# AWS CLI Deployment Script for CSEC Schedule API
# This script deploys the infrastructure and Lambda function using AWS CLI

param(
    [string]$StackName = "csec-schedule-api",
    [string]$BucketName = "csec-schedule-api",
    [string]$LambdaFunctionName = "csec-schedule-updater",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CSEC Schedule API - AWS Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if AWS CLI is installed
Write-Host "Checking AWS CLI..." -ForegroundColor Yellow
try {
    $awsVersion = aws --version
    Write-Host "OK - AWS CLI found: $awsVersion" -ForegroundColor Green
} catch {
        Write-Host "ERROR - AWS CLI not found. Please install AWS CLI first." -ForegroundColor Red
    exit 1
}

# Check AWS credentials
Write-Host "Checking AWS credentials..." -ForegroundColor Yellow
try {
    $callerIdentity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
        exit 1
    }
    $accountId = ($callerIdentity | ConvertFrom-Json).Account
    Write-Host "OK - AWS credentials configured (Account: $accountId)" -ForegroundColor Green
} catch {
    Write-Host "✗ AWS credentials not configured. Run 'aws configure' first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 1: Create CloudFormation Stack
Write-Host "Step 1: Creating CloudFormation stack..." -ForegroundColor Yellow
Write-Host "Stack Name: $StackName" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host ""

$stackExists = aws cloudformation describe-stacks --stack-name $StackName --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Stack already exists. Updating..." -ForegroundColor Yellow
    aws cloudformation update-stack `
        --stack-name $StackName `
        --template-body file://infrastructure/cloudformation.yaml `
        --capabilities CAPABILITY_NAMED_IAM `
        --region $Region `
        --parameters ParameterKey=BucketName,ParameterValue=$BucketName ParameterKey=LambdaFunctionName,ParameterValue=$LambdaFunctionName
    
    if ($LASTEXITCODE -ne 0) {
        $errorOutput = $stackExists
        if ($errorOutput -match "No updates are to be performed") {
            Write-Host "OK - No updates needed for stack" -ForegroundColor Green
        } else {
            Write-Host "ERROR - Failed to update stack" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "OK - Stack update initiated. Waiting for completion..." -ForegroundColor Green
        aws cloudformation wait stack-update-complete --stack-name $StackName --region $Region
        Write-Host "OK - Stack updated successfully" -ForegroundColor Green
    }
} else {
    Write-Host "Creating new stack..." -ForegroundColor Yellow
    aws cloudformation create-stack `
        --stack-name $StackName `
        --template-body file://infrastructure/cloudformation.yaml `
        --capabilities CAPABILITY_NAMED_IAM `
        --region $Region `
        --parameters ParameterKey=BucketName,ParameterValue=$BucketName ParameterKey=LambdaFunctionName,ParameterValue=$LambdaFunctionName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Failed to create stack" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Stack creation initiated. Waiting for completion..." -ForegroundColor Green
    aws cloudformation wait stack-create-complete --stack-name $StackName --region $Region
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Stack creation failed or timed out" -ForegroundColor Red
        Write-Host "Check CloudFormation console for details" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "OK - Stack created successfully" -ForegroundColor Green
}

Write-Host ""

# Step 2: Package Lambda function
Write-Host "Step 2: Packaging Lambda function..." -ForegroundColor Yellow
$ZipFile = "lambda-deployment.zip"

# Remove existing zip if it exists
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

# Install dependencies
Write-Host "Installing Lambda dependencies..." -ForegroundColor Cyan
Set-Location lambda
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
npm install --production
if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Failed to install dependencies" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Create zip file
Write-Host "Creating deployment package..." -ForegroundColor Cyan
Set-Location lambda
Compress-Archive -Path * -DestinationPath "..\$ZipFile" -Force
Set-Location ..

if (-not (Test-Path $ZipFile)) {
        Write-Host "ERROR - Failed to create deployment package" -ForegroundColor Red
    exit 1
}

$zipSize = (Get-Item $ZipFile).Length / 1MB
$zipSizeMB = [math]::Round($zipSize, 2)
Write-Host "[OK] Deployment package created ($zipSizeMB MB)" -ForegroundColor Green

Write-Host ""

# Step 3: Deploy Lambda function code
Write-Host "Step 3: Deploying Lambda function code..." -ForegroundColor Yellow
Write-Host "Function Name: $LambdaFunctionName" -ForegroundColor Cyan
Write-Host ""

aws lambda update-function-code `
    --function-name $LambdaFunctionName `
    --zip-file fileb://$ZipFile `
    --region $Region

if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR - Failed to update Lambda function" -ForegroundColor Red
    Write-Host "Note: If this is the first deployment, the function may not exist yet." -ForegroundColor Yellow
    Write-Host "The CloudFormation template should have created it. Please check the stack status." -ForegroundColor Yellow
    Remove-Item $ZipFile -Force
    exit 1
}

Write-Host "OK - Lambda function code updated" -ForegroundColor Green

# Wait for function to be ready
Write-Host "Waiting for function to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host ""

# Step 4: Update Lambda environment variables
Write-Host "Step 4: Updating Lambda environment variables..." -ForegroundColor Yellow
$envVarsObj = @{
    Variables = @{
        S3_BUCKET_NAME = $BucketName
        S3_KEY = "schedule.json"
        AWS_REGION = $Region
    }
}
$envVarsJson = ($envVarsObj | ConvertTo-Json -Compress -Depth 10)
aws lambda update-function-configuration `
    --function-name $LambdaFunctionName `
    --environment $envVarsJson `
    --region $Region

if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING - Failed to update environment variables" -ForegroundColor Yellow
} else {
        Write-Host "OK - Environment variables updated" -ForegroundColor Green
}

Write-Host ""

# Step 5: Test Lambda function
Write-Host "Step 5: Testing Lambda function..." -ForegroundColor Yellow
$testResponse = "lambda-test-response.json"
if (Test-Path $testResponse) {
    Remove-Item $testResponse -Force
}

aws lambda invoke `
    --function-name $LambdaFunctionName `
    --payload '{}' `
    --region $Region `
    $testResponse

if ($LASTEXITCODE -eq 0) {
    $response = Get-Content $testResponse | ConvertFrom-Json
    if ($response.statusCode -eq 200) {
        Write-Host "OK - Lambda function test successful" -ForegroundColor Green
        Write-Host "Response: $($response.body)" -ForegroundColor Cyan
    } else {
        Write-Host "WARNING - Lambda function returned error: $($response.body)" -ForegroundColor Yellow
    }
    Remove-Item $testResponse -Force
} else {
        Write-Host "WARNING - Failed to test Lambda function" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Get S3 URL
Write-Host "Step 6: Getting S3 bucket URL..." -ForegroundColor Yellow
$s3Url = "https://$BucketName.s3.amazonaws.com/schedule.json"
Write-Host "OK - Schedule data will be available at:" -ForegroundColor Green
Write-Host "  $s3Url" -ForegroundColor Cyan

Write-Host ""

# Cleanup
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $ZipFile -Force
Write-Host "OK - Cleanup complete" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check CloudWatch Logs: /aws/lambda/$LambdaFunctionName" -ForegroundColor Cyan
Write-Host "2. Access schedule data: $s3Url" -ForegroundColor Cyan
Write-Host "3. Lambda will run automatically every hour" -ForegroundColor Cyan
Write-Host ""


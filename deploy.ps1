# PowerShell deployment script for CSEC Schedule API Lambda function
# This script packages and deploys the Lambda function to AWS

param(
    [string]$LambdaFunctionName = "csec-schedule-updater",
    [string]$S3BucketName = "csec-schedule-api",
    [string]$AwsRegion = "us-east-1"
)

$ErrorActionPreference = "Stop"

Write-Host "Starting deployment..." -ForegroundColor Green

# Step 1: Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Set-Location lambda
npm install --production
Set-Location ..

# Step 2: Create deployment package
Write-Host "Creating deployment package..." -ForegroundColor Yellow
$ZipFile = "lambda-deployment.zip"

# Remove existing zip if it exists
if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

# Create zip file
Set-Location lambda
Compress-Archive -Path * -DestinationPath "..\$ZipFile" -Force
Set-Location ..

# Step 3: Deploy to AWS Lambda
Write-Host "Deploying to AWS Lambda..." -ForegroundColor Yellow
aws lambda update-function-code `
    --function-name $LambdaFunctionName `
    --zip-file fileb://$ZipFile `
    --region $AwsRegion

# Step 4: Update environment variables
Write-Host "Updating Lambda environment variables..." -ForegroundColor Yellow
aws lambda update-function-configuration `
    --function-name $LambdaFunctionName `
    --environment "Variables={S3_BUCKET_NAME=$S3BucketName,S3_KEY=schedule.json}" `
    --region $AwsRegion

# Step 5: Clean up
Write-Host "Cleaning up..." -ForegroundColor Yellow
Remove-Item $ZipFile -Force

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Lambda function: $LambdaFunctionName" -ForegroundColor Cyan
Write-Host "S3 bucket: $S3BucketName" -ForegroundColor Cyan


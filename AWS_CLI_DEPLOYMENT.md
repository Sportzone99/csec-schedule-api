# AWS CLI Deployment Guide

This guide walks you through deploying the CSEC Schedule API to AWS using the AWS CLI.

## Prerequisites

1. **AWS CLI installed**: Check with `aws --version`
2. **AWS credentials configured**: Run `aws configure` if not already done
3. **Appropriate AWS permissions**:
   - CloudFormation (create/update stacks)
   - S3 (create buckets, upload files)
   - Lambda (create/update functions)
   - IAM (create roles and policies)
   - CloudWatch Events (create rules)

## Quick Deployment (Automated Script)

### Windows PowerShell:
```powershell
.\deploy-aws-cli.ps1
```

### With Custom Parameters:
```powershell
.\deploy-aws-cli.ps1 -StackName "my-schedule-api" -BucketName "my-bucket" -Region "us-west-2"
```

## Manual Deployment Steps

### Step 1: Create CloudFormation Stack

```powershell
aws cloudformation create-stack `
  --stack-name csec-schedule-api `
  --template-body file://infrastructure/cloudformation.yaml `
  --capabilities CAPABILITY_NAMED_IAM `
  --region ca-central-1 `
  --parameters ParameterKey=BucketName,ParameterValue=csec-schedule-api ParameterKey=LambdaFunctionName,ParameterValue=csec-schedule-updater
```

**Wait for stack creation:**
```powershell
aws cloudformation wait stack-create-complete --stack-name csec-schedule-api --region us-east-1
```

**Check stack status:**
```powershell
aws cloudformation describe-stacks --stack-name csec-schedule-api --query 'Stacks[0].StackStatus' --region us-east-1
```

### Step 2: Package Lambda Function

```powershell
# Install dependencies
cd lambda
npm install --production
cd ..

# Create deployment package
Compress-Archive -Path lambda\* -DestinationPath lambda-deployment.zip -Force
```

### Step 3: Deploy Lambda Code

```powershell
aws lambda update-function-code `
  --function-name csec-schedule-updater `
  --zip-file fileb://lambda-deployment.zip `
  --region ca-central-1
```

### Step 4: Update Lambda Environment Variables

```powershell
aws lambda update-function-configuration `
  --function-name csec-schedule-updater `
  --environment "Variables={S3_BUCKET_NAME=csec-schedule-api,S3_KEY=schedule.json,AWS_REGION=ca-central-1}" `
  --region ca-central-1
```

### Step 5: Test Lambda Function

```powershell
aws lambda invoke `
  --function-name csec-schedule-updater `
  --payload '{}' `
  --region ca-central-1 `
  response.json

# View response
Get-Content response.json | ConvertFrom-Json
```

### Step 6: Verify S3 File

```powershell
# Check if file exists
aws s3 ls s3://csec-schedule-api/schedule.json

# Download and view
aws s3 cp s3://csec-schedule-api/schedule.json schedule.json
Get-Content schedule.json | ConvertFrom-Json
```

## Verify Deployment

### Check CloudFormation Stack
```powershell
aws cloudformation describe-stacks --stack-name csec-schedule-api --region us-east-1
```

### Check Lambda Function
```powershell
aws lambda get-function --function-name csec-schedule-updater --region us-east-1
```

### Check CloudWatch Events Rule
```powershell
aws events describe-rule --name csec-schedule-hourly-trigger --region us-east-1
```

### View Lambda Logs
```powershell
aws logs tail /aws/lambda/csec-schedule-updater --follow --region us-east-1
```

## Access Schedule Data

Once deployed, the schedule data is available at:

```
https://csec-schedule-api.s3.amazonaws.com/schedule.json
```

## Updating the Lambda Function

When you make code changes:

```powershell
# 1. Update code locally
# 2. Commit to git
git add .
git commit -m "Update: description of changes"
git push

# 3. Package and deploy
cd lambda
npm install --production
cd ..
Compress-Archive -Path lambda\* -DestinationPath lambda-deployment.zip -Force

aws lambda update-function-code `
  --function-name csec-schedule-updater `
  --zip-file fileb://lambda-deployment.zip `
  --region ca-central-1
```

Or use the automated script:
```powershell
.\deploy-aws-cli.ps1
```

## Troubleshooting

### Stack Creation Fails

**Check stack events:**
```powershell
aws cloudformation describe-stack-events --stack-name csec-schedule-api --region us-east-1
```

**Common issues:**
- Bucket name already exists (choose a different name)
- IAM permissions insufficient
- Region-specific issues

### Lambda Function Not Found

If you get "Function not found" error:
1. Check CloudFormation stack completed successfully
2. Verify function name matches: `csec-schedule-updater`
3. Check region is correct

### Lambda Function Fails

**Check logs:**
```powershell
aws logs tail /aws/lambda/csec-schedule-updater --follow --region us-east-1
```

**Common issues:**
- Missing environment variables
- S3 permissions
- Network timeout (increase Lambda timeout)

### S3 File Not Accessible

**Check bucket policy:**
```powershell
aws s3api get-bucket-policy --bucket csec-schedule-api --region us-east-1
```

**Check public access block:**
```powershell
aws s3api get-public-access-block --bucket csec-schedule-api --region us-east-1
```

## Cleanup

To remove all resources:

```powershell
# Delete CloudFormation stack (removes all resources)
aws cloudformation delete-stack --stack-name csec-schedule-api --region us-east-1

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name csec-schedule-api --region us-east-1
```

## Cost Monitoring

**Check Lambda invocations:**
```powershell
aws cloudwatch get-metric-statistics `
  --namespace AWS/Lambda `
  --metric-name Invocations `
  --dimensions Name=FunctionName,Value=csec-schedule-updater `
  --start-time (Get-Date).AddDays(-7).ToString("yyyy-MM-ddTHH:mm:ss") `
  --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
  --period 3600 `
  --statistics Sum `
  --region ca-central-1
```

## Next Steps

1. Set up CloudWatch alarms for errors
2. Configure custom domain for S3 bucket (optional)
3. Set up API Gateway if needed (optional)
4. Monitor costs and usage

For more details, see `DEPLOYMENT.md` or `QUICKSTART.md`.


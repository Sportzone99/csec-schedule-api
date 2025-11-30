# Complete CloudFront Deployment Guide

Step-by-step instructions to deploy CSEC Schedule API with CloudFront.

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Node.js installed
- AWS account with appropriate permissions

---

## Step 1: Create S3 Bucket

```powershell
aws s3 mb s3://csec-schedule-api --region ca-central-1
```

**Verify:**
```powershell
aws s3 ls
```

---

## Step 2: Create IAM Role for Lambda

### 2a. Create Trust Policy File

```powershell
@"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
"@ | Out-File -FilePath trust-policy.json -Encoding utf8
```

### 2b. Create IAM Role

```powershell
aws iam create-role --role-name csec-schedule-lambda-role --assume-role-policy-document file://trust-policy.json
```

### 2c. Attach Basic Execution Policy

```powershell
aws iam attach-role-policy --role-name csec-schedule-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 2d. Create S3 Access Policy

```powershell
@"
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:PutObjectAcl", "s3:GetObject"],
    "Resource": "arn:aws:s3:::csec-schedule-api/*"
  }]
}
"@ | Out-File -FilePath s3-policy.json -Encoding utf8

aws iam put-role-policy --role-name csec-schedule-lambda-role --policy-name S3Access --policy-document file://s3-policy.json
```

### 2e. Get Role ARN

```powershell
$accountId = (aws sts get-caller-identity | ConvertFrom-Json).Account
$roleArn = "arn:aws:iam::${accountId}:role/csec-schedule-lambda-role"
Write-Host "Role ARN: $roleArn"
```

**Save the Role ARN - you'll need it in Step 4**

---

## Step 3: Package Lambda Function

### 3a. Install Dependencies

```powershell
cd lambda
npm install --production
cd ..
```

### 3b. Create Deployment Package

```powershell
Compress-Archive -Path lambda\* -DestinationPath lambda-deployment.zip -Force
```

**Verify:**
```powershell
Test-Path lambda-deployment.zip
```

---

## Step 4: Create Lambda Function

**Replace `YOUR_ROLE_ARN` with the ARN from Step 2e**

```powershell
aws lambda create-function `
  --function-name csec-schedule-updater `
  --runtime nodejs20.x `
  --role YOUR_ROLE_ARN `
  --handler index.handler `
  --zip-file fileb://lambda-deployment.zip `
  --timeout 60 `
  --memory-size 256 `
  --environment Variables="{S3_BUCKET_NAME=csec-schedule-api,S3_KEY=schedule.json,AWS_REGION=ca-central-1}"
```

**Verify:**
```powershell
aws lambda get-function --function-name csec-schedule-updater --query 'Configuration.FunctionName'
```

---

## Step 5: Create CloudWatch Events Rule (Hourly Trigger)

### 5a. Create Rule

```powershell
aws events put-rule --name csec-schedule-hourly-trigger --schedule-expression "rate(1 hour)" --state ENABLED
```

### 5b. Get Lambda ARN

```powershell
$lambdaArn = aws lambda get-function --function-name csec-schedule-updater --query 'Configuration.FunctionArn' --output text
Write-Host "Lambda ARN: $lambdaArn"
```

### 5c. Add Lambda as Target

```powershell
aws events put-targets --rule csec-schedule-hourly-trigger --targets "Id=1,Arn=$lambdaArn"
```

### 5d. Grant Permission

```powershell
$ruleArn = aws events describe-rule --name csec-schedule-hourly-trigger --query 'Arn' --output text
aws lambda add-permission --function-name csec-schedule-updater --statement-id allow-cloudwatch-events --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn $ruleArn
```

---

## Step 6: Test Lambda Function

```powershell
aws lambda invoke --function-name csec-schedule-updater --payload '{}' response.json
Get-Content response.json
```

**Expected:** Should see success message with game count.

**Verify S3 file was created:**
```powershell
aws s3 ls s3://csec-schedule-api/schedule.json
```

---

## Step 7: Create CloudFront Origin Access Control (OAC)

```powershell
aws cloudfront create-origin-access-control --origin-access-control-config '{
  "Name": "csec-schedule-oac",
  "OriginAccessControlOriginType": "s3",
  "SigningBehavior": "always",
  "SigningProtocol": "sigv4"
}'
```

**Save the `Id` from the response - you'll need it in Step 8**

**Example response:**
```json
{
  "OriginAccessControl": {
    "Id": "E1234567890ABC",
    ...
  }
}
```

---

## Step 8: Create CloudFront Distribution

**Replace `YOUR_OAC_ID` with the Id from Step 7**

```powershell
$callerRef = (New-Guid).ToString()
$distConfig = @{
  CallerReference = $callerRef
  Comment = "CSEC Schedule API"
  DefaultRootObject = "schedule.json"
  Origins = @{
    Quantity = 1
    Items = @(
      @{
        Id = "csec-schedule-api"
        DomainName = "csec-schedule-api.s3.ca-central-1.amazonaws.com"
        OriginAccessControlId = "YOUR_OAC_ID"
      }
    )
  }
  DefaultCacheBehavior = @{
    TargetOriginId = "csec-schedule-api"
    ViewerProtocolPolicy = "redirect-to-https"
    AllowedMethods = @{
      Quantity = 2
      Items = @("GET", "HEAD")
      CachedMethods = @{
        Quantity = 2
        Items = @("GET", "HEAD")
      }
    }
    ForwardedValues = @{
      QueryString = $false
      Cookies = @{ Forward = "none" }
    }
    MinTTL = 0
    DefaultTTL = 3600
    MaxTTL = 86400
    Compress = $true
  }
  Enabled = $true
  PriceClass = "PriceClass_100"
} | ConvertTo-Json -Depth 10

$distConfig | Out-File -FilePath dist-config.json -Encoding utf8
aws cloudfront create-distribution --distribution-config file://dist-config.json
Remove-Item dist-config.json
```

**Save the `Id` and `DomainName` from the response**

**Example response:**
```json
{
  "Distribution": {
    "Id": "E1234567890XYZ",
    "DomainName": "d1234567890abc.cloudfront.net",
    ...
  }
}
```

**Note:** Distribution takes 10-15 minutes to deploy. Status will be "InProgress" initially.

---

## Step 9: Update S3 Bucket Policy for CloudFront

**Replace `YOUR_ACCOUNT_ID` and `YOUR_DISTRIBUTION_ID` with actual values**

```powershell
$accountId = (aws sts get-caller-identity | ConvertFrom-Json).Account
$distributionId = "YOUR_DISTRIBUTION_ID"

$bucketPolicy = @{
  Version = "2012-10-17"
  Statement = @(
    @{
      Sid = "AllowCloudFrontServicePrincipal"
      Effect = "Allow"
      Principal = @{
        Service = "cloudfront.amazonaws.com"
      }
      Action = "s3:GetObject"
      Resource = "arn:aws:s3:::csec-schedule-api/*"
      Condition = @{
        StringEquals = @{
          "AWS:SourceArn" = "arn:aws:cloudfront::${accountId}:distribution/${distributionId}"
        }
      }
    }
  )
} | ConvertTo-Json -Depth 10

$bucketPolicy | Out-File -FilePath bucket-policy.json -Encoding utf8
aws s3api put-bucket-policy --bucket csec-schedule-api --policy file://bucket-policy.json
Remove-Item bucket-policy.json
```

---

## Step 10: Wait for CloudFront Deployment

**Check distribution status:**
```powershell
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID --query 'Distribution.Status'
```

**Wait until status is "Deployed" (takes 10-15 minutes)**

**Monitor progress:**
```powershell
# Check every minute
while ($true) {
  $status = aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID --query 'Distribution.Status' --output text
  Write-Host "Status: $status - $(Get-Date)"
  if ($status -eq "Deployed") { break }
  Start-Sleep -Seconds 60
}
```

---

## Step 11: Verify Deployment

### 11a. Test CloudFront URL

**Replace `YOUR_DOMAIN_NAME` with the DomainName from Step 8**

```powershell
curl https://YOUR_DOMAIN_NAME/schedule.json
```

**Or in browser:**
```
https://YOUR_DOMAIN_NAME/schedule.json
```

### 11b. Verify Data Structure

The response should include:
- `success: true`
- `count: [number]`
- `lastUpdated: [timestamp]`
- `data: [array of games]`

---

## Step 12: Clean Up Temporary Files

```powershell
Remove-Item trust-policy.json -ErrorAction SilentlyContinue
Remove-Item s3-policy.json -ErrorAction SilentlyContinue
Remove-Item lambda-deployment.zip -ErrorAction SilentlyContinue
Remove-Item response.json -ErrorAction SilentlyContinue
```

---

## Summary

✅ **S3 Bucket**: `csec-schedule-api` (private)

✅ **Lambda Function**: `csec-schedule-updater` (runs every hour)

✅ **CloudFront URL**: `https://YOUR_DOMAIN_NAME/schedule.json`

✅ **Update Frequency**: Every hour automatically

---

## Troubleshooting

### Lambda not updating S3?
```powershell
# Check logs
aws logs tail /aws/lambda/csec-schedule-updater --follow
```

### CloudFront not accessible?
- Wait for deployment to complete (10-15 minutes)
- Verify bucket policy allows CloudFront
- Check distribution status: `aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID`

### S3 file not found?
```powershell
# Manually trigger Lambda
aws lambda invoke --function-name csec-schedule-updater --payload '{}' test.json
```

---

## Updating Lambda Code

When you make code changes:

```powershell
# 1. Update code locally
# 2. Package
cd lambda
npm install --production
cd ..
Compress-Archive -Path lambda\* -DestinationPath lambda-deployment.zip -Force

# 3. Deploy
aws lambda update-function-code --function-name csec-schedule-updater --zip-file fileb://lambda-deployment.zip
```

---

## Quick Reference Commands

**Get Distribution ID:**
```powershell
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='CSEC Schedule API'].Id" --output text
```

**Get Distribution Domain:**
```powershell
aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='CSEC Schedule API'].DomainName" --output text
```

**Check Lambda Logs:**
```powershell
aws logs tail /aws/lambda/csec-schedule-updater --follow
```

**Manually Trigger Lambda:**
```powershell
aws lambda invoke --function-name csec-schedule-updater --payload '{}' response.json
```


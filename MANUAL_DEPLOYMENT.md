# Manual AWS CLI Deployment Guide

**Purpose**: Step-by-step AWS CLI commands to deploy manually. These commands work on Windows (PowerShell/CMD), Linux, and Mac.

**Note**: This guide uses CloudFront (recommended). For a simpler public S3 setup, see the alternative commands below.

---

## Step 1: Create S3 Bucket

```bash
aws s3 mb s3://csec-schedule-api --region ca-central-1
```

**Verify:**
```bash
aws s3 ls
```

---

## Step 2: Create IAM Role for Lambda

### 2a. Create Trust Policy File

Create `trust-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

### 2b. Create IAM Role

```bash
aws iam create-role --role-name csec-schedule-lambda-role --assume-role-policy-document file://trust-policy.json
```

### 2c. Attach Basic Execution Policy

```bash
aws iam attach-role-policy --role-name csec-schedule-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 2d. Create S3 Access Policy

Create `s3-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:PutObjectAcl", "s3:GetObject"],
    "Resource": "arn:aws:s3:::csec-schedule-api/*"
  }]
}
```

```bash
aws iam put-role-policy --role-name csec-schedule-lambda-role --policy-name S3Access --policy-document file://s3-policy.json
```

### 2e. Get Role ARN

```bash
# Get account ID
aws sts get-caller-identity --query Account --output text

# Role ARN format: arn:aws:iam::ACCOUNT_ID:role/csec-schedule-lambda-role
# Replace ACCOUNT_ID with your account ID
```

---

## Step 3: Package Lambda Function

```bash
# Install dependencies
cd lambda
npm install --production
cd ..

# Create zip file
# Windows PowerShell:
Compress-Archive -Path lambda\* -DestinationPath lambda-deployment.zip -Force

# Linux/Mac:
zip -r lambda-deployment.zip lambda/
```

---

## Step 4: Create Lambda Function

**Replace `ACCOUNT_ID` with your AWS account ID from Step 2e**

```bash
aws lambda create-function \
  --function-name csec-schedule-updater \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/csec-schedule-lambda-role \
  --handler index.handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 60 \
  --memory-size 256 \
  --environment Variables="{S3_BUCKET_NAME=csec-schedule-api,S3_KEY=schedule.json,AWS_REGION=ca-central-1}"
```

**Verify:**
```bash
aws lambda get-function --function-name csec-schedule-updater --query 'Configuration.FunctionName'
```

---

## Step 5: Create CloudWatch Events Rule (Hourly Trigger)

### 5a. Create Rule

```bash
aws events put-rule --name csec-schedule-hourly-trigger --schedule-expression "rate(1 hour)" --state ENABLED
```

### 5b. Get Lambda ARN

```bash
aws lambda get-function --function-name csec-schedule-updater --query 'Configuration.FunctionArn' --output text
```

### 5c. Add Lambda as Target

**Replace `LAMBDA_ARN` with the ARN from Step 5b**

```bash
aws events put-targets --rule csec-schedule-hourly-trigger --targets "Id=1,Arn=LAMBDA_ARN"
```

### 5d. Grant Permission

```bash
RULE_ARN=$(aws events describe-rule --name csec-schedule-hourly-trigger --query 'Arn' --output text)
aws lambda add-permission --function-name csec-schedule-updater --statement-id allow-cloudwatch-events --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn $RULE_ARN
```

---

## Step 6: Test Lambda Function

```bash
aws lambda invoke --function-name csec-schedule-updater --payload '{}' response.json
cat response.json
```

**Verify S3 file was created:**
```bash
aws s3 ls s3://csec-schedule-api/schedule.json
```

---

## Step 7: Create CloudFront Origin Access Control (OAC)

```bash
aws cloudfront create-origin-access-control --origin-access-control-config '{
  "Name": "csec-schedule-oac",
  "OriginAccessControlOriginType": "s3",
  "SigningBehavior": "always",
  "SigningProtocol": "sigv4"
}'
```

**Save the `Id` from the response - you'll need it in Step 8**

---

## Step 8: Create CloudFront Distribution

**Replace `YOUR_OAC_ID` with the Id from Step 7**

Create `dist-config.json`:
```json
{
  "CallerReference": "unique-reference-here",
  "Comment": "CSEC Schedule API",
  "DefaultRootObject": "schedule.json",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "csec-schedule-api",
      "DomainName": "csec-schedule-api.s3.ca-central-1.amazonaws.com",
      "OriginAccessControlId": "YOUR_OAC_ID"
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "csec-schedule-api",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {"Forward": "none"}
    },
    "MinTTL": 0,
    "DefaultTTL": 3600,
    "MaxTTL": 86400,
    "Compress": true
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
```

```bash
aws cloudfront create-distribution --distribution-config file://dist-config.json
```

**Save the `Id` and `DomainName` from the response**

**Note:** Distribution takes 10-15 minutes to deploy.

---

## Step 9: Update S3 Bucket Policy for CloudFront

**Replace `ACCOUNT_ID` and `DISTRIBUTION_ID` with actual values**

Create `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontServicePrincipal",
    "Effect": "Allow",
    "Principal": {
      "Service": "cloudfront.amazonaws.com"
    },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::csec-schedule-api/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
      }
    }
  }]
}
```

```bash
aws s3api put-bucket-policy --bucket csec-schedule-api --policy file://bucket-policy.json
```

---

## Step 10: Wait for CloudFront Deployment

**Check distribution status:**
```bash
aws cloudfront get-distribution --id DISTRIBUTION_ID --query 'Distribution.Status'
```

**Wait until status is "Deployed" (takes 10-15 minutes)**

---

## Step 11: Verify Deployment

**Replace `YOUR_DOMAIN_NAME` with the DomainName from Step 8**

```bash
curl https://YOUR_DOMAIN_NAME/schedule.json
```

---

## Step 12: Clean Up Temporary Files

```bash
rm trust-policy.json s3-policy.json dist-config.json bucket-policy.json lambda-deployment.zip response.json
```

---

## Alternative: Public S3 Bucket (No CloudFront)

If you prefer direct S3 access without CloudFront:

### After Step 1, instead of Steps 7-10:

```bash
# Create bucket policy for public read
aws s3api put-bucket-policy --bucket csec-schedule-api --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::csec-schedule-api/*"
  }]
}'

# Remove public access block
aws s3api put-public-access-block --bucket csec-schedule-api --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

**Then access via:** `https://csec-schedule-api.s3.ca-central-1.amazonaws.com/schedule.json`

---

## Summary

✅ **S3 Bucket**: `csec-schedule-api` (private with CloudFront)

✅ **Lambda Function**: `csec-schedule-updater` (runs every hour)

✅ **CloudFront URL**: `https://YOUR_DOMAIN_NAME/schedule.json`

✅ **Update Frequency**: Every hour automatically

---

## Document Purpose

This document provides **manual AWS CLI commands** that work on any platform (Windows, Linux, Mac). All commands use standard AWS CLI syntax with JSON files for complex configurations.

**For automated scripts**, see:
- `deploy-aws-cli.ps1` - PowerShell automation script
- `cloudfront-setup.ps1` - CloudFront setup script
- `DEPLOY_CLOUDFRONT.md` - Detailed CloudFront guide with PowerShell examples

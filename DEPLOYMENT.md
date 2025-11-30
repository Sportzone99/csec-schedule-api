# Deployment Guide for CSEC Schedule API

This guide will help you deploy the CSEC Schedule API to AWS using S3 and Lambda.

## Prerequisites

1. **AWS CLI** installed and configured with appropriate credentials
2. **Node.js** and **npm** installed
3. **AWS Account** with permissions to create:
   - S3 buckets
   - Lambda functions
   - IAM roles and policies
   - CloudWatch Events rules

## Architecture

- **S3 Bucket**: Stores the `schedule.json` file with unified schedule data
- **Lambda Function**: Fetches data from NHL, WHL, and AHL APIs, processes it, and uploads to S3
- **CloudWatch Events**: Triggers the Lambda function every hour
- **Public Access**: The S3 bucket is configured for public read access to `schedule.json`

## Deployment Steps

### Option 1: Using CloudFormation (Recommended)

1. **Create the CloudFormation stack**:
   ```bash
   aws cloudformation create-stack \
     --stack-name csec-schedule-api \
     --template-body file://infrastructure/cloudformation.yaml \
     --parameters ParameterKey=BucketName,ParameterValue=csec-schedule-api \
                  ParameterKey=LambdaFunctionName,ParameterValue=csec-schedule-updater \
     --capabilities CAPABILITY_NAMED_IAM
   ```

2. **Wait for stack creation** (takes a few minutes):
   ```bash
   aws cloudformation wait stack-create-complete --stack-name csec-schedule-api
   ```

3. **Package and deploy Lambda code**:
   ```bash
   # On Windows (PowerShell)
   .\deploy.ps1
   
   # On Linux/Mac
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Test the Lambda function**:
   ```bash
   aws lambda invoke \
     --function-name csec-schedule-updater \
     --payload '{}' \
     response.json
   ```

5. **Verify S3 file**:
   ```bash
   aws s3 ls s3://csec-schedule-api/
   curl https://csec-schedule-api.s3.amazonaws.com/schedule.json
   ```

### Option 2: Manual Deployment

#### Step 1: Create S3 Bucket

```bash
aws s3 mb s3://csec-schedule-api --region us-east-1
```

#### Step 2: Configure S3 Bucket for Public Access

```bash
# Create bucket policy
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::csec-schedule-api/*"
    }
  ]
}
EOF

# Apply bucket policy
aws s3api put-bucket-policy --bucket csec-schedule-api --policy file://bucket-policy.json

# Enable public access
aws s3api put-public-access-block \
  --bucket csec-schedule-api \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

#### Step 3: Create IAM Role for Lambda

```bash
# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name csec-schedule-lambda-role \
  --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name csec-schedule-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach S3 access policy
cat > s3-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::csec-schedule-api/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name csec-schedule-lambda-role \
  --policy-name S3Access \
  --policy-document file://s3-policy.json
```

#### Step 4: Create Lambda Function

```bash
# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name csec-schedule-lambda-role --query 'Role.Arn' --output text)

# Package Lambda code
cd lambda
npm install --production
zip -r ../lambda-deployment.zip . -x "*.git*" "*.DS_Store"
cd ..

# Create Lambda function
aws lambda create-function \
  --function-name csec-schedule-updater \
  --runtime nodejs20.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://lambda-deployment.zip \
  --timeout 60 \
  --memory-size 256 \
  --environment Variables="{S3_BUCKET_NAME=csec-schedule-api,S3_KEY=schedule.json}"
```

#### Step 5: Create CloudWatch Events Rule

```bash
# Create rule
aws events put-rule \
  --name csec-schedule-hourly-trigger \
  --schedule-expression "rate(1 hour)" \
  --state ENABLED

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function --function-name csec-schedule-updater --query 'Configuration.FunctionArn' --output text)

# Add Lambda as target
aws events put-targets \
  --rule csec-schedule-hourly-trigger \
  --targets "Id=1,Arn=$LAMBDA_ARN"

# Grant permission for Events to invoke Lambda
aws lambda add-permission \
  --function-name csec-schedule-updater \
  --statement-id allow-cloudwatch-events \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn $(aws events describe-rule --name csec-schedule-hourly-trigger --query 'Arn' --output text)
```

#### Step 6: Test Lambda Function

```bash
aws lambda invoke \
  --function-name csec-schedule-updater \
  --payload '{}' \
  response.json

cat response.json
```

## Updating the Lambda Function

When you need to update the Lambda function code:

```bash
# On Windows (PowerShell)
.\deploy.ps1

# On Linux/Mac
./deploy.sh
```

Or manually:

```bash
cd lambda
npm install --production
zip -r ../lambda-deployment.zip . -x "*.git*" "*.DS_Store"
cd ..

aws lambda update-function-code \
  --function-name csec-schedule-updater \
  --zip-file fileb://lambda-deployment.zip
```

## Accessing the Schedule Data

Once deployed, the schedule data will be available at:

```
https://csec-schedule-api.s3.amazonaws.com/schedule.json
```

Or if you set up a custom domain:

```
https://your-domain.com/schedule.json
```

## Monitoring

- **CloudWatch Logs**: Check `/aws/lambda/csec-schedule-updater` for Lambda execution logs
- **CloudWatch Metrics**: Monitor Lambda invocations, errors, and duration
- **S3**: Check the `lastUpdated` field in `schedule.json` to verify updates

## Troubleshooting

1. **Lambda function not updating S3**:
   - Check CloudWatch Logs for errors
   - Verify IAM role has S3 permissions
   - Check environment variables are set correctly

2. **S3 file not publicly accessible**:
   - Verify bucket policy allows public read
   - Check public access block settings
   - Ensure CORS is configured if needed

3. **CloudWatch Events not triggering**:
   - Verify rule is enabled
   - Check Lambda permissions allow Events to invoke
   - Verify rule targets are configured correctly

## Cost Estimation

- **S3**: ~$0.023 per GB storage + $0.0004 per 1,000 requests
- **Lambda**: Free tier includes 1M requests/month, then $0.20 per 1M requests
- **CloudWatch**: Free tier includes 5GB logs/month
- **Estimated monthly cost**: < $1 for typical usage

## Cleanup

To remove all resources:

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name csec-schedule-api

# Or manually delete:
aws lambda delete-function --function-name csec-schedule-updater
aws events delete-rule --name csec-schedule-hourly-trigger
aws s3 rb s3://csec-schedule-api --force
aws iam delete-role-policy --role-name csec-schedule-lambda-role --policy-name S3Access
aws iam detach-role-policy --role-name csec-schedule-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name csec-schedule-lambda-role
```


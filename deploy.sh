#!/bin/bash

# Deployment script for CSEC Schedule API Lambda function
# This script packages and deploys the Lambda function to AWS

set -e

echo "Starting deployment..."

# Configuration
LAMBDA_FUNCTION_NAME="${LAMBDA_FUNCTION_NAME:-csec-schedule-updater}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-csec-schedule-api}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ZIP_FILE="lambda-deployment.zip"

# Step 1: Install dependencies
echo "Installing dependencies..."
cd lambda
npm install --production
cd ..

# Step 2: Create deployment package
echo "Creating deployment package..."
cd lambda
zip -r ../${ZIP_FILE} . -x "*.git*" "*.DS_Store" "node_modules/.bin/*"
cd ..

# Step 3: Deploy to AWS Lambda
echo "Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --zip-file fileb://${ZIP_FILE} \
  --region ${AWS_REGION}

# Step 4: Update environment variables
echo "Updating Lambda environment variables..."
aws lambda update-function-configuration \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --environment "Variables={S3_BUCKET_NAME=${S3_BUCKET_NAME},S3_KEY=schedule.json}" \
  --region ${AWS_REGION}

# Step 5: Clean up
echo "Cleaning up..."
rm -f ${ZIP_FILE}

echo "Deployment complete!"
echo "Lambda function: ${LAMBDA_FUNCTION_NAME}"
echo "S3 bucket: ${S3_BUCKET_NAME}"


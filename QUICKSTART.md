# Quick Start Guide - Deploy to AWS

This is a quick guide to get your CSEC Schedule API deployed to AWS S3 with hourly updates.

## Prerequisites

1. AWS CLI installed: `aws --version`
2. AWS credentials configured: `aws configure`
3. Node.js installed: `node --version`

## Quick Deployment (5 minutes)

### Step 1: Create Infrastructure

```bash
aws cloudformation create-stack \
  --stack-name csec-schedule-api \
  --template-body file://infrastructure/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM
```

Wait for stack creation (check status):
```bash
aws cloudformation describe-stacks --stack-name csec-schedule-api --query 'Stacks[0].StackStatus'
```

### Step 2: Deploy Lambda Code

**On Windows:**
```powershell
.\deploy.ps1
```

**On Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Test It

```bash
# Invoke Lambda manually
aws lambda invoke --function-name csec-schedule-updater --payload '{}' response.json

# Check the response
cat response.json  # or type response.json on Windows

# Access the schedule data
curl https://csec-schedule-api.s3.amazonaws.com/schedule.json
```

### Step 4: Verify Hourly Updates

The Lambda function will automatically run every hour. You can verify by:
- Checking CloudWatch Logs: `/aws/lambda/csec-schedule-updater`
- Checking the `lastUpdated` field in the JSON response

## Customization

Edit these files to customize:

- **Bucket name**: Edit `infrastructure/cloudformation.yaml` or pass as parameter
- **Update frequency**: Edit CloudWatch Events rule (currently `rate(1 hour)`)
- **Lambda timeout/memory**: Edit `infrastructure/cloudformation.yaml`

## Troubleshooting

**Lambda not updating?**
- Check CloudWatch Logs: `aws logs tail /aws/lambda/csec-schedule-updater --follow`
- Verify IAM permissions
- Check environment variables

**S3 file not accessible?**
- Verify bucket policy allows public read
- Check bucket name matches in Lambda environment variables

**Need help?** See `DEPLOYMENT.md` for detailed instructions.


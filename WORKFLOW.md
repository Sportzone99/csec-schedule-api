# Development & Deployment Workflow

## Recommended Workflow: Git First, Then AWS

**Yes, you should commit to git before deploying to AWS.** Here's why:

1. **Version Control**: Track changes and rollback if needed
2. **Backup**: Your code is safely stored in git
3. **Documentation**: Commit messages document what changed
4. **Collaboration**: Others can see what was deployed
5. **Safety**: If AWS deployment fails, you have a known good state in git

## Standard Workflow

### 1. Make Changes Locally
```bash
# Edit files, test locally
npm start
# Test at http://localhost:3000/api/schedule
```

### 2. Commit to Git
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add gameId field and update linkToSummary URLs"

# (Optional) Push to remote repository
git remote add origin <your-repo-url>
git push -u origin main
```

### 3. Deploy to AWS
```bash
# Deploy infrastructure (first time only)
aws cloudformation create-stack --stack-name csec-schedule-api --template-body file://infrastructure/cloudformation.yaml --capabilities CAPABILITY_NAMED_IAM

# Deploy Lambda code
.\deploy.ps1  # Windows
# or
./deploy.sh  # Linux/Mac
```

### 4. Verify Deployment
```bash
# Test Lambda
aws lambda invoke --function-name csec-schedule-updater --payload '{}' response.json

# Check S3 file
curl https://csec-schedule-api.s3.amazonaws.com/schedule.json
```

## Initial Setup (First Time)

```bash
# 1. Initialize git (if not already done)
git init

# 2. Create initial commit
git add .
git commit -m "Initial commit: CSEC Schedule API with Lambda deployment"

# 3. (Optional) Add remote repository
git remote add origin <your-git-repo-url>
git branch -M main
git push -u origin main

# 4. Deploy to AWS
# Follow QUICKSTART.md or DEPLOYMENT.md
```

## Making Updates

### For Code Changes:
```bash
# 1. Make changes locally
# 2. Test locally
npm start

# 3. Commit to git
git add .
git commit -m "Description of changes"
git push  # if using remote repo

# 4. Deploy to AWS
.\deploy.ps1
```

### For Infrastructure Changes:
```bash
# 1. Update cloudformation.yaml
# 2. Commit to git
git add infrastructure/cloudformation.yaml
git commit -m "Update CloudFormation template: [description]"

# 3. Update stack
aws cloudformation update-stack \
  --stack-name csec-schedule-api \
  --template-body file://infrastructure/cloudformation.yaml \
  --capabilities CAPABILITY_NAMED_IAM
```

## Best Practices

1. **Always commit before deploying** - This ensures you can rollback
2. **Use descriptive commit messages** - Helps track what changed
3. **Test locally first** - Verify changes work before deploying
4. **Tag releases** - Tag important deployments:
   ```bash
   git tag -a v1.0.0 -m "Initial production deployment"
   git push origin v1.0.0
   ```
5. **Keep secrets out of git** - Use environment variables or AWS Secrets Manager
6. **Document changes** - Update README.md or CHANGELOG.md for significant changes

## Rollback Procedure

If something goes wrong:

```bash
# 1. Revert to previous commit
git log  # Find the commit hash
git checkout <previous-commit-hash>

# 2. Redeploy Lambda
.\deploy.ps1

# 3. Or rollback CloudFormation stack
aws cloudformation rollback-stack --stack-name csec-schedule-api
```

## Current Status

Your repository is initialized and ready. To commit everything:

```bash
git commit -m "Initial commit: CSEC Schedule API with AWS Lambda deployment"
```

Then proceed with AWS deployment following `QUICKSTART.md`.


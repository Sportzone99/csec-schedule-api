# Deployment Documentation Guide

This document explains the purpose of each deployment file.

## Main Deployment Guides

### 📘 `DEPLOY_CLOUDFRONT.md` ⭐ **START HERE**
**Purpose**: Complete step-by-step CloudFront deployment guide  
**Best for**: First-time deployment with CloudFront  
**Format**: Detailed instructions with PowerShell examples (but commands work on any platform)

### 📗 `MANUAL_DEPLOYMENT.md`
**Purpose**: Manual AWS CLI commands (platform-agnostic)  
**Best for**: Users who want standard AWS CLI commands without PowerShell syntax  
**Format**: Pure AWS CLI commands with JSON files

### 📙 `AWS_CLI_DEPLOYMENT.md`
**Purpose**: Reference guide for AWS CLI commands  
**Best for**: Quick reference and troubleshooting  
**Format**: Command snippets and examples

### 📕 `DEPLOYMENT.md`
**Purpose**: General deployment overview with CloudFormation option  
**Best for**: Understanding deployment options  
**Format**: High-level overview with multiple deployment methods

## Automation Scripts

### 🔧 `deploy-aws-cli.ps1`
**Purpose**: Automated PowerShell script for full deployment  
**Best for**: Windows users who want one-click deployment  
**Format**: PowerShell script

### 🔧 `cloudfront-setup.ps1`
**Purpose**: Automated CloudFront setup script  
**Best for**: Setting up CloudFront after initial deployment  
**Format**: PowerShell script

### 🔧 `deploy.sh` / `deploy.ps1`
**Purpose**: Simple Lambda code deployment scripts  
**Best for**: Updating Lambda function code  
**Format**: Bash/PowerShell scripts

## Infrastructure

### 🏗️ `infrastructure/cloudformation.yaml`
**Purpose**: CloudFormation template for infrastructure-as-code  
**Best for**: Users who prefer Infrastructure as Code  
**Format**: YAML CloudFormation template

## Quick Start Recommendation

1. **First time deploying?** → Use `DEPLOY_CLOUDFRONT.md`
2. **Want pure AWS CLI?** → Use `MANUAL_DEPLOYMENT.md`
3. **Want automation?** → Use `deploy-aws-cli.ps1` (Windows) or follow `DEPLOY_CLOUDFRONT.md` manually

## All Files Use Canada Central (ca-central-1)

All deployment guides and scripts are configured for the **ca-central-1** region.


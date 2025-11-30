# CloudFront Setup Script for CSEC Schedule API
# This script sets up CloudFront distribution for private S3 bucket

param(
    [string]$BucketName = "csec-schedule-api",
    [string]$Region = "ca-central-1"
)

Write-Host "Setting up CloudFront for CSEC Schedule API..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Create Origin Access Control
Write-Host "Step 1: Creating Origin Access Control..." -ForegroundColor Yellow
$oacConfig = @{
    Name = "csec-schedule-oac"
    OriginAccessControlOriginType = "s3"
    SigningBehavior = "always"
    SigningProtocol = "sigv4"
} | ConvertTo-Json

$oacResponse = aws cloudfront create-origin-access-control --origin-access-control-config $oacConfig | ConvertFrom-Json
$oacId = $oacResponse.OriginAccessControl.Id
Write-Host "Created OAC: $oacId" -ForegroundColor Green

# Step 2: Get AWS Account ID
Write-Host "Step 2: Getting AWS Account ID..." -ForegroundColor Yellow
$accountId = (aws sts get-caller-identity | ConvertFrom-Json).Account
Write-Host "Account ID: $accountId" -ForegroundColor Green

# Step 3: Create CloudFront Distribution
Write-Host "Step 3: Creating CloudFront Distribution..." -ForegroundColor Yellow
$callerRef = (New-Guid).ToString()
$distConfig = @{
    CallerReference = $callerRef
    Comment = "CSEC Schedule API"
    DefaultRootObject = "schedule.json"
    Origins = @{
        Quantity = 1
        Items = @(
            @{
                Id = $BucketName
                DomainName = "$BucketName.s3.$Region.amazonaws.com"
                OriginAccessControlId = $oacId
            }
        )
    }
    DefaultCacheBehavior = @{
        TargetOriginId = $BucketName
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

$distResponse = aws cloudfront create-distribution --distribution-config $distConfig | ConvertFrom-Json
$distributionId = $distResponse.Distribution.Id
$domainName = $distResponse.Distribution.DomainName
Write-Host "Created Distribution: $distributionId" -ForegroundColor Green
Write-Host "Domain: $domainName" -ForegroundColor Green

# Step 4: Update S3 Bucket Policy
Write-Host "Step 4: Updating S3 Bucket Policy..." -ForegroundColor Yellow
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
            Resource = "arn:aws:s3:::$BucketName/*"
            Condition = @{
                StringEquals = @{
                    "AWS:SourceArn" = "arn:aws:cloudfront::$accountId`:distribution/$distributionId"
                }
            }
        }
    )
} | ConvertTo-Json -Depth 10

$bucketPolicy | Out-File -FilePath bucket-policy.json -Encoding utf8
aws s3api put-bucket-policy --bucket $BucketName --policy file://bucket-policy.json
Remove-Item bucket-policy.json
Write-Host "Bucket policy updated" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CloudFront Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Distribution ID: $distributionId" -ForegroundColor Yellow
Write-Host "CloudFront URL: https://$domainName/schedule.json" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: Distribution takes 10-15 minutes to deploy." -ForegroundColor Cyan
Write-Host "You can check status with:" -ForegroundColor Cyan
Write-Host "  aws cloudfront get-distribution --id $distributionId" -ForegroundColor Gray
Write-Host ""


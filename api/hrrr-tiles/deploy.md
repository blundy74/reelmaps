# HRRR Tile Service Deployment Guide

## Prerequisites
- AWS CLI configured with admin-level permissions
- Docker installed (for Decode Lambda)
- Node.js 20+ (for Tile Lambda)

## Step 1: Create S3 Bucket

```bash
aws s3 mb s3://reelmaps-hrrr --region us-east-2
aws s3api put-bucket-cors --bucket reelmaps-hrrr --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}'
```

## Step 2: Create IAM Role for Lambdas

```bash
# Create role
aws iam create-role \
  --role-name hrrr-lambda-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policies
aws iam attach-role-policy --role-name hrrr-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Custom policy for S3 access
aws iam put-role-policy --role-name hrrr-lambda-role \
  --policy-name hrrr-s3-access \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject"],
        "Resource": "arn:aws:s3:::reelmaps-hrrr/*"
      },
      {
        "Effect": "Allow",
        "Action": ["s3:GetObject"],
        "Resource": "arn:aws:s3:::noaa-hrrr-pds/*"
      }
    ]
  }'
```

## Step 3: Deploy Decode Lambda (Python Docker)

```bash
cd api/hrrr-decode

# Build Docker image
docker build -t hrrr-decode .

# Create ECR repo
aws ecr create-repository --repository-name hrrr-decode --region us-east-2

# Tag and push
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 375209110784.dkr.ecr.us-east-2.amazonaws.com
docker tag hrrr-decode:latest 375209110784.dkr.ecr.us-east-2.amazonaws.com/hrrr-decode:latest
docker push 375209110784.dkr.ecr.us-east-2.amazonaws.com/hrrr-decode:latest

# Create Lambda
aws lambda create-function \
  --function-name hrrr-decode \
  --package-type Image \
  --code ImageUri=375209110784.dkr.ecr.us-east-2.amazonaws.com/hrrr-decode:latest \
  --role arn:aws:iam::375209110784:role/hrrr-lambda-role \
  --timeout 300 \
  --memory-size 1024 \
  --environment "Variables={HRRR_BUCKET=reelmaps-hrrr}" \
  --region us-east-2

# Add hourly trigger (at minute 50 past each hour)
aws events put-rule \
  --name hrrr-hourly \
  --schedule-expression "cron(50 * * * ? *)" \
  --region us-east-2

aws lambda add-permission \
  --function-name hrrr-decode \
  --statement-id hrrr-hourly \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-2:375209110784:rule/hrrr-hourly

aws events put-targets \
  --rule hrrr-hourly \
  --targets "Id"="hrrr-decode","Arn"="arn:aws:lambda:us-east-2:375209110784:function:hrrr-decode"
```

## Step 4: Deploy Tile Lambda (Node.js)

```bash
cd api/hrrr-tiles
npm install

# Zip it
zip -r hrrr-tiles.zip handler.js package.json node_modules/

# Create Lambda with Function URL
aws lambda create-function \
  --function-name hrrr-tiles \
  --runtime nodejs20.x \
  --handler handler.handler \
  --zip-file fileb://hrrr-tiles.zip \
  --role arn:aws:iam::375209110784:role/hrrr-lambda-role \
  --timeout 10 \
  --memory-size 256 \
  --environment "Variables={HRRR_BUCKET=reelmaps-hrrr}" \
  --region us-east-2

# Create Function URL (public, with CORS)
aws lambda create-function-url-config \
  --function-name hrrr-tiles \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["*"],
    "AllowMethods": ["GET"],
    "AllowHeaders": ["*"]
  }' \
  --region us-east-2

# Allow public invoke
aws lambda add-permission \
  --function-name hrrr-tiles \
  --statement-id public-url \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE
```

The Function URL will be something like:
`https://abc123xyz.lambda-url.us-east-2.on.aws`

## Step 5: CloudFront (Optional, for caching)

Create a CloudFront distribution with:
- Origin: The tile Lambda Function URL
- Cache behavior: TTL 3600s for `/tiles/hrrr/*`
- Forward all path components

## Step 6: Frontend Integration

Set the tile base URL in your .env or directly in code:
```
VITE_HRRR_TILE_URL=https://abc123xyz.lambda-url.us-east-2.on.aws
```

## Step 7: Test

```bash
# Trigger a manual decode run
aws lambda invoke --function-name hrrr-decode /dev/stdout

# Check the manifest
curl https://abc123xyz.lambda-url.us-east-2.on.aws/tiles/hrrr/latest.json

# Fetch a tile
curl -o test.png "https://abc123xyz.lambda-url.us-east-2.on.aws/tiles/hrrr/20260331/12/fh06/5/8/12.png"
```

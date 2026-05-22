# Infrastructure — One-Time Setup

Deploy these stacks in order. All secrets and env vars are stored in **SSM Parameter Store SecureString** parameters (free tier for standard ≤ 4 KB).

## Prerequisites

```bash
aws configure  # ensure AWS CLI is pointing at the right account
export ENV=prod
export REGION=ap-south-1
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

## Stack deployment order

### 0 — Cognito (`cognito.yaml`)

Deploy first — the User Pool ARN is required by stacks 3 (compute) and 6 (IAM).

```bash
aws cloudformation deploy \
  --stack-name "api-portal-cognito" \
  --template-file infra/cognito.yaml \
  --parameter-overrides \
    PoolName=api-gateway-portal \
    DomainPrefix=api-portal-$ACCOUNT_ID \
  --region $REGION

COGNITO_USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-cognito" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

COGNITO_USER_POOL_ARN=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-cognito" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolArn`].OutputValue' \
  --output text)

COGNITO_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-cognito" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AppClientId`].OutputValue' \
  --output text)

COGNITO_CLIENT_SECRET=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-cognito" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AppClientSecret`].OutputValue' \
  --output text)

TOKEN_URL=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-cognito" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`TokenUrl`].OutputValue' \
  --output text)
```

### 1 — VPC (`1-vpc.yaml`)

```bash
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-vpc" \
  --template-file infra/1-vpc.yaml \
  --parameter-overrides EnvironmentName=$ENV \
  --region $REGION \
  --capabilities CAPABILITY_NAMED_IAM
```

### 2 — DB password into SSM (must exist before stack 3-database)

The Aurora cluster resolves `{{resolve:ssm-secure:...}}` at deploy time — the parameter must already exist.

```bash
# Generate a strong password (no special chars that break connection strings)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')

aws ssm put-parameter \
  --name "/api-portal/$ENV/db-password" \
  --type SecureString \
  --value "$DB_PASSWORD" \
  --region $REGION
```

### 3 — Database (`2-database.yaml`)

```bash
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-database" \
  --template-file infra/2-database.yaml \
  --parameter-overrides EnvironmentName=$ENV \
  --region $REGION \
  --capabilities CAPABILITY_NAMED_IAM

DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-database" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)
```

### 4 — Storage / CloudFront (`4-storage.yaml`)

**Must be deployed in us-east-1** (CloudFront requirement):

```bash
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-storage" \
  --template-file infra/4-storage.yaml \
  --parameter-overrides \
    EnvironmentName=$ENV \
    AlbDnsName="placeholder.example.com" \
  --region us-east-1

ARTIFACT_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-storage" --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketName`].OutputValue' \
  --output text)

ASSETS_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-storage" --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`AssetsBucketName`].OutputValue' \
  --output text)
```

### 5 — IAM users + policies (`6-iam.yaml`)

Creates the app IAM user (for API Gateway / ACM) and CI/CD user (for GitHub Actions). Access keys appear in CloudFormation Outputs — restrict `cloudformation:DescribeStacks` on this stack to ops accounts.

```bash
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-iam" \
  --template-file infra/6-iam.yaml \
  --parameter-overrides \
    EnvironmentName=$ENV \
    ArtifactBucketName=$ARTIFACT_BUCKET \
    AssetsBucketName=$ASSETS_BUCKET \
    CognitoUserPoolArn=$COGNITO_USER_POOL_ARN \
  --region $REGION \
  --capabilities CAPABILITY_NAMED_IAM

# Read the generated access keys from CloudFormation Outputs
APP_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-iam" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AppUserKeyId`].OutputValue' \
  --output text)

APP_SECRET=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-iam" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AppUserSecretKey`].OutputValue' \
  --output text)

CICD_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-iam" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CICDUserKeyId`].OutputValue' \
  --output text)

CICD_SECRET=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-iam" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`CICDUserSecretKey`].OutputValue' \
  --output text)

echo "GitHub Actions credentials (add these in repo Settings → Secrets → Actions):"
echo "  AWS_ACCESS_KEY_ID     = $CICD_KEY_ID"
echo "  AWS_SECRET_ACCESS_KEY = $CICD_SECRET"
```

Store the app user credentials in SSM so you can retrieve them later without re-running CloudFormation:

```bash
aws ssm put-parameter \
  --name "/api-portal/$ENV/app-user-credentials" \
  --type SecureString \
  --value "{\"AWS_ACCESS_KEY_ID\":\"$APP_KEY_ID\",\"AWS_SECRET_ACCESS_KEY\":\"$APP_SECRET\"}" \
  --region $REGION
```

### 6 — Compute (`3-compute.yaml`)

The ALB serves HTTP on port 80 — TLS is terminated at CloudFront, so no ACM cert is needed on the ALB.

```bash
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-compute" \
  --template-file infra/3-compute.yaml \
  --parameter-overrides \
    EnvironmentName=$ENV \
    ArtifactBucketName=$ARTIFACT_BUCKET \
  --region $REGION \
  --capabilities CAPABILITY_NAMED_IAM

EC2_INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-compute" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`EC2InstanceId`].OutputValue' \
  --output text)

ALB_DNS=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-compute" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AlbDnsName`].OutputValue' \
  --output text)

# Update CloudFront storage stack with the real ALB DNS
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-storage" \
  --template-file infra/4-storage.yaml \
  --parameter-overrides EnvironmentName=$ENV AlbDnsName=$ALB_DNS \
  --region us-east-1
```

### 7 — WAF (`5-waf.yaml`)

**Must be deployed in us-east-1**. Start in Count mode; switch to Block after tuning:

```bash
CF_DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-storage" --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
  --output text)

CF_ARN="arn:aws:cloudfront::$ACCOUNT_ID:distribution/$CF_DIST_ID"

aws cloudformation deploy \
  --stack-name "api-portal-$ENV-waf" \
  --template-file infra/5-waf.yaml \
  --parameter-overrides \
    EnvironmentName=$ENV \
    CloudFrontDistributionArn=$CF_ARN \
    RulesMode=Count \
  --region us-east-1

# After 1-2 weeks of reviewing sampled requests, switch to Block:
# aws cloudformation deploy ... --parameter-overrides ... RulesMode=Block ...
```

### 8 — Write the app env parameter to SSM

This is the single parameter the deploy script reads on each deployment.

```bash
SESSION_SECRET=$(openssl rand -base64 32)

aws ssm put-parameter \
  --name "/api-portal/env" \
  --type SecureString \
  --overwrite \
  --region $REGION \
  --value "{
    \"DATABASE_URL\": \"postgresql://apiportal:${DB_PASSWORD}@${DB_ENDPOINT}:5432/apiportal\",
    \"SESSION_SECRET\": \"${SESSION_SECRET}\",
    \"NODE_ENV\": \"production\",
    \"PORT\": \"3000\",
    \"AWS_REGION\": \"${REGION}\",
    \"AWS_ACCESS_KEY_ID\": \"${APP_KEY_ID}\",
    \"AWS_SECRET_ACCESS_KEY\": \"${APP_SECRET}\",
    \"COGNITO_USER_POOL_ID\": \"${COGNITO_USER_POOL_ID}\",
    \"COGNITO_USER_POOL_ARN\": \"${COGNITO_USER_POOL_ARN}\",
    \"COGNITO_CLIENT_ID\": \"${COGNITO_CLIENT_ID}\",
    \"COGNITO_CLIENT_SECRET\": \"${COGNITO_CLIENT_SECRET}\",
  }"
```

To update a single env var later (e.g. rotate a key), just overwrite the parameter:

```bash
# Fetch current value, patch it, write back
CURRENT=$(aws ssm get-parameter --name "/api-portal/env" --with-decryption \
  --query 'Parameter.Value' --output text --region $REGION)

# Edit CURRENT in your editor, then:
aws ssm put-parameter --name "/api-portal/env" --type SecureString \
  --overwrite --value "$CURRENT" --region $REGION
```

### 9 — Subscribe to alerts

```bash
SNS_ARN=$(aws cloudformation describe-stacks \
  --stack-name "api-portal-$ENV-compute" --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`AlarmSNSTopicArn`].OutputValue' \
  --output text)

aws sns subscribe \
  --topic-arn $SNS_ARN \
  --protocol email \
  --notification-endpoint renganatha10@gmail.com
```

### 10 — Add GitHub Actions secrets

```
AWS_ACCESS_KEY_ID          → $CICD_KEY_ID
AWS_SECRET_ACCESS_KEY      → $CICD_SECRET
AWS_REGION                 → ap-south-1
EC2_INSTANCE_ID            → $EC2_INSTANCE_ID
S3_ARTIFACT_BUCKET         → $ARTIFACT_BUCKET
S3_ASSETS_BUCKET           → $ASSETS_BUCKET
CLOUDFRONT_DISTRIBUTION_ID → $CF_DIST_ID
ALB_HEALTH_URL             → https://$ALB_DNS/health
```

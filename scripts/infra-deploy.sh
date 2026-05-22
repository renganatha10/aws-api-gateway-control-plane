#!/usr/bin/env bash
# Local equivalent of .github/workflows/infra-deploy.yml
# Run from the repo root:
#   ./scripts/infra-deploy.sh --env prod --domain api-portal-123456789012
#
# Prerequisites:
#   - AWS CLI configured (aws configure or env vars)
#   - Sufficient IAM permissions (same as BOOTSTRAP_AWS_ACCESS_KEY_ID in CI)

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}══ $* ${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── Args ─────────────────────────────────────────────────────────────────────
ENV="prod"
COGNITO_DOMAIN_PREFIX=""
INSTANCE_TYPE="t3.small"
REGION="ap-south-1"

usage() {
  echo "Usage: $0 --env <name> --domain <cognito-prefix> [--instance-type t3.small|t3.medium|t3.large]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --env)            ENV="$2";                  shift 2 ;;
    --domain)         COGNITO_DOMAIN_PREFIX="$2"; shift 2 ;;
    --instance-type)  INSTANCE_TYPE="$2";         shift 2 ;;
    *) usage ;;
  esac
done

[[ -z "$COGNITO_DOMAIN_PREFIX" ]] && usage

# ── Helpers ───────────────────────────────────────────────────────────────────
cf_output() {
  local stack=$1 key=$2 region=${3:-$REGION}
  aws cloudformation describe-stacks \
    --stack-name "$stack" --region "$region" \
    --query "Stacks[0].Outputs[?OutputKey==\`$key\`].OutputValue" \
    --output text
}

# ══════════════════════════════════════════════════════════════════════════════
step "0 | Deploy Cognito"
aws cloudformation deploy \
  --stack-name "api-portal-cognito" \
  --template-file infra/cognito.yaml \
  --parameter-overrides \
    PoolName=api-gateway-portal \
    DomainPrefix="$COGNITO_DOMAIN_PREFIX" \
  --region "$REGION"

COGNITO_USER_POOL_ID=$(cf_output "api-portal-cognito" UserPoolId)
COGNITO_USER_POOL_ARN=$(cf_output "api-portal-cognito" UserPoolArn)
COGNITO_CLIENT_ID=$(cf_output "api-portal-cognito" AppClientId)
COGNITO_CLIENT_SECRET=$(cf_output "api-portal-cognito" AppClientSecret)
ok "Cognito: $COGNITO_USER_POOL_ID"

# ══════════════════════════════════════════════════════════════════════════════
step "1 | Deploy VPC"
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-vpc" \
  --template-file infra/1-vpc.yaml \
  --parameter-overrides EnvironmentName="$ENV" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM
ok "VPC deployed"

# ══════════════════════════════════════════════════════════════════════════════
step "2 | Generate DB password (idempotent)"
if ! aws ssm get-parameter --name "/api-portal/$ENV/db-password" --region "$REGION" &>/dev/null; then
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')
  aws ssm put-parameter \
    --name "/api-portal/$ENV/db-password" \
    --type SecureString \
    --value "$DB_PASSWORD" \
    --region "$REGION"
  ok "DB password created"
else
  warn "DB password already exists in SSM — skipping"
fi

DB_PASSWORD=$(aws ssm get-parameter \
  --name "/api-portal/$ENV/db-password" \
  --with-decryption --query Parameter.Value --output text --region "$REGION")

# ══════════════════════════════════════════════════════════════════════════════
step "3 | Deploy Database (Aurora Serverless v2)"
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-database" \
  --template-file infra/2-database.yaml \
  --parameter-overrides EnvironmentName="$ENV" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

DB_ENDPOINT=$(cf_output "api-portal-$ENV-database" ClusterEndpoint)
ok "DB endpoint: $DB_ENDPOINT"

# ══════════════════════════════════════════════════════════════════════════════
step "4 | Deploy Storage + CloudFront (placeholder ALB, us-east-1)"
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-storage" \
  --template-file infra/4-storage.yaml \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    AlbDnsName="placeholder.example.com" \
  --region us-east-1

ARTIFACT_BUCKET=$(cf_output "api-portal-$ENV-storage" ArtifactBucketName us-east-1)
ASSETS_BUCKET=$(cf_output "api-portal-$ENV-storage"   AssetsBucketName   us-east-1)
CF_DIST_ID=$(cf_output    "api-portal-$ENV-storage"   DistributionId     us-east-1)
ok "Artifact bucket: $ARTIFACT_BUCKET"
ok "CloudFront dist:  $CF_DIST_ID"

# ══════════════════════════════════════════════════════════════════════════════
step "5 | Deploy IAM users + policies"
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-iam" \
  --template-file infra/6-iam.yaml \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    ArtifactBucketName="$ARTIFACT_BUCKET" \
    AssetsBucketName="$ASSETS_BUCKET" \
    CognitoUserPoolArn="$COGNITO_USER_POOL_ARN" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

APP_KEY_ID=$(cf_output "api-portal-$ENV-iam" AppUserKeyId)
APP_SECRET=$(cf_output  "api-portal-$ENV-iam" AppUserSecretKey)
CICD_KEY_ID=$(cf_output "api-portal-$ENV-iam" CICDUserKeyId)
CICD_SECRET=$(cf_output  "api-portal-$ENV-iam" CICDUserSecretKey)
ok "IAM users created"

# ══════════════════════════════════════════════════════════════════════════════
step "6 | Deploy Compute (EC2 + ALB)"
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-compute" \
  --template-file infra/3-compute.yaml \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    InstanceType="$INSTANCE_TYPE" \
    ArtifactBucketName="$ARTIFACT_BUCKET" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

EC2_INSTANCE_ID=$(cf_output "api-portal-$ENV-compute" EC2InstanceId)
ALB_DNS=$(cf_output          "api-portal-$ENV-compute" AlbDnsName)
ok "EC2: $EC2_INSTANCE_ID"
ok "ALB: $ALB_DNS"

# ══════════════════════════════════════════════════════════════════════════════
step "7 | Update CloudFront origin with real ALB DNS (us-east-1)"
aws cloudformation deploy \
  --stack-name "api-portal-$ENV-storage" \
  --template-file infra/4-storage.yaml \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    AlbDnsName="$ALB_DNS" \
  --region us-east-1
ok "CloudFront origin updated"

# ══════════════════════════════════════════════════════════════════════════════
step "8 | Deploy WAF (us-east-1, Count mode)"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CF_ARN="arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${CF_DIST_ID}"

aws cloudformation deploy \
  --stack-name "api-portal-$ENV-waf" \
  --template-file infra/5-waf.yaml \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    CloudFrontDistributionArn="$CF_ARN" \
    RulesMode=Count \
  --region us-east-1
ok "WAF deployed"

# ══════════════════════════════════════════════════════════════════════════════
step "9 | Write app env to SSM Parameter Store"
if aws ssm get-parameter --name "/api-portal/env" --region "$REGION" &>/dev/null; then
  SESSION_SECRET=$(aws ssm get-parameter \
    --name "/api-portal/env" --with-decryption \
    --query Parameter.Value --output text --region "$REGION" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['SESSION_SECRET'])")
  warn "Reusing existing SESSION_SECRET"
else
  SESSION_SECRET=$(openssl rand -base64 32)
  ok "Generated new SESSION_SECRET"
fi

aws ssm put-parameter \
  --name "/api-portal/env" \
  --type SecureString \
  --overwrite \
  --region "$REGION" \
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
    \"COGNITO_CLIENT_SECRET\": \"${COGNITO_CLIENT_SECRET}\"
  }"
ok "SSM env written"

# ══════════════════════════════════════════════════════════════════════════════
step "10 | SNS email subscription"
SNS_ARN=$(cf_output "api-portal-$ENV-compute" AlarmSNSTopicArn)
read -rp "Alert email address for CloudWatch alarms: " ALERT_EMAIL
aws sns subscribe \
  --topic-arn "$SNS_ARN" \
  --protocol email \
  --notification-endpoint "$ALERT_EMAIL" \
  --region "$REGION"
warn "Check $ALERT_EMAIL and confirm the SNS subscription"

# ══════════════════════════════════════════════════════════════════════════════
echo -e "\n${GREEN}══════════════════════════════════════════════════${NC}"
echo -e "${GREEN} Infrastructure deploy complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════${NC}"
echo ""
echo "Deploy secrets for GitHub Actions (set these manually or via gh CLI):"
echo "  AWS_ACCESS_KEY_ID          = $CICD_KEY_ID"
echo "  AWS_SECRET_ACCESS_KEY      = (hidden — retrieve from CloudFormation)"
echo "  AWS_REGION                 = $REGION"
echo "  EC2_INSTANCE_ID            = $EC2_INSTANCE_ID"
echo "  S3_ARTIFACT_BUCKET         = $ARTIFACT_BUCKET"
echo "  S3_ASSETS_BUCKET           = $ASSETS_BUCKET"
echo "  CLOUDFRONT_DISTRIBUTION_ID = $CF_DIST_ID"
echo "  ALB_HEALTH_URL             = http://$ALB_DNS/health"
echo ""
echo "Or run automatically with gh CLI:"
echo "  gh secret set AWS_ACCESS_KEY_ID     --body \"$CICD_KEY_ID\""
echo "  gh secret set EC2_INSTANCE_ID       --body \"$EC2_INSTANCE_ID\""
echo "  gh secret set S3_ARTIFACT_BUCKET    --body \"$ARTIFACT_BUCKET\""
echo "  gh secret set S3_ASSETS_BUCKET      --body \"$ASSETS_BUCKET\""
echo "  gh secret set CLOUDFRONT_DISTRIBUTION_ID --body \"$CF_DIST_ID\""
echo "  gh secret set ALB_HEALTH_URL        --body \"http://$ALB_DNS/health\""

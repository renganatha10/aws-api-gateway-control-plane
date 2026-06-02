#!/usr/bin/env bash
# infra/deploy.sh — Deploy api-portal stacks via AWS CLI.
#
# Stack order:
#   Cognito → VPC → Database → Storage → IAM → Compute → Storage (update ALB) → SSM env
#
# Usage:
#   ./infra/deploy.sh [env] [region]
#     env:    prod (default) or staging
#     region: ap-south-1 (default)
#
# Requires: aws cli v2, jq, openssl

set -euo pipefail

ENV="${1:-prod}"
REGION="${2:-ap-south-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

COGNITO_STACK="api-portal-cognito"
VPC_STACK="api-portal-${ENV}-vpc"
DATABASE_STACK="api-portal-${ENV}-database"
STORAGE_STACK="api-portal-${ENV}-storage"
IAM_STACK="api-portal-${ENV}-iam"
COMPUTE_STACK="api-portal-${ENV}-compute"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo "[deploy] $*"; }

stack_exists() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" >/dev/null 2>&1
}

get_output() {
  aws cloudformation describe-stacks \
    --stack-name "$1" --region "${3:-$REGION}" \
    --query "Stacks[0].Outputs[?OutputKey==\`$2\`].OutputValue" \
    --output text 2>/dev/null || echo ""
}

deploy_stack() {
  local name=$1; shift
  if stack_exists "$name"; then
    log "$name — already exists, updating (no-op if unchanged)"
  else
    log "$name — creating"
  fi
  aws cloudformation deploy --stack-name "$name" "$@"
  log "$name — done"
}

# ── Step 0: Cognito ───────────────────────────────────────────────────────────
log ""
log "── Step 0: Cognito ──────────────────────────────────────────"
deploy_stack "$COGNITO_STACK" \
  --template-file "$SCRIPT_DIR/cognito.yaml" \
  --parameter-overrides \
    PoolName=api-gateway-portal \
    DomainPrefix="api-portal-${ACCOUNT_ID}" \
  --region "$REGION"

COGNITO_USER_POOL_ID=$(get_output "$COGNITO_STACK" UserPoolId)
COGNITO_USER_POOL_ARN=$(get_output "$COGNITO_STACK" UserPoolArn)
COGNITO_CLIENT_ID=$(get_output "$COGNITO_STACK" AppClientId)
COGNITO_CLIENT_SECRET=$(get_output "$COGNITO_STACK" AppClientSecret)
TOKEN_URL=$(get_output "$COGNITO_STACK" TokenUrl)

log "  UserPoolId:  $COGNITO_USER_POOL_ID"
log "  ClientId:    $COGNITO_CLIENT_ID"

# ── Step 1: VPC ───────────────────────────────────────────────────────────────
log ""
log "── Step 1: VPC ──────────────────────────────────────────────"
deploy_stack "$VPC_STACK" \
  --template-file "$SCRIPT_DIR/1-vpc.yaml" \
  --parameter-overrides EnvironmentName="$ENV" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

# ── Step 2: DB password in SSM ────────────────────────────────────────────────
log ""
log "── Step 2: DB password in SSM ───────────────────────────────"
SSM_DB_PARAM="/api-portal/${ENV}/db-password"
if aws ssm get-parameter --name "$SSM_DB_PARAM" --region "$REGION" >/dev/null 2>&1; then
  log "  $SSM_DB_PARAM — already exists, skipping"
  DB_PASSWORD=$(aws ssm get-parameter --name "$SSM_DB_PARAM" --with-decryption \
    --query 'Parameter.Value' --output text --region "$REGION")
else
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')
  aws ssm put-parameter \
    --name "$SSM_DB_PARAM" \
    --type SecureString \
    --value "$DB_PASSWORD" \
    --region "$REGION"
  log "  $SSM_DB_PARAM — stored"
fi

# ── Step 3: Database ──────────────────────────────────────────────────────────
log ""
log "── Step 3: Database ─────────────────────────────────────────"
deploy_stack "$DATABASE_STACK" \
  --template-file "$SCRIPT_DIR/2-database.yaml" \
  --parameter-overrides EnvironmentName="$ENV" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

DB_ENDPOINT=$(get_output "$DATABASE_STACK" DBEndpoint)
log "  DBEndpoint: $DB_ENDPOINT"

# ── Step 4: Storage / CloudFront (placeholder ALB) ────────────────────────────
log ""
log "── Step 4: Storage (initial, placeholder ALB) ───────────────"
deploy_stack "$STORAGE_STACK" \
  --template-file "$SCRIPT_DIR/4-storage.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    AlbDnsName="placeholder.example.com" \
  --region "$REGION"

ARTIFACT_BUCKET=$(get_output "$STORAGE_STACK" ArtifactBucketName)
ASSETS_BUCKET=$(get_output "$STORAGE_STACK" AssetsBucketName)
CF_DIST_ID=$(get_output "$STORAGE_STACK" DistributionId)

log "  ArtifactBucket: $ARTIFACT_BUCKET"
log "  AssetsBucket:   $ASSETS_BUCKET"
log "  CloudFront:     $CF_DIST_ID"

# ── Step 5: IAM ───────────────────────────────────────────────────────────────
log ""
log "── Step 5: IAM ──────────────────────────────────────────────"
deploy_stack "$IAM_STACK" \
  --template-file "$SCRIPT_DIR/6-iam.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    ArtifactBucketName="$ARTIFACT_BUCKET" \
    AssetsBucketName="$ASSETS_BUCKET" \
    CognitoUserPoolId="$COGNITO_USER_POOL_ID" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

APP_KEY_ID=$(get_output "$IAM_STACK" AppUserKeyId)
APP_SECRET=$(get_output "$IAM_STACK" AppUserSecretKey)
CICD_KEY_ID=$(get_output "$IAM_STACK" CICDUserKeyId)
CICD_SECRET=$(get_output "$IAM_STACK" CICDUserSecretKey)

log "  AppUser key:  $APP_KEY_ID"
log "  CICD key:     $CICD_KEY_ID"

# Store app credentials in SSM so they can be retrieved without re-running CloudFormation
aws ssm put-parameter \
  --name "/api-portal/${ENV}/app-user-credentials" \
  --type SecureString \
  --overwrite \
  --value "{\"AWS_ACCESS_KEY_ID\":\"${APP_KEY_ID}\",\"AWS_SECRET_ACCESS_KEY\":\"${APP_SECRET}\"}" \
  --region "$REGION" >/dev/null
log "  App credentials stored in SSM: /api-portal/${ENV}/app-user-credentials"

# ── Step 6: Compute ───────────────────────────────────────────────────────────
log ""
log "── Step 6: Compute ──────────────────────────────────────────"
deploy_stack "$COMPUTE_STACK" \
  --template-file "$SCRIPT_DIR/3-compute.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    ArtifactBucketName="$ARTIFACT_BUCKET" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

EC2_INSTANCE_ID=$(get_output "$COMPUTE_STACK" EC2InstanceId)
ALB_DNS=$(get_output "$COMPUTE_STACK" AlbDnsName)

log "  EC2InstanceId: $EC2_INSTANCE_ID"
log "  AlbDnsName:    $ALB_DNS"

# ── Step 7: Storage — update with real ALB DNS ────────────────────────────────
log ""
log "── Step 7: Storage (update ALB DNS → real value) ────────────"
deploy_stack "$STORAGE_STACK" \
  --template-file "$SCRIPT_DIR/4-storage.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    AlbDnsName="$ALB_DNS" \
  --region "$REGION"

# ── Step 8: Write app env to SSM ─────────────────────────────────────────────
log ""
log "── Step 8: App env → SSM (/api-portal/${ENV}/env) ──────────────────"
SSM_SESSION_PARAM="/api-portal/${ENV}/session-secret"
if aws ssm get-parameter --name "$SSM_SESSION_PARAM" --region "$REGION" >/dev/null 2>&1; then
  log "  $SSM_SESSION_PARAM — already exists, reusing"
  SESSION_SECRET=$(aws ssm get-parameter --name "$SSM_SESSION_PARAM" --with-decryption \
    --query 'Parameter.Value' --output text --region "$REGION")
else
  SESSION_SECRET=$(openssl rand -base64 32)
  aws ssm put-parameter \
    --name "$SSM_SESSION_PARAM" \
    --type SecureString \
    --value "$SESSION_SECRET" \
    --region "$REGION" >/dev/null
  log "  $SSM_SESSION_PARAM — stored"
fi

aws ssm put-parameter \
  --name "/api-portal/${ENV}/env" \
  --type SecureString \
  --overwrite \
  --region "$REGION" \
  --value "{
    \"DATABASE_URL\": \"postgresql://apiportal:${DB_PASSWORD}@${DB_ENDPOINT}:5432/apiportal?sslmode=verify-full&sslrootcert=/etc/pki/rds/global-bundle.pem\",
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
  }" >/dev/null
log "  /api-portal/${ENV}/env — stored"

# ── Step 9: SNS subscription ──────────────────────────────────────────────────
log ""
log "── Step 9: SNS alert subscription ──────────────────────────"
SNS_ARN=$(get_output "$COMPUTE_STACK" AlarmSNSTopicArn)
if [ -n "$SNS_ARN" ] && [ "$SNS_ARN" != "None" ]; then
  aws sns subscribe \
    --topic-arn "$SNS_ARN" \
    --protocol email \
    --notification-endpoint renganatha10@gmail.com \
    --region "$REGION" >/dev/null 2>&1 || log "  SNS subscription already exists or failed (not critical)"
  log "  Subscribed renganatha10@gmail.com to $SNS_ARN"
fi

# ── Step 10: GitHub Actions secrets ──────────────────────────────────────────
log ""
log "── Step 10: GitHub Actions secrets ──────────────────────────"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  GH_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
  if [ -n "$GH_REPO" ]; then
    log "  Repo: $GH_REPO"
    set_secret() {
      gh secret set "$1" --body "$2" --repo "$GH_REPO"
      log "  ✓ $1"
    }
    set_secret AWS_ACCESS_KEY_ID          "$CICD_KEY_ID"
    set_secret AWS_SECRET_ACCESS_KEY      "$CICD_SECRET"
    set_secret AWS_REGION                 "$REGION"
    set_secret EC2_INSTANCE_ID            "$EC2_INSTANCE_ID"
    set_secret S3_ARTIFACT_BUCKET         "$ARTIFACT_BUCKET"
    set_secret S3_ASSETS_BUCKET           "$ASSETS_BUCKET"
    set_secret CLOUDFRONT_DISTRIBUTION_ID "$CF_DIST_ID"
    set_secret ALB_HEALTH_URL             "http://$ALB_DNS/health"
    log "  All secrets set on $GH_REPO"
  else
    log "  Could not detect GitHub repo — skipping (not inside a gh-tracked repo?)"
  fi
else
  log "  gh not found or not authenticated — skipping"
  log "  Set these secrets manually in Settings → Secrets → Actions:"
  log "    AWS_ACCESS_KEY_ID          = $CICD_KEY_ID"
  log "    AWS_SECRET_ACCESS_KEY      = $CICD_SECRET"
  log "    AWS_REGION                 = $REGION"
  log "    EC2_INSTANCE_ID            = $EC2_INSTANCE_ID"
  log "    S3_ARTIFACT_BUCKET         = $ARTIFACT_BUCKET"
  log "    S3_ASSETS_BUCKET           = $ASSETS_BUCKET"
  log "    CLOUDFRONT_DISTRIBUTION_ID = $CF_DIST_ID"
  log "    ALB_HEALTH_URL             = http://$ALB_DNS/health"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
log ""
log "═══ Deployment complete: env=$ENV region=$REGION ═══"
log ""
log "Check your email to confirm the SNS alert subscription."

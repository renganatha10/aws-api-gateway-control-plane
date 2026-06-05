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

# ── GoDaddy credentials (required for cert-manager) ──────────────────────────
# Export these before running deploy.sh, or set them here (do not commit secrets):
#   export GODADDY_KEY=dLP4VM1iKhYo_8C6PTpXe56qUn6bX8MEA41
#   export GODADDY_SECRET=LQgfDn2R5ckmyhVY1epnuY
GODADDY_KEY="${GODADDY_KEY:-}"
GODADDY_SECRET="${GODADDY_SECRET:-}"

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

# ── Step 0: ACM Certificates (cert-manager) ───────────────────────────────────
log ""
log "── Step 0: ACM Certificates (cert-manager) ──────────────────"

read_cert_arn() {
  aws ssm get-parameter --name "/api-portal/certs/$1" --region "$REGION" \
    --query 'Parameter.Value' --output text 2>/dev/null || echo ""
}

# Check if all 4 certs are already ISSUED in SSM
CERT_STATIC=$(read_cert_arn "static")
CERT_ALB=$(read_cert_arn "api-manager")
CERT_AUTH=$(read_cert_arn "auth")
CERT_METRICS=$(read_cert_arn "metrics")

if [ -z "$CERT_STATIC" ] || [ -z "$CERT_ALB" ] || [ -z "$CERT_AUTH" ] || [ -z "$CERT_METRICS" ]; then
  if [ -z "$GODADDY_KEY" ] || [ -z "$GODADDY_SECRET" ]; then
    log "  GODADDY_KEY / GODADDY_SECRET not set — skipping cert provisioning."
    log "  Set them and re-run, or provision certs manually then store ARNs in SSM:"
    log "    /api-portal/certs/static  /api-portal/certs/api-manager"
    log "    /api-portal/certs/auth    /api-portal/certs/metrics"
  else
    log "  Running cert-manager.sh..."
    GODADDY_KEY="$GODADDY_KEY" GODADDY_SECRET="$GODADDY_SECRET" \
      "$SCRIPT_DIR/cert-manager.sh" "$REGION"
    # Refresh ARNs after cert-manager completes
    CERT_STATIC=$(read_cert_arn "static")
    CERT_ALB=$(read_cert_arn "api-manager")
    CERT_AUTH=$(read_cert_arn "auth")
    CERT_METRICS=$(read_cert_arn "metrics")
  fi
else
  log "  All 4 cert ARNs already in SSM — skipping cert-manager"
fi

log "  static:      ${CERT_STATIC:-<not set>}"
log "  api-manager: ${CERT_ALB:-<not set>}"
log "  auth:        ${CERT_AUTH:-<not set>}"
log "  metrics:     ${CERT_METRICS:-<not set>}"

# ── Step 1: Cognito ───────────────────────────────────────────────────────────
log ""
log "── Step 1: Cognito ──────────────────────────────────────────"

# Use custom domain if auth cert is available; fall back to prefix domain.
COGNITO_EXTRA_PARAMS=()
if [ -n "$CERT_AUTH" ]; then
  COGNITO_EXTRA_PARAMS+=(
    CustomDomain="auth.rengaonline.in"
    AuthCertArn="$CERT_AUTH"
  )
fi

deploy_stack "$COGNITO_STACK" \
  --template-file "$SCRIPT_DIR/cognito.yaml" \
  --parameter-overrides \
    PoolName=api-gateway-portal \
    DomainPrefix="api-portal-${ACCOUNT_ID}" \
    "${COGNITO_EXTRA_PARAMS[@]+"${COGNITO_EXTRA_PARAMS[@]}"}" \
  --region "$REGION"

COGNITO_USER_POOL_ID=$(get_output "$COGNITO_STACK" UserPoolId)
COGNITO_USER_POOL_ARN=$(get_output "$COGNITO_STACK" UserPoolArn)
COGNITO_CLIENT_ID=$(get_output "$COGNITO_STACK" AppClientId)
COGNITO_CLIENT_SECRET=$(get_output "$COGNITO_STACK" AppClientSecret)
TOKEN_URL=$(get_output "$COGNITO_STACK" TokenUrl)

log "  UserPoolId:  $COGNITO_USER_POOL_ID"
log "  ClientId:    $COGNITO_CLIENT_ID"

# ── Step 2: VPC ───────────────────────────────────────────────────────────────
log ""
log "── Step 2: VPC ──────────────────────────────────────────────"
deploy_stack "$VPC_STACK" \
  --template-file "$SCRIPT_DIR/1-vpc.yaml" \
  --parameter-overrides EnvironmentName="$ENV" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

# ── Step 3: DB password in SSM ────────────────────────────────────────────────
log ""
log "── Step 3: DB password in SSM ───────────────────────────────"
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

# ── Step 4: Database ──────────────────────────────────────────────────────────
log ""
log "── Step 4: Database ─────────────────────────────────────────"
deploy_stack "$DATABASE_STACK" \
  --template-file "$SCRIPT_DIR/2-database.yaml" \
  --parameter-overrides EnvironmentName="$ENV" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

DB_ENDPOINT=$(get_output "$DATABASE_STACK" DBEndpoint)
log "  DBEndpoint: $DB_ENDPOINT"

# ── Step 5: Storage / CloudFront (S3-only, no ALB origin) ────────────────────
# CloudFront only serves static.rengaonline.in assets from S3.
# SSR traffic goes directly to the ALB — no ALB origin in this distribution.
log ""
log "── Step 5: Storage (S3-only CloudFront) ─────────────────────"
deploy_stack "$STORAGE_STACK" \
  --template-file "$SCRIPT_DIR/4-storage.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    ${CERT_STATIC:+StaticCertArn="$CERT_STATIC"} \
  --region "$REGION"

ARTIFACT_BUCKET=$(get_output "$STORAGE_STACK" ArtifactBucketName)
ASSETS_BUCKET=$(get_output "$STORAGE_STACK" AssetsBucketName)
CF_DIST_ID=$(get_output "$STORAGE_STACK" DistributionId)

log "  ArtifactBucket: $ARTIFACT_BUCKET"
log "  AssetsBucket:   $ASSETS_BUCKET"
log "  CloudFront:     $CF_DIST_ID"

# ── Step 6: IAM ───────────────────────────────────────────────────────────────
log ""
log "── Step 6: IAM ──────────────────────────────────────────────"
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

# ── Step 7: Compute ───────────────────────────────────────────────────────────
log ""
log "── Step 7: Compute ──────────────────────────────────────────"
deploy_stack "$COMPUTE_STACK" \
  --template-file "$SCRIPT_DIR/3-compute.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    ArtifactBucketName="$ARTIFACT_BUCKET" \
    ${CERT_ALB:+AlbCertArn="$CERT_ALB"} \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM

EC2_INSTANCE_ID=$(get_output "$COMPUTE_STACK" EC2InstanceId)
ALB_DNS=$(get_output "$COMPUTE_STACK" AlbDnsName)

log "  EC2InstanceId: $EC2_INSTANCE_ID"
log "  AlbDnsName:    $ALB_DNS"

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

# ── Step 10: SNS subscription ─────────────────────────────────────────────────
log ""
log "── Step 10: SNS alert subscription ─────────────────────────"
SNS_ARN=$(get_output "$COMPUTE_STACK" AlarmSNSTopicArn)
if [ -n "$SNS_ARN" ] && [ "$SNS_ARN" != "None" ]; then
  aws sns subscribe \
    --topic-arn "$SNS_ARN" \
    --protocol email \
    --notification-endpoint renganatha10@gmail.com \
    --region "$REGION" >/dev/null 2>&1 || log "  SNS subscription already exists or failed (not critical)"
  log "  Subscribed renganatha10@gmail.com to $SNS_ARN"
fi

# ── Step 11: GitHub Actions secrets ──────────────────────────────────────────
log ""
log "── Step 11: GitHub Actions secrets ──────────────────────────"
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
    # Use the custom domain for health checks if cert is set, otherwise raw ALB DNS
    ALB_HEALTH="${CERT_ALB:+https://api-manager.rengaonline.in/health}"
    ALB_HEALTH="${ALB_HEALTH:-https://$ALB_DNS/health}"
    set_secret ALB_HEALTH_URL             "$ALB_HEALTH"
    set_secret VITE_ASSETS_BASE_URL       "https://static.rengaonline.in/"
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
  log "    ALB_HEALTH_URL             = https://api-manager.rengaonline.in/health"
  log "    VITE_ASSETS_BASE_URL       = https://static.rengaonline.in/"
fi

# ── Step 12: Monitoring (Prometheus + Grafana) ────────────────────────────────
log ""
log "── Step 12: Monitoring ──────────────────────────────────────"
MONITORING_STACK="api-portal-${ENV}-monitoring"
SSM_GRAFANA_PARAM="/api-portal/${ENV}/grafana-admin-password"
if aws ssm get-parameter --name "$SSM_GRAFANA_PARAM" --region "$REGION" >/dev/null 2>&1; then
  log "  $SSM_GRAFANA_PARAM — already exists, reusing"
else
  GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
  aws ssm put-parameter \
    --name "$SSM_GRAFANA_PARAM" \
    --type SecureString \
    --value "$GRAFANA_PASSWORD" \
    --region "$REGION" >/dev/null
  log "  $SSM_GRAFANA_PARAM — stored"
fi
log "  Uploading Grafana dashboard JSON to S3..."
aws s3 cp "$SCRIPT_DIR/grafana/dashboards/nodejs-otel.json" \
  "s3://$ARTIFACT_BUCKET/grafana/nodejs-otel.json" \
  --region "$REGION" >/dev/null
log "  s3://$ARTIFACT_BUCKET/grafana/nodejs-otel.json — uploaded"

deploy_stack "$MONITORING_STACK" \
  --template-file "$SCRIPT_DIR/5-monitoring.yaml" \
  --parameter-overrides \
    EnvironmentName="$ENV" \
    ArtifactBucketName="$ARTIFACT_BUCKET" \
    ${CERT_METRICS:+MetricsCertArn="$CERT_METRICS"} \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM
GRAFANA_URL=$(get_output "$MONITORING_STACK" GrafanaUrl)
PROMETHEUS_URL=$(get_output "$MONITORING_STACK" PrometheusUrl)
MONITORING_ALB_DNS=$(get_output "$MONITORING_STACK" MonitoringAlbDnsName 2>/dev/null || echo "")
log "  Grafana:    $GRAFANA_URL  (user: admin)"
log "  Prometheus: $PROMETHEUS_URL"
log "  Grafana password: aws ssm get-parameter --name $SSM_GRAFANA_PARAM --with-decryption --query Parameter.Value --output text"
log ""
log "  NOTE: The OTel Collector config on the app EC2 has been updated in the"
log "  CloudFormation template. If the app EC2 is already running, apply the"
log "  new config via SSM Run Command or redeploy the compute stack."

# ── Step 13: GoDaddy DNS alias records ───────────────────────────────────────
CF_DOMAIN=$(get_output "$STORAGE_STACK" DistributionDomain)
COGNITO_CF_DOMAIN=$(get_output "$COGNITO_STACK" CognitoCloudFrontDomain 2>/dev/null || echo "")

log ""
log "── Step 13: GoDaddy DNS alias CNAMEs ────────────────────────"

# Helper: PUT a CNAME record under rengaonline.in via GoDaddy API.
# Strips any trailing dot from the value (AWS outputs never have one, but be safe).
set_godaddy_cname() {
  local subdomain="$1"   # e.g. static
  local target="$2"      # e.g. abc123.cloudfront.net

  if [ -z "$target" ]; then
    log "  SKIP ${subdomain}.rengaonline.in — target not available yet"
    return 0
  fi

  local value="${target%.}"   # strip trailing dot if present
  log "  ${subdomain}.rengaonline.in → ${value}"

  local http_code
  http_code=$(curl -s -o /tmp/gd-response.json -w "%{http_code}" -X PUT \
    "https://api.godaddy.com/v1/domains/rengaonline.in/records/CNAME/${subdomain}" \
    -H "Authorization: sso-key ${GODADDY_KEY}:${GODADDY_SECRET}" \
    -H "Content-Type: application/json" \
    -d "[{\"data\": \"${value}\", \"ttl\": 600}]")

  if [ "$http_code" = "200" ]; then
    log "  ✓ ${subdomain}.rengaonline.in"
  else
    log "  ✗ ${subdomain}.rengaonline.in — HTTP ${http_code}: $(cat /tmp/gd-response.json)"
  fi
}

if [ -z "$GODADDY_KEY" ] || [ -z "$GODADDY_SECRET" ]; then
  log "  GODADDY_KEY / GODADDY_SECRET not set — skipping DNS update."
  log "  Add these CNAMEs in GoDaddy manually:"
  [ -n "$CF_DOMAIN" ]          && log "    static      → $CF_DOMAIN"
  [ -n "$ALB_DNS" ]            && log "    api-manager → $ALB_DNS"
  [ -n "$COGNITO_CF_DOMAIN" ]  && log "    auth        → $COGNITO_CF_DOMAIN"
  [ -n "$MONITORING_ALB_DNS" ] && log "    metrics     → $MONITORING_ALB_DNS"
else
  set_godaddy_cname "static"      "$CF_DOMAIN"
  set_godaddy_cname "api-manager" "$ALB_DNS"
  [ -n "$COGNITO_CF_DOMAIN" ]  && set_godaddy_cname "auth"    "$COGNITO_CF_DOMAIN"
  [ -n "$MONITORING_ALB_DNS" ] && set_godaddy_cname "metrics" "$MONITORING_ALB_DNS"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
log ""
log "═══ Deployment complete: env=$ENV region=$REGION ═══"
log ""
log "Check your email to confirm the SNS alert subscription."

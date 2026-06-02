#!/usr/bin/env bash
# infra/teardown.sh — Teardown api-portal stacks via AWS CLI.
#
# Order: IAM → Compute → Database → Storage → VPC → Cognito
#   - Empties versioned S3 buckets before storage stack delete
#   - Disables CloudFront distribution before storage stack delete (saves ~15 min)
#   - Idempotent: skips stacks that don't exist
#
# Usage:
#   ./infra/teardown.sh [env] [region]
#     env:    prod (default) or staging
#     region: ap-south-1 (default)
#
# Requires: aws cli v2, jq

set -euo pipefail

ENV="${1:-prod}"
REGION="${2:-ap-south-1}"

IAM_STACK="api-portal-${ENV}-iam"
COMPUTE_STACK="api-portal-${ENV}-compute"
DATABASE_STACK="api-portal-${ENV}-database"
STORAGE_STACK="api-portal-${ENV}-storage"
VPC_STACK="api-portal-${ENV}-vpc"
COGNITO_STACK="api-portal-cognito"

TMPDIR_LOCAL=$(mktemp -d)
trap 'rm -rf "$TMPDIR_LOCAL"' EXIT

log() { echo "[teardown] $*"; }

stack_exists() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$REGION" >/dev/null 2>&1
}

delete_stack() {
  local name=$1
  if ! stack_exists "$name"; then
    log "$name — not found, skipping"
    return 0
  fi
  log "$name — deleting"
  aws cloudformation delete-stack --stack-name "$name" --region "$REGION"
  log "$name — waiting for delete to complete"
  if ! aws cloudformation wait stack-delete-complete --stack-name "$name" --region "$REGION"; then
    log "$name — wait failed; recent DELETE_FAILED events:"
    aws cloudformation describe-stack-events \
      --stack-name "$name" --region "$REGION" \
      --query 'StackEvents[?ResourceStatus==`DELETE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
      --output table || true
    return 1
  fi
  log "$name — deleted"
}

empty_bucket() {
  local bucket=$1
  [ -z "$bucket" ] && return 0
  if ! aws s3api head-bucket --bucket "$bucket" --region "$REGION" 2>/dev/null; then
    log "  $bucket — not found, skipping"
    return 0
  fi
  log "  $bucket — emptying"

  local total=0
  while :; do
    local payload
    payload=$(aws s3api list-object-versions \
      --bucket "$bucket" --region "$REGION" --max-items 1000 \
      --query '{Objects:[Versions[].{Key:Key,VersionId:VersionId},DeleteMarkers[].{Key:Key,VersionId:VersionId}][]}' \
      --output json)

    local count
    count=$(echo "$payload" | jq '(.Objects // []) | length')
    if [ "$count" -eq 0 ]; then break; fi

    aws s3api delete-objects --bucket "$bucket" --region "$REGION" \
      --delete "$(echo "$payload" | jq '. + {Quiet: true}')" >/dev/null
    total=$((total + count))
    log "  $bucket — deleted batch of $count (running total: $total)"
  done
  log "  $bucket — empty"
}

disable_cloudfront() {
  local dist_id=$1
  [ -z "$dist_id" ] && return 0

  log "  CloudFront $dist_id — checking state"
  local etag cfg
  etag=$(aws cloudfront get-distribution-config --id "$dist_id" --query 'ETag' --output text)
  cfg=$(aws cloudfront get-distribution-config --id "$dist_id" --query 'DistributionConfig' --output json)

  if [ "$(echo "$cfg" | jq -r '.Enabled')" = "false" ]; then
    log "  CloudFront $dist_id — already disabled"
  else
    echo "$cfg" | jq '.Enabled = false' > "$TMPDIR_LOCAL/cf-config.json"
    aws cloudfront update-distribution \
      --id "$dist_id" \
      --distribution-config "file://$TMPDIR_LOCAL/cf-config.json" \
      --if-match "$etag" >/dev/null
    log "  CloudFront $dist_id — disable submitted"
  fi

  log "  CloudFront $dist_id — waiting for Deployed status (typically 5-10 min)"
  aws cloudfront wait distribution-deployed --id "$dist_id"
  log "  CloudFront $dist_id — disabled and Deployed"
}

remove_bucket_if_lingers() {
  local bucket=$1
  [ -z "$bucket" ] && return 0
  if aws s3api head-bucket --bucket "$bucket" --region "$REGION" 2>/dev/null; then
    log "  $bucket — still exists after stack delete (DeletionPolicy: Retain?); removing via s3 rb"
    aws s3 rb "s3://$bucket" --force --region "$REGION" || log "  $bucket — failed to remove"
  fi
}

# Aurora resources may have DeletionPolicy: Retain on already-deployed stacks.
# Delete instance → cluster → subnet group via AWS CLI so the stack delete is clean.
delete_aurora_resources() {
  local stack=$1
  if ! stack_exists "$stack"; then return 0; fi

  local cluster instance subnet_group
  cluster=$(aws cloudformation list-stack-resources \
    --stack-name "$stack" --region "$REGION" \
    --query "StackResourceSummaries[?ResourceType=='AWS::RDS::DBCluster'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || echo "")
  instance=$(aws cloudformation list-stack-resources \
    --stack-name "$stack" --region "$REGION" \
    --query "StackResourceSummaries[?ResourceType=='AWS::RDS::DBInstance'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || echo "")
  subnet_group=$(aws cloudformation list-stack-resources \
    --stack-name "$stack" --region "$REGION" \
    --query "StackResourceSummaries[?ResourceType=='AWS::RDS::DBSubnetGroup'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -n "$instance" ] && [ "$instance" != "None" ]; then
    if aws rds describe-db-instances --db-instance-identifier "$instance" --region "$REGION" >/dev/null 2>&1; then
      log "  Aurora instance $instance — deleting (no final snapshot)"
      aws rds delete-db-instance \
        --db-instance-identifier "$instance" \
        --skip-final-snapshot \
        --region "$REGION" >/dev/null
      log "  Aurora instance $instance — waiting for deletion"
      aws rds wait db-instance-deleted --db-instance-identifier "$instance" --region "$REGION"
      log "  Aurora instance $instance — deleted"
    fi
  fi

  if [ -n "$cluster" ] && [ "$cluster" != "None" ]; then
    if aws rds describe-db-clusters --db-cluster-identifier "$cluster" --region "$REGION" >/dev/null 2>&1; then
      local protection
      protection=$(aws rds describe-db-clusters --db-cluster-identifier "$cluster" --region "$REGION" \
        --query 'DBClusters[0].DeletionProtection' --output text)
      if [ "$protection" = "True" ] || [ "$protection" = "true" ]; then
        log "  Aurora cluster $cluster — disabling deletion protection"
        aws rds modify-db-cluster \
          --db-cluster-identifier "$cluster" \
          --no-deletion-protection \
          --apply-immediately \
          --region "$REGION" >/dev/null
      fi
      log "  Aurora cluster $cluster — deleting (no final snapshot)"
      aws rds delete-db-cluster \
        --db-cluster-identifier "$cluster" \
        --skip-final-snapshot \
        --region "$REGION" >/dev/null
      log "  Aurora cluster $cluster — waiting for deletion"
      aws rds wait db-cluster-deleted --db-cluster-identifier "$cluster" --region "$REGION"
      log "  Aurora cluster $cluster — deleted"
    fi
  fi

  if [ -n "$subnet_group" ] && [ "$subnet_group" != "None" ]; then
    if aws rds describe-db-subnet-groups --db-subnet-group-name "$subnet_group" --region "$REGION" >/dev/null 2>&1; then
      log "  DB subnet group $subnet_group — deleting"
      aws rds delete-db-subnet-group --db-subnet-group-name "$subnet_group" --region "$REGION"
      log "  DB subnet group $subnet_group — deleted"
    fi
  fi
}

# Cognito UserPool may have DeletionPolicy: Retain on already-deployed stacks.
# Delete the domain then the pool itself (clients are removed with the pool).
delete_cognito_resources() {
  local stack=$1
  if ! stack_exists "$stack"; then return 0; fi

  local pool domain
  pool=$(aws cloudformation list-stack-resources \
    --stack-name "$stack" --region "$REGION" \
    --query "StackResourceSummaries[?ResourceType=='AWS::Cognito::UserPool'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || echo "")

  if [ -n "$pool" ] && [ "$pool" != "None" ]; then
    domain=$(aws cognito-idp describe-user-pool --user-pool-id "$pool" --region "$REGION" \
      --query 'UserPool.Domain' --output text 2>/dev/null || echo "")

    if [ -n "$domain" ] && [ "$domain" != "None" ]; then
      log "  Cognito domain $domain — deleting"
      aws cognito-idp delete-user-pool-domain \
        --domain "$domain" \
        --user-pool-id "$pool" \
        --region "$REGION" >/dev/null 2>&1 || log "  Cognito domain $domain — delete failed (may already be gone)"
    fi

    log "  Cognito UserPool $pool — deleting"
    aws cognito-idp delete-user-pool --user-pool-id "$pool" --region "$REGION"
    log "  Cognito UserPool $pool — deleted"
  fi
}

# Detach all entities from a managed policy then delete it.
delete_managed_policy() {
  local arn=$1
  [ -z "$arn" ] || [ "$arn" = "None" ] && return 0

  log "  Policy $arn — detaching from all entities"
  local entities
  entities=$(aws iam list-entities-for-policy --policy-arn "$arn" \
    --query '{Users:PolicyUsers[].UserName,Roles:PolicyRoles[].RoleName,Groups:PolicyGroups[].GroupName}' \
    --output json 2>/dev/null || echo '{}')

  echo "$entities" | jq -r '.Users[]? // empty' | while read -r user; do
    aws iam detach-user-policy --user-name "$user" --policy-arn "$arn"
    log "    detached from user $user"
  done
  echo "$entities" | jq -r '.Roles[]? // empty' | while read -r role; do
    aws iam detach-role-policy --role-name "$role" --policy-arn "$arn"
    log "    detached from role $role"
  done
  echo "$entities" | jq -r '.Groups[]? // empty' | while read -r group; do
    aws iam detach-group-policy --group-name "$group" --policy-arn "$arn"
    log "    detached from group $group"
  done

  aws iam delete-policy --policy-arn "$arn"
  log "  Policy $arn — deleted"
}

delete_iam_resources() {
  local stack=$1
  if ! stack_exists "$stack"; then return 0; fi

  local app_policy cicd_policy
  app_policy=$(aws cloudformation list-stack-resources \
    --stack-name "$stack" --region "$REGION" \
    --query "StackResourceSummaries[?ResourceType=='AWS::IAM::ManagedPolicy' && LogicalResourceId=='AppPolicy'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || echo "")
  cicd_policy=$(aws cloudformation list-stack-resources \
    --stack-name "$stack" --region "$REGION" \
    --query "StackResourceSummaries[?ResourceType=='AWS::IAM::ManagedPolicy' && LogicalResourceId=='CICDPolicy'].PhysicalResourceId | [0]" \
    --output text 2>/dev/null || echo "")

  delete_managed_policy "$app_policy"
  delete_managed_policy "$cicd_policy"
}

# ────────────────────────────────────────────────────────────────────────────
log "═══ Teardown: env=$ENV region=$REGION ═══"

# Step 1 — IAM (no Fn::ImportValue dependents)
log ""
log "── Step 1: IAM ─────────────────────────────────────────────"
delete_iam_resources "$IAM_STACK"
delete_stack "$IAM_STACK"

# Step 2 — Compute (imports VPC subnets/SGs; must go before VPC)
log ""
log "── Step 2: Compute ─────────────────────────────────────────"
delete_stack "$COMPUTE_STACK"
# Remove log groups that CloudFormation won't delete automatically (no DeletionPolicy)
for lg in /app/ec2/application /app/ec2/system /app/ec2/deploys; do
  if aws logs describe-log-groups --log-group-name-prefix "$lg" --region "$REGION" \
      --query 'logGroups[0].logGroupName' --output text 2>/dev/null | grep -q "$lg"; then
    aws logs delete-log-group --log-group-name "$lg" --region "$REGION"
    log "  $lg — deleted"
  fi
done

# Step 3 — Database (imports VPC subnets/SG; force-deletes Aurora resources first)
log ""
log "── Step 3: Database ────────────────────────────────────────"
delete_aurora_resources "$DATABASE_STACK"
delete_stack "$DATABASE_STACK"

# Step 4 — Storage (empty S3 + disable CloudFront before stack delete)
log ""
log "── Step 4: Storage ─────────────────────────────────────────"
ASSETS_BUCKET=""
ARTIFACT_BUCKET=""
CF_DIST=""
if stack_exists "$STORAGE_STACK"; then
  get_output() {
    aws cloudformation describe-stacks \
      --stack-name "$STORAGE_STACK" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey==\`$1\`].OutputValue" \
      --output text 2>/dev/null || echo ""
  }
  ASSETS_BUCKET=$(get_output AssetsBucketName)
  ARTIFACT_BUCKET=$(get_output ArtifactBucketName)
  CF_DIST=$(get_output DistributionId)

  disable_cloudfront "$CF_DIST"
  empty_bucket "$ASSETS_BUCKET"
  empty_bucket "$ARTIFACT_BUCKET"
fi
delete_stack "$STORAGE_STACK"
# Safety net: remove buckets if stack delete left them behind
remove_bucket_if_lingers "$ASSETS_BUCKET"
remove_bucket_if_lingers "$ARTIFACT_BUCKET"

# Step 5 — VPC (Compute + Database now gone)
log ""
log "── Step 5: VPC ─────────────────────────────────────────────"
delete_stack "$VPC_STACK"

# Step 6 — Cognito (force-delete UserPool + domain first)
log ""
log "── Step 6: Cognito ─────────────────────────────────────────"
delete_cognito_resources "$COGNITO_STACK"
delete_stack "$COGNITO_STACK"

log ""
log "═══ Teardown complete ═══"
log ""
log "Remaining (not deleted by this script — clean up manually if needed):"
log "  - SSM parameters under /api-portal/"
log "  - CloudWatch log groups under /aws/rds/, /api-portal/"
log ""
log "Manual cleanup commands:"
log "  aws ssm delete-parameters --names \$(aws ssm get-parameters-by-path --path /api-portal/ --recursive --region $REGION --query 'Parameters[].Name' --output text) --region $REGION"
log "  aws logs describe-log-groups --log-group-name-prefix /api-portal --region $REGION --query 'logGroups[].logGroupName' --output text | xargs -n1 aws logs delete-log-group --region $REGION --log-group-name"

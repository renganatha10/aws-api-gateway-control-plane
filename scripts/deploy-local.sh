#!/usr/bin/env bash
# Local deploy: build → upload to S3 → ansible over SSH to EC2
#
# Usage:
#   ./scripts/deploy-local.sh
#
# Optional overrides:
#   ARTIFACT_BUCKET=my-bucket ./scripts/deploy-local.sh
#   SHA=abc1234 ./scripts/deploy-local.sh   # deploy a specific commit
#
# Prerequisites:
#   - ansible installed locally  (pip install ansible)
#   - AWS CLI configured with cicd-user credentials (or admin for testing)
#   - ansible/inventory.ini filled in with EC2 public IP + key path

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}══ $* ${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

REGION="${AWS_REGION:-ap-south-1}"
SHA="${SHA:-$(git rev-parse --short HEAD)}"

# ── Resolve artifact bucket ───────────────────────────────────────────────────
if [[ -z "${ARTIFACT_BUCKET:-}" ]]; then
  warn "ARTIFACT_BUCKET not set — looking up from CloudFormation..."
  ENV="${ENV:-prod}"
  ARTIFACT_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "api-portal-$ENV-storage" --region us-east-1 \
    --query 'Stacks[0].Outputs[?OutputKey==`ArtifactBucketName`].OutputValue' \
    --output text 2>/dev/null) || die "Could not resolve artifact bucket. Set ARTIFACT_BUCKET env var or deploy infra first."
fi

[[ -z "$ARTIFACT_BUCKET" ]] && die "Artifact bucket is empty. Set ARTIFACT_BUCKET=<bucket> and retry."

echo "SHA:    $SHA"
echo "Bucket: $ARTIFACT_BUCKET"
echo "Region: $REGION"

# ── Step 1: Build ─────────────────────────────────────────────────────────────
step "1/3 | Build"
npm run build
ok "Build complete"

# ── Step 2: Upload artifact to S3 ─────────────────────────────────────────────
step "2/3 | Upload artifact → s3://$ARTIFACT_BUCKET/api-portal/$SHA/"

# Upload build output + server files needed to run on EC2
aws s3 sync build/           "s3://$ARTIFACT_BUCKET/api-portal/$SHA/build/"           --region "$REGION"
aws s3 sync node_modules/    "s3://$ARTIFACT_BUCKET/api-portal/$SHA/node_modules/"    --region "$REGION" --exclude "*.map"
aws s3 sync db/migrations/   "s3://$ARTIFACT_BUCKET/api-portal/$SHA/db/migrations/"   --region "$REGION"
aws s3 cp package.json       "s3://$ARTIFACT_BUCKET/api-portal/$SHA/package.json"     --region "$REGION"
aws s3 cp package-lock.json  "s3://$ARTIFACT_BUCKET/api-portal/$SHA/package-lock.json" --region "$REGION"

# Upload ecosystem config if it exists
[[ -f ecosystem.config.cjs ]] && \
  aws s3 cp ecosystem.config.cjs "s3://$ARTIFACT_BUCKET/api-portal/$SHA/ecosystem.config.cjs" --region "$REGION"

ok "Artifact uploaded"

# ── Step 3: Deploy via Ansible over SSH ───────────────────────────────────────
step "3/3 | Deploy via Ansible (SSH → EC2)"

INVENTORY="ansible/inventory.ini"
PLAYBOOK="ansible/deploy-ssh.yml"

[[ -f "$INVENTORY" ]] || die "Inventory not found at $INVENTORY"
grep -q "<EC2_PUBLIC_IP>" "$INVENTORY" && die "Fill in ansible_host in $INVENTORY before deploying"

ansible-playbook "$PLAYBOOK" \
  -i "$INVENTORY" \
  -e "git_sha=$SHA" \
  -e "artifact_bucket=$ARTIFACT_BUCKET" \
  -v

ok "Deploy complete — SHA $SHA is live"

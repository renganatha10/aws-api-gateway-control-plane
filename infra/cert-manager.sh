#!/usr/bin/env bash
# infra/cert-manager.sh — Provision ACM certificates with GoDaddy DNS validation.
#
# Certificates managed:
#   static.rengaonline.in      → us-east-1   (CloudFront — must be us-east-1)
#   api-manager.rengaonline.in → ap-south-1  (Application Load Balancer)
#   auth.rengaonline.in        → us-east-1   (Cognito custom domain — must be us-east-1)
#   metrics.rengaonline.in     → ap-south-1  (Monitoring EC2 ALB)
#
# ARNs stored in SSM Parameter Store after issuance:
#   /api-portal/certs/static        (us-east-1 cert)
#   /api-portal/certs/api-manager   (ap-south-1 cert)
#   /api-portal/certs/auth          (us-east-1 cert)
#   /api-portal/certs/metrics       (ap-south-1 cert)
#
# Required env vars:
#   GODADDY_KEY    — GoDaddy OTE API key
#   GODADDY_SECRET — GoDaddy OTE API secret
#
# Usage:
#   export GODADDY_KEY=<key> GODADDY_SECRET=<secret>
#   ./infra/cert-manager.sh [ap-south-1]

set -euo pipefail

GODADDY_KEY="${GODADDY_KEY:?Set GODADDY_KEY env var before running}"
GODADDY_SECRET="${GODADDY_SECRET:?Set GODADDY_SECRET env var before running}"
GODADDY_DOMAIN="rengaonline.in"
GODADDY_API="https://api.godaddy.com"

AP_REGION="${1:-ap-south-1}"
US_REGION="us-east-1"

log() { echo "[cert-manager] $*" >&2; }
err() { echo "[cert-manager] ERROR: $*" >&2; }

# ── GoDaddy helpers ────────────────────────────────────────────────────────────

# Strip the domain suffix and trailing dot from an ACM CNAME name.
# ACM gives: _abc.static.rengaonline.in.  → we need: _abc.static
strip_domain() {
  local fqdn="${1%.}"                      # remove trailing dot
  echo "${fqdn%.${GODADDY_DOMAIN}}"        # remove .rengaonline.in
}

# Strip trailing dot from a CNAME value.
strip_dot() { echo "${1%.}"; }

# Add a CNAME record to GoDaddy DNS.
add_godaddy_cname() {
  local name="$1"    # e.g. _abc123.static
  local value="$2"   # e.g. _xyz.acm-validations.aws
  log "    GoDaddy PUT CNAME: ${name}.${GODADDY_DOMAIN} → ${value}"
  curl -sf -X PUT \
    "${GODADDY_API}/v1/domains/${GODADDY_DOMAIN}/records/CNAME/${name}" \
    -H "Authorization: sso-key ${GODADDY_KEY}:${GODADDY_SECRET}" \
    -H "Content-Type: application/json" \
    -d "[{\"data\": \"${value}\", \"ttl\": 600}]" \
    || { err "GoDaddy PUT failed for ${name}"; return 1; }
  log "    ✓ GoDaddy CNAME added: ${name}.${GODADDY_DOMAIN}"
}

# ── ACM helpers ────────────────────────────────────────────────────────────────

# Return the status of an ACM cert ARN, or empty string if it no longer exists.
cert_status() {
  local arn="$1"
  local region="$2"
  aws acm describe-certificate --certificate-arn "$arn" \
    --region "$region" \
    --query 'Certificate.Status' --output text 2>/dev/null || echo ""
}

# Ensure a cert exists for the given subdomain and return its ARN.
# Idempotency logic (in priority order):
#   1. SSM cache hit + ISSUED            → reuse, skip everything
#   2. SSM cache hit + PENDING_VALIDATION → reuse (DNS already added or pending), skip request
#   3. SSM cache hit + FAILED/EXPIRED/gone → request a new cert
#   4. No SSM cache                       → request a new cert
# The ACM idempotency token guards against duplicate requests within the same
# session only (token window is 3 hours; we never rely on it across re-runs).
request_cert() {
  local subdomain="$1"
  local region="$2"
  local domain="${subdomain}.${GODADDY_DOMAIN}"

  log "  Checking SSM cache for ${subdomain}..."
  local cached
  cached=$(read_arn "$subdomain")

  if [ -n "$cached" ]; then
    log "  SSM cache hit: ${cached}"
    log "  Checking ACM status for ${domain} in ${region}..."
    local status
    status=$(cert_status "$cached" "$region")
    log "  ACM status: ${status}"
    case "$status" in
      ISSUED)
        log "  ✓ ${domain} — already ISSUED, skipping (${cached})"
        echo "$cached"
        return 0
        ;;
      PENDING_VALIDATION)
        log "  ${domain} — PENDING_VALIDATION, reusing existing cert (${cached})"
        echo "$cached"
        return 0
        ;;
      FAILED|REVOKED|EXPIRED|VALIDATION_TIMED_OUT)
        log "  ${domain} — cert is ${status}, requesting a replacement"
        ;;
      "")
        log "  ${domain} — cached ARN no longer exists in ACM, requesting new"
        ;;
    esac
  else
    log "  SSM cache miss for ${subdomain}"
  fi

  # No valid cert found — request a new one.
  # Idempotency token deduplicates parallel/rapid re-runs within the same 3-hour window.
  local token
  token=$(echo "apportal-${subdomain}" | tr -cd 'a-zA-Z0-9' | cut -c1-32)

  log "  Requesting ACM certificate for ${domain} in ${region} (token: ${token})..."
  local arn
  arn=$(aws acm request-certificate \
    --domain-name "$domain" \
    --validation-method DNS \
    --idempotency-token "$token" \
    --region "$region" \
    --query CertificateArn --output text)

  log "  ${domain} → new cert ARN: ${arn}"
  store_arn "$subdomain" "$arn"
  echo "$arn"
}

# Block until ACM generates the DNS validation CNAME (usually <30s after request).
# Prints "name|value" to stdout.
wait_for_dns_record() {
  local cert_arn="$1"
  local region="$2"
  local domain="$3"
  local attempts=60  # 60 × 5s = 5 min

  log "  Polling ACM for validation CNAME (up to $((attempts * 5))s) — ARN: ${cert_arn}"
  for i in $(seq 1 $attempts); do
    local raw_json name value cert_status_now
    raw_json=$(aws acm describe-certificate --certificate-arn "$cert_arn" \
      --region "$region" \
      --query 'Certificate.{Status:Status,Options:DomainValidationOptions[0]}' \
      --output json 2>/dev/null || echo "{}")

    cert_status_now=$(echo "$raw_json" | grep -o '"Status": *"[^"]*"' | grep -o '[A-Z_]*"' | tr -d '"' || echo "UNKNOWN")
    name=$(aws acm describe-certificate --certificate-arn "$cert_arn" \
      --region "$region" \
      --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
      --output text 2>/dev/null || echo "")
    value=$(aws acm describe-certificate --certificate-arn "$cert_arn" \
      --region "$region" \
      --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' \
      --output text 2>/dev/null || echo "")

    if [ -n "$name" ] && [ "$name" != "None" ] && [ "$name" != "null" ]; then
      log "  ✓ Validation record ready for ${domain} (attempt ${i}/${attempts})"
      log "    Name:  ${name}"
      log "    Value: ${value}"
      echo "${name}|${value}"
      return 0
    fi

    if (( i % 6 == 0 )); then
      log "  ... ${domain} status=${cert_status_now}, CNAME not yet available (${i}0s elapsed)"
    fi
    sleep 5
  done

  err "Timed out waiting for ACM validation record for ${domain} (5 min)."
  err "Run: aws acm describe-certificate --certificate-arn ${cert_arn} --region ${region}"
  return 1
}

# Block until the cert reaches ISSUED status (up to 15 min for DNS propagation).
wait_for_issued() {
  local cert_arn="$1"
  local region="$2"
  local domain="$3"
  local attempts=90  # 90 × 10s = 15 min

  log "  Waiting for ${domain} to become ISSUED..."
  for i in $(seq 1 $attempts); do
    local status
    status=$(aws acm describe-certificate --certificate-arn "$cert_arn" \
      --region "$region" \
      --query 'Certificate.Status' --output text 2>/dev/null || echo "UNKNOWN")

    case "$status" in
      ISSUED)
        log "  ✓ ${domain} — ISSUED"
        return 0
        ;;
      FAILED)
        err "${domain} certificate failed. Check ACM console for details."
        return 1
        ;;
    esac

    # Print progress every 30s
    if (( i % 3 == 0 )); then
      log "  ... ${domain} status=${status} (${i}0s elapsed)"
    fi
    sleep 10
  done

  err "Timed out waiting for ${domain} to become ISSUED (15 min)."
  err "DNS may still be propagating — re-run cert-manager.sh to continue."
  return 1
}

# Store cert ARN in SSM (AP region stores all ARN pointers for easy lookup by deploy.sh).
store_arn() {
  local subdomain="$1"
  local arn="$2"
  log "  Storing ARN in SSM: /api-portal/certs/${subdomain} = ${arn}"
  aws ssm put-parameter \
    --name "/api-portal/certs/${subdomain}" \
    --type String \
    --overwrite \
    --value "$arn" \
    --region "$AP_REGION" >/dev/null
  log "  ✓ SSM parameter stored"
}

# Read cert ARN from SSM; returns empty string if not found.
read_arn() {
  local subdomain="$1"
  aws ssm get-parameter \
    --name "/api-portal/certs/${subdomain}" \
    --region "$AP_REGION" \
    --query 'Parameter.Value' --output text 2>/dev/null || echo ""
}

# Check if a cert ARN is currently ISSUED.
is_issued() {
  local arn="$1"
  local region="$2"
  local status
  status=$(aws acm describe-certificate --certificate-arn "$arn" \
    --region "$region" --query 'Certificate.Status' --output text 2>/dev/null || echo "")
  [ "$status" = "ISSUED" ]
}

# ── Main ───────────────────────────────────────────────────────────────────────

log ""
log "═══ cert-manager: ${GODADDY_DOMAIN} ═══"
log ""

# subdomain → ACM region
declare -A REGIONS=(
  ["static"]="$US_REGION"
  ["api-manager"]="$AP_REGION"
  ["auth"]="$US_REGION"
  ["metrics"]="$AP_REGION"
)

declare -A ARNS=()

# ── Step 1: Request certificates ─────────────────────────────────────────────
# request_cert is fully idempotent: reuses ISSUED or PENDING_VALIDATION certs
# from SSM cache; only requests a new cert when the cached one is gone/failed.
log "── Step 1: Request ACM certificates ─────────────────────────────────────"
for sub in static api-manager auth metrics; do
  region="${REGIONS[$sub]}"
  log "  → ${sub}.${GODADDY_DOMAIN} (region: ${region})"
  ARNS["$sub"]=$(request_cert "$sub" "$region")
  log ""
done

# ── Step 2: Fetch validation CNAMEs + add to GoDaddy ─────────────────────────
log ""
log "── Step 2: Add GoDaddy DNS validation CNAMEs ────────────────────────────"
for sub in static api-manager auth metrics; do
  region="${REGIONS[$sub]}"
  domain="${sub}.${GODADDY_DOMAIN}"
  arn="${ARNS[$sub]}"

  # Skip certs that are already ISSUED (CNAME already validated)
  if [ "$(cert_status "$arn" "$region")" = "ISSUED" ]; then
    log "  ✓ ${domain} — already ISSUED, CNAME not needed"
    continue
  fi

  log "  Fetching validation record for ${domain}..."
  pair=$(wait_for_dns_record "$arn" "$region" "$domain")
  raw_name=$(echo "$pair" | cut -d'|' -f1)
  raw_value=$(echo "$pair" | cut -d'|' -f2)

  gd_name=$(strip_domain "$raw_name")
  gd_value=$(strip_dot "$raw_value")

  log "  Stripped GoDaddy name:  ${gd_name}"
  log "  Stripped GoDaddy value: ${gd_value}"
  add_godaddy_cname "$gd_name" "$gd_value"
done

# ── Step 3: Wait for all certs to reach ISSUED ────────────────────────────────
log ""
log "── Step 3: Wait for ISSUED status ───────────────────────────────────────"
for sub in static api-manager auth metrics; do
  region="${REGIONS[$sub]}"
  domain="${sub}.${GODADDY_DOMAIN}"
  arn="${ARNS[$sub]}"
  wait_for_issued "$arn" "$region" "$domain"
done

# ── Summary ────────────────────────────────────────────────────────────────────
log ""
log "═══ All 4 certificates ISSUED ═══"
log ""
log "SSM paths (read by deploy.sh automatically):"
for sub in static api-manager auth metrics; do
  log "  /api-portal/certs/${sub}  =  ${ARNS[$sub]}"
done
log ""
log "After deploy.sh completes, add these alias records in GoDaddy:"
log "  static.rengaonline.in      CNAME → CloudFront distribution domain"
log "  api-manager.rengaonline.in CNAME → ALB DNS name"
log "  auth.rengaonline.in        CNAME → Cognito CloudFront distribution domain"
log "  metrics.rengaonline.in     CNAME → Monitoring ALB DNS name"
log ""
log "deploy.sh will print the target values for each record after deployment."

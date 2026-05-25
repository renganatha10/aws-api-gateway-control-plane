#!/usr/bin/env bash
# One-time setup: installs PM2, the CloudWatch agent, and wires up the log pipeline.
# Non-sudo steps run automatically. Sudo steps are printed for you to copy-paste.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$HOME/logs/api-portal"
CW_AGENT_BIN="/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl"
CW_AGENT_DEB="/tmp/amazon-cloudwatch-agent.deb"
CW_CONFIG="$PROJECT_DIR/cloudwatch-agent-local.json"

log()  { echo "[setup] $*"; }
warn() { echo "[setup] WARN: $*"; }
die()  { echo "[setup] ERROR: $*" >&2; exit 1; }

SUDO_STEPS=()
add_sudo() { SUDO_STEPS+=("$*"); }

# ── 1. Create log directory ───────────────────────────────────────────────────
log "Creating log directory: $LOG_DIR"
mkdir -p "$LOG_DIR"

# ── 2. Install PM2 ───────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  log "Installing PM2 globally..."
  npm install -g pm2
else
  log "PM2 already installed: $(pm2 --version | tail -1)"
fi

# ── 3. Download CloudWatch agent deb ─────────────────────────────────────────
if [ ! -f "$CW_AGENT_BIN" ]; then
  if [ ! -f "$CW_AGENT_DEB" ]; then
    log "Downloading Amazon CloudWatch Agent..."
    curl -fsSL \
      "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb" \
      -o "$CW_AGENT_DEB"
    log "Downloaded: $CW_AGENT_DEB"
  else
    log "CloudWatch Agent deb already downloaded: $CW_AGENT_DEB"
  fi
  add_sudo "dpkg -i -E $CW_AGENT_DEB"
  add_sudo "$CW_AGENT_BIN -a fetch-config -m onPremise -c file:$CW_CONFIG -s"
else
  log "CloudWatch Agent already installed — reconfiguring..."
  if sudo -n true 2>/dev/null; then
    sudo "$CW_AGENT_BIN" -a fetch-config -m onPremise -c "file:$CW_CONFIG" -s
  else
    add_sudo "$CW_AGENT_BIN -a fetch-config -m onPremise -c file:$CW_CONFIG -s"
  fi
fi

# ── 4. AWS credentials ────────────────────────────────────────────────────────
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -d "$HOME/.aws" ] || [ ! -f "$HOME/.aws/credentials" ]; then
  if [ -f "$ENV_FILE" ]; then
    AWS_KEY="$(grep '^AWS_ACCESS_KEY_ID=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
    AWS_SECRET="$(grep '^AWS_SECRET_ACCESS_KEY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"
    AWS_REGION_VAL="$(grep '^AWS_REGION=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '\r' || true)"

    if [ -n "$AWS_KEY" ] && [[ "$AWS_KEY" != *EXAMPLE* ]]; then
      log "Writing ~/.aws credentials from .env..."
      mkdir -p "$HOME/.aws"
      cat > "$HOME/.aws/credentials" <<EOF
[default]
aws_access_key_id = $AWS_KEY
aws_secret_access_key = $AWS_SECRET
EOF
      cat > "$HOME/.aws/config" <<EOF
[default]
region = ${AWS_REGION_VAL:-ap-south-1}
output = json
EOF
      chmod 600 "$HOME/.aws/credentials"
      log "~/.aws/credentials written."
    else
      warn ".env has placeholder AWS credentials."
      warn "Create a real .env (copy from .env.example) and re-run this script,"
      warn "OR manually run: aws configure"
    fi
  else
    warn "No .env file found and no ~/.aws/credentials."
    warn "Create .env from .env.example with real AWS keys, then re-run this script."
  fi
else
  log "~/.aws/credentials already exists."
fi

# ── 5. Print pending sudo steps ───────────────────────────────────────────────
if [ ${#SUDO_STEPS[@]} -gt 0 ]; then
  echo ""
  echo "══════════════════════════════════════════════════════════════"
  echo "  Manual step required — run these commands in your terminal:"
  echo "══════════════════════════════════════════════════════════════"
  for cmd in "${SUDO_STEPS[@]}"; do
    echo "  sudo $cmd"
  done
  echo "══════════════════════════════════════════════════════════════"
  echo ""
  echo "In Claude Code terminal, prefix each with !  e.g.:"
  for cmd in "${SUDO_STEPS[@]}"; do
    echo "  ! sudo $cmd"
  done
  echo ""
else
  echo ""
  log "Setup complete. Run: npm run build && scripts/start-local.sh"
fi

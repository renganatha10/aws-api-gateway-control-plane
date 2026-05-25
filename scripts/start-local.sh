#!/usr/bin/env bash
# Starts PM2 (app) and the CloudWatch agent for local development.
# Run after setup-local-monitoring.sh has been executed once.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$HOME/logs/api-portal"
ENV_FILE="$PROJECT_DIR/.env"
ECOSYSTEM="$PROJECT_DIR/ecosystem.local.config.cjs"
CW_AGENT_BIN="/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl"

log() { echo "[start] $*"; }
die() { echo "[start] ERROR: $*" >&2; exit 1; }

# ── Guards ────────────────────────────────────────────────────────────────────
command -v pm2 &>/dev/null || die "PM2 not found. Run scripts/setup-local-monitoring.sh first."
[ -f "$CW_AGENT_BIN" ]     || die "CloudWatch agent not found. Run scripts/setup-local-monitoring.sh first."
[ -f "$PROJECT_DIR/build/server/index.js" ] \
  || die "Build not found. Run 'npm run build' first."

# ── Load .env into the current shell so PM2 inherits them ────────────────────
if [ -f "$ENV_FILE" ]; then
  log "Loading .env..."
  set -a
  # shellcheck disable=SC1090
  source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
  set +a
fi

# ── Ensure log dir exists ─────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Start / reload PM2 ───────────────────────────────────────────────────────
# Delete + start fresh (not reload): pm2 caches the env from first launch and
# `reload --update-env` does not reliably refresh it, so a stale/empty
# DATABASE_URL would silently persist across restarts.
if pm2 describe api-portal-local &>/dev/null; then
  log "Removing existing PM2 process to pick up current .env..."
  pm2 delete api-portal-local
fi
log "Starting PM2..."
pm2 start "$ECOSYSTEM"

# ── Start CloudWatch agent ────────────────────────────────────────────────────
CW_STATUS=$(sudo "$CW_AGENT_BIN" -a status 2>/dev/null | grep '"status"' | tr -d ' ",' | cut -d: -f2 || echo "unknown")
if [ "$CW_STATUS" = "running" ]; then
  log "CloudWatch agent already running."
else
  log "Starting CloudWatch agent..."
  sudo "$CW_AGENT_BIN" -a start
fi

# ── Summary ───────────────────────────────────────────────────────────────────
log ""
log "App is running on http://localhost:3000"
log ""
log "Useful commands:"
log "  pm2 logs api-portal-local          # stream live logs from PM2"
log "  tail -f $LOG_DIR/out.log           # same logs on disk"
log "  tail -f /tmp/amazon-cloudwatch-agent.log  # agent debug log"
log "  pm2 stop api-portal-local          # stop the app"
log "  sudo $CW_AGENT_BIN -a stop         # stop the CW agent"
log ""
log "CloudWatch log group: /api-portal/local"
log "  stdout stream: stdout"
log "  stderr stream: stderr"

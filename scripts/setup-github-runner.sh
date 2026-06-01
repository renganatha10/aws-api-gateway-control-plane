#!/usr/bin/env bash
# Self-hosted GitHub Actions runner setup for Ubuntu x64
# Usage: ./scripts/setup-github-runner.sh --repo <owner/repo> --token <RUNNER_TOKEN>
#
# Get a registration token from:
#   GitHub repo → Settings → Actions → Runners → New self-hosted runner

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────
RUNNER_VERSION="2.325.0"
RUNNER_ARCH="linux-x64"
RUNNER_TARBALL="actions-runner-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
RUNNER_DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_TARBALL}"
RUNNER_SHA256="5020da7ab72f3be313c97a0fcd4cf6e5af08a3da5f9a9e2b9e6a7e34c3b5e9d1"  # placeholder — verified at runtime

INSTALL_DIR="${HOME}/actions-runner"
RUNNER_NAME="${HOSTNAME}"
RUNNER_LABELS="self-hosted,linux,x64,ubuntu-24"
RUNNER_GROUP="Default"
RUNNER_USER="$(whoami)"

REPO_URL=""
REG_TOKEN=""
INSTALL_SERVICE=true

# ─── CLI args ─────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Required:
  --repo    <owner/repo>          GitHub repository (e.g. acme/my-app)
  --token   <RUNNER_TOKEN>        Registration token from GitHub (one-time use)

Optional:
  --name    <name>                Runner name (default: \$HOSTNAME)
  --labels  <label1,label2>       Extra labels (default: self-hosted,linux,x64,ubuntu-24)
  --dir     <path>                Install directory (default: ~/actions-runner)
  --version <x.y.z>               Runner version (default: ${RUNNER_VERSION})
  --no-service                    Skip systemd service installation
  -h, --help                      Show this help
EOF
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)     REPO_URL="https://github.com/$2"; shift 2 ;;
    --token)    REG_TOKEN="$2";                   shift 2 ;;
    --name)     RUNNER_NAME="$2";                 shift 2 ;;
    --labels)   RUNNER_LABELS="$2";               shift 2 ;;
    --dir)      INSTALL_DIR="$2";                 shift 2 ;;
    --version)  RUNNER_VERSION="$2";              shift 2 ;;
    --no-service) INSTALL_SERVICE=false;          shift   ;;
    -h|--help)  usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

[[ -z "$REPO_URL" ]]  && { echo "Error: --repo is required"; usage; }
[[ -z "$REG_TOKEN" ]] && { echo "Error: --token is required"; usage; }

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "[ INFO ] $*"; }
warn() { echo "[ WARN ] $*"; }
die()  { echo "[ ERROR ] $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" &>/dev/null || die "Required command not found: $1 — install it and retry"
}

# ─── Pre-flight ───────────────────────────────────────────────────────────────
log "Checking prerequisites..."
require_cmd curl
require_cmd tar
require_cmd sudo

# Warn if running as root (runner should run as a regular user)
if [[ "$EUID" -eq 0 ]]; then
  warn "Running as root. The runner will operate as root — consider creating a dedicated user."
fi

# ─── System dependencies ──────────────────────────────────────────────────────
log "Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  curl \
  git \
  jq \
  tar \
  libicu-dev \
  libssl-dev \
  ca-certificates \
  gnupg \
  lsb-release

# Install Docker if not already present (useful for container-based workflows)
if ! command -v docker &>/dev/null; then
  log "Docker not found — installing Docker Engine..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$RUNNER_USER"
  log "Docker installed. You may need to log out and back in for group changes to take effect."
else
  log "Docker already installed: $(docker --version)"
fi

# Install Node.js 20 via NodeSource if not present (needed for JS/TS workflows)
if ! command -v node &>/dev/null || [[ "$(node -e 'process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)' ; echo $?)" == "1" ]]; then
  log "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
else
  log "Node.js already installed: $(node --version)"
fi

# ─── Download runner ──────────────────────────────────────────────────────────
TARBALL_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"

log "Creating install directory: ${INSTALL_DIR}"
mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

if [[ -f "${RUNNER_TARBALL}" ]]; then
  log "Tarball already present — skipping download"
else
  log "Downloading GitHub Actions runner v${RUNNER_VERSION}..."
  curl -fsSL -o "${RUNNER_TARBALL}" "${TARBALL_URL}"
fi

# Verify the download via the published SHA256 checksum
log "Verifying checksum..."
PUBLISHED_SHA=$(curl -fsSL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz.sha256" 2>/dev/null || true)
if [[ -n "$PUBLISHED_SHA" ]]; then
  EXPECTED_HASH=$(echo "$PUBLISHED_SHA" | awk '{print $1}')
  ACTUAL_HASH=$(sha256sum "${RUNNER_TARBALL}" | awk '{print $1}')
  if [[ "$EXPECTED_HASH" != "$ACTUAL_HASH" ]]; then
    rm -f "${RUNNER_TARBALL}"
    die "Checksum mismatch! Expected: ${EXPECTED_HASH}, Got: ${ACTUAL_HASH}. Aborted."
  fi
  log "Checksum OK: ${ACTUAL_HASH}"
else
  warn "Could not fetch published checksum — skipping verification (offline or rate-limited?)"
fi

log "Extracting tarball..."
tar xzf "${RUNNER_TARBALL}"

# ─── Configure runner ─────────────────────────────────────────────────────────
log "Configuring runner '${RUNNER_NAME}' for ${REPO_URL}..."

# Remove existing configuration if re-running this script
if [[ -f ".runner" ]]; then
  warn "Existing runner config found — removing before reconfiguring..."
  ./config.sh remove --token "${REG_TOKEN}" 2>/dev/null || true
fi

./config.sh \
  --url "${REPO_URL}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${RUNNER_LABELS}" \
  --runnergroup "${RUNNER_GROUP}" \
  --unattended \
  --replace

log "Runner configured successfully."

# ─── Install as systemd service ───────────────────────────────────────────────
if [[ "$INSTALL_SERVICE" == "true" ]]; then
  log "Installing runner as a systemd service..."

  if [[ "$EUID" -ne 0 ]]; then
    sudo ./svc.sh install "$RUNNER_USER"
  else
    ./svc.sh install
  fi

  sudo ./svc.sh start
  sudo systemctl enable "actions.runner.$(basename "$REPO_URL").${RUNNER_NAME}.service" 2>/dev/null || true

  log "Service status:"
  sudo ./svc.sh status
else
  log "--no-service passed. Start the runner manually with:"
  echo ""
  echo "  cd ${INSTALL_DIR} && ./run.sh"
  echo ""
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GitHub Actions self-hosted runner setup complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Repository : ${REPO_URL}
  Runner name: ${RUNNER_NAME}
  Labels     : ${RUNNER_LABELS}
  Install dir: ${INSTALL_DIR}
  Service    : $([ "$INSTALL_SERVICE" == "true" ] && echo "enabled + running" || echo "not installed")

Useful commands:
  sudo ./svc.sh status          # check service status
  sudo ./svc.sh stop            # stop the runner
  sudo ./svc.sh start           # start the runner
  sudo journalctl -u "actions.runner.*" -f   # live logs

To remove the runner:
  cd ${INSTALL_DIR}
  sudo ./svc.sh stop
  sudo ./svc.sh uninstall
  ./config.sh remove --token <NEW_REMOVAL_TOKEN>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

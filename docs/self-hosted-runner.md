# Self-Hosted GitHub Actions Runner

A setup script is provided at `scripts/setup-github-runner.sh` to register this Ubuntu machine as a self-hosted GitHub Actions runner. The runner lets CI/CD workflows execute directly on your infrastructure — useful when jobs need access to internal networks, AWS credentials on the host, or Docker without rate limits.

## Prerequisites

- Ubuntu 22.04 or 24.04 (x64)
- `sudo` access
- A GitHub account with **Admin** access to the repository

The script installs any missing system dependencies automatically (Docker, Node.js 20, Git, etc.).

## Quick start

**Step 1 — get a registration token**

In GitHub: **Repo → Settings → Actions → Runners → New self-hosted runner**

Copy the token shown under the "Configure" section. It expires in one hour.

**Step 2 — run the setup script**

```bash
./scripts/setup-github-runner.sh \
  --repo your-org/your-repo \
  --token AXXXXXXXXXXXXXXXXXXXXXXXXX
```

The script will:

1. Install system dependencies (`curl`, `git`, `libicu`, Docker Engine, Node.js 20)
2. Download and verify the GitHub Actions runner binary (SHA256 checked against GitHub's published hash)
3. Register the runner with your repository using the one-time token
4. Install and enable a systemd service so the runner starts automatically on boot

## Options

| Flag | Default | Description |
|---|---|---|
| `--repo <owner/repo>` | _(required)_ | GitHub repository to register against |
| `--token <token>` | _(required)_ | One-time registration token from GitHub |
| `--name <name>` | `$HOSTNAME` | Display name shown in GitHub's runner list |
| `--labels <l1,l2>` | `self-hosted,linux,x64,ubuntu-24` | Labels used to target this runner in workflows |
| `--dir <path>` | `~/actions-runner` | Where to install the runner files |
| `--version <x.y.z>` | `2.325.0` | Runner version to download |
| `--no-service` | _(off)_ | Skip systemd setup; start manually with `./run.sh` |

## Targeting the runner in a workflow

Use the `self-hosted` label or any of the custom labels you passed to `--labels`:

```yaml
jobs:
  build:
    runs-on: self-hosted   # picks any registered self-hosted runner
```

Or target a specific label to pin to this machine:

```yaml
jobs:
  deploy:
    runs-on: [self-hosted, ubuntu-24]
```

## Managing the service

```bash
cd ~/actions-runner

sudo ./svc.sh status    # check if the runner is running
sudo ./svc.sh stop      # stop the runner
sudo ./svc.sh start     # start the runner
sudo ./svc.sh restart   # restart after config changes

# Follow live logs
sudo journalctl -u "actions.runner.*" -f
```

## Removing the runner

Removal requires a fresh token (registration tokens are one-time use; get a removal token from the same GitHub Settings page).

```bash
cd ~/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token <REMOVAL_TOKEN>
```

## Re-registering (token expired or repo changed)

Re-run the setup script with a new token. It detects an existing configuration and removes it before registering fresh:

```bash
./scripts/setup-github-runner.sh \
  --repo your-org/your-repo \
  --token BNEWTOKEN
```

## Security considerations

- **Do not use self-hosted runners on public repositories.** A pull request from a fork can execute arbitrary code in your runner environment.
- Run the runner as a dedicated low-privilege user (e.g. `github-runner`) rather than your personal account or root.
- Store AWS credentials and secrets in GitHub Actions secrets, not in files on the runner host.
- Rotate the runner's IAM credentials and Cognito secrets on the same schedule as your other service accounts.

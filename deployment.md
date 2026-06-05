# Deployment Guide — API Gateway Portal

## Architecture

```
Browser
  │
  ├──► https://api-manager.rengaonline.in  (GoDaddy CNAME → ALB)
  │         │
  │         └──► ALB (HTTPS 443, ACM cert, ap-south-1)
  │                   │  HTTP 301 redirect on port 80
  │                   └──► EC2 :3000 (SSR, private subnet)
  │                              │
  │                              ├──► Aurora PostgreSQL (private subnet)
  │                              ├──► AWS API Gateway (managed APIs)
  │                              └──► AWS Cognito (auth)
  │
  └──► https://static.rengaonline.in  (GoDaddy CNAME → CloudFront)
            │
            └──► CloudFront (ACM cert us-east-1, S3 assets only)
                      └──► S3 assets bucket (OAC, private)

Supporting:
  https://auth.rengaonline.in     → Cognito hosted UI (custom domain, us-east-1 cert)
  https://metrics.rengaonline.in  → Monitoring ALB → Grafana EC2 :3000
  http://<eip>:9090               → Prometheus (direct, monitoring EC2)
```

**Key principle:** CloudFront serves *only* content-hashed static assets from S3. All SSR and API traffic hits the ALB directly. Vite bakes `https://static.rengaonline.in/` as the asset base URL at build time, so the browser fetches JS/CSS from CloudFront regardless of how it reached the app.

---

## CloudFormation Stacks

All stacks live in `infra/` and are deployed by `infra/deploy.sh`.

| # | File | Stack name | What it provisions |
|---|---|---|---|
| 0 | `cognito.yaml` | `api-portal-cognito` | Cognito User Pool, hosted UI, portal app client, custom domain `auth.rengaonline.in` |
| 1 | `1-vpc.yaml` | `api-portal-prod-vpc` | VPC, public/private subnets (2 AZs), NAT Gateway, security groups |
| 2 | `2-database.yaml` | `api-portal-prod-database` | Aurora Serverless v2 PostgreSQL (private subnets) |
| 3 | `4-storage.yaml` | `api-portal-prod-storage` | S3 (assets + artifacts), CloudFront S3-only distribution (`static.rengaonline.in`) |
| 4 | `6-iam.yaml` | `api-portal-prod-iam` | IAM users for app and CI/CD, access keys |
| 5 | `3-compute.yaml` | `api-portal-prod-compute` | EC2 (private subnet), ALB (HTTPS, `api-manager.rengaonline.in`), CloudWatch alarms |
| 6 | `5-monitoring.yaml` | `api-portal-prod-monitoring` | Monitoring EC2 (Prometheus + Grafana), monitoring ALB (`metrics.rengaonline.in`) |

### Security groups

| SG | Allows |
|---|---|
| `sg-alb` | 80, 443 from `0.0.0.0/0` |
| `sg-ec2` | 3000 from `sg-alb` only |
| `sg-db` | 5432 from `sg-ec2` only |
| `sg-monitoring-alb` | 80, 443 from `0.0.0.0/0` |
| `sg-monitoring` | 9090 from `0.0.0.0/0`; 3000 from `sg-monitoring-alb` |

---

## ACM Certificates

Managed by `infra/cert-manager.sh`. Run once; ARNs are cached in SSM.

| Domain | Region | Used by |
|---|---|---|
| `static.rengaonline.in` | `us-east-1` | CloudFront (must be us-east-1) |
| `api-manager.rengaonline.in` | `ap-south-1` | ALB HTTPS listener |
| `auth.rengaonline.in` | `us-east-1` | Cognito custom domain (uses CloudFront internally, must be us-east-1) |
| `metrics.rengaonline.in` | `ap-south-1` | Monitoring ALB HTTPS listener |

Validation: cert-manager calls the GoDaddy API to add ACM validation CNAME records automatically and waits for `ISSUED` status before returning.

ARN storage: `/api-portal/certs/{static,api-manager,auth,metrics}` in SSM Parameter Store (ap-south-1).

---

## DNS (GoDaddy — rengaonline.in)

`deploy.sh` updates these records automatically at Step 13 after all stacks deploy.

| Record | Type | Target |
|---|---|---|
| `static` | CNAME | CloudFront distribution domain (from storage stack output) |
| `api-manager` | CNAME | ALB DNS name (from compute stack output) |
| `auth` | CNAME | Cognito CloudFront distribution domain (from cognito stack output) |
| `metrics` | CNAME | Monitoring ALB DNS name (from monitoring stack output) |

ACM validation CNAMEs (added by cert-manager.sh, pattern `_abc123.subdomain`) also live in GoDaddy and must not be removed.

---

## Environment Variables

Stored in SSM Parameter Store as a single JSON SecureString at `/api-portal/prod/env`. Written by `deploy.sh`; read by Ansible on deploy.

| Variable | Source |
|---|---|
| `DATABASE_URL` | Aurora endpoint + DB password (SSM) |
| `SESSION_SECRET` | Random, generated once, stored in SSM |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `AWS_REGION` | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | App IAM user key (from IAM stack) |
| `AWS_SECRET_ACCESS_KEY` | App IAM user secret (from IAM stack) |
| `COGNITO_USER_POOL_ID` | From Cognito stack output |
| `COGNITO_USER_POOL_ARN` | From Cognito stack output |
| `COGNITO_CLIENT_ID` | From Cognito stack output |
| `COGNITO_CLIENT_SECRET` | From Cognito stack output |

---

## Deployment Order

### First-time setup

```
Step 1 — Provision ACM certificates + GoDaddy validation CNAMEs
  export GODADDY_KEY=<key>
  export GODADDY_SECRET=<secret>
  ./infra/cert-manager.sh ap-south-1
  # Takes up to 15 min for DNS propagation + ISSUED status.
  # ARNs written to SSM /api-portal/certs/*.

Step 2 — Deploy all infrastructure + set GoDaddy alias CNAMEs
  export GODADDY_KEY=<key>
  export GODADDY_SECRET=<secret>
  ./infra/deploy.sh prod ap-south-1
  # Deploys 7 CloudFormation stacks in dependency order.
  # Step 13 automatically sets the 4 GoDaddy alias CNAME records.
  # Prints GitHub Actions secrets to set if gh CLI is not authenticated.

Step 3 — Push to main to trigger first app deploy
  git push origin main
  # GitHub Actions: build (with VITE_ASSETS_BASE_URL) → S3 sync → EC2 via Ansible.
  # See CI/CD section below.

Step 4 — Verify
  curl https://api-manager.rengaonline.in/health   # expect 200
  curl -I https://static.rengaonline.in/favicon.ico # expect 200 from CloudFront
  open https://metrics.rengaonline.in               # Grafana login
```

> Re-running `deploy.sh` is safe and idempotent. It skips cert-manager if all 4 ARNs are already in SSM. CloudFormation stacks update only if the template changed. GoDaddy CNAMEs are overwritten (no-op if unchanged).

### Ongoing deploys

Push to `main` → GitHub Actions runs automatically:

```
1. Pre-deploy health check
   GET https://api-manager.rengaonline.in/health → must return 200

2. npm ci + npm run typecheck

3. npm run build
   env: VITE_ASSETS_BASE_URL=https://static.rengaonline.in/
   → Vite bakes absolute CDN URLs into all <script> / <link> tags

4. Sync build/client/ → S3 assets bucket
   Hashed assets: Cache-Control: max-age=31536000,immutable
   HTML + manifests: Cache-Control: no-cache,no-store

5. CloudFront invalidation: /*.html /manifest.json

6. Upload server bundle + Ansible playbook → S3 artifact bucket

7. aws ssm send-command → Ansible on EC2
   - Download artifact from S3
   - Pull /api-portal/prod/env from SSM → write .env
   - npm install --omit=dev
   - pm2 reload ecosystem.config.cjs
   - Health check loop (curl localhost:3000/health)
```

---

## GitHub Actions Secrets

Set automatically by `deploy.sh` if `gh` CLI is authenticated. Otherwise set manually in repo Settings → Secrets → Actions.

| Secret | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | CI/CD IAM user key |
| `AWS_SECRET_ACCESS_KEY` | CI/CD IAM user secret |
| `AWS_REGION` | `ap-south-1` |
| `EC2_INSTANCE_ID` | From compute stack output |
| `S3_ARTIFACT_BUCKET` | From storage stack output |
| `S3_ASSETS_BUCKET` | From storage stack output |
| `CLOUDFRONT_DISTRIBUTION_ID` | From storage stack output |
| `ALB_HEALTH_URL` | `https://api-manager.rengaonline.in/health` |
| `VITE_ASSETS_BASE_URL` | `https://static.rengaonline.in/` |

---

## Monitoring

| Service | URL | Notes |
|---|---|---|
| Grafana | `https://metrics.rengaonline.in` | Password: `aws ssm get-parameter --name /api-portal/prod/grafana-admin-password --with-decryption --query Parameter.Value --output text` |
| Prometheus | `http://<monitoring-eip>:9090` | Direct access (no HTTPS — internal only) |
| CloudWatch logs | `/app/ec2/application` | App structured JSON logs via OTel Collector |
| CloudWatch logs | `/app/ec2/system` | UserData + system logs |
| CloudWatch logs | `/app/ec2/deploys` | Ansible deploy logs per SHA |

Prometheus scrapes OTel Collector metrics from the app EC2 on port `9464` using EC2 service discovery (tag `Name=api-portal-prod-ec2`). Grafana is pre-provisioned with the Prometheus datasource and Node.js OTel dashboard.

CloudWatch Alarms (SNS → renganatha10@gmail.com):
- EC2 CPU > 80% for 5 min
- ALB 5xx count > 5 in 2 min

---

## Infra Update Workflow

```bash
# Preview changes before applying (recommended for all infra changes)
aws cloudformation create-change-set \
  --stack-name api-portal-prod-compute \
  --template-body file://infra/3-compute.yaml \
  --change-set-name preview-$(date +%s) \
  --capabilities CAPABILITY_NAMED_IAM

aws cloudformation describe-change-set --change-set-name <name> --stack-name <stack>

# Apply if safe
aws cloudformation execute-change-set --change-set-name <name> --stack-name <stack>
```

**Never** delete and recreate a stack containing the database. Use `DeletionPolicy: Retain` (already set on S3 buckets and DB). Always snapshot Aurora before any stack update that touches the DB cluster.

---

## Rollback

### App rollback (bad deploy)
```bash
# Redeploy a previous SHA via SSM
aws ssm send-command \
  --instance-ids <EC2_INSTANCE_ID> \
  --document-name AWS-RunShellScript \
  --parameters commands=["ansible-playbook /tmp/deploy-<prev-sha>.yml -e 'git_sha=<prev-sha>'"]
```

### Asset rollback (bad S3 deploy)
```bash
# S3 versioning is enabled — restore previous version of any object
aws s3api list-object-versions --bucket <assets-bucket> --prefix assets/
aws s3api copy-object \
  --bucket <assets-bucket> \
  --copy-source "<assets-bucket>/assets/main.abc123.js?versionId=<old-version-id>" \
  --key assets/main.abc123.js
```

### CloudFormation rollback
CloudFormation automatically rolls back on stack update failure. To trigger manually:
```bash
aws cloudformation cancel-update-stack --stack-name <stack>
```

---

## Teardown

```bash
./infra/teardown.sh prod ap-south-1
```

Order: Monitoring → Compute → IAM → Storage → Database → VPC → Cognito.
Certs are retained (`DeletionPolicy: Retain`) and must be deleted manually in ACM console if no longer needed.

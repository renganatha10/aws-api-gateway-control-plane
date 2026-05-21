# AWS Hosting Plan: EC2 + S3/CloudFront + WAF + Serverless DB

---

## Architecture Overview

```
Internet
  │
  ▼
Route 53 (DNS)
  │
  ▼
AWS WAF  ──────────────────────────────┐
  │                                    │
  ├──► CloudFront (CDN)                │
  │         │                          │
  │         ├──► S3 (static assets)    │
  │         └──► EC2 (API/SSR origin)  │
  │                   │                │
  │                   ├──► Aurora Serverless v2 (RDS)
  │                   └──► CloudWatch Logs
  │
  └── (WAF also attached to CloudFront and optionally ALB)
```

---

## Phase 1: CloudFormation Template (One-Time Setup)

Run once to provision all infrastructure. Split into logical stacks or one nested stack.

### Stack 1 — Networking (VPC)

- **VPC** with public and private subnets across 2 AZs
- **Internet Gateway** for public subnet
- **NAT Gateway** in public subnet (EC2 in private subnet needs outbound for npm installs, AWS SDK calls)
- **Security Groups**:
  - `sg-alb` — allows 80/443 from internet (or CloudFront IP prefix list only)
  - `sg-ec2` — allows 3000 (app port) from `sg-alb` only
  - `sg-db` — allows 5432 from `sg-ec2` only
- **Route tables** for public and private subnets

### Stack 2 — Database (Aurora Serverless v2)

- **Aurora Serverless v2 cluster** (PostgreSQL-compatible)
  - Min ACU: 0.5, Max ACU: 4 (tune based on load)
  - Placed in **private subnets** — no public access
  - **DB subnet group** spanning both private subnets
  - Master credentials stored in **AWS Secrets Manager** (auto-rotation optional)
  - Enable **Performance Insights** for query monitoring
  - Enable **Enhanced Monitoring** (60s interval)
- **CloudWatch log exports**: `postgresql` logs exported to log group `/aws/rds/cluster/<name>/postgresql`
- **Parameter group**: set `log_min_duration_statement = 1000` to capture slow queries

### Stack 3 — Compute (EC2 + ALB)

- **Application Load Balancer (ALB)**
  - Public subnets, `sg-alb`
  - HTTPS listener (443) with ACM certificate
  - HTTP listener (80) → redirect to HTTPS
  - Target group pointing to EC2, health check on `/health` (add this endpoint to your app)
- **EC2 instance** (t3.medium or t3.small to start)
  - Private subnet, `sg-ec2`
  - Amazon Linux 2023 AMI
  - **IAM Instance Profile** with permissions:
    - `ssm:*` — for AWS Systems Manager (no SSH needed)
    - `secretsmanager:GetSecretValue` — to read DB credentials
    - `s3:GetObject` — if app reads assets
    - `logs:CreateLogStream`, `logs:PutLogEvents` — for CloudWatch agent
    - `cloudwatch:PutMetricData`
  - **CloudWatch Agent** installed via UserData (bootstrap only — Ansible handles app)
  - **SSM Session Manager** enabled — no bastion host, no SSH key management
- **Auto Scaling Group** (optional but recommended): min 1, max 2, scale on CPU > 70%

### Stack 4 — Static Assets (S3 + CloudFront)

- **S3 bucket** (private — no public access)
  - Versioning enabled
  - Lifecycle rule: expire old versions after 30 days
  - Server-side encryption (SSE-S3 or SSE-KMS)
- **Origin Access Control (OAC)** — CloudFront-only access to S3 (replaces legacy OAI)
- **CloudFront distribution**
  - **Origin 1 (S3)**: path pattern `/assets/*`, `/favicon.ico`, `/_build/*`
  - **Origin 2 (ALB)**: default (`/*`) — all SSR/API traffic
  - **Cache behaviors**:
    - S3 origin: long TTL (1 year) with cache-busting via hashed filenames
    - ALB origin: short TTL or no cache (SSR pages) — forward cookies/auth headers
  - **HTTPS only**, TLS 1.2+, custom domain + ACM certificate (must be in `us-east-1` for CloudFront)
  - **Compress objects automatically**: yes
  - **Price class**: PriceClass_100 (US/EU) or All to start

### Stack 5 — WAF

- **WebACL** attached to **CloudFront** (must be in `us-east-1`)
  - All rules below apply at the edge, before traffic hits your origin
- See WAF rules section below

### Stack 6 — Observability (CloudWatch)

- **Log Groups** (all created by CloudFormation with retention policies):

| Log Group | Source | Retention |
|---|---|---|
| `/app/ec2/application` | App logs via CloudWatch agent | 30 days |
| `/app/ec2/system` | System logs (syslog, messages) | 14 days |
| `/app/alb/access` | ALB access logs (via S3 → subscription) | 90 days |
| `/aws/rds/cluster/<name>/postgresql` | Aurora slow query logs | 30 days |
| `/aws/waf/webacl` | WAF sampled requests | 90 days |

- **CloudWatch Agent config** on EC2 (deployed by Ansible):
  - Tail your app's stdout/stderr and write to `/app/ec2/application`
  - Collect memory and disk metrics (not native EC2 metrics)
- **Metric Alarms**:
  - CPU > 80% for 5 minutes → SNS email
  - ALB 5xx rate > 1% → SNS email
  - Aurora CPU > 70% → SNS email
- **CloudWatch Dashboard**: CPU, memory, request count, DB connections, WAF blocked requests

---

## Phase 2: WAF Rules and Use Cases

Attach the WebACL to CloudFront. Rules are evaluated in priority order (lower number = higher priority).

### Rule Set

| Priority | Rule | Action | Use Case |
|---|---|---|---|
| 1 | **IP Reputation List** (AWS Managed) | Block | Blocks known malicious IPs (botnets, scanners, Tor exit nodes) — zero config |
| 2 | **Core Rule Set (CRS)** (AWS Managed) | Block | OWASP Top 10: SQLi, XSS, command injection, path traversal, HTTP protocol violations |
| 3 | **Known Bad Inputs** (AWS Managed) | Block | Log4Shell, Spring4Shell, SSRF patterns, common exploit payloads |
| 4 | **Anonymous IP List** (AWS Managed) | Count → Block after tuning | VPNs, proxies, Tor — useful for API abuse; `Count` first to avoid blocking legitimate users |
| 5 | **Rate limit — global** | Rate-based Block | 2000 requests / 5 minutes per IP across all paths — blunt DDoS protection |
| 6 | **Rate limit — login endpoint** | Rate-based Block | 20 requests / 5 minutes per IP on `/login` — brute force protection |
| 7 | **Rate limit — API paths** | Rate-based Block | 500 requests / 5 minutes per IP on `/api/*` — API abuse |
| 8 | **Geo block** (optional) | Block | Block countries you don't serve — reduces noise from overseas scanners |
| 9 | **Size restriction** | Block | Request body > 8KB blocked — prevents large payload attacks on your API |

### WAF Logging

- Enable WAF logging → **Kinesis Firehose** → S3 bucket → optional Athena queries
- Or WAF logs → CloudWatch log group `/aws/waf/webacl` directly (simpler, higher cost at volume)
- Set `log_scope: REDACTED` for sensitive headers (Authorization, Cookie) in logs

### WAF Tuning Workflow

1. Start rules in **Count mode** (not Block) for 1–2 weeks
2. Review sampled requests in WAF console — identify false positives
3. Add **IP set allow rules** or **rule exclusions** for legitimate traffic patterns
4. Switch to **Block mode** once confident

---

## Phase 3: Ansible Deployment (Recurring)

Ansible connects via **SSM Session Manager** (no SSH keys), using the `community.aws` collection.

### Playbook Steps

```
1. Pre-deploy checks
   - Health check current app (curl /health)
   - Snapshot or tag current deployment

2. Pull application code
   - git pull from your repo (or copy artifact from S3 build bucket)

3. Install dependencies
   - npm ci --production

4. Build (if SSR build step needed)
   - npm run build

5. Environment config
   - Write .env from Secrets Manager (aws secretsmanager get-secret-value)
   - Never store secrets in your repo or Ansible vars

6. Restart application
   - systemctl restart myapp (PM2 or systemd unit)
   - Wait for health check to pass (retry loop)

7. Post-deploy validation
   - curl ALB /health → assert HTTP 200
   - Tail CloudWatch logs for 30s, check for errors
```

### Zero-Downtime Option

- **With ASG**: launch new instance with new code, wait for health, drain old instance
- **Without ASG (single EC2)**: use PM2 reload (in-process) for near-zero downtime on single instance

---

## Phase 4: S3 Asset Update (Recurring)

Three options depending on your build pipeline:

### Option A — Local Build + AWS CLI Upload

```bash
# 1. Build
npm run build  # produces hashed filenames: main.abc123.js

# 2. Sync hashed assets (long cache — never need invalidation)
aws s3 sync ./build/client s3://<bucket>/ \
  --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "*.html"

# 3. Sync HTML separately (short cache — always revalidate)
aws s3 sync ./build/client s3://<bucket>/ \
  --include "*.html" \
  --cache-control "no-cache,no-store"

# 4. Invalidate only non-hashed files (HTML, manifest)
aws cloudfront create-invalidation \
  --distribution-id <id> \
  --paths "/*.html" "/manifest.json"
```

**Key insight**: hashed JS/CSS never need invalidation (new hash = new URL). Only invalidate HTML and manifests.

### Option B — CI/CD (GitHub Actions / CodePipeline)

- Push to `main` → GitHub Action builds → uploads to S3 → CloudFront invalidation
- EC2 deployment via Ansible triggered from the same pipeline (`aws ssm send-command`)
- Keeps deployment atomic: assets and server code deploy together

### Option C — S3 Versioning Rollback

If a bad asset deploy goes out, restore previous version:

```bash
aws s3api list-object-versions --bucket <bucket> --prefix assets/main.js
aws s3api copy-object ... --copy-source <bucket>/assets/main.js?versionId=<old-version-id>
```

---

## Phase 5: CloudFormation Update Strategy

Never update prod CloudFormation stacks blindly. Three patterns:

### Pattern A — Change Sets (Recommended for Infra Changes)

1. `aws cloudformation create-change-set` — preview what will change
2. Review in console: will anything be **replaced** (destructive) or just **modified**?
3. `aws cloudformation execute-change-set` — apply
4. Watch stack events in real time

**Always use this for**: VPC changes, SG changes, DB changes, EC2 AMI updates.

### Pattern B — Parameter Updates (Safe for Config Changes)

For updating AMI IDs, instance types, or WAF rule thresholds:
- Pass new `--parameter-overrides` without touching the template
- Low risk, fast

### Pattern C — Stack Drift Detection

- Periodically run `aws cloudformation detect-stack-drift`
- Finds manual console changes that diverge from your template
- Fix drift by importing resources or updating the template — never leave drift unresolved

### What NOT to Do

- Never delete and recreate a stack containing the database
- Never update an RDS cluster's engine version via CloudFormation without a manual snapshot first
- Use `DeletionPolicy: Retain` on S3 buckets and RDS clusters in your template

---

## Summary Checklist

```
CloudFormation (one-time)
  ☐ VPC + subnets + SGs + NAT Gateway
  ☐ Aurora Serverless v2 + Secrets Manager
  ☐ EC2 + ALB + IAM Instance Profile + SSM
  ☐ S3 bucket + CloudFront + OAC
  ☐ WAF WebACL attached to CloudFront
  ☐ CloudWatch log groups + metric alarms + dashboard

Ansible (per deploy)
  ☐ Pull code → install deps → build → reload app
  ☐ Inject secrets from Secrets Manager at runtime
  ☐ Health check validation post-deploy

S3 asset update (per deploy)
  ☐ aws s3 sync with correct cache-control headers
  ☐ CloudFront invalidation for HTML/manifest only

Ongoing
  ☐ Review WAF Count-mode hits weekly before switching to Block
  ☐ Monitor CloudWatch dashboard after each deploy
  ☐ Run CloudFormation drift detection monthly
  ☐ Rotate DB credentials via Secrets Manager auto-rotation
```

---

## Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| WAF blocks legitimate users | Start all rules in Count mode, tune for 1–2 weeks before blocking |
| CloudFormation update breaks DB | Always take Aurora snapshot before any stack update touching RDS |
| Secrets in Ansible vars | Pull all secrets from Secrets Manager at runtime, never store in repo |
| S3 assets serve stale files | Use hashed filenames + CloudFront invalidation on deploy |
| EC2 deploy causes downtime | PM2 reload (no ASG) or ASG rolling update (with ASG) |
| ALB accessible without WAF | Restrict `sg-alb` to CloudFront managed prefix list only |

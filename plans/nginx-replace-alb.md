# Plan: Replace ALB with Nginx EC2 Load Balancer

## Current Architecture

```
Internet
  └─ CloudFront
       └─ ALB (internet-facing, public subnets A+B, SGAlb)
            └─ EC2 App (private subnet A, port 3000, SGEc2)
```

The ALB is the only internet-facing entry point. CloudFront currently uses the ALB DNS name as its origin.

---

## Proposed Architecture

```
Internet
  └─ CloudFront
       └─ [AWS internal backbone — VPC Origin]
            └─ Nginx EC2 (private subnet A, port 80, SGNginx)
                 └─ EC2 App (private subnet A, port 3000, SGEc2)
```

### Answer: Can Nginx live in a private subnet?

**Yes — via CloudFront VPC Origins (GA since Nov 2024).**

CloudFront VPC Origins lets CloudFront reach origins in private subnets without a public IP or NAT. CloudFront places managed ENIs inside your VPC and routes traffic over the AWS backbone directly to the private instance. The Nginx EC2 never needs a public IP — CloudFront handles TLS externally, Nginx receives plain HTTP internally.

This is strictly better than putting Nginx in a public subnet:
- No public IP or Elastic IP on Nginx
- No internet-exposed security group rules
- Traffic stays on the AWS backbone end-to-end
- Same cost model as a regular EC2 instance (no ALB hourly fee ~$20/mo)

---

## Changes Required

### 1. `infra/1-vpc.yaml`

**Remove:**
- `SGAlb` — ALB security group no longer needed

**Add:**
- `SGNginx` — accepts port 80 inbound from the CloudFront-managed security group (injected via the VPC Origin resource) or from the VPC CIDR (`10.0.0.0/16`) as a fallback during initial setup

**Modify:**
- `SGEc2` — change ingress source from `SourceSecurityGroupId: SGAlb` → `SourceSecurityGroupId: SGNginx`

**Exports to add:** `SGNginxId`

---

### 2. `infra/3-compute.yaml`

**Remove:**
- `ALB` (`AWS::ElasticLoadBalancingV2::LoadBalancer`)
- `TargetGroup` (`AWS::ElasticLoadBalancingV2::TargetGroup`)
- `ALBListenerHTTP` (`AWS::ElasticLoadBalancingV2::Listener`)
- `Alarm5xxRate` (metric `HTTPCode_Target_5XX_Count` is ALB-specific — replace with Nginx log alarm)

**Add: `NginxEC2Instance`**

- Same Amazon Linux 2023 AMI as the app instance
- Placed in **private subnet A** (no public IP)
- Security group: `SGNginx`
- Instance type: `t3.micro` (Nginx is lightweight; can tune up)
- IAM role: SSM Session Manager access only (no S3 or Parameter Store needed)
- User data bootstraps:
  1. Install nginx
  2. Write `/etc/nginx/conf.d/portal.conf` with upstream pointing to app EC2 private DNS
  3. Enable + start nginx
  4. Install CloudWatch Agent to ship `/var/log/nginx/access.log` + `error.log`

Nginx upstream uses the **app EC2 private DNS** (`ip-10-0-10-x.region.compute.internal`) rather than its private IP — DNS is stable across stop/start; IP can change.

**Outputs to add:** `NginxInstanceId`, `NginxPrivateIp`

**Remove output:** `AlbDnsName`, `AlbArn`

---

### 3. New CloudFront VPC Origin (`infra/3-compute.yaml` or separate stack)

Add `AWS::CloudFront::VpcOrigin`:
- `Name`: `api-portal-${EnvironmentName}-nginx-vpc-origin`
- `VpcOriginEndpointConfig`:
  - `Arn`: Nginx EC2 instance ARN
  - `HTTPPort`: 80
  - `OriginProtocolPolicy`: `http-only` (CloudFront terminates TLS; Nginx receives HTTP)

CloudFront automatically creates and manages a security group for the VPC Origin. After deployment, the Nginx SG inbound rule should be narrowed from the VPC CIDR to reference **only** the CloudFront-managed SG (done post-deploy via a custom resource or manual update).

**Update CloudFront distribution** (wherever it is defined):
- Change origin from `AlbDnsName` → VPC Origin ID
- Origin protocol: HTTP (port 80)
- Keep existing cache behaviors, headers, and WAF as-is

---

### 4. Nginx Config (user data snippet — for review, not final code)

```nginx
upstream portal_app {
    server <app-ec2-private-dns>:3000;
    # add more servers here when scaling horizontally
}

server {
    listen 80;

    location /health {
        proxy_pass http://portal_app;
        access_log off;
    }

    location / {
        proxy_pass http://portal_app;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    }
}
```

When adding more app EC2 instances later, add `server` lines to the upstream block and reload nginx (`nginx -s reload`) — no CloudFormation change needed.

---

### 5. Monitoring adjustments

| Current (ALB metric) | Replacement |
|---|---|
| `HTTPCode_Target_5XX_Count` alarm | Parse Nginx access log for 5xx; ship to CloudWatch custom metric via CloudWatch agent or OTel |
| ALB request count | Nginx `stub_status` module → Prometheus → existing Grafana |

The existing OTel collector + Prometheus + Grafana stack (5-monitoring.yaml) can scrape Nginx metrics via `stub_status` with minimal config change.

---

## Tradeoff Summary

| Concern | ALB (current) | Nginx EC2 (proposed) |
|---|---|---|
| Monthly cost | ~$20 + LCU charges | EC2 t3.micro ~$8 |
| High availability | Multi-AZ built-in | Single instance (same SPOF as current app EC2) |
| TLS termination | ALB or CloudFront | CloudFront only |
| Health checks | Automatic | Nginx passive (upstream `max_fails`) |
| Horizontal scaling | Add targets to TG | Add `server` lines to upstream |
| Metrics | Native CloudWatch | Custom log/stub_status |
| Maintenance | Zero | Nginx package updates, config changes |
| Security | Managed SG | Managed SG + CloudFront VPC Origin |

**Net:** lower cost, more control, slightly more ops overhead. Since the current setup is already a single EC2 app instance (no real HA), the HA tradeoff is not a regression.

---

## Rollout Order

1. Update `1-vpc.yaml` — add `SGNginx`, update `SGEc2`
2. Update `3-compute.yaml` — add Nginx EC2, remove ALB resources
3. Deploy VPC Origin, update CloudFront distribution origin
4. Verify health via `/health` through CloudFront
5. Remove old ALB CloudWatch alarm; add Nginx log alarm

---

## Files to Change

| File | Action |
|---|---|
| `infra/1-vpc.yaml` | Remove SGAlb, add SGNginx, update SGEc2 |
| `infra/3-compute.yaml` | Remove ALB/TG/Listener, add NginxEC2Instance + VpcOrigin |
| CloudFront distribution | Update origin to VPC Origin (wherever CF is defined) |

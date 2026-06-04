# Plan: Direct ALB Access with HTTPS + CDN Assets

## Current state

```
User → CloudFront → ALB (HTTP) → EC2 (app + assets)
                ↘ S3 (static assets)
```

## Target state

```
User → ALB (HTTPS, direct) → EC2 (SSR only)
                              ↓ asset URLs in HTML point to →
                              CloudFront → S3 (static assets only)
```

---

## Step 1 — SSL-terminate at the ALB

- Request an **ACM certificate** in the **same region** as your ALB for your domain (e.g. `app.yourdomain.com`). CloudFront certs must be in `us-east-1`; ALB certs must match the ALB's region — make sure you're requesting in the right region.
- Add an **HTTPS (443) listener** to the ALB and attach the ACM cert.
- Keep the existing HTTP (80) listener but change its action to **redirect → HTTPS 301**.
- The ALB target group stays unchanged — EC2 still receives plain HTTP internally.

---

## Step 2 — DNS: point a domain directly at ALB

- Create an **A record (Alias)** in Route 53 (or CNAME elsewhere) for `app.yourdomain.com` → ALB DNS name.
- This is the URL users (or your frontend) will use. CloudFront stays alive but only for assets.

---

## Step 3 — Make React Router 7 emit CloudFront-absolute asset URLs

This is the key change. When Vite builds the app, all `<script>`, `<link>`, and `import()` paths default to relative (`/assets/...`). When accessed via ALB, the browser fetches those from EC2 — wrong.

Fix: set **`base`** in `vite.config.ts` to your CloudFront distribution URL:

```
base: "https://your-distribution.cloudfront.net/"
```

After this, every asset URL in the built HTML becomes an absolute CDN URL. The browser fetches JS/CSS/images from CloudFront regardless of whether it hit the app via ALB or CloudFront — EC2 never serves assets.

---

## Step 4 — Upload built assets to S3 on every deploy

Your CI/CD pipeline must:

1. Run `npm run build`
2. Sync `build/client/assets/` → S3 bucket (the one CloudFront fronts)
3. Start/restart EC2 with the new `build/server/` bundle

The EC2 process only needs the server bundle. Static files do not need to live on EC2 at all.

---

## Step 5 — CloudFront distribution: assets only

- **Remove the ALB origin** from CloudFront (or keep it disabled — it's no longer the primary path).
- CloudFront's only job is now fronting S3. Set up **Origin Access Control (OAC)** so S3 is private and only CloudFront can read it.
- Set long cache TTLs on `/assets/*` (Vite content-hashes filenames, so cache-busting is automatic).

---

## Step 6 — CORS on S3 / CloudFront (if needed)

If your app fetches assets via `fetch()` or uses ES module workers, browsers enforce CORS. Add a CORS rule to the S3 bucket allowing your app origin (`https://app.yourdomain.com`). For normal `<script>`/`<link>` tags this isn't required.

---

## Trade-offs

| | CloudFront-fronted app (current) | Direct ALB (target) |
|---|---|---|
| Latency | CF edge adds RTT on cache misses | Direct to ALB, lower RTT |
| HTTPS | CF terminates | ALB terminates (ACM cert) |
| Static assets | CF → S3 | CF → S3 (unchanged) |
| DDoS / WAF | CF + WAF | ALB + WAF (attach separately if needed) |
| Cost | CF request pricing | ALB LCU pricing |

> If you have a WAF attached to CloudFront today, attach an **AWS WAF WebACL to the ALB** too — otherwise the ALB is exposed without it.

---

## Summary of required changes

| # | Change | Where |
|---|---|---|
| 1 | ACM cert + ALB HTTPS (443) listener | AWS console / CloudFormation |
| 2 | Route 53 alias record → ALB | Route 53 |
| 3 | `base` in `vite.config.ts` → CloudFront URL | One line of config |
| 4 | CI/CD: sync `build/client/assets/` to S3 before EC2 restart | Deploy pipeline |
| 5 | CloudFront: keep for S3 only, remove ALB origin | CloudFront distribution |

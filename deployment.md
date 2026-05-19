# Serverless Deployment Plan

Deploys the API Gateway portal to AWS using Lambda + CloudFront (SSR), Aurora Serverless v1 (PostgreSQL), and Amazon Cognito (auth) — replacing Docker-based Keycloak and a persistent server.

---

## Architecture

```
Browser
  │
  ▼
CloudFront (CDN)
  ├── /assets/*  ──────────────────► S3 (static files)
  └── /*  ────────────────────────► Lambda Function URL
                                         │
                                         ├── React Router 7 SSR
                                         ├── Cognito SDK (auth)
                                         ├── AWS API Gateway SDK (existing)
                                         └── RDS Proxy ──► Aurora Serverless v1
```

| Service | Role | Replaces |
|---|---|---|
| Lambda + Lambda Web Adapter | SSR application server | Node.js process / ECS |
| CloudFront | CDN, HTTPS, static asset cache | Nginx / ALB |
| S3 | Static asset storage | Served from Node |
| Aurora Serverless v1 | PostgreSQL (auto-pauses when idle) | Docker Postgres |
| RDS Proxy | Connection pooling for Lambda | Direct pg connection |
| Amazon Cognito | User auth (OIDC) | Keycloak |

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js 20+
- An S3 bucket for deployment artifacts (create once)

---

## Step 1 — Amazon Cognito (replacing Keycloak)

### 1a. Create User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name api-portal \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=false,RequireLowercase=false,RequireNumbers=false,RequireSymbols=false}" \
  --query "UserPool.Id" --output text
# → saves as COGNITO_USER_POOL_ID
```

### 1b. Create App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id $COGNITO_USER_POOL_ID \
  --client-name api-portal-server \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query "UserPoolClient.ClientId" --output text
# → saves as COGNITO_CLIENT_ID
```

`ALLOW_USER_PASSWORD_AUTH` is the Cognito equivalent of Keycloak's Direct Access Grant — accepts username + password directly.

### 1c. Update app auth module

Replace `app/lib/keycloak.server.ts` with `app/lib/cognito.server.ts`:

```typescript
// app/lib/cognito.server.ts
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  ForgotPasswordCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider"

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!
const CLIENT_ID    = process.env.COGNITO_CLIENT_ID!

export interface TokenResponse {
  access_token:  string
  refresh_token: string
  expires_in:    number
  token_type:    string
}

export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const res = await client.send(new InitiateAuthCommand({
    AuthFlow:       "USER_PASSWORD_AUTH",
    ClientId:       CLIENT_ID,
    AuthParameters: { USERNAME: username, PASSWORD: password },
  }))

  const auth = res.AuthenticationResult as AuthenticationResultType
  if (!auth?.AccessToken) throw new Error("Invalid username or password")

  return {
    access_token:  auth.AccessToken,
    refresh_token: auth.RefreshToken ?? "",
    expires_in:    auth.ExpiresIn ?? 3600,
    token_type:    auth.TokenType ?? "Bearer",
  }
}

export async function registerUser(params: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<void> {
  // AdminCreateUser creates the account; AdminSetUserPassword confirms it immediately
  await client.send(new AdminCreateUserCommand({
    UserPoolId:        USER_POOL_ID,
    Username:          params.email,
    TemporaryPassword: params.password,
    UserAttributes: [
      { Name: "email",          Value: params.email },
      { Name: "email_verified", Value: "true" },
      { Name: "given_name",     Value: params.firstName ?? "" },
      { Name: "family_name",    Value: params.lastName ?? "" },
    ],
    MessageAction: "SUPPRESS",
  })).catch((e: Error) => {
    if (e.name === "UsernameExistsException") throw new Error("An account with this email already exists")
    throw new Error("Failed to create account")
  })

  await client.send(new AdminSetUserPasswordCommand({
    UserPoolId: USER_POOL_ID,
    Username:   params.email,
    Password:   params.password,
    Permanent:  true,
  }))
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    await client.send(new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
    }))
  } catch {
    // swallow — never leak account existence
  }
}

export function extractUserId(accessToken: string): string {
  return decodePayload(accessToken)?.sub ?? ""
}

export function getUserProfile(accessToken: string) {
  const p = decodePayload(accessToken)
  return {
    sub:         p?.sub ?? "",
    email:       p?.email ?? "",
    given_name:  p?.given_name ?? "",
    family_name: p?.family_name ?? "",
    name:        p?.name ?? [p?.given_name, p?.family_name].filter(Boolean).join(" "),
  }
}

function decodePayload(token: string): Record<string, string> | null {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
  } catch {
    return null
  }
}
```

Update all imports in route files from `~/lib/keycloak.server` → `~/lib/cognito.server`. The exported function signatures are identical so no other changes are needed.

Also install the Cognito SDK:

```bash
npm install @aws-sdk/client-cognito-identity-provider
```

---

## Step 2 — Aurora Serverless v1

### 2a. Create VPC (if not using an existing one)

```bash
# Use the default VPC or create a dedicated one.
# Easiest: use AWS Console → VPC → Create VPC with public + private subnets.
# Save the VPC ID, private subnet IDs, and default security group ID.
```

### 2b. Create Aurora Serverless v1 cluster

```bash
aws rds create-db-cluster \
  --db-cluster-identifier api-portal-db \
  --engine aurora-postgresql \
  --engine-mode serverless \
  --engine-version 13.12 \
  --scaling-configuration MinCapacity=2,MaxCapacity=8,AutoPause=true,SecondsUntilAutoPause=300,TimeoutAction=RollbackCapacityChange \
  --master-username app \
  --master-user-password <strong-password> \
  --database-name app \
  --vpc-security-group-ids <sg-id> \
  --db-subnet-group-name <subnet-group-name>
```

Key scaling config:
- `AutoPause=true` — pauses after 5 minutes idle (scales to zero)
- `MinCapacity=2` — minimum 2 ACUs when active (prevents out-of-memory on cold queries)
- `SecondsUntilAutoPause=300` — 5-minute idle timeout

### 2c. Create RDS Proxy (required for Lambda)

Lambda spawns many short-lived connections. Without a proxy, Aurora Serverless v1 hits its connection limit quickly.

```bash
aws rds create-db-proxy \
  --db-proxy-name api-portal-proxy \
  --engine-family POSTGRESQL \
  --auth '[{"AuthScheme":"SECRETS","IAMAuth":"DISABLED","SecretArn":"<secret-arn>"}]' \
  --role-arn <rds-proxy-role-arn> \
  --vpc-subnet-ids <private-subnet-1> <private-subnet-2> \
  --vpc-security-group-ids <sg-id>

aws rds register-db-proxy-targets \
  --db-proxy-name api-portal-proxy \
  --db-cluster-identifiers api-portal-db
```

Store the proxy endpoint — use it as `DATABASE_URL` in Lambda:
```
postgresql://app:<password>@<proxy-endpoint>:5432/app
```

### 2d. Run migrations from local machine

Point `DATABASE_URL` at the cluster endpoint (not the proxy — proxy is for app connections), then:

```bash
DATABASE_URL=postgresql://app:<password>@<cluster-endpoint>:5432/app npm run db:migrate
```

> Aurora Serverless v1 may take 15–30 seconds to resume from pause on first connection.

---

## Step 3 — Lambda Function (SSR)

Uses [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) — runs `npm run start` as-is inside Lambda with zero code changes. The adapter layer converts Lambda events to HTTP and back.

### 3a. Add Lambda entry point

Create `server/lambda.ts`:

```typescript
// server/lambda.ts
// Lambda Web Adapter intercepts the port — this file just starts the standard
// production server. The adapter layer handles event ↔ HTTP translation.
import "../build/server/index.js"
```

Or more simply, point Lambda's handler at the existing `npm run start` script by configuring the Lambda Web Adapter environment variable:

```
AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap
PORT=3000
```

### 3b. Create Lambda function

```bash
# Package the app
npm run build
zip -r function.zip build/ node_modules/ package.json

# Upload to S3
aws s3 cp function.zip s3://<artifact-bucket>/api-portal/function.zip

# Create function
aws lambda create-function \
  --function-name api-portal \
  --runtime nodejs20.x \
  --role <lambda-execution-role-arn> \
  --handler run.sh \
  --code S3Bucket=<artifact-bucket>,S3Key=api-portal/function.zip \
  --timeout 30 \
  --memory-size 512 \
  --vpc-config SubnetIds=<private-subnet-1>,<private-subnet-2>,SecurityGroupIds=<sg-id> \
  --layers arn:aws:lambda:<region>:753240598075:layer:LambdaAdapterLayerX86:24 \
  --environment Variables="{
    NODE_ENV=production,
    PORT=3000,
    AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap,
    DATABASE_URL=postgresql://app:<password>@<proxy-endpoint>:5432/app,
    SESSION_SECRET=<secret>,
    COGNITO_USER_POOL_ID=<pool-id>,
    COGNITO_CLIENT_ID=<client-id>,
    AWS_REGION=<region>,
    AWS_ACCESS_KEY_ID=<key>,
    AWS_SECRET_ACCESS_KEY=<secret>
  }"
```

Lambda Web Adapter layer ARNs by region: https://github.com/awslabs/aws-lambda-web-adapter#lambda-functions-packaged-as-zip-package-for-other-languages

### 3c. Create Function URL

```bash
aws lambda create-function-url-config \
  --function-name api-portal \
  --auth-type NONE

aws lambda add-permission \
  --function-name api-portal \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --statement-id public-url
```

Note the Function URL — used as CloudFront origin.

---

## Step 4 — S3 + CloudFront

### 4a. Upload static assets

```bash
# After npm run build
aws s3 sync build/client/ s3://<assets-bucket>/assets/ \
  --cache-control "public,max-age=31536000,immutable"
```

### 4b. Create CloudFront distribution

Two origins:
1. **S3 origin** — serves `/assets/*` (long-cache, immutable hashes)
2. **Lambda Function URL origin** — serves everything else (SSR)

```bash
# Use AWS Console or CDK — the JSON config is verbose.
# Key settings:
#   Default behavior → Lambda Function URL origin, cache disabled (TTL=0)
#   /assets/* behavior → S3 origin, cache max-age=1 year
#   Viewer protocol → Redirect HTTP to HTTPS
#   Price class → PriceClass_100 (US/EU) or PriceClass_All
```

With CDK (recommended, saves the JSON config):

```typescript
import * as cloudfront from "aws-cdk-lib/aws-cloudfront"
import * as origins from "aws-cdk-lib/aws-cloudfront-origins"

const distribution = new cloudfront.Distribution(this, "Portal", {
  defaultBehavior: {
    origin: new origins.FunctionUrlOrigin(fn.addFunctionUrl({ authType: FunctionUrlAuthType.NONE })),
    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
  },
  additionalBehaviors: {
    "/assets/*": {
      origin: new origins.S3Origin(assetsBucket),
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
  },
})
```

---

## Step 5 — Environment Variables

Remove all Keycloak variables. Final set for Lambda:

```env
NODE_ENV=production
PORT=3000
AWS_LAMBDA_EXEC_WRAPPER=/opt/bootstrap

# Database (via RDS Proxy)
DATABASE_URL=postgresql://app:<password>@<rds-proxy-endpoint>:5432/app

# Session
SESSION_SECRET=<random-64-char-string>

# Cognito
COGNITO_USER_POOL_ID=<us-east-1_xxxxxxx>
COGNITO_CLIENT_ID=<26-char-client-id>

# AWS (API Gateway SDK — existing)
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

Store secrets in **AWS Systems Manager Parameter Store** (SecureString) and pull them into Lambda via the AWS Parameters and Secrets Lambda Extension, or set them directly in Lambda environment variables for simplicity.

---

## Step 6 — Code Changes Summary

| File | Change |
|---|---|
| `app/lib/cognito.server.ts` | New — replaces `keycloak.server.ts` |
| `app/lib/keycloak.server.ts` | Delete |
| All route files importing keycloak | Change import path to `~/lib/cognito.server` |
| `app/lib/session.server.ts` | No changes needed |
| `docker-compose.yml` | Remove Keycloak service (keep Postgres for local dev) |
| `.env.example` | Replace `KEYCLOAK_*` with `COGNITO_*` |

---

## Step 7 — CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run typecheck
      - run: npm run build

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id:     ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region:            ap-southeast-2

      # Upload static assets to S3
      - run: |
          aws s3 sync build/client/ s3://${{ secrets.ASSETS_BUCKET }}/assets/ \
            --cache-control "public,max-age=31536000,immutable" \
            --delete

      # Package and deploy Lambda
      - run: zip -r function.zip build/ node_modules/ package.json
      - run: |
          aws s3 cp function.zip s3://${{ secrets.ARTIFACT_BUCKET }}/api-portal/function.zip
          aws lambda update-function-code \
            --function-name api-portal \
            --s3-bucket ${{ secrets.ARTIFACT_BUCKET }} \
            --s3-key api-portal/function.zip

      # Invalidate CloudFront cache for HTML (assets are immutable)
      - run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## Cost Estimate

Assumes light usage: ~10k page requests/day, dev portal with moderate traffic.

| Service | Monthly estimate |
|---|---|
| Lambda (512 MB, 30s timeout, ~300k invocations) | ~$1–3 |
| CloudFront (10 GB transfer, 1M requests) | ~$1–2 |
| S3 (100 MB assets, 1M requests) | < $0.50 |
| Aurora Serverless v1 (active ~4 hrs/day, 2 ACU) | ~$7–10 |
| RDS Proxy | ~$0.015/vCPU-hr × hours active ≈ $2–4 |
| Cognito (< 50k MAU, minimal M2M) | $0 |
| **Total** | **~$12–20/month** |

Compare to always-on ECS/EC2: $30–80/month minimum.

Aurora Serverless v1 cold start (resume from pause) takes 15–30 seconds on first request after idle. This is acceptable for a dev portal. If unacceptable, increase `SecondsUntilAutoPause` to keep it warmer, or switch to Aurora Serverless v2 (no pause, ~$1/day minimum).

---

## Known Gotchas

### Lambda cold starts + Aurora pause
If Aurora is paused when Lambda wakes up, the first request will time out unless the Lambda timeout is set ≥ 35 seconds. Set Lambda timeout to **60 seconds** to cover this.

### VPC required
Lambda must be in the same VPC as Aurora and RDS Proxy. This adds ~500ms to Lambda cold starts (ENI attachment). Use **Provisioned Concurrency** if cold start latency is unacceptable in production.

### Lambda response size limit
Lambda Function URLs have a 6 MB response body limit. React Router SSR responses are small, but avoid returning large JSON blobs directly from loaders.

### Session cookies on Lambda Web Adapter
The adapter forwards all headers including `Cookie` and `Set-Cookie` correctly. No changes needed to `session.server.ts`.

### Cognito password reset flow
`ForgotPasswordCommand` sends a code to the user's email (not a magic link). The app's forgot-password route currently expects a magic link (Keycloak). Update the UI to show a "check your email for a reset code" message and add a `/reset-password` route that calls `ConfirmForgotPasswordCommand` with the code + new password.

### Local development
Keep Docker Compose Postgres for local dev. For Cognito locally, either:
- Point local `.env` at a real Cognito dev User Pool (free, no Docker needed)
- Or keep Keycloak in `docker-compose.yml` and only swap to Cognito in production via env vars (both modules share the same interface)

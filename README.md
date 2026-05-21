# SideHussle CDN Portal

A full-stack management portal for AWS API Gateway — create and publish APIs, group them into products, apply rate-limit plans, deploy to multiple environments, and provision consumers with Cognito credentials.

## Features

- **Gateways** — multi-tenant top-level resource; switch between gateways from the sidebar
- **APIs** — import Swagger 2.0 / OpenAPI 3.0 specs; synced to AWS API Gateway with Cognito auth injected automatically
- **Products** — bundle APIs together and associate plans
- **Plans** — rate-limit tiers (throttle, burst, quota) synced to AWS Usage Plans
- **Environments** — named deployment targets (dev, staging, production)
- **Publish** — deploy a product's APIs to a selected environment; stage variables (`backendHost`) resolve from each spec's `hosts` map
- **Consumers** — provision a Cognito App Client + AWS API key scoped to a product/environment/plan; surfaces invoke URL, token URL, and API key value

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Router 7 (SSR) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Language | TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | AWS Cognito (`USER_PASSWORD_AUTH` flow) |
| Cloud | AWS API Gateway + Cognito (SDK v3) |

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local Postgres)
- An AWS account with API Gateway and Cognito access
- A Cognito User Pool with an App Client (`ALLOW_USER_PASSWORD_AUTH` enabled)

## Getting started

### 1. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL on `localhost:5432`.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SESSION_SECRET=<random-string>
DATABASE_URL=postgresql://app:app_password@localhost:5432/app

COGNITO_USER_POOL_ID=us-east-1_xxxxxxx
COGNITO_CLIENT_ID=your-app-client-id
COGNITO_CLIENT_SECRET=your-app-client-secret

AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>

# Optional — ARN of the User Pool used as the CognitoAuth authorizer in API specs
COGNITO_USER_POOL_ARN=arn:aws:cognito-idp:...

# Optional — CloudWatch log group ARN for API Gateway access logs
APIGW_ACCESS_LOG_GROUP_ARN=arn:aws:logs:...
```

### 3. Run migrations

```bash
npm install
npm run db:migrate
```

### 4. Start the dev server

```bash
npm run dev
```

App is available at `http://localhost:5173`.

## Scripts

```bash
npm run dev               # dev server with HMR
npm run build             # production build
npm run start             # serve the production build
npm run typecheck         # type-check (run before committing)
npm run db:migrate        # apply pending migrations
npm run db:migrate:down   # roll back last migration
npm run db:migrate:create # scaffold a new migration file
npm run test:e2e          # Playwright e2e tests (headless)
npm run test:e2e:ui       # Playwright e2e tests (interactive UI)
```

## Project structure

```
app/
  aws/               # AWS API Gateway + Cognito helpers (one concern per file)
  components/ui/     # shadcn/ui components
  hooks/             # shared React hooks
  lib/               # db, schema, session, cognito
  repositories/      # Drizzle data-access layer
  routes/            # React Router route modules
db/
  migrations/        # Sequential SQL migrations
tests/
  e2e/               # Playwright end-to-end tests
docker-compose.yml   # Local Postgres service
CLAUDE.md            # AI coding-assistant context
```

## Database schema

```
gateways
  ├── environments
  ├── apis
  ├── plans
  └── products
        ├── api_associations
        ├── plan_associations
        ├── product_deployments   (+ invoke_url)
        └── consumers             (client_id, aws_api_key_id, token_url)
```

## Publishing a product

1. Create a gateway and add environments (e.g. `dev`, `production`)
2. Import APIs — each spec can include a custom `hosts` map:
   ```yaml
   hosts:
     dev:        api.dev.company.com
     production: api.company.com
   ```
3. Create a product, associate APIs and plans, save
4. From the Products list, click **⋯ → Publish**, select an environment, and click **Deploy**

The portal creates an AWS deployment for each API and attaches a stage named after the environment. The `backendHost` stage variable is set from `hosts[envName]`.

## Provisioning a consumer

1. From the Consumers page, click **New Consumer**
2. Select a product, environment, and plan
3. On save, the portal provisions a Cognito App Client and an AWS API key
4. The consumer detail page shows the invoke URL, token URL, and API key value

## Development notes

- `npm run typecheck` must pass before committing — it runs `react-router typegen` first
- Add new migrations with `npm run db:migrate:create -- <description>`, then edit the generated file under `-- Up Migration` / `-- Down Migration`
- shadcn components are added with `npx shadcn add <component>` and use the unified `radix-ui` package (not `@radix-ui/react-*`)

---

## TODO

### Polish
- [ ] Match the design of empty states and search across all pages (inconsistent between pages)
- [ ] Error handling and user-facing error logging
- [ ] UX of consumers is not great — allow try-out and edit directly on the consumer detail page rather than through the dropdown menu; same applies to products

### Missing actions
- [ ] Delete consumer
- [ ] Delete product
- [ ] Delete API

### New pages / features
- [ ] Settings page — add custom domain and path mapping
- [ ] Custom Domain page
- [ ] User Management page
- [ ] Add "Deploy" option directly from the product detail page (currently only available from the product list)
- [ ] Analytics — API call volume, latency, error rates
- [ ] View logs from APIs (stream or query CloudWatch)

### Code quality
- [ ] Extract each page's sub-components into their own files
- [ ] Write unit tests for all extracted components

### Think about
- [ ] Organisation / multi-tenancy model
- [ ] UX rethink for consumers and products (see Polish note above)

### Infrastructure
- [ ] CloudFormation template — Aurora (RDS), CloudFront, WAF, EC2 instance
- [ ] Ansible playbook — deploy application to EC2
- [ ] S3 bucket + pipeline — upload and serve static assets

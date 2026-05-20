# CLAUDE.md

## Project overview

API Gateway management portal built with React Router 7 (SSR), Tailwind CSS v4, shadcn/ui, and TypeScript. Manages gateways, APIs, products, plans, and environments, with direct AWS API Gateway integration for publishing.

## Commands

```bash
npm run dev          # dev server with HMR (http://localhost:5173)
npm run build        # production build
npm run typecheck    # react-router typegen + tsc (run before committing)
npm run db:migrate   # apply pending migrations (node-pg-migrate)
npm run db:migrate:down    # roll back last migration
npm run db:migrate:create  # scaffold a new migration file
```

## Architecture

### Stack
- **React Router 7** — SSR, file-based routes, loaders/actions for data
- **Tailwind CSS v4** — utility-first styling
- **shadcn/ui (new-york)** — component library via `radix-ui` unified package
- **Drizzle ORM** — type-safe SQL queries against PostgreSQL
- **node-pg-migrate** — SQL migration files in `db/migrations/`
- **Keycloak 24** — OIDC auth via ROPC / Direct Access Grant
- **AWS SDK v3** — API Gateway management (`@aws-sdk/client-api-gateway`)

### Directory layout

```
app/
  aws/               # AWS API Gateway helpers (one concern per file)
  components/ui/     # shadcn components
  hooks/             # shared React hooks
  lib/               # db client, schema, session, keycloak
  repositories/      # DB access layer (one file per entity)
  routes/            # React Router route modules
db/migrations/       # numbered SQL migrations (node-pg-migrate format)
```

### Route structure

```
login / logout / forgot-password   (standalone, no layout)
layout.tsx  (SidebarProvider + AppSidebar + Outlet)
  /                  home.tsx
  /gateway           gateway.tsx
  /apis              apis.tsx
  /apis/new          api-create.tsx
  /apis/:id          apis.$id.tsx
  /products          products.tsx
  /products/new      product-create.tsx
  /products/:id      products.$id.tsx
  /environments      environments.tsx
  /environments/:id  environments.$id.tsx
  /plans             plans.tsx
```

### Data model

```
gateways
  └─ environments      (gateway_id FK)
  └─ apis              (gateway_id FK, awsApiId)
  └─ plans             (gateway_id FK, awsUsagePlanId)
  └─ products          (gateway_id FK)
       └─ api_associations    (product_id, api_id, gateway_id)
       └─ plan_associations   (product_id, plan_id, gateway_id)
       └─ product_deployments (product_id, environment_id, gateway_id)
```

### Patterns to follow

**Loaders/actions** — always call `requireAuth(request)` first, then `getActiveGatewayId(request)`. Multi-intent actions use `formData.get("_intent")`.

**Repositories** — thin Drizzle wrappers, one file per entity, named `*.repository.server.ts`. No business logic inside.

**AWS helpers** — one file per AWS concern in `app/aws/`. Server-only (`.server.ts`). Always log with `[aws:service]` prefix.

**UI components** — import from `radix-ui` unified package (not `@radix-ui/react-*`):
```ts
import { Tooltip as TooltipPrimitive } from "radix-ui"
```

**Associations** — managed client-side in the UI, saved atomically on the single Save action (see `products.$id.tsx`).

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Cookie session signing key |
| `KEYCLOAK_URL` | Keycloak base URL (e.g. `http://localhost:8081`) |
| `KEYCLOAK_REALM` | Realm name |
| `KEYCLOAK_CLIENT_ID` | Client ID |
| `KEYCLOAK_CLIENT_SECRET` | Client secret (blank if public client) |
| `KEYCLOAK_ADMIN_USER` | Admin username for user registration API |
| `KEYCLOAK_ADMIN_PASSWORD` | Admin password |
| `AWS_REGION` | AWS region for API Gateway |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `COGNITO_USER_POOL_ARN` | Cognito User Pool ARN injected into `CognitoAuth` authorizer in every API spec (e.g. `arn:aws:cognito-idp:ap-south-1:443985162942:userpool/ap-south-1_AY6l4PkyX`) |
| `APIGW_ACCESS_LOG_GROUP_ARN` | CloudWatch log group ARN for API Gateway access logs (e.g. `arn:aws:logs:ap-south-1:443985162942:log-group:api-gw-access-logs`). If unset, access logging is skipped but execution logging (INFO) is still enabled. |

## Database migrations

Migrations live in `db/migrations/` as plain SQL with `-- Up Migration` / `-- Down Migration` sections. Number sequentially (`14_...`). Run `npm run db:migrate` after adding one.

## AWS integration notes

- APIs are imported/updated via `importApiSpec` / `putApiSpec` (spec is built with `buildAwsSpec` which injects `x-amazon-apigateway-integration` blocks)
- Integration URIs use `${stageVariables.backendHost}` — the value is resolved from `spec.hosts[envName]` at publish time and stored on the AWS stage
- Plans sync to AWS Usage Plans via `createUsagePlan` / `updateUsagePlan`
- Publishing a product calls `publishProductToEnvironment` which creates/updates one stage per API per environment

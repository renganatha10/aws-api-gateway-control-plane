# API Gateway Portal

A full-stack management portal for AWS API Gateway — create and publish APIs, group them into products, apply rate-limit plans, and deploy to multiple environments, all from one UI.

## Features

- **Gateways** — multi-tenant top-level resource; switch between gateways from the sidebar
- **APIs** — import Swagger 2.0 / OpenAPI 3.0 specs; synced to AWS API Gateway automatically
- **Products** — bundle APIs together with a visibility setting (public / authenticated / invisible); associate plans
- **Plans** — rate-limit tiers (throttle, burst, quota) synced to AWS Usage Plans
- **Environments** — named deployment targets (dev, staging, production)
- **Publish** — deploy a product's APIs to a selected environment; stage variables (`backendHost`) are resolved from each spec's `hosts` map

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Router 7 (SSR) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Language | TypeScript |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | Keycloak 24 (OIDC / ROPC) |
| Cloud | AWS API Gateway (SDK v3) |

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for Postgres + Keycloak)
- An AWS account with API Gateway access
- A Keycloak realm and client (see setup below)

## Getting started

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL on `localhost:5432` (app database)
- PostgreSQL on a private port (Keycloak database)
- Keycloak on `localhost:8081`

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
SESSION_SECRET=<random-string>
DATABASE_URL=postgresql://app:app_password@localhost:5432/app

KEYCLOAK_URL=http://localhost:8081
KEYCLOAK_REALM=my-app
KEYCLOAK_CLIENT_ID=my-app-client
KEYCLOAK_CLIENT_SECRET=

KEYCLOAK_ADMIN_USER=admin
KEYCLOAK_ADMIN_PASSWORD=admin

AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

### 3. Set up Keycloak

1. Open `http://localhost:8081` and sign in with `admin / admin`
2. Create a realm named `my-app`
3. Create a client named `my-app-client`:
   - Client authentication: **on** (confidential)
   - Direct access grants: **enabled**
   - Copy the client secret into `KEYCLOAK_CLIENT_SECRET`

### 4. Run migrations

```bash
npm install
npm run db:migrate
```

### 5. Start the dev server

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
```

## Project structure

```
app/
  aws/               # AWS API Gateway helpers
  components/ui/     # shadcn/ui components
  hooks/             # shared React hooks
  lib/               # db, schema, session, keycloak
  repositories/      # Drizzle data-access layer
  routes/            # React Router route modules
db/
  migrations/        # Sequential SQL migrations
docker-compose.yml   # Postgres + Keycloak local services
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
        └── product_deployments
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

The portal creates an AWS deployment for each API and attaches a stage named after the environment. The `backendHost` stage variable is set from `hosts[envName]` so integration URIs resolve to the correct backend per environment.

## Development notes

- `npm run typecheck` must pass before committing — it runs `react-router typegen` first
- Add new migrations with `npm run db:migrate:create -- <description>`, then edit the generated file to add SQL under `-- Up Migration` and `-- Down Migration`
- shadcn components are added with `npx shadcn add <component>` and use the unified `radix-ui` package

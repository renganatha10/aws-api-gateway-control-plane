# CLAUDE.md

## Project overview

AWS API Gateway Control Plane — a full-stack management portal built with React Router 7 (SSR), Tailwind CSS v4, shadcn/ui, and TypeScript. Manages organisations, gateways, APIs, products, plans, environments, custom domains, and consumers, with direct AWS API Gateway, ACM, and Cognito integration for publishing and provisioning.

## Commands

```bash
npm run dev              # dev server with HMR (http://localhost:5173)
npm run build            # production build
npm run typecheck        # react-router typegen + tsc (run before committing)
npm run db:migrate       # apply pending migrations (node-pg-migrate)
npm run db:migrate:down  # roll back last migration
npm run db:migrate:create  # scaffold a new migration file
npm run test:e2e         # run Playwright e2e tests (headless)
npm run test:e2e:ui      # run Playwright e2e tests (interactive UI)
```

## Architecture

### Stack
- **React Router 7** — SSR, file-based routes, loaders/actions for data
- **Tailwind CSS v4** — utility-first styling
- **shadcn/ui (new-york)** — component library via `radix-ui` unified package
- **Drizzle ORM** — type-safe SQL queries against PostgreSQL
- **node-pg-migrate** — SQL migration files in `db/migrations/`
- **AWS Cognito** — auth via `USER_PASSWORD_AUTH` flow (`app/lib/cognito.server.ts`)
- **AWS SDK v3** — API Gateway (`@aws-sdk/client-api-gateway`) and Cognito (`@aws-sdk/client-cognito-identity-provider`) management

### Directory layout

```
app/
  aws/               # AWS API Gateway, ACM + Cognito helpers (one concern per file)
  components/
    ui/              # shadcn components
    apis/            # components for the API detail page
    consumers/       # components for the consumer detail + tryout pages
    domains/         # components for the custom domain detail page
    environments/    # components for the environments page
    plans/           # components for the plans page
    products/        # components for the product detail page
  hooks/             # shared React hooks
  lib/               # db client, schema (schema.ts), session, cognito
  repositories/      # DB access layer (one file per entity)
  routes/            # React Router route modules (loader + action + thin default export only)
db/migrations/       # numbered SQL migrations (node-pg-migrate format)
tests/e2e/           # Playwright end-to-end tests
```

### Route structure

```
login / logout / forgot-password / reset-password   (standalone, no layout)
organisation.tsx                                     (new org creation, no layout)
health.ts                                            (health-check endpoint)
layout.tsx  (SidebarProvider + AppSidebar + Outlet)
  /                       home.tsx
  /gateway                gateway.tsx
  /apis                   apis.tsx
  /apis/new               api-create.tsx
  /apis/:id               apis.$id.tsx
  /products               products.tsx
  /products/new           product-create.tsx
  /products/:id           products.$id.tsx
  /environments           environments.tsx
  /environments/:id       environments.$id.tsx
  /plans                  plans.tsx
  /consumers              consumers.tsx
  /consumers/new          consumer-create.tsx
  /consumers/:id          consumers.$id.tsx           (Details tab)
  /consumers/:id/tryout   consumers.$id.tryout.tsx    (Try Out tab)
  /domains                domains.tsx
  /domains/new            domain-create.tsx
  /domains/:id            domains.$id.tsx

Resource API routes (no layout, JSON responses):
  api.organisation-switch.ts        # switch active organisation in session
  api.consumer-apikey.$id.ts        # fetch API key value for a consumer
  api.consumer-secret.$id.ts        # fetch Cognito client secret for a consumer
  api.consumer-token.$id.ts         # exchange credentials for an access token (Try Out)
  api.consumer-proxy.ts             # proxy API requests for the Try Out sandbox
```

### Data model

```
organisations
  └─ gateways          (organisation_id FK)
       └─ environments      (gateway_id FK)
       └─ apis              (gateway_id FK, awsApiId, status)
       └─ plans             (gateway_id FK, awsUsagePlanId, status)
       └─ domains           (gateway_id FK, acm_certificate_arn, status)
            └─ domain_route_mappings  (domain_id FK, base_path, api_id, stage)
       └─ products          (gateway_id FK)
            └─ api_associations    (product_id, api_id, gateway_id)
            └─ plan_associations   (product_id, plan_id, gateway_id)
            └─ product_deployments (product_id, environment_id, gateway_id, invoke_url, status)
       └─ consumers         (product_id, environment_id, plan_id, gateway_id,
                              client_id, aws_api_key_id, token_url, status)
```

`status` values for AWS-backed entities: `pending | active | failed | deleting`. See **AWS–DB consistency** section below.

## UI/UX conventions

**List pages** (`apis.tsx`, `products.tsx`, `consumers.tsx`, `domains.tsx`) — read-only browse views:
- No search bar.
- No per-row action buttons or dropdowns.
- Entire table row is clickable and navigates to the detail page (`*.id` route).
- Only one action allowed on the list page: the "New / Add" creation button in the top-right header.
- Environments and Plans are exempt — they keep their existing layout.

**Detail pages** (`apis.$id.tsx`, `products.$id.tsx`, `consumers.$id.tsx`, `domains.$id.tsx`) — all mutations live here:
- Header: breadcrumb (`← EntityList / Entity name`) + action buttons (Save, Publish, Delete) in the top-right.
- All destructive actions (Delete) must open a shadcn `<Dialog>` for confirmation — never use inline confirm/cancel text in the table row or header.
- Separate `useFetcher` for each independent mutation (save vs. delete vs. publish) so loading states don't interfere.
- Use `deleteError` / `publishError` keys (not `error`) when returning action errors for non-save intents, so the UI can route them to the right place.

**Consumer detail** (`consumers.$id.tsx` + `consumers.$id.tryout.tsx`) — horizontal tabs:
- Two tabs: **Details** (form + Save + Delete) and **Try Out** (API sandbox).
- Tabs are URL-based: Details = `/consumers/:id`, Try Out = `/consumers/:id/tryout`.
- Both pages render the same breadcrumb and tab bar so the active tab is always clear.

**Button colors** — all primary action buttons (Save, Create, Publish, Submit, Send, etc.) use black, never blue:
```tsx
<Button className="bg-black hover:bg-gray-900 text-white px-6">Save</Button>
```
Destructive buttons (Delete, Remove) keep `variant="destructive"` — do not change those to black.

**Delete pattern** — consistent across all detail pages:
```tsx
// Action returns a typed error key, not generic "error"
return { deleteError: "Friendly message." }

// Component wires a dedicated fetcher
const deleteFetcher = useFetcher<typeof action>()
const deleteError = deleteFetcher.data && "deleteError" in deleteFetcher.data
  ? (deleteFetcher.data as { deleteError: string }).deleteError
  : null

// Dialog holds the fetcher.Form
<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <DialogContent>
    <DialogHeader><DialogTitle>Delete …</DialogTitle></DialogHeader>
    <p>Confirmation copy…</p>
    {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
    <DialogFooter>
      <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
      <deleteFetcher.Form method="post">
        <input type="hidden" name="_intent" value="delete" />
        <Button type="submit" variant="destructive" disabled={deleteFetcher.state !== "idle"}>
          {deleteFetcher.state !== "idle" ? "Deleting…" : "Delete"}
        </Button>
      </deleteFetcher.Form>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Patterns to follow

**Component organisation** — one component per file, one responsibility per component:

- Route files (`app/routes/`) export only `meta`, `loader`, `action`, and a thin default export that calls `useLoaderData` and renders the page component. No JSX beyond that single return.
- All UI lives in `app/components/<entity>/`. Each file exports exactly one component or one utility (hook, parser, constants).
- Name files after what they render: `product-header.tsx`, `delete-product-dialog.tsx`, `apis-section.tsx`.
- Shared types and constants go in `types.ts` / `constants.ts` within the same directory. Pure parsing/utility functions go in their own file (e.g. `parse-spec.ts`).
- Multi-intent actions: extract each intent as a private `handle*` function above the exported `action`, which becomes a clean dispatcher:

```ts
// route file — action only dispatches
export async function action({ request, params }) {
  const intent = formData.get("_intent")
  if (intent === "delete")  return handleDelete(id)
  if (intent === "publish") return handlePublish(id, formData, organisationId, createdBy)
  return handleUpdate(id, formData, organisationId, createdBy)
}
```

- Delete dialogs own their `useFetcher` internally — no need to lift the fetcher to the page.
- State orchestration belongs in the `*-detail-page.tsx` component; section/panel components receive only the props they need.

See `app/components/products/` as the canonical example — `product-detail-page.tsx` owns state, `product-header.tsx` / `apis-section.tsx` / `plans-section.tsx` etc. are pure presentational components that receive props and callbacks.

**Loaders/actions** — always call `requireAuth(request)` first, then `getActiveOrganisationId(request)` and/or `getActiveGatewayId(request)`. Multi-intent actions use `formData.get("_intent")`.

**Repositories** — thin Drizzle wrappers, one file per entity, named `*.repository.server.ts`. No business logic inside.

**Indexes** — add indexes whenever you introduce FK columns or columns used in common queries:
- Every FK column (`gateway_id`, `organisation_id`, `product_id`, etc.) gets an index.
- Add indexes for columns used in loader WHERE clauses (e.g., `environment_id`, `plan_id` on consumers).
- Unique constraints (e.g., `(product_id, api_id)`) act as indexes — no separate index needed.
- Declare indexes in the same migration that creates the table; use a dedicated `N_indexes_and_constraints.sql` migration only when backfilling across multiple tables.
- Never add a composite index speculatively — only when a real query pattern drives it.

**AWS helpers** — one file per AWS concern in `app/aws/`. Server-only (`.server.ts`). Always log with `[aws:service]` prefix.

**UI components** — import from `radix-ui` unified package (not `@radix-ui/react-*`):
```ts
import { Tooltip as TooltipPrimitive } from "radix-ui"
```

**Associations** — managed client-side in the UI, saved atomically in a single DB transaction on the Save action (see `products.$id.tsx`). The transaction must wrap `updateProduct` + `syncApiAssociations` + `syncPlanAssociations` together so the product name and its associations are committed or rolled back as one unit.

**Error handling** — never return raw error messages to the UI. Every `catch` block must:
1. `console.error("[route-or-module] description", err)` on the server
2. Return a generic, user-friendly message: `return { error: "Something went wrong. Please try again." }`
3. Use specific messages only for known, safe cases (e.g. auth failures, not-found, validation).
- AWS operations: `"Failed to sync with AWS. Please try again."`
- DB operations: `"Something went wrong while saving/deleting. Please try again."`
- Multi-step AWS flows (e.g. consumer provisioning): wrap each phase separately so partial failures are logged precisely.

**Loading states** — every `useFetcher` submit should disable/replace its trigger while `fetcher.state !== "idle"`. Show a spinner for async operations (AWS calls, multi-step provisioning). Pattern for row-level actions:
```tsx
const deleting = fetcher.state !== "idle"
const actionError = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null

if (deleting) return <Spinner />
if (actionError) return <ErrorWithRetry message={actionError} onRetry={() => fetcher.submit(...)} />
```
For full-page forms use `useNavigation`: `const submitting = navigation.state === "submitting"`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Cookie session signing key |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID for auth (`USER_PASSWORD_AUTH` flow) |
| `COGNITO_CLIENT_ID` | Cognito App Client ID (must have `ALLOW_USER_PASSWORD_AUTH` enabled) |
| `COGNITO_CLIENT_SECRET` | Cognito App Client secret |
| `AWS_REGION` | AWS region for API Gateway and Cognito |
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `COGNITO_USER_POOL_ARN` | Cognito User Pool ARN injected into `CognitoAuth` authorizer in every API spec (e.g. `arn:aws:cognito-idp:ap-south-1:443985162942:userpool/ap-south-1_AY6l4PkyX`) |

## Database migrations

Migrations live in `db/migrations/` as plain SQL with `-- Up Migration` / `-- Down Migration` sections. Number sequentially (next is `15_...`). Run `npm run db:migrate` after adding one.

## AWS integration notes

- APIs are imported/updated via `importApiSpec` / `putApiSpec` (spec is built with `buildAwsSpec` which injects `x-amazon-apigateway-integration` blocks)
- Integration URIs use `${stageVariables.backendHost}` — the value is resolved from `spec.hosts[envName]` at publish time and stored on the AWS stage
- Plans sync to AWS Usage Plans via `createUsagePlan` / `updateUsagePlan`
- Publishing a product calls `publishProductToEnvironment` which creates/updates one stage per API per environment and stores the `invoke_url`
- Creating a consumer provisions a Cognito App Client and an AWS API key, storing `client_id`, `aws_api_key_id`, and `token_url` on the consumer record. Each AWS ID is persisted to the DB immediately after that step succeeds so retries skip completed steps.
- Deleting a consumer soft-deletes the DB record first (`status = deleting`), then removes the Cognito App Client and the API Gateway key. AWS 404 responses are treated as success so retries are safe. See **AWS–DB consistency** for the full delete pattern.
- Custom domains use ACM for certificate lookup (`acm.server.ts`) and API Gateway custom domain management (`custom-domain.server.ts`); route mappings are persisted in `domain_route_mappings` and synced to AWS base path mappings

## AWS–DB consistency

**Core principle:** the DB is always written **before** AWS. The DB record is the source of truth for desired state and in-flight status. If AWS and DB diverge, the DB wins and AWS is brought back into sync.

See `plans/aws-db-consistency.md` for the full design. Key rules to enforce in code:

### Status state machine
All AWS-backed entities (`apis`, `plans`, `consumers`, `domains`, `product_deployments`) carry a `status` column:

| Status | Meaning |
|---|---|
| `pending` | DB record created, AWS resource not yet provisioned |
| `active` | Fully provisioned and in sync |
| `failed` | AWS provisioning failed — retry available |
| `deleting` | Soft-deleted in DB, AWS deletion pending |

### Create
1. Insert DB record with `status = pending` — unique constraint fires here, rejecting concurrent duplicates before any AWS call
2. Call AWS (resource name derived from DB record ID — stable across retries)
3. Success → update `status = active` + store AWS resource ID
4. Failure → update `status = failed`; UI shows retry button
5. Retry → check if AWS resource already exists by derived name; if yes, recover by updating DB; if no, re-attempt creation

### Update
1. Update DB record first (DB always reflects desired state)
2. Call AWS to sync the change
3. Failure → return error to UI; no status change needed; retry re-runs the sync

### Delete
1. Update `status = deleting` in DB (single write — no AWS touched yet)
2. Call AWS delete; treat 404 as success so retries are safe
3. Success → hard-delete the DB row
4. Failure → leave `status = deleting`; UI shows retry button

### GET resilience
Detail-page loaders must check `status` before fetching AWS data:
- `pending` / `failed` → render creation-state UI, skip AWS fetch
- `deleting` → render deletion-pending UI, skip AWS fetch
- `active` but AWS returns 404 → render tombstone: "Resource missing in AWS — delete record?" (hard-delete without AWS call)

### Transactions required
| Operation | Transaction scope |
|---|---|
| Product save | `updateProduct` + `syncApiAssociations` + `syncPlanAssociations` |
| `syncApiAssociations` | Entire read + delete loop + insert loop |
| `syncPlanAssociations` | Same |
| `replaceMappings` | `DELETE` + `INSERT` |
| Domain create | Domain insert + `replaceMappings` (AWS call is outside the transaction) |
| Domain save | `replaceMappings` (AWS base-path sync is outside the transaction) |

### Unique constraints (concurrency guards)
| Table | Constraint |
|---|---|
| `apis` | `UNIQUE (name, gateway_id)` |
| `plans` | `UNIQUE (name, gateway_id)` |
| `consumers` | `UNIQUE (name, gateway_id)` |
| `domains` | `UNIQUE (name, organisation_id)` |

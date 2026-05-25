# CLAUDE.md

## Project overview

API Gateway management portal built with React Router 7 (SSR), Tailwind CSS v4, shadcn/ui, and TypeScript. Manages gateways, APIs, products, plans, environments, and consumers, with direct AWS API Gateway and Cognito integration for publishing and provisioning.

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
  aws/               # AWS API Gateway + Cognito helpers (one concern per file)
  components/ui/     # shadcn components
  hooks/             # shared React hooks
  lib/               # db client, schema, session, cognito
  repositories/      # DB access layer (one file per entity)
  routes/            # React Router route modules
db/migrations/       # numbered SQL migrations (node-pg-migrate format)
tests/e2e/           # Playwright end-to-end tests
```

### Route structure

```
login / logout / forgot-password / reset-password   (standalone, no layout)
layout.tsx  (SidebarProvider + AppSidebar + Outlet)
  /                    home.tsx
  /gateway             gateway.tsx
  /apis                apis.tsx
  /apis/new            api-create.tsx
  /apis/:id            apis.$id.tsx
  /products            products.tsx
  /products/new        product-create.tsx
  /products/:id        products.$id.tsx
  /environments        environments.tsx
  /environments/:id    environments.$id.tsx
  /plans               plans.tsx
  /consumers           consumers.tsx
  /consumers/new       consumer-create.tsx
  /consumers/:id       consumers.$id.tsx           (Details tab)
  /consumers/:id/tryout consumers.$id.tryout.tsx   (Try Out tab)
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
       └─ product_deployments (product_id, environment_id, gateway_id, invoke_url)
  └─ consumers         (product_id, environment_id, plan_id, gateway_id,
                         client_id, aws_api_key_id, token_url)
```

## UI/UX conventions

**List pages** (`apis.tsx`, `products.tsx`, `consumers.tsx`) — read-only browse views:
- No search bar.
- No per-row action buttons or dropdowns.
- Entire table row is clickable and navigates to the detail page (`*.id` route).
- Only one action allowed on the list page: the "New / Add" creation button in the top-right header.
- Environments and Plans are exempt — they keep their existing layout.

**Detail pages** (`apis.$id.tsx`, `products.$id.tsx`, `consumers.$id.tsx`) — all mutations live here:
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

**Loaders/actions** — always call `requireAuth(request)` first, then `getActiveGatewayId(request)`. Multi-intent actions use `formData.get("_intent")`.

**Repositories** — thin Drizzle wrappers, one file per entity, named `*.repository.server.ts`. No business logic inside.

**AWS helpers** — one file per AWS concern in `app/aws/`. Server-only (`.server.ts`). Always log with `[aws:service]` prefix.

**UI components** — import from `radix-ui` unified package (not `@radix-ui/react-*`):
```ts
import { Tooltip as TooltipPrimitive } from "radix-ui"
```

**Associations** — managed client-side in the UI, saved atomically on the single Save action (see `products.$id.tsx`).

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

Migrations live in `db/migrations/` as plain SQL with `-- Up Migration` / `-- Down Migration` sections. Number sequentially (next is `18_...`). Run `npm run db:migrate` after adding one.

## AWS integration notes

- APIs are imported/updated via `importApiSpec` / `putApiSpec` (spec is built with `buildAwsSpec` which injects `x-amazon-apigateway-integration` blocks)
- Integration URIs use `${stageVariables.backendHost}` — the value is resolved from `spec.hosts[envName]` at publish time and stored on the AWS stage
- Plans sync to AWS Usage Plans via `createUsagePlan` / `updateUsagePlan`
- Publishing a product calls `publishProductToEnvironment` which creates/updates one stage per API per environment and stores the `invoke_url`
- Creating a consumer provisions a Cognito App Client and an AWS API key, storing `client_id`, `aws_api_key_id`, and `token_url` on the consumer record
- Deleting a consumer removes the Cognito App Client (`deleteAppClient`) and the API Gateway key (`deleteApiKey`) before removing the DB record. AWS cleanup runs first — if it fails the record is preserved and the user can retry.

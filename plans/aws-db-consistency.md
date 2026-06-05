# AWS–DB Consistency Plan: Resource Lifecycle Management

## Core Principle

The DB is always updated **before** AWS. The DB record is the source of truth for desired state and in-flight status. AWS is secondary — if AWS and DB diverge, the DB wins and AWS is brought back into sync.

This applies uniformly across create, update, and delete. The specific mechanism differs per operation type, but the principle is consistent.

---

## Status State Machine

Add a `status` column to every entity backed by an AWS resource:

```
pending → active → deleting → (row hard-deleted)
               ↘ failed
```

| Status | Meaning |
|---|---|
| `pending` | DB record created, AWS resource not yet provisioned |
| `active` | Fully provisioned, AWS and DB in sync |
| `failed` | AWS provisioning failed, retry available |
| `deleting` | DB soft-deleted, AWS deletion in progress or pending |

Entities that need this column: `apis`, `plans`, `consumers`, `domains`.
`product_deployments` already acts as a deployment record — add `status` there too.

Pure-DB entities (`products`, `environments`, `organisations`) need no status column.

---

## Concurrency Strategy

**Problem:** Two concurrent create requests for the same resource name both pass a pre-check, both call AWS, and create duplicate resources.

**Solution: DB insert first as the concurrency lock.**

1. Add a unique constraint on the natural key for each entity:
   - `apis`: `(name, gateway_id)`
   - `plans`: `(name, gateway_id)`
   - `consumers`: `(name, gateway_id)`
   - `domains`: `(name, organisation_id)`
2. Insert the `pending` DB record before touching AWS. The unique constraint fires here — the second concurrent request gets a conflict error immediately, before any AWS call is made.
3. Derive the AWS resource name from the DB record's primary key (e.g. `api-{id}`, `consumer-{id}`). The user-visible name lives in the DB only. This guarantees the AWS name is unique across retries and concurrent requests without any coordination.

---

## Operation Patterns

### Create

```
1. INSERT DB record (status = pending, aws_id = null)
   └─ unique constraint fires here — concurrent duplicate rejected immediately
2. Call AWS to create resource
   └─ use a name derived from the DB record ID (stable, deterministic)
3. On AWS success → UPDATE status = active, aws_id = <returned id>
4. On AWS failure → UPDATE status = failed
   └─ UI shows retry button
5. On retry → check if AWS resource already exists by derived name
   └─ if yes: recover — just update DB record with existing AWS id, set status = active
   └─ if no:  re-attempt AWS creation, go to step 3
```

**Why insert first:** If AWS is called first and succeeds but the DB insert fails, you have an orphaned AWS resource with no DB record — untrackable and unrecoverable. Inserting first means failure before the AWS call is a clean no-op (just delete the pending row or leave it for cleanup).

---

### Update

```
1. UPDATE DB record with new values (DB reflects desired state immediately)
2. Call AWS to sync the change
3. On AWS success → done
4. On AWS failure → return error to UI, let user retry
   └─ no status change needed — DB already holds the correct desired state
   └─ retry just re-runs the AWS sync call
```

Updates do not need a `status` change because the DB record always reflects what the resource *should* look like. A failed AWS sync doesn't corrupt the DB. The user retrying is safe and idempotent.

**Exception — Consumer plan/product change:** If updating a consumer requires re-provisioning AWS resources (e.g. API key rotation), treat it as a mini-saga: write DB first, attempt AWS, surface retry on failure. Does not need a status column — an explicit error return is enough.

---

### Delete

```
1. UPDATE status = deleting in DB (single fast write — no AWS touched yet)
2. Call AWS delete
   └─ treat AWS 404 (resource not found) as success — makes retries safe
3. On AWS success → hard-DELETE the DB row
4. On AWS failure → leave status = deleting
   └─ UI shows "Deletion pending — retry" button
5. On retry → repeat from step 2 (AWS 404 = success, then step 3)
```

**Why DB soft-delete first:**
- The GET loader checks `status` before deciding whether to fetch AWS data
- If `status = deleting`, the loader never calls AWS — it renders a deletion-pending UI
- This eliminates the failure mode where AWS deletion succeeds, the DB hard-delete fails, and the next GET tries to describe a non-existent AWS resource

**GET resilience (defence in depth):**
Even with the above, add a fallback in every detail-page loader:
- `status = pending` → render "Creation in progress" + retry button, skip AWS fetch
- `status = failed` → render "Creation failed" + retry button, skip AWS fetch
- `status = deleting` → render "Deletion in progress" + retry button, skip AWS fetch
- `status = active` but AWS returns 404 → render tombstone: "Resource missing in AWS — delete record?" with a button that skips AWS and just hard-deletes the DB row

---

## Transactions

These are DB-consistency fixes that apply regardless of the saga pattern above.

| Operation | Current state | Fix |
|---|---|---|
| `syncApiAssociations` | Loop of individual deletes + inserts, no transaction | Wrap the entire sync (read + loop of deletes + inserts) in a single transaction |
| `syncPlanAssociations` | Same | Same |
| Product save (route action) | Calls `updateProduct` → `syncApiAssociations` → `syncPlanAssociations` sequentially | Wrap all three in one transaction — product name and associations save atomically or not at all |
| `replaceMappings` | `DELETE` then `INSERT`, no transaction | Wrap both statements in a transaction |
| Domain create | `createDomain` insert then `replaceMappings` | Wrap domain insert + `replaceMappings` in one transaction; AWS call happens before the transaction |
| Domain save (update) | `replaceMappings` only | Wrap `replaceMappings` in a transaction; AWS base-path sync happens after |

---

## Entity-by-Entity Plan

### API

**Status column:** `apis.status` (`pending | active | failed | deleting`)
**Unique constraint:** `(name, gateway_id)`

| Operation | Flow |
|---|---|
| Create | Insert pending → AWS `CreateRestApi` (name = `api-{id}`) → update active + `aws_api_id` |
| Update (spec) | Update `spec` in DB → AWS `PutRestApi` / `ImportRestApi` → error on failure, retry |
| Delete | Set `deleting` → AWS `DeleteRestApi` (404 = ok) → hard-delete row |

**Retry on create:** call AWS `GetRestApis`, find by tag or derived name. If found, update DB with existing id. If not found, re-attempt creation.

---

### Plan

**Status column:** `plans.status` (`pending | active | failed | deleting`)
**Unique constraint:** `(name, gateway_id)`

| Operation | Flow |
|---|---|
| Create | Insert pending → AWS `CreateUsagePlan` → update active + `aws_usage_plan_id` |
| Update | Update DB (name, throttle, quota) → AWS `UpdateUsagePlan` → error on failure, retry |
| Delete | Set `deleting` → AWS `DeleteUsagePlan` (404 = ok) → hard-delete row |

**Retry on create:** call AWS `GetUsagePlans`, find by name. If found, update DB. If not found, re-attempt.

---

### Consumer

**Status column:** `consumers.status` (`pending | active | failed | deleting`)
**Unique constraint:** `(name, gateway_id)`

Consumer provisioning is multi-step (Cognito App Client + API Key). Each AWS ID is persisted to the DB immediately after that step succeeds — this makes retries idempotent without extra AWS describe calls.

| Operation | Flow |
|---|---|
| Create | Insert pending (client_id = null, aws_api_key_id = null) → AWS `CreateUserPoolClient` → update `client_id` → AWS `CreateApiKey` → update `aws_api_key_id` → update active + `token_url` |
| Update (name/plan) | Update DB fields → sync to AWS if required → error on failure |
| Delete | Set `deleting` → AWS `DeleteUserPoolClient` (404 = ok) → AWS `DeleteApiKey` (404 = ok) → hard-delete row |

**Retry on create:**
- If `client_id` is already set on the pending record: skip Cognito step
- If `aws_api_key_id` is already set: skip API key step
- Resume from where the record left off

**Delete order matters:** delete Cognito client first, then API key. If Cognito delete fails, API key still exists — safe to retry both. If Cognito succeeds and API key fails, row stays `deleting`, retry calls Cognito delete (404 = ok), retries API key delete.

---

### Domain

**Status column:** `domains.status` (`pending | active | failed | deleting`)
**Unique constraint:** `(name, organisation_id)`

| Operation | Flow |
|---|---|
| Create | Insert pending → ACM certificate lookup (read-only) → AWS `CreateDomainName` → **transaction:** update `aws_domain_name` + set active + replace mappings |
| Update | **Transaction:** update domain record + `replaceMappings` → AWS base-path mapping sync → error on failure |
| Delete | Set `deleting` → AWS `DeleteDomainName` (404 = ok) → **transaction:** hard-delete domain row + cascade-delete `domain_route_mappings` |

**Why transaction on create step 4:** if `aws_domain_name` is written but mappings fail to insert, the domain is `active` with no routes. Wrapping both in one transaction ensures the domain only goes active when mappings are also committed.

**Retry on create:** call AWS `GetDomainName` by domain name. If found, recover with existing `aws_domain_name`. If not found, re-attempt creation.

---

### Product Deployment (Publish)

**Status column:** `product_deployments.status` (`pending | active | failed`)

Publish is the most complex operation — it touches multiple APIs across multiple environments.

| Operation | Flow |
|---|---|
| Publish | Upsert deployment record with `status = pending` → for each API: create/update AWS stage (idempotent) → update `invoke_url` + set `status = active` |
| Retry | Re-run publish — AWS stage create/update is idempotent, safe to retry without checks |

No delete pattern — deployments are updated in place, not deleted individually. Unpublishing would set `status = deleting` and remove the stages.

---

### Pure-DB Entities (no pattern change)

| Entity | Create | Update | Delete |
|---|---|---|---|
| Product | Single DB insert | Transaction: `updateProduct` + `syncApiAssociations` + `syncPlanAssociations` | Single DB delete |
| Environment | Single DB insert | Not supported | Single DB delete |
| Organisation | Already transactional (org + member + environments) | — | Single DB delete |

---

## DB Schema Changes Summary

### New columns

| Table | Column | Type | Notes |
|---|---|---|---|
| `apis` | `status` | `text` | `pending \| active \| failed \| deleting`, default `active` for existing rows |
| `plans` | `status` | `text` | Same defaults |
| `consumers` | `status` | `text` | Same defaults |
| `domains` | `status` | `text` | Same defaults |
| `product_deployments` | `status` | `text` | `pending \| active \| failed`, default `active` for existing rows |

### New unique constraints

| Table | Constraint |
|---|---|
| `apis` | `UNIQUE (name, gateway_id)` |
| `plans` | `UNIQUE (name, gateway_id)` |
| `consumers` | `UNIQUE (name, gateway_id)` |
| `domains` | `UNIQUE (name, organisation_id)` |

### Migration order

Run as two migrations:
1. `15_resource_status_columns.sql` — add all `status` columns with `DEFAULT 'active'` (non-breaking for existing rows)
2. `16_resource_unique_constraints.sql` — add unique constraints (verify no existing duplicates before applying)

---

## What Was Explicitly Ruled Out

| Item | Reason |
|---|---|
| Outbox pattern for Update API / Update Plan | Single fast AWS call. DB holds desired state. Retry is safe without any state tracking. |
| Outbox pattern for all Delete operations | Soft-delete status + AWS-first-with-404-as-success is sufficient. No background worker needed. |
| Appending user ID to AWS resource names | Doesn't solve concurrent same-user submissions; leaks internals into user-visible names. Unique constraint + insert-first solves this properly. |
| Background worker / async processor | All operations complete within a single HTTP request. Retry is user-initiated via UI. A background worker adds operational complexity with no benefit at this scale. |
| Outbox for pure-DB entities | No AWS = no consistency gap. Transactions are the right tool. |

# Middleware Auth & RBAC Plan

## Overview

Centralise authentication and role-based access control using React Router 7's `v8_middleware` future flag. Currently `requireAuth()` and `requirePermission()` are scattered manually across ~20 route files. This plan moves auth to a single chokepoint on `layout.tsx` and adds permission middleware on routes that need it, ensuring authorization runs on both full-page requests and client-side `.data` requests.

---

## Complete Audit of Role Checks

### Server-side — Loaders

| Route | `requireAuth` | Role/Permission Check | How |
|---|---|---|---|
| `layout.tsx` | ✅ | `portal-user` routing guard | hardcoded redirect to `/consumers` |
| `api-create.tsx` | ✅ | `create:resources` | `can()` + redirect to `/apis` |
| `product-create.tsx` | ✅ | `create:resources` | `can()` + redirect to `/products` |
| `domain-create.tsx` | ✅ | `create:resources` | `can()` + redirect to `/domains` |
| `consumer-create.tsx` | ✅ | `manage:consumers` | `can()` + redirect to `/consumers` |
| `users.tsx` | ✅ | `view:users` | `getMemberRole()` direct DB hit + `can()` + redirect to `/` |
| `consumers.tsx` | ✅ | none | auth only |
| `domains.tsx` | ✅ | none | auth only |
| `products.tsx` | ✅ | none | auth only |
| `apis.tsx` | ✅ | none | auth only |
| `plans.tsx` | ✅ | none | auth only |
| `environments.tsx` | ✅ | none | auth only |
| `consumers.$id.tsx` | ✅ | none | auth only |
| `consumers.$id.tryout.tsx` | ✅ | none | auth only |
| `products.$id.tsx` | ✅ | none | auth only |
| `domains.$id.tsx` | ✅ | none | auth only |
| `apis.$id.tsx` | ✅ | none | auth only |
| `organisation.tsx` | ✅ | none | auth only |
| `home.tsx` | ❌ | none | **known gap — no auth at all** |
| `api.consumer-proxy.ts` | ✅ | none | outside layout |
| `api.organisation-switch.ts` | ✅ | none | outside layout |
| `api.consumer-secret.$id.ts` | ✅ | none | outside layout |
| `api.consumer-apikey.$id.ts` | ✅ | none | outside layout |
| `api.consumer-token.$id.ts` | ✅ | none | outside layout |

### Server-side — Actions

| Route | Permission(s) Checked | Intents |
|---|---|---|
| `api-create.tsx` | `create:resources` | all |
| `product-create.tsx` | `create:resources` | all |
| `domain-create.tsx` | `create:resources` | all |
| `consumer-create.tsx` | `manage:consumers` | all |
| `users.tsx` | `invite:users` | invite, remove, update-role (3 handlers) |
| `plans.tsx` | `create:resources`, `edit:resources`, `delete:resources` | by intent |
| `environments.tsx` | `create:resources` | create intent |
| `products.$id.tsx` | `edit:resources`, `publish:products`, `delete:resources` | by intent |
| `apis.$id.tsx` | `edit:resources`, `delete:resources` | by intent |
| `domains.$id.tsx` | `edit:resources`, `delete:resources` | by intent |
| `consumers.$id.tsx` | `manage:consumers` | all intents |

### Client-side — JSX / Components

| File | Permission(s) Checked | What It Controls |
|---|---|---|
| `app-sidebar.tsx` | `view:all`, `view:users` | sidebar nav items visibility |
| `product-header.tsx` | `edit:resources`, `publish:products`, `delete:resources` | Save / Publish / Delete buttons |
| `api-header.tsx` | `edit:resources`, `delete:resources` | Save / Delete buttons |
| `consumer-header.tsx` | `manage:consumers` | Save / Delete buttons |
| `domain-header.tsx` | `delete:resources` | Delete button only (**Save has no guard — see Step 9**) |
| `plans-page.tsx` | `create:resources` | Add plan button |
| `environments-page.tsx` | `create:resources` | Add / "create first" environment buttons |
| `users-page.tsx` | `invite:users` | Invite User button |
| `users-table.tsx` | `invite:users` | Remove member button |

---

## Implementation Steps

### Step 1 — Enable `v8_middleware`

```ts
// react-router.config.ts
export default {
  ssr: true,
  future: { v8_middleware: true },
} satisfies Config;
```

No behavior change — just unlocks the feature.

---

### Step 2 — Create typed context file (`app/lib/middleware.server.ts`)

Define one context object carrying everything downstream loaders and actions need, so they never re-read the cookie:

```ts
userContext = createContext<{
  user: UserProfile;       // email, name, sub — from decoded JWT
  role: OrgRole | null;    // admin | editor | viewer | portal-user
  orgId: number | null;    // active organisation
}>()
```

Also define two building blocks here:

- `authMiddleware` — does `requireAuth` + stamps `userContext`
- `permissionMiddleware(permission, redirectTo?)` — factory that reads `userContext.role` and either redirects or throws 403

---

### Step 3 — Auth middleware on `layout.tsx`

`authMiddleware` replaces the current loader's manual `requireAuth()` call. It also takes over the portal-user routing guard that currently lives in the loader body.

```
authMiddleware on layout:
  1. requireAuth (JWT verify + silent refresh → redirect /login if invalid)
  2. Decode user profile from token
  3. Read orgId + role from session cache (written by layout loader on prior nav)
  4. Portal-user guard: if role === "portal-user" and pathname not /consumers or /api/*, redirect /consumers
  5. context.set(userContext, { user, role, orgId })
  6. next()
```

**Why this covers client-side `.data` requests:** `layout.tsx` already has a loader, so React Router always includes it in the `.data` request batch on every client-side navigation within the protected area. The middleware wraps that `.data` fetch — auth runs on every nav regardless of whether it is a full page load or a link click.

The layout loader still runs (to load organisations, update the session cache, and return `activeUserRole` to the client for the `<Can>` component and sidebar). It drops the redundant `requireAuth()` call and reads from `context.get(userContext)` instead.

---

### Step 4 — Permission middleware on loader-guarded create/access routes

These routes currently do `requireAuth` + `can()` + redirect in their loader. That logic moves to a middleware, which runs before both the loader and the action:

| Route | Middleware | Redirect if denied |
|---|---|---|
| `api-create.tsx` | `permissionMiddleware("create:resources")` | redirect `/apis` |
| `product-create.tsx` | `permissionMiddleware("create:resources")` | redirect `/products` |
| `domain-create.tsx` | `permissionMiddleware("create:resources")` | redirect `/domains` |
| `consumer-create.tsx` | `permissionMiddleware("manage:consumers")` | redirect `/consumers` |
| `users.tsx` | `permissionMiddleware("view:users")` | redirect `/` |

The `permissionMiddleware` factory uses a **redirect** (not 403) for these routes to match current UX. The `requirePermission()` in their actions still throws 403 — that distinction is intentional because a redirect on a POST is wrong.

**Execution chain for client nav to `/apis/new`:**
```
layout middleware    → stamps userContext (auth + portal-user guard)
api-create middleware → checks create:resources, redirects /apis if viewer/portal-user
api-create loader    → reads from context, returns form data
```

The same chain wraps the POST — permission is enforced for both loading the form and submitting it.

---

### Step 5 — Action-level `requirePermission()` — simplify, don't remove

The `requirePermission()` calls in all actions stay in place — they are the authoritative server-side guard for mutations. The function is simplified to read from context instead of re-parsing the session cookie:

**Current:** `requirePermission(request, orgId, permission)` — reads session cookie, DB slow-path fallback.  
**After:** `requirePermission(context, permission)` — reads `context.get(userContext).role` directly.

The `orgId` param goes away because it was only needed for the DB slow-path, which is eliminated since the middleware already resolved the role.

All existing action intents and permission checks remain unchanged — only the internals of `requirePermission` change.

---

### Step 6 — Fix `home.tsx` — the known auth gap

`home.tsx` has no `requireAuth()` in its loader today. A direct request to `/` with no valid session reaches the home loader. With the layout middleware in place this is **automatically fixed** — the layout middleware runs before the home loader and redirects to `/login`. No change needed to `home.tsx` itself.

---

### Step 7 — Resource API routes — keep as-is

`api.consumer-proxy.ts`, `api.organisation-switch.ts`, `api.consumer-secret.$id.ts`, `api.consumer-apikey.$id.ts`, `api.consumer-token.$id.ts` are **outside the layout** (no parent middleware covers them). They keep their direct `requireAuth()` calls. These are small, focused resource endpoints and are already correctly guarded.

---

### Step 8 — Client middleware on `layout.tsx` (UX layer)

A thin `clientMiddleware` on `layout.tsx` prevents the visual flash where a portal-user's browser briefly renders a forbidden page before the server redirect arrives:

```
clientMiddleware on layout:
  1. await next()  ← wait for layout loader data (includes activeUserRole)
  2. Read activeUserRole from layout loader result
  3. If portal-user and pathname not /consumers → throw redirect("/consumers")
```

This is a **UX shortcut only** — the server middleware (Step 3) is the authoritative guard. The client middleware cannot read the `httpOnly` session cookie; it gets the role from the loader data returned by `next()`.

---

### Step 9 — Fix `domain-header.tsx` Save button (UI gap)

The audit found that `domain-header.tsx` wraps the Delete button with `<Can permission="delete:resources">` but the Save button has no permission guard. Every other detail header (`product-header`, `api-header`, `consumer-header`) guards Save.

Fix: add `<Can permission="edit:resources">` around the Save button in `domain-header.tsx`.

This is a UI-only gap — the action already calls `requirePermission(..., "edit:resources")` so the server is safe — but viewers currently see a Save button they cannot use.

---

## What Changes, What Stays the Same

| Concern | Change |
|---|---|
| `requireAuth()` in layout-child loaders | **Removed** — layout middleware handles it |
| `requireAuth()` in resource API routes | **Unchanged** |
| Portal-user routing guard | **Moved** from layout loader body → layout `authMiddleware` |
| `can()` + redirect in create-route loaders | **Moved** to `permissionMiddleware` on those routes |
| `requirePermission()` in all actions | **Simplified** to read from context; no DB slow-path |
| `<Can>` component, `usePermissions` hook | **Unchanged** — client-side UI guards work fine |
| `app-sidebar.tsx` permission filtering | **Unchanged** — reads from layout loader data |
| Session cookie, DB sessions, Cognito flow | **Unchanged** |

---

## Migration Order

Safe to do incrementally — calling `requireAuth()` twice during migration is harmless.

1. Enable `v8_middleware` flag in `react-router.config.ts`
2. Create `app/lib/middleware.server.ts` with `userContext`, `authMiddleware`, `permissionMiddleware`
3. Add `authMiddleware` to `layout.tsx` + update its loader to read from context
4. Add `permissionMiddleware` to the 5 routes: `api-create`, `product-create`, `domain-create`, `consumer-create`, `users`
5. Simplify `requirePermission()` in `app/lib/require-role.server.ts` to use context
6. Drop redundant `requireAuth()` calls from all layout-child loaders (do route by route)
7. Add `clientMiddleware` to `layout.tsx`
8. Fix `domain-header.tsx` Save button guard

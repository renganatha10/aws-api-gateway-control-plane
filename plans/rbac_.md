# Plan: User Management with RBAC

## Context

The app currently has no user or role concept — all entities are owned by whoever created them (`createdBy` email). Every authenticated user has full access to every org they created. The request is to add:

1. **4 roles** (admin / editor / viewer / portal-user) using Cognito Groups
2. **Org membership table** so users can belong to multiple orgs with different roles per org
3. **Invite flow** — only admins can add users; no self-signup for invited users
4. **Users tab** in sidebar listing org members and their roles
5. **Frontend RBAC hooks/component** — single injection point (`usePermissions()` + `<Can>`) to show/hide buttons
6. **Backend defense-in-depth** — one `requirePermission()` utility called per mutating action (minimal, not scattered)

---

## Architecture Decisions

- **Role authority = DB** (`organisation_members.role`). Cognito Groups are created for structural consistency but the DB is the source of truth. Per-org role (user is admin in org A, viewer in org B) cannot live in a global JWT claim.
- **Role is read in the layout loader** on every navigation — fresh, never stale. No session caching.
- **Frontend RBAC**: `useRouteLoaderData("routes/layout")` gives every nested component access to `activeUserRole` via `usePermissions()` hook — no context provider needed.
- **Invite flow**: `AdminCreateUserCommand` (no SUPPRESS) — Cognito sends email with temp password. Login flow handles `NEW_PASSWORD_REQUIRED` challenge with a dedicated `/set-password` page.

---

## Permission Matrix

| Permission key | Admin | Editor | Viewer | Portal-User |
|---|---|---|---|---|
| `view:all` (non-consumer pages) | ✅ | ✅ | ✅ | ❌ |
| `view:consumers` | ✅ | ✅ | ✅ | ✅ |
| `view:users` (users tab) | ✅ | ✅ | ✅ | ❌ |
| `create:resources` | ✅ | ✅ | ❌ | ❌ |
| `edit:resources` | ✅ | ✅ | ❌ | ❌ |
| `delete:resources` | ✅ | ✅ | ❌ | ❌ |
| `publish:products` | ✅ | ✅ | ❌ | ❌ |
| `manage:consumers` (create/edit/delete consumers) | ✅ | ✅ | ❌ | ✅ |
| `invite:users` | ✅ | ❌ | ❌ | ❌ |

---

## Implementation Steps

### Step 1 — DB migrations + schema

**Create** `db/migrations/12_create_organisation_members.sql`:
```sql
CREATE TABLE organisation_members (
  id              SERIAL PRIMARY KEY,
  organisation_id INTEGER      NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_email      VARCHAR(255) NOT NULL,
  role            VARCHAR(50)  NOT NULL CHECK (role IN ('admin','editor','viewer','portal-user')),
  invited_by      VARCHAR(255),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, user_email)
);
CREATE INDEX idx_org_members_email ON organisation_members(user_email);
```

**Create** `db/migrations/13_backfill_org_members.sql` — inserts an `admin` row for every existing org's `created_by`:
```sql
INSERT INTO organisation_members (organisation_id, user_email, role)
SELECT id, created_by, 'admin' FROM organisations
ON CONFLICT DO NOTHING;
```

**Update** `app/lib/schema.ts` — add `organisationMembers` table and export `OrgRole` type:
```ts
export type OrgRole = "admin" | "editor" | "viewer" | "portal-user";
export const organisationMembers = pgTable("organisation_members", { ... });
```

---

### Step 2 — Organisation members repository

**Create** `app/repositories/organisation-member.repository.server.ts` with:
- `getMemberRole(orgId, email) → OrgRole | null`
- `listMembersByOrganisation(orgId) → OrganisationMember[]`
- `addMember(orgId, email, role, invitedBy) → OrganisationMember`
- `removeMember(orgId, email)`
- `updateMemberRole(orgId, email, role)`

---

### Step 3 — Organisation repository updates

**Modify** `app/repositories/organisation.repository.server.ts`:

1. `listOrganisations(email)` — change to UNION query: orgs where `createdBy = email` OR where `organisation_members.user_email = email`
2. `countOrganisations(email)` — same join/union
3. `createOrganisationWithEnvironments()` / `createOrganisation()` — after inserting the org, also insert an `admin` row in `organisation_members` for the creator (keeps invariant that creator is always a member)

---

### Step 4 — Permission constants + RBAC utilities

**Create** `app/lib/permissions.ts` (shared client+server, no `.server.ts`):
- `Permission` union type (strings like `"edit:resources"`, `"invite:users"`, etc.)
- `ROLE_PERMISSIONS` map
- `can(role: OrgRole | null, permission: Permission): boolean`
- `getPermissions(role: OrgRole | null): Permission[]`

**Create** `app/hooks/use-permissions.ts`:
```ts
export function usePermissions() {
  const data = useRouteLoaderData("routes/layout") as { activeUserRole: OrgRole | null };
  const role = data?.activeUserRole ?? null;
  return { role, can: (p: Permission) => can(role, p) };
}
```

**Create** `app/components/can.tsx` — renders children if `can(permission)` is true:
```tsx
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
```

**Create** `app/lib/require-role.server.ts` — single server-side permission utility:
```ts
export async function requirePermission(
  accessToken: string, orgId: number, permission: Permission
): Promise<OrgRole> { /* throws data({error:"Forbidden"}, {status:403}) if not allowed */ }
```

---

### Step 5 — Cognito helpers update

**Modify** `app/lib/cognito.server.ts`:

1. Add `AdminAddUserToGroupCommand`, `RespondToAuthChallengeCommand` to imports.

2. Export `NewPasswordChallengeResult` interface and change `loginWithCredentials` return type to `Promise<TokenResponse | NewPasswordChallengeResult>`. When Cognito returns `ChallengeName === "NEW_PASSWORD_REQUIRED"`, return `{ challengeName, session, email }` instead of throwing.

3. Add `inviteUser({ email, firstName, lastName })` — calls `AdminCreateUserCommand` without `MessageAction: SUPPRESS` so Cognito sends the invite email with temp password. Does NOT call `AdminSetUserPassword` so the forced-password-change challenge remains active.

4. Add `setNewPassword(email, session, newPassword) → Promise<TokenResponse>` — calls `RespondToAuthChallengeCommand` with `NEW_PASSWORD_REQUIRED` and returns tokens.

---

### Step 6 — Session helpers for challenge flow

**Modify** `app/lib/session.server.ts` — add two helpers to temporarily store the Cognito challenge in the session cookie (used between the login redirect and the set-password page):
- `storeNewPasswordChallenge(request, { session, email }) → string` (Set-Cookie value)
- `getNewPasswordChallenge(request) → { session, email } | null`

---

### Step 7 — Layout loader

**Modify** `app/routes/layout.tsx`:

1. After resolving `activeOrganisationId`, call `getMemberRole(activeOrganisationId, user.email)` → `activeUserRole`.
2. If `activeUserRole === "portal-user"` and path is not under `/consumers` or `/api/`, throw `redirect("/consumers")`.
3. Return `{ user, organisations, activeOrganisationId, activeUserRole }`.
4. Pass `activeUserRole` into `<AppSidebar ... activeUserRole={activeUserRole} />`.

---

### Step 8 — Login page + set-password route

**Modify** `app/routes/login.tsx`:
- Remove the Sign Up tab from the UI (Sign Up path stays for initial org creator but is not surfaced in the UI).
- In the login action, after `loginWithCredentials()`, check if result has `challengeName`. If so, store challenge in session and `redirect("/set-password")`.
- In the signup path, after creating the user, add them to `organisation_members` as `admin` when they create their first org (handled by the org repository update in Step 3).

**Create** `app/routes/set-password.tsx` (standalone, no layout, same style as forgot-password):
- Loader: reads challenge from session; redirects to `/login` if missing.
- Action: calls `setNewPassword(email, session, newPassword)` → creates session → redirects to `/`.
- Component: `app/components/set-password-page.tsx` — password + confirm fields.

---

### Step 9 — Sidebar update

**Modify** `app/components/app-sidebar.tsx`:

1. Accept `activeUserRole: OrgRole | null` prop.
2. Import `can` from `~/lib/permissions`.
3. The existing `navItems` array is shown only if `can(activeUserRole, "view:all")`. Portal-users see only Consumers.
4. Add Users nav item (`/users`, `UserRound` icon) rendered when `can(activeUserRole, "view:users")`, after a `<SidebarSeparator />`.

---

### Step 10 — Users route + components

**Create** `app/routes/users.tsx` (thin loader/action/default export):
- Loader: checks `view:users` permission; queries `listMembersByOrganisation(orgId)`.
- Action dispatches `_intent`: `invite` → `handleInvite`, `remove` → `handleRemove`, `update-role` → `handleUpdateRole`.
- Each handler calls `requirePermission(accessToken, orgId, 'invite:users')`.
- `handleInvite` flow: `inviteUser(email, firstName, lastName)` → `addMember(orgId, email, role, inviterEmail)`. On `UsernameExistsException`, skip Cognito create, only call `addMember`.

**Create** `app/components/users/`:
- `users-page.tsx` — state container, renders table + invite button
- `users-table.tsx` — member rows with `<RoleBadge>`, remove button wrapped in `<Can permission="invite:users">`
- `invite-user-dialog.tsx` — `<Dialog>` with email, firstName, lastName, role select (editor/viewer/portal-user only). Owns its own `useFetcher`.
- `role-badge.tsx` — colored badge chip for each role

---

### Step 11 — Apply `<Can>` to detail pages

For each entity, wrap action buttons with `<Can>`. Pattern applied to these component files:

- `app/components/products/product-header.tsx` — `Save` → `edit:resources`, `Publish` → `publish:products`, `Delete` → `delete:resources`
- Any api header component — `Save` → `edit:resources`, `Delete` → `delete:resources`
- Consumer header — `Save` / `Delete` → `manage:consumers`
- Domain header — `Save` → `edit:resources`, `Delete` → `delete:resources`
- Environment/Plan add buttons — `create:resources`
- All list page "New" buttons — `create:resources` (consumers → `manage:consumers`)

**Create page loaders** (api-create, product-create, consumer-create, domain-create) — add one `requirePermission` call at the top of the loader to block viewers from reaching the creation pages entirely.

---

### Step 12 — Backend action guards

Add `requirePermission(accessToken, orgId, permission)` at the top of each mutating action handler. This is the defense-in-depth layer so viewers/portal-users can't bypass the UI via direct HTTP. One line per action:

Routes to update: `apis.$id.tsx`, `api-create.tsx`, `products.$id.tsx`, `product-create.tsx`, `consumers.$id.tsx`, `consumer-create.tsx`, `domains.$id.tsx`, `domain-create.tsx`, `plans.tsx`, `environments.tsx`.

---

## Files Overview

**New files:**
- `db/migrations/12_create_organisation_members.sql`
- `db/migrations/13_backfill_org_members.sql`
- `app/repositories/organisation-member.repository.server.ts`
- `app/lib/permissions.ts`
- `app/lib/require-role.server.ts`
- `app/hooks/use-permissions.ts`
- `app/components/can.tsx`
- `app/routes/set-password.tsx`
- `app/components/set-password-page.tsx`
- `app/routes/users.tsx`
- `app/components/users/users-page.tsx`
- `app/components/users/users-table.tsx`
- `app/components/users/invite-user-dialog.tsx`
- `app/components/users/role-badge.tsx`

**Modified files:**
- `app/lib/schema.ts`
- `app/lib/cognito.server.ts`
- `app/lib/session.server.ts`
- `app/repositories/organisation.repository.server.ts`
- `app/routes/layout.tsx`
- `app/routes/login.tsx`
- `app/components/app-sidebar.tsx`
- All entity detail + create route files (action guards)
- All entity header components (wrap buttons with `<Can>`)

---

## Verification

1. Run migrations: `npm run db:migrate`
2. `npm run typecheck` — no TS errors
3. **Admin flow**: Sign up → auto admin role → invite an editor → invited user receives Cognito email → logs in → redirected to `/set-password` → sets password → lands on `/`
4. **Viewer flow**: Log in as viewer → all pages visible → Save/Delete/New buttons hidden → direct POST to a mutating action returns 403
5. **Portal-user flow**: Log in → redirected to `/consumers` if navigating elsewhere → Consumers page fully functional → Users tab hidden in sidebar
6. **Multi-org**: User is admin in org A, viewer in org B → switch org → buttons change state immediately without logout
7. `npm run test:e2e` — existing tests pass

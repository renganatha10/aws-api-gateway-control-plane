# Plan: Cognito Email Notifications

## Context

The app creates Cognito users via `AdminCreateUserCommand` with `MessageAction: "SUPPRESS"`, meaning no welcome email is ever sent. The only working email today is the forgot-password reset code, which fires via Cognito's default sender (`no-reply@verificationemail.com`, 50 emails/day cap, no branding). This plan wires up production-grade email for all Cognito-triggered events and adds a consumer credential delivery email for newly provisioned API consumers.

---

## Scope

Four independently shippable phases in recommended order:

| Phase | What | App code change? |
|---|---|---|
| 1 | Configure SES as Cognito email sender | No (AWS Console / infra only) |
| 2 | Custom Message Lambda (branded HTML emails) | New Lambda (separate repo or inline) |
| 3 | Un-suppress welcome email on user creation | 1-line change in `cognito.server.ts` |
| 4 | Consumer credential email via SES | New SES helper + action change |

---

## Phase 1 — SES Email Sender (Infra Only)

**No app code changes.**

Steps in AWS Console / Terraform:
1. Verify sending domain (or address) in **SES → Verified identities**
2. Move SES out of sandbox — submit production access request
3. Open **Cognito User Pool → Messaging → Email configuration**:
   - Switch from "Cognito default" to "Send email with SES"
   - Source ARN = verified SES identity ARN
   - From address = `noreply@yourdomain.com`
   - Reply-to address = support address if needed

This is a prerequisite for all subsequent phases.

---

## Phase 2 — Custom Message Lambda

**Purpose:** Inject branded HTML into every Cognito-triggered email.

### Lambda trigger

Wire to: **Cognito User Pool → Triggers → Custom message**

### Event sources handled

| `triggerSource` | Email sent |
|---|---|
| `CustomMessage_ForgotPassword` | Password reset code |
| `CustomMessage_AdminCreateUser` | Welcome / invite |
| `CustomMessage_VerifyUserAttribute` | Email change verification (future) |

### Lambda contract

- Input: `event.triggerSource`, `event.request.codeParameter` (`{####}`)
- Output: set `event.response.emailSubject` and `event.response.emailMessage`
- `{####}` is the placeholder Cognito replaces with the actual code

### Placement

New file: `app/aws/cognito-custom-message.lambda.ts` (or a standalone Lambda if deployed separately).

---

## Phase 3 — Enable Welcome Email

**File:** `app/lib/cognito.server.ts` — `registerUser()` function (line ~86)

**Change:** Remove `MessageAction: "SUPPRESS"` from `AdminCreateUserCommand`.

```ts
// Before
new AdminCreateUserCommand({
  UserPoolId: USER_POOL_ID,
  Username: params.email,
  TemporaryPassword: params.password,
  MessageAction: "SUPPRESS",   // ← remove this line
  UserAttributes: [...],
})
```

**Note:** The `AdminSetUserPasswordCommand` call that immediately follows still sets a permanent password, so the temporary password in the welcome email will be unusable. The welcome email should therefore say "Your account is ready — go to /login" rather than showing a temp password. Use Phase 2's Lambda to control this message.

---

## Phase 4 — Consumer Credential Email (Custom SES)

**Purpose:** When a consumer is provisioned (Cognito App Client + API key created), email the consumer their credentials.

### New helper

**File:** `app/aws/ses.server.ts`

```ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
// sendConsumerCredentialsEmail(to, { clientId, tokenUrl, apiKeyNote })
```

### Integration point

**File:** `app/routes/consumers.new.tsx` (or whichever action handles consumer creation)

After the existing provisioning succeeds (Cognito App Client + API key created, DB record saved), call `sendConsumerCredentialsEmail` with:
- `to` = consumer contact email (add a field to the consumer creation form if not present)
- `clientId` = the provisioned Cognito App Client ID
- `tokenUrl` = the stored `token_url`
- A note that the API key value is available in the portal

**Error handling:** SES failure must NOT roll back consumer creation. Log the error and surface a non-blocking warning in the UI.

---

## Critical Files

| File | Change |
|---|---|
| `app/lib/cognito.server.ts` | Remove `MessageAction: "SUPPRESS"` (Phase 3) |
| `app/aws/ses.server.ts` | New — SES send helper (Phase 4) |
| `app/aws/cognito-custom-message.lambda.ts` | New — Custom Message Lambda (Phase 2) |
| Consumer creation route/action | Call SES helper after successful provisioning (Phase 4) |

---

## Reuse

- `app/lib/cognito.server.ts` — `CognitoIdentityProviderClient` setup pattern (region, env vars) replicated in `ses.server.ts` for `SESClient`
- Existing `[aws:service]` log prefix convention for the new SES helper
- Existing `useFetcher` + `deleteError` / `publishError` pattern for surfacing SES warnings in consumer creation UI

---

## Verification

1. **Phase 1:** Send a test email via SES console after verifying identity; confirm it arrives from your domain.
2. **Phase 2:** Trigger `ForgotPasswordCommand` for a test user; verify branded HTML arrives.
3. **Phase 3:** Create a new user via the organisation route; verify welcome email arrives at the email address.
4. **Phase 4:** Create a new consumer end-to-end; verify credential email arrives and consumer record is saved even if SES call is mocked to fail.

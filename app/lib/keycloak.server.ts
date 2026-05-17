const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080"
const REALM = process.env.KEYCLOAK_REALM ?? "my-app"
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "my-app-client"
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET ?? ""
const ADMIN_USER = process.env.KEYCLOAK_ADMIN_USER ?? "admin"
const ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin"

const tokenEndpoint = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  sub?: string
}

/** Resource Owner Password Credentials (Direct Access Grant) */
export async function loginWithCredentials(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: CLIENT_ID,
    username,
    password,
    scope: "openid profile email",
  })
  if (CLIENT_SECRET) body.set("client_secret", CLIENT_SECRET)

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>
    console.error("[keycloak] login failed", {
      username,
      status: res.status,
      error: err.error,
      description: err.error_description,
    })
    throw new Error(err.error_description ?? "Invalid username or password")
  }

  return res.json() as Promise<TokenResponse>
}

/** Register a new user via Keycloak Admin REST API */
export async function registerUser(params: {
  email: string
  password: string
  firstName?: string
  lastName?: string
}): Promise<void> {
  const adminToken = await getAdminToken()

  const res = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      username: params.email,
      email: params.email,
      firstName: params.firstName ?? "",
      lastName: params.lastName ?? "",
      enabled: true,
      emailVerified: true,
      credentials: [
        { type: "password", value: params.password, temporary: false },
      ],
    }),
  })

  if (res.status === 409) {
    console.warn("[keycloak] register conflict: email already exists", { email: params.email })
    throw new Error("An account with this email already exists")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>
    console.error("[keycloak] register failed", {
      email: params.email,
      status: res.status,
      errorMessage: err.errorMessage,
    })
    throw new Error(err.errorMessage ?? "Failed to create account")
  }
}

export interface UserProfile {
  sub: string
  email: string
  given_name: string
  family_name: string
  name: string
}

/** Extract the user ID from a Keycloak access token (JWT sub claim) */
export function extractUserId(accessToken: string): string {
  return decodeTokenPayload(accessToken)?.sub ?? ""
}

/** Decode user profile claims from the JWT access token payload */
export function getUserProfile(accessToken: string): UserProfile {
  const p = decodeTokenPayload(accessToken)
  return {
    sub: p?.sub ?? "",
    email: p?.email ?? "",
    given_name: p?.given_name ?? "",
    family_name: p?.family_name ?? "",
    name: p?.name ?? [p?.given_name, p?.family_name].filter(Boolean).join(" "),
  }
}

function decodeTokenPayload(token: string): Record<string, string> | null {
  try {
    return JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    ) as Record<string, string>
  } catch {
    return null
  }
}

/**
 * Trigger a "reset password" email for the given email address via the
 * Keycloak Admin REST API.  Always resolves (never throws) — callers should
 * show a generic "check your inbox" message regardless of outcome so we
 * don't leak whether an account exists.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const adminToken = await getAdminToken()

    // 1. Look up user by email
    const usersRes = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users?email=${encodeURIComponent(email)}&exact=true`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    )
    if (!usersRes.ok) {
      console.error("[keycloak] password reset: user lookup failed", { email, status: usersRes.status })
      return
    }

    const users = await usersRes.json() as Array<{ id: string }>
    if (!users.length) {
      console.warn("[keycloak] password reset: no user found for email", { email })
      return
    }

    // 2. Send UPDATE_PASSWORD action email
    await fetch(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${users[0].id}/execute-actions-email`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(["UPDATE_PASSWORD"]),
      },
    )
  } catch (err) {
    console.error("[keycloak] password reset: unexpected error", { email, error: String(err) })
    // swallow — never leak account existence
  }
}

/** Get an admin access token using master realm admin-cli client */
async function getAdminToken(): Promise<string> {
  const res = await fetch(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: ADMIN_USER,
        password: ADMIN_PASSWORD,
      }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>
    console.error("[keycloak] admin token failed", {
      status: res.status,
      error: err.error,
      description: err.error_description,
    })
    throw new Error("Could not obtain admin token")
  }
  const data = await res.json() as { access_token: string }
  return data.access_token
}

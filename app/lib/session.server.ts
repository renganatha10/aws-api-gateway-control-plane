import { createSessionStorage, redirect } from "react-router";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { JwtExpiredError } from "aws-jwt-verify/error";
import { eq, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "~/lib/db.server";
import { decodeTokenPayload, refreshCognitoToken } from "~/lib/cognito.server";
import { sessions } from "~/lib/schema";
import type { OrgRole } from "~/lib/schema";

const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID ?? "",
  clientId: process.env.COGNITO_CLIENT_ID ?? "",
  tokenUse: "id",
});

const sessionStorage = createSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET ?? "dev-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS,
  },
  async createData(data, expires) {
    const id = randomUUID();
    const expiresAt = expires ?? new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await db.insert(sessions).values({ id, data, expiresAt });
    // Purge expired sessions opportunistically — fire-and-forget
    db.delete(sessions).where(lt(sessions.expiresAt, new Date())).catch(() => {});
    return id;
  },
  async readData(id) {
    const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    if (!row || row.expiresAt < new Date()) return null;
    return row.data as Record<string, unknown>;
  },
  async updateData(id, data, expires) {
    const expiresAt = expires ?? new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await db.update(sessions).set({ data, expiresAt }).where(eq(sessions.id, id));
  },
  async deleteData(id) {
    await db.delete(sessions).where(eq(sessions.id, id));
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

type AppSession = Awaited<ReturnType<typeof getSession>>;

/** Exchanges the stored refresh token for a new access token and redirects to the same URL. */
async function doTokenRefreshRedirect(
  session: AppSession,
  requestUrl: string
): Promise<never> {
  const refreshToken = session.get("refreshToken") as string | undefined;
  const username = session.get("username") as string | undefined;
  if (!refreshToken || !username) throw new Error("no refresh credentials");

  const tokens = await refreshCognitoToken(username, refreshToken);
  session.set("accessToken", tokens.access_token);
  throw redirect(requestUrl, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

/** Proactively refreshes if the token expires within REFRESH_BUFFER_MS. */
async function tryProactiveRefresh(
  session: AppSession,
  accessToken: string,
  requestUrl: string
): Promise<void> {
  const payload = decodeTokenPayload(accessToken);
  const expiresAt = payload?.exp ? Number(payload.exp) * 1000 : 0;
  if (!expiresAt || Date.now() < expiresAt - REFRESH_BUFFER_MS) return;

  try {
    await doTokenRefreshRedirect(session, requestUrl);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("[session] proactive token refresh failed", err);
  }
}

export async function requireAuth(request: Request) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken") as string | undefined;
  if (!accessToken) throw redirect("/login");

  await tryProactiveRefresh(session, accessToken, request.url);

  try {
    await jwtVerifier.verify(accessToken);
    return { accessToken, userId: session.get("userId") as string };
  } catch (err) {
    if (err instanceof JwtExpiredError) {
      try {
        await doTokenRefreshRedirect(session, request.url);
      } catch (refreshErr) {
        if (refreshErr instanceof Response) throw refreshErr;
        console.error("[session] token refresh failed, forcing re-login", refreshErr);
      }
    } else {
      console.error("[session] token verification failed", err);
    }
    throw redirect("/login", {
      headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
    });
  }
}

export async function createUserSession({
  request,
  accessToken,
  refreshToken,
  username,
  userId,
  redirectTo,
}: {
  request: Request;
  accessToken: string;
  refreshToken: string;
  username: string;
  userId: string;
  redirectTo: string;
}) {
  const session = await getSession(request);
  session.set("accessToken", accessToken);
  session.set("refreshToken", refreshToken);
  session.set("username", username);
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

export async function destroyUserSession(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}

export async function storeNewPasswordChallenge(
  request: Request,
  challenge: { session: string; email: string }
): Promise<string> {
  const session = await getSession(request);
  session.set("npChallengSession", challenge.session);
  session.set("npChallengeEmail", challenge.email);
  return sessionStorage.commitSession(session);
}

export async function getNewPasswordChallenge(
  request: Request
): Promise<{ session: string; email: string } | null> {
  const session = await getSession(request);
  const challengeSession = session.get("npChallengSession") as string | undefined;
  const email = session.get("npChallengeEmail") as string | undefined;
  if (!challengeSession || !email) return null;
  return { session: challengeSession, email };
}

export async function clearNewPasswordChallenge(request: Request): Promise<string> {
  const session = await getSession(request);
  session.unset("npChallengSession");
  session.unset("npChallengeEmail");
  return sessionStorage.commitSession(session);
}

export async function getActiveOrganisationId(request: Request): Promise<number | null> {
  const session = await getSession(request);
  const value = session.get("activeOrganisationId");
  return typeof value === "number" ? value : null;
}

export async function setActiveOrganisationId(
  request: Request,
  organisationId: number
): Promise<string> {
  const session = await getSession(request);
  session.set("activeOrganisationId", organisationId);
  return sessionStorage.commitSession(session);
}

export async function getActiveUserRole(request: Request): Promise<OrgRole | null> {
  const session = await getSession(request);
  const value = session.get("activeUserRole");
  return (value as OrgRole) ?? null;
}

/** Writes org id + role in one cookie commit — keeps them in sync. */
export async function setActiveOrgAndRole(
  request: Request,
  organisationId: number,
  role: OrgRole | null
): Promise<string> {
  const session = await getSession(request);
  session.set("activeOrganisationId", organisationId);
  if (role) session.set("activeUserRole", role);
  else session.unset("activeUserRole");
  return sessionStorage.commitSession(session);
}

import { createCookieSessionStorage, redirect } from "react-router";

import type { OrgRole } from "~/lib/schema";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET ?? "dev-secret-change-me"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8 hours
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function requireAuth(request: Request) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken") as string | undefined;
  if (!accessToken) {
    throw redirect("/login");
  }
  return { accessToken, userId: session.get("userId") as string };
}

export async function createUserSession({
  request,
  accessToken,
  userId,
  redirectTo,
}: {
  request: Request;
  accessToken: string;
  userId: string;
  redirectTo: string;
}) {
  const session = await getSession(request);
  session.set("accessToken", accessToken);
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

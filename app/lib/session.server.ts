import { createCookieSessionStorage, redirect } from "react-router";

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

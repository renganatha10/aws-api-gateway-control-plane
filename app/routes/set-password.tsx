import { data, redirect } from "react-router";
import { SetPasswordPage } from "~/components/set-password-page";
import { extractUserId, setNewPassword } from "~/lib/cognito.server";
import { createUserSession, getNewPasswordChallenge } from "~/lib/session.server";
import type { Route } from "./+types/set-password";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Set Password" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const challenge = await getNewPasswordChallenge(request);
  if (!challenge) throw redirect("/login");
  return { email: challenge.email };
}

export async function action({ request }: Route.ActionArgs) {
  const challenge = await getNewPasswordChallenge(request);
  if (!challenge) throw redirect("/login");

  const formData = await request.formData();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return data({ error: "Password is required." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return data({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    const tokens = await setNewPassword(challenge.email, challenge.session, password);
    return createUserSession({
      request,
      accessToken: tokens.access_token,
      userId: extractUserId(tokens.access_token),
      redirectTo: "/",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return data({ error: message }, { status: 400 });
  }
}

export default function SetPassword({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <SetPasswordPage
      email={loaderData.email}
      error={actionData && "error" in actionData ? actionData.error : null}
    />
  );
}

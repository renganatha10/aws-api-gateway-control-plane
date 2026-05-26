import { KeyRound, Zap } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { confirmPasswordReset } from "~/lib/cognito.server";
import type { Route } from "./+types/reset-password";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") ?? "";
  return { email };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = (formData.get("email") as string)?.trim();
  const code = (formData.get("code") as string)?.trim();
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !code || !newPassword) {
    return data({ error: "All fields are required", email }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return data({ error: "Passwords do not match", email }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return data({ error: "Password must be at least 8 characters", email }, { status: 400 });
  }

  try {
    await confirmPasswordReset(email, code, newPassword);
    throw redirect("/login?reset=1");
  } catch (err) {
    if (err instanceof Response) throw err;
    const message = err instanceof Error ? err.message : "Failed to reset password";
    return data({ error: message, email }, { status: 400 });
  }
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const email = actionData?.email ?? loaderData.email;

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 dark:from-stone-950 dark:via-stone-900 dark:to-stone-800 relative overflow-hidden">
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] bg-[linear-gradient(to_right,oklch(0.923_0.003_48.717)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.923_0.003_48.717)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <Card className="w-full max-w-sm mx-4 shadow-xl relative z-10">
        <CardHeader className="items-center pb-2">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <KeyRound className="size-6" />
          </div>
          <CardTitle className="text-2xl font-semibold">Set new password</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code from your email and choose a new password.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Form method="post" className="space-y-3">
            <input type="hidden" name="email" value={email} />

            {actionData?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionData.error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="code">Reset code</Label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={submitting}>
              {submitting ? "Resetting…" : "Reset password"}
            </Button>
          </Form>

          <div className="text-center space-y-1">
            <Link
              to="/forgot-password"
              className="block text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Resend code
            </Link>
            <Link
              to="/login"
              className="block text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

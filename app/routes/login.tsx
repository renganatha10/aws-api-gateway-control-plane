import { Zap } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { extractUserId, loginWithCredentials, registerUser } from "~/lib/cognito.server";
import { createUserSession, getSession } from "~/lib/session.server";
import type { Route } from "./+types/login";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (session.get("accessToken")) throw redirect("/");
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "signup" ? "signup" : "login";
  return { mode };
}

export async function action({ request }: Route.ActionArgs) {
  try {
    const formData = await request.formData();
    const mode = formData.get("mode") as string;
    const email = (formData.get("email") as string)?.trim();
    const password = formData.get("password") as string;
    const firstName = (formData.get("firstName") as string | null)?.trim() ?? "";
    const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";

    if (!email || !password) {
      return data({ error: "Email and password are required", mode }, { status: 400 });
    }

    if (mode === "signup") {
      await registerUser({ email, password, firstName, lastName });
      const tokens = await loginWithCredentials(email, password);
      return createUserSession({
        request,
        accessToken: tokens.access_token,
        userId: extractUserId(tokens.access_token),
        redirectTo: "/",
      });
    } else {
      const tokens = await loginWithCredentials(email, password);
      return createUserSession({
        request,
        accessToken: tokens.access_token,
        userId: extractUserId(tokens.access_token),
        redirectTo: "/",
      });
    }
  } catch (err) {
    console.error("[login] action failed", err);
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return data({ error: message, mode: "login" }, { status: 400 });
  }
}

export default function Login({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  // actionData.mode preserves mode on validation error; loaderData.mode comes from URL
  const mode = actionData?.mode ?? loaderData.mode;
  const isSignup = mode === "signup";

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 dark:from-stone-950 dark:via-stone-900 dark:to-stone-800 relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] bg-[linear-gradient(to_right,oklch(0.923_0.003_48.717)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.923_0.003_48.717)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <Card className="w-full max-w-sm mx-4 shadow-xl relative z-10">
        <CardHeader className="items-center pb-2">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Zap className="size-6" />
          </div>
          <CardTitle className="text-2xl font-semibold">ApiGateway</CardTitle>
          <CardDescription>
            {isSignup ? "Create your workspace account" : "Sign in to your workspace"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Mode tabs */}
          <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
            <Link
              to="/login"
              className={`rounded-md py-1.5 text-center text-sm font-medium transition-colors ${
                !isSignup
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </Link>
            <Link
              to="/login?mode=signup"
              className={`rounded-md py-1.5 text-center text-sm font-medium transition-colors ${
                isSignup
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </Link>
          </div>

          {actionData?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionData.error}
            </p>
          )}

          <Form method="post" className="space-y-3">
            <input type="hidden" name="mode" value={mode} />

            {isSignup && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" name="firstName" placeholder="Jane" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" name="lastName" placeholder="Doe" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isSignup && (
                  <Link
                    to="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={isSignup ? 8 : 1}
              />
              {isSignup && (
                <p className="text-xs text-muted-foreground">
                  Min 8 characters with uppercase, lowercase, number, and symbol
                </p>
              )}
            </div>

            <Button className="w-full" size="lg" type="submit" disabled={submitting}>
              {submitting
                ? isSignup
                  ? "Creating account…"
                  : "Signing in…"
                : isSignup
                  ? "Create Account"
                  : "Sign In"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

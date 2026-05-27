import { Zap } from "lucide-react";
import { Form, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface SetPasswordPageProps {
  error?: string | null;
  email: string;
}

export function SetPasswordPage({ error, email }: SetPasswordPageProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 dark:from-stone-950 dark:via-stone-900 dark:to-stone-800 relative overflow-hidden">
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] bg-[linear-gradient(to_right,oklch(0.923_0.003_48.717)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.923_0.003_48.717)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <Card className="w-full max-w-sm mx-4 shadow-xl relative z-10">
        <CardHeader className="items-center pb-2">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Zap className="size-6" />
          </div>
          <CardTitle className="text-2xl font-semibold">Set your password</CardTitle>
          <CardDescription>
            Welcome! Choose a permanent password for{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Form method="post" className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Min 8 characters with uppercase, lowercase, number, and symbol
              </p>
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
              {submitting ? "Setting password…" : "Set Password"}
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

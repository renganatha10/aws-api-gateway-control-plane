import { MailCheck, Zap } from "lucide-react"
import { data, Form, Link, useNavigation } from "react-router"

import { sendPasswordResetEmail } from "~/lib/cognito.server"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import type { Route } from "./+types/forgot-password"

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const email = (formData.get("email") as string)?.trim()

  if (!email) {
    return data({ sent: false, email: "", error: "Email is required" }, { status: 400 })
  }

  // Always resolve silently — never reveal whether the account exists
  await sendPasswordResetEmail(email)
  return data({ sent: true, email, error: null })
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation()
  const submitting = navigation.state === "submitting"
  const sent = actionData?.sent === true
  const email = actionData?.email ?? ""

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 dark:from-stone-950 dark:via-stone-900 dark:to-stone-800 relative overflow-hidden">
      <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] bg-[linear-gradient(to_right,oklch(0.923_0.003_48.717)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.923_0.003_48.717)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <Card className="w-full max-w-sm mx-4 shadow-xl relative z-10">
        <CardHeader className="items-center pb-2">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            {sent ? <MailCheck className="size-6" /> : <Zap className="size-6" />}
          </div>
          <CardTitle className="text-2xl font-semibold">
            {sent ? "Check your inbox" : "Forgot password?"}
          </CardTitle>
          <CardDescription className="text-center">
            {sent
              ? "A 6-digit code has been sent to your email. Use it to set a new password."
              : "Enter your email and we'll send you a reset code."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!sent && (
            <Form method="post" className="space-y-3">
              {actionData?.error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {actionData.error}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autoFocus
                />
              </div>

              <Button className="w-full" size="lg" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset code"}
              </Button>
            </Form>
          )}

          {sent && (
            <Link
              to={`/reset-password?email=${encodeURIComponent(email)}`}
              className="block w-full"
            >
              <Button className="w-full" size="lg">
                Enter reset code →
              </Button>
            </Link>
          )}

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

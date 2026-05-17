import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { Form, redirect } from "react-router"

import { requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/keycloak.server"
import { createGatewayWithEnvironments } from "~/repositories/gateway.repository.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import type { Route } from "./+types/onboard"

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const createdBy = getUserProfile(accessToken).email

  const formData = await request.formData()
  const gatewayName = (formData.get("apiName") as string)?.trim()
  const environments = formData.getAll("environment").map((e) => (e as string).trim()).filter(Boolean)

  if (!gatewayName) return { error: "Gateway name is required" }
  if (environments.length === 0) return { error: "Add at least one environment" }

  try {
    await createGatewayWithEnvironments({ name: gatewayName, createdBy }, environments)
    console.log("[onboard] gateway created", { gatewayName, environments, createdBy })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[onboard] failed to create gateway", { gatewayName, error: msg })
    return { error: `Failed to create gateway: ${msg}` }
  }

  throw redirect("/")
}

export default function Onboard({ actionData }: Route.ComponentProps) {
  const [envs, setEnvs] = React.useState([""])

  function addEnv() {
    setEnvs((prev) => [...prev, ""])
  }

  function removeEnv(index: number) {
    setEnvs((prev) => prev.filter((_, i) => i !== index))
  }

  function updateEnv(index: number, value: string) {
    setEnvs((prev) => prev.map((e, i) => (i === index ? value : e)))
  }

  return (
    <div className="flex min-h-full items-start justify-center px-4 py-12">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create a new API</CardTitle>
          <CardDescription>
            Give your API a name and set up the environments you want to manage.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form method="post" className="space-y-6">
            {actionData?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionData.error}
              </p>
            )}

            {/* API Name */}
            <div className="space-y-2">
              <Label htmlFor="apiName">API name</Label>
              <Input
                id="apiName"
                name="apiName"
                placeholder="e.g. payments-api"
                required
              />
            </div>

            {/* Environments */}
            <div className="space-y-3">
              <Label>Environments</Label>

              <div className="space-y-2">
                {envs.map((env, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      name="environment"
                      value={env}
                      onChange={(e) => updateEnv(i, e.target.value)}
                      placeholder={i === 0 ? "e.g. production" : i === 1 ? "e.g. staging" : "Environment name"}
                      required
                    />
                    {envs.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEnv(i)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={addEnv}
              >
                <Plus className="size-4" />
                Add environment
              </Button>
            </div>

            <Button type="submit" className="w-full" size="lg">
              Create API
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

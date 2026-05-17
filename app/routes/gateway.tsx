import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { Form, redirect, useNavigate, useActionData } from "react-router"
import { toast } from "sonner"

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
import type { Route } from "./+types/gateway"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create Gateway" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const user = getUserProfile(accessToken)
  const createdBy = user.email

  const formData = await request.formData()
  const name = (formData.get("name") as string)?.trim()
  const environments = formData
    .getAll("environment")
    .map((e) => (e as string).trim())
    .filter(Boolean)

  if (!name) return { error: "Gateway name is required." }
  if (environments.length === 0) return { error: "At least one environment is required." }

  try {
    await createGatewayWithEnvironments({ name, createdBy }, environments)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[gateway] failed to create", { name, error: msg })
    return { error: `Failed to create gateway: ${msg}` }
  }

  throw redirect("/")
}

export default function GatewayCreate() {
  const actionData = useActionData<typeof action>()
  const navigate = useNavigate()
  const [envs, setEnvs] = React.useState([""])
  const [envError, setEnvError] = React.useState(false)

  // Show toast whenever backend returns an error
  React.useEffect(() => {
    if (actionData?.error) {
      toast.error(actionData.error)
    }
  }, [actionData])

  function addEnv() {
    setEnvs((prev) => [...prev, ""])
    setEnvError(false)
  }

  function removeEnv(i: number) {
    setEnvs((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateEnv(i: number, v: string) {
    setEnvs((prev) => prev.map((e, idx) => (idx === i ? v : e)))
    if (v.trim()) setEnvError(false)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const filled = envs.filter((e) => e.trim())
    if (filled.length === 0) {
      e.preventDefault()
      setEnvError(true)
    }
  }

  return (
    <div className="flex min-h-full items-start justify-center px-4 py-12">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create a Gateway</CardTitle>
          <CardDescription>
            Give your gateway a name and define the environments you want to manage.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form method="post" className="space-y-6" onSubmit={handleSubmit}>
            {/* Gateway name */}
            <div className="space-y-2">
              <Label htmlFor="name">Gateway name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. payments-gateway"
                required
              />
            </div>

            {/* Environments */}
            <div className="space-y-3">
              <Label>
                Environments
                {envError && (
                  <span className="ml-2 text-xs font-normal text-destructive">
                    At least one environment is required
                  </span>
                )}
              </Label>

              <div className="space-y-2">
                {envs.map((env, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      name="environment"
                      value={env}
                      onChange={(e) => updateEnv(i, e.target.value)}
                      placeholder={
                        i === 0 ? "e.g. production"
                        : i === 1 ? "e.g. staging"
                        : "Environment name"
                      }
                      className={envError && !env.trim() ? "border-destructive" : ""}
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

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" size="lg">
                Create Gateway
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

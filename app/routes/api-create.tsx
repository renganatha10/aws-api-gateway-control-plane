import * as React from "react"
import { Form, redirect, useActionData, useNavigate } from "react-router"

import { requireAuth } from "~/lib/session.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import type { Route } from "./+types/api-create"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create API" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request)

  const formData = await request.formData()
  const name  = (formData.get("name") as string)?.trim()
  const type  = formData.get("type") as string
  const yaml  = (formData.get("yaml") as string)?.trim()
  const scope = (formData.get("scope") as string)?.trim()

  if (!name) return { error: "API name is required." }
  if (!type) return { error: "Please select an API type." }
  if (!yaml) return { error: "YAML definition is required." }

  // TODO: persist to database once APIs table is created
  console.log("[api-create] create API", { name, type, scope, yamlLength: yaml.length })

  throw redirect("/apis")
}

const API_TYPES = [
  { value: "swagger2", label: "Swagger 2.0" },
  { value: "openapi3", label: "OpenAPI 3.0" },
]

export default function ApiCreate() {
  const actionData = useActionData<typeof action>()
  const navigate   = useNavigate()
  const [type, setType] = React.useState("swagger2")

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">Create API</h1>
          <div className="flex gap-2">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6">
              Save API
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 px-6 py-6 gap-6">
          {actionData?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
              {actionData.error}
            </p>
          )}

          {/* Name */}
          <div className="space-y-2 shrink-0">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="e.g. payments-api" required className="max-w-sm" />
          </div>

          {/* Type + Scope */}
          <div className="flex gap-6 items-end shrink-0">
            <div className="space-y-2">
              <Label>Type</Label>
              <input type="hidden" name="type" value={type} />
              <div className="flex gap-2">
                {API_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={[
                      "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                      type === t.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-64 space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Input id="scope" name="scope" placeholder="e.g. read:orders" />
            </div>
          </div>

          {/* YAML definition — grows to fill remaining space */}
          <div className="flex flex-col flex-1 min-h-0 space-y-2">
            <Label htmlFor="yaml">Definition (YAML)</Label>
            <textarea
              id="yaml"
              name="yaml"
              placeholder={type === "swagger2" ? SWAGGER_PLACEHOLDER : OPENAPI3_PLACEHOLDER}
              className="flex-1 w-full rounded-md border border-input bg-gray-950 px-4 py-3 font-mono text-sm text-white placeholder:text-gray-600 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              required
            />
          </div>
        </div>
      </Form>
    </div>
  )
}

const SWAGGER_PLACEHOLDER = `swagger: "2.0"
info:
  title: My API
  version: "1.0"
basePath: /v1
paths:
  /example:
    get:
      summary: Example endpoint
      responses:
        200:
          description: OK`

const OPENAPI3_PLACEHOLDER = `openapi: "3.0.0"
info:
  title: My API
  version: "1.0.0"
paths:
  /example:
    get:
      summary: Example endpoint
      responses:
        "200":
          description: OK`

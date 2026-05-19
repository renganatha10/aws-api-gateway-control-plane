import { Form, redirect, useActionData, useLoaderData, useNavigate } from "react-router"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { createConsumer } from "~/repositories/consumer.repository.server"
import { listProductsByGateway } from "~/repositories/product.repository.server"
import { listEnvironmentsByGateway, findEnvironmentById } from "~/repositories/environment.repository.server"
import { listPlansByGateway, findPlanById } from "~/repositories/plan.repository.server"
import { listApiScopesForProduct } from "~/repositories/api-association.repository.server"
import { ensureResourceServer } from "~/aws/cognito-resource-server.server"
import { createMachineClient } from "~/aws/cognito-app-client.server"
import { createApiKey, provisionConsumerKey } from "~/aws/api-key.server"
import { USER_POOL_ID } from "~/aws/cognito-client.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { Route } from "./+types/consumer-create"

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Consumer" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  const gatewayId = await getActiveGatewayId(request)

  const [products, environments, plans] = await Promise.all([
    gatewayId ? listProductsByGateway(gatewayId) : [],
    gatewayId ? listEnvironmentsByGateway(gatewayId) : [],
    gatewayId ? listPlansByGateway(gatewayId) : [],
  ])

  return { products, environments, plans, gatewayId }
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const createdBy       = getUserProfile(accessToken).email
  const gatewayId       = await getActiveGatewayId(request)

  if (!gatewayId) return { error: "No active gateway selected." }

  const formData      = await request.formData()
  const name          = (formData.get("name") as string)?.trim()
  const productId     = Number(formData.get("productId"))
  const environmentId = Number(formData.get("environmentId"))
  const planId        = Number(formData.get("planId"))

  if (!name)          return { error: "Name is required." }
  if (!productId)     return { error: "Please select a product." }
  if (!environmentId) return { error: "Please select a stage." }
  if (!planId)        return { error: "Please select a plan." }

  const [apis, environment, plan] = await Promise.all([
    listApiScopesForProduct(productId),
    findEnvironmentById(environmentId),
    findPlanById(planId),
  ])

  if (!environment) return { error: "Selected stage not found." }
  if (!plan?.awsUsagePlanId) return { error: "Selected plan has not been synced to AWS yet." }
  if (apis.length === 0) return { error: "No AWS-synced APIs with scopes found in this product." }

  // 1. Ensure a Cognito resource server exists for each API
  for (const api of apis) {
    await ensureResourceServer(USER_POOL_ID, api.name, api.displayName, [api.scope!])
  }

  // 2. Build full OAuth scopes: "{api.name}/{api.scope}"
  const fullScopes = apis.map((api) => `${api.name}/${api.scope}`)

  // 3. Create Cognito machine client
  const { clientId } = await createMachineClient(USER_POOL_ID, name, fullScopes)

  // 4. Create AWS API key
  const { id: awsApiKeyId } = await createApiKey(name)

  // 5. Associate API key with usage plan + add API stages
  await provisionConsumerKey(
    plan.awsUsagePlanId,
    awsApiKeyId,
    apis.map((api) => ({ apiId: api.awsApiId!, stage: environment.name })),
  )

  // 6. Persist consumer
  const now = new Date()
  await createConsumer({
    name,
    productId,
    environmentId,
    planId,
    gatewayId,
    clientId,
    awsApiKeyId,
    createdBy,
    updatedBy: createdBy,
    createdAt: now,
    updatedAt: now,
  })

  throw redirect("/consumers")
}

export default function ConsumerCreate() {
  const { products, environments, plans } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigate   = useNavigate()

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">New Consumer</h1>
          <div className="flex gap-2">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6">
              Save Consumer
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6 max-w-lg">
          {actionData?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionData.error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Consumer Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. ACME Corp"
              required
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productId">Product</Label>
            <Select name="productId" required>
              <SelectTrigger className="max-w-sm" id="productId">
                <SelectValue placeholder="Select a product…" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <SelectItem value="_none" disabled>No products available</SelectItem>
                ) : (
                  products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="environmentId">Stage</Label>
            <Select name="environmentId" required>
              <SelectTrigger className="max-w-sm" id="environmentId">
                <SelectValue placeholder="Select a stage…" />
              </SelectTrigger>
              <SelectContent>
                {environments.length === 0 ? (
                  <SelectItem value="_none" disabled>No stages available</SelectItem>
                ) : (
                  environments.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planId">Plan</Label>
            <Select name="planId" required>
              <SelectTrigger className="max-w-sm" id="planId">
                <SelectValue placeholder="Select a plan…" />
              </SelectTrigger>
              <SelectContent>
                {plans.length === 0 ? (
                  <SelectItem value="_none" disabled>No plans available</SelectItem>
                ) : (
                  plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground max-w-sm">
            Saving will provision a Cognito app client, resource servers for each API in the product, and an AWS API key associated with the selected plan.
          </p>
        </div>
      </Form>
    </div>
  )
}

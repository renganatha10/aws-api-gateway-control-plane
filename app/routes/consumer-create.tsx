import { useState } from "react"
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { createConsumer } from "~/repositories/consumer.repository.server"
import { listProductsByGateway } from "~/repositories/product.repository.server"
import { listEnvironmentsByGateway, findEnvironmentById } from "~/repositories/environment.repository.server"
import { listPlansByGateway, findPlanById } from "~/repositories/plan.repository.server"
import { listDeploymentsByGateway } from "~/repositories/product-deployment.repository.server"
import { listApiScopesForProduct } from "~/repositories/api-association.repository.server"
import { ensureResourceServer } from "~/aws/cognito-resource-server.server"
import { createMachineClient, getTokenUrl } from "~/aws/cognito-app-client.server"
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

  const [allProducts, allEnvironments, plans, deployments] = await Promise.all([
    gatewayId ? listProductsByGateway(gatewayId) : [],
    gatewayId ? listEnvironmentsByGateway(gatewayId) : [],
    gatewayId ? listPlansByGateway(gatewayId) : [],
    gatewayId ? listDeploymentsByGateway(gatewayId) : [],
  ])

  const deployedProductIds = new Set(deployments.map((d) => d.productId))
  const products = allProducts.filter((p) => deployedProductIds.has(p.id))

  return { products, allEnvironments, plans, deployments, gatewayId }
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

  let clientId: string
  let tokenUrl: string
  let awsApiKeyId: string

  try {
    // 1. Ensure a Cognito resource server exists for each API
    for (const api of apis) {
      await ensureResourceServer(USER_POOL_ID, api.name, api.displayName, [api.scope!])
    }

    // 2. Build full OAuth scopes: "{api.name}/{api.scope}"
    const fullScopes = apis.map((api) => `${api.name}/${api.scope}`)

    // 3. Create Cognito machine client + resolve token URL
    const awsResourceName = `${name}-${gatewayId}`
    const [machineClient, resolvedTokenUrl] = await Promise.all([
      createMachineClient(USER_POOL_ID, awsResourceName, fullScopes),
      getTokenUrl(USER_POOL_ID),
    ])
    clientId = machineClient.clientId
    tokenUrl = resolvedTokenUrl

    // 4. Create AWS API key pinned to the Cognito clientId as its value
    const apiKey = await createApiKey(awsResourceName, clientId)
    awsApiKeyId = apiKey.id

    // 5. Associate API key with usage plan + add API stages
    await provisionConsumerKey(
      plan.awsUsagePlanId,
      awsApiKeyId,
      apis.map((api) => ({ apiId: api.awsApiId!, stage: environment.name })),
    )
  } catch (err) {
    console.error("[consumer-create] AWS provisioning failed", err)
    return { error: "Failed to provision consumer in AWS. Please try again." }
  }

  // 6. Persist consumer
  try {
    const now = new Date()
    await createConsumer({
      name,
      productId,
      environmentId,
      planId,
      gatewayId,
      clientId,
      awsApiKeyId,
      tokenUrl,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    console.error("[consumer-create] DB insert failed", err)
    return { error: "Something went wrong while saving. Please try again." }
  }

  throw redirect("/consumers")
}

export default function ConsumerCreate() {
  const { products, allEnvironments, plans, deployments } = useLoaderData<typeof loader>()
  const actionData  = useActionData<typeof action>()
  const navigate    = useNavigate()
  const navigation  = useNavigation()
  const submitting  = navigation.state === "submitting"

  const [selectedProductId,     setSelectedProductId]     = useState("")
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("")

  const deployedEnvIds = new Set(
    deployments
      .filter((d) => d.productId === Number(selectedProductId))
      .map((d) => d.environmentId),
  )
  const availableEnvironments = allEnvironments.filter((e) => deployedEnvIds.has(e.id))

  function handleProductChange(val: string) {
    setSelectedProductId(val)
    setSelectedEnvironmentId("")
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">New Consumer</h1>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
              {submitting ? "Creating…" : "Save Consumer"}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => navigate(-1)}>
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
            <Select
              name="productId"
              required
              value={selectedProductId}
              onValueChange={handleProductChange}
            >
              <SelectTrigger className="max-w-sm" id="productId">
                <SelectValue placeholder="Select a product…" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <SelectItem value="_none" disabled>No deployed products — publish a product first</SelectItem>
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
            <Select
              name="environmentId"
              required
              value={selectedEnvironmentId}
              onValueChange={setSelectedEnvironmentId}
              disabled={!selectedProductId}
            >
              <SelectTrigger className="max-w-sm" id="environmentId">
                <SelectValue placeholder={!selectedProductId ? "Select a product first…" : "Select a stage…"} />
              </SelectTrigger>
              <SelectContent>
                {availableEnvironments.length === 0 ? (
                  <SelectItem value="_none" disabled>No deployed stages for this product</SelectItem>
                ) : (
                  availableEnvironments.map((e) => (
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

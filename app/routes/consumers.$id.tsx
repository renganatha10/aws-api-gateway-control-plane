import { useState } from "react"
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, useFetcher } from "react-router"
import { Eye, EyeOff } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import {
  findConsumerById,
  updateConsumer,
} from "~/repositories/consumer.repository.server"
import { listProductsByGateway } from "~/repositories/product.repository.server"
import { listEnvironmentsByGateway } from "~/repositories/environment.repository.server"
import { listPlansByGateway } from "~/repositories/plan.repository.server"
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
import type { Route } from "./+types/consumers.$id"

export function meta({ data }: Route.MetaArgs) {
  return [{ title: (data as { consumer?: { name?: string } })?.consumer?.name ?? "Edit Consumer" }]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request)
  const gatewayId = await getActiveGatewayId(request)
  const consumer  = await findConsumerById(Number(params.id))
  if (!consumer) throw new Response("Not found", { status: 404 })

  const [products, environments, plans] = await Promise.all([
    gatewayId ? listProductsByGateway(gatewayId) : [],
    gatewayId ? listEnvironmentsByGateway(gatewayId) : [],
    gatewayId ? listPlansByGateway(gatewayId) : [],
  ])

  return { consumer, products, environments, plans }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const updatedBy       = getUserProfile(accessToken).email
  const id              = Number(params.id)

  const formData      = await request.formData()
  const name          = (formData.get("name") as string)?.trim()
  const productId     = Number(formData.get("productId"))
  const environmentId = Number(formData.get("environmentId"))
  const planId        = Number(formData.get("planId"))

  if (!name)          return { error: "Name is required." }
  if (!productId)     return { error: "Please select a product." }
  if (!environmentId) return { error: "Please select a stage." }
  if (!planId)        return { error: "Please select a plan." }

  await updateConsumer(id, { name, productId, environmentId, planId, updatedBy, updatedAt: new Date() })
  throw redirect("/consumers")
}

function RevealSecret({ consumerId }: { consumerId: number }) {
  const fetcher  = useFetcher<{ secret?: string; error?: string }>()
  const [visible, setVisible] = useState(false)
  const secret   = fetcher.data?.secret
  const fetchErr = fetcher.data?.error

  if (fetchErr) {
    return <span className="text-sm text-destructive">{fetchErr}</span>
  }

  if (!secret) {
    return (
      <button
        onClick={() => fetcher.load(`/api/consumer-secret/${consumerId}`)}
        disabled={fetcher.state === "loading"}
        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
      >
        {fetcher.state === "loading" ? "Loading…" : "Show secret"}
      </button>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-sm text-gray-800 select-all">
        {visible ? secret : "••••••••••••••••"}
      </span>
      <button
        onClick={() => setVisible((v) => !v)}
        className="text-gray-400 hover:text-gray-700"
        title={visible ? "Hide" : "Show"}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  )
}

export default function ConsumerEdit() {
  const { consumer, products, environments, plans } = useLoaderData<typeof loader>()
  const actionData  = useActionData<typeof action>()
  const navigate    = useNavigate()
  const navigation  = useNavigation()
  const submitting  = navigation.state === "submitting"

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">Edit Consumer</h1>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
              {submitting ? "Saving…" : "Save Changes"}
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
              defaultValue={consumer.name}
              required
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productId">Product</Label>
            <Select name="productId" defaultValue={String(consumer.productId)} required>
              <SelectTrigger className="max-w-sm" id="productId">
                <SelectValue placeholder="Select a product…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="environmentId">Stage</Label>
            <Select name="environmentId" defaultValue={String(consumer.environmentId)} required>
              <SelectTrigger className="max-w-sm" id="environmentId">
                <SelectValue placeholder="Select a stage…" />
              </SelectTrigger>
              <SelectContent>
                {environments.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="planId">Plan</Label>
            <Select name="planId" defaultValue={String(consumer.planId)} required>
              <SelectTrigger className="max-w-sm" id="planId">
                <SelectValue placeholder="Select a plan…" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            {consumer.clientId && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Client ID</p>
                  <p className="font-mono text-sm text-gray-800 select-all" data-testid="client-id">{consumer.clientId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">Client Secret</p>
                  <RevealSecret consumerId={consumer.id} />
                </div>
                {consumer.tokenUrl && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500">Token URL</p>
                    <p className="font-mono text-sm text-gray-800 select-all break-all" data-testid="token-url">{consumer.tokenUrl}</p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-gray-500">Created by</span>
                <p className="mt-0.5">{consumer.createdBy}</p>
                <p>{new Date(consumer.createdAt).toLocaleString()}</p>
              </div>
              {consumer.updatedBy && (
                <div>
                  <span className="font-medium text-gray-500">Last updated by</span>
                  <p className="mt-0.5">{consumer.updatedBy}</p>
                  <p>{new Date(consumer.updatedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Form>
    </div>
  )
}

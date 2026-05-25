import { useState } from "react"
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation, useFetcher } from "react-router"
import { Eye, EyeOff, Trash2 } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import {
  findConsumerById,
  updateConsumer,
  deleteConsumer,
} from "~/repositories/consumer.repository.server"
import { listProductsByGateway } from "~/repositories/product.repository.server"
import { listEnvironmentsByGateway } from "~/repositories/environment.repository.server"
import { listPlansByGateway } from "~/repositories/plan.repository.server"
import { deleteAppClient } from "~/aws/cognito-app-client.server"
import { deleteApiKey } from "~/aws/api-key.server"
import { USER_POOL_ID } from "~/aws/cognito-client.server"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
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
  return [{ title: (data as { consumer?: { name?: string } })?.consumer?.name ?? "Consumer" }]
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
  const formData        = await request.formData()
  const intent          = formData.get("_intent") as string

  if (intent === "delete") {
    let consumer: Awaited<ReturnType<typeof findConsumerById>>
    try {
      consumer = await findConsumerById(id)
    } catch (err) {
      console.error("[consumers.$id] findConsumerById failed", err)
      return { deleteError: "Something went wrong. Please try again." }
    }
    if (!consumer) return { deleteError: "Consumer not found." }

    if (consumer.clientId) {
      try {
        await deleteAppClient(USER_POOL_ID, consumer.clientId)
      } catch (err) {
        console.error("[consumers.$id] deleteAppClient failed", { clientId: consumer.clientId, err })
        return { deleteError: "Failed to remove the Cognito app client. Please try again." }
      }
    }

    if (consumer.awsApiKeyId) {
      try {
        await deleteApiKey(consumer.awsApiKeyId)
      } catch (err) {
        console.error("[consumers.$id] deleteApiKey failed", { awsApiKeyId: consumer.awsApiKeyId, err })
        return { deleteError: "Failed to remove the API key. Please try again." }
      }
    }

    try {
      await deleteConsumer(id)
    } catch (err) {
      console.error("[consumers.$id] deleteConsumer DB failed", err)
      return { deleteError: "AWS resources removed but failed to delete the record. Please try again." }
    }
    throw redirect("/consumers")
  }

  // update
  const name          = (formData.get("name") as string)?.trim()
  const productId     = Number(formData.get("productId"))
  const environmentId = Number(formData.get("environmentId"))
  const planId        = Number(formData.get("planId"))

  if (!name)          return { error: "Name is required." }
  if (!productId)     return { error: "Please select a product." }
  if (!environmentId) return { error: "Please select a stage." }
  if (!planId)        return { error: "Please select a plan." }

  try {
    await updateConsumer(id, { name, productId, environmentId, planId, updatedBy, updatedAt: new Date() })
  } catch (err) {
    console.error("[consumers.$id] updateConsumer failed", err)
    return { error: "Something went wrong while saving. Please try again." }
  }
  return { ok: true }
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

export default function ConsumerDetail() {
  const { consumer, products, environments, plans } = useLoaderData<typeof loader>()
  const actionData   = useActionData<typeof action>()
  const navigation   = useNavigation()
  const deleteFetcher = useFetcher<typeof action>()
  const submitting   = navigation.state === "submitting" && navigation.formData?.get("_intent") !== "delete"
  const saved        = actionData && "ok" in actionData && actionData.ok

  const deleteError = deleteFetcher.data && "deleteError" in deleteFetcher.data
    ? (deleteFetcher.data as { deleteError: string }).deleteError
    : null

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/consumers" className="hover:underline">Consumers</Link>
        {" /"}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 truncate">{consumer.name}</h1>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-green-600">Saved</span>
          )}
          {actionData && "error" in actionData && actionData.error && (
            <span className="text-xs text-destructive">{actionData.error}</span>
          )}
          <Button
            type="submit"
            form="consumer-form"
            disabled={submitting}
            className="bg-black hover:bg-gray-900 text-white px-6"
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 px-6">
        <span className="border-b-2 border-gray-900 text-gray-900 px-4 pb-2 pt-2 text-sm font-medium">
          Details
        </span>
        <Link
          to={`/consumers/${consumer.id}/tryout`}
          className="border-b-2 border-transparent text-gray-500 hover:text-gray-900 px-4 pb-2 pt-2 text-sm font-medium transition-colors"
        >
          Try Out
        </Link>
      </div>

      {/* Form */}
      <Form method="post" id="consumer-form" className="flex flex-col flex-1 min-h-0 overflow-auto">
        <input type="hidden" name="_intent" value="update" />
        <div className="flex flex-col gap-6 px-6 py-6 max-w-lg">

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

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Consumer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{consumer.name}</span>?
            This will remove the Cognito app client and API key and cannot be undone.
          </p>
          {deleteError && (
            <p className="text-xs text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteFetcher.state !== "idle"}>
              Cancel
            </Button>
            <deleteFetcher.Form method="post">
              <input type="hidden" name="_intent" value="delete" />
              <Button type="submit" variant="destructive" disabled={deleteFetcher.state !== "idle"}>
                {deleteFetcher.state !== "idle" ? "Deleting…" : "Delete"}
              </Button>
            </deleteFetcher.Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

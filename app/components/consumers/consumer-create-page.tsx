import { useState } from "react"
import { Form, useNavigate } from "react-router"

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

interface Product {
  id: number
  displayName: string
}

interface Environment {
  id: number
  name: string
}

interface Plan {
  id: number
  displayName: string
}

interface Deployment {
  productId: number
  environmentId: number
}

interface ConsumerCreatePageProps {
  products: Product[]
  allEnvironments: Environment[]
  plans: Plan[]
  deployments: Deployment[]
  actionError?: string
  submitting: boolean
}

export function ConsumerCreatePage({
  products,
  allEnvironments,
  plans,
  deployments,
  actionError,
  submitting,
}: ConsumerCreatePageProps) {
  const navigate = useNavigate()
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
            <Button
              type="submit"
              disabled={submitting}
              className="bg-black hover:bg-gray-900 text-white px-6"
            >
              {submitting ? "Creating…" : "Save Consumer"}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6 max-w-lg">
          {actionError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
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
                  <SelectItem value="_none" disabled>
                    No deployed products — publish a product first
                  </SelectItem>
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
                <SelectValue
                  placeholder={!selectedProductId ? "Select a product first…" : "Select a stage…"}
                />
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
            Saving will provision a Cognito app client, resource servers for each API in the
            product, and an AWS API key associated with the selected plan.
          </p>
        </div>
      </Form>
    </div>
  )
}

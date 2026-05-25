import { Form, Link, redirect, useActionData, useNavigation } from "react-router"

import { getActiveOrganisationId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { createProduct } from "~/repositories/product.repository.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Textarea } from "~/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { Route } from "./+types/product-create"

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Product" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  return null
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const createdBy = getUserProfile(accessToken).email

  const organisationId = await getActiveOrganisationId(request)

  const formData    = await request.formData()
  const displayName = (formData.get("displayName") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null
  const visibility  = (formData.get("visibility") as string) || "authenticated"

  if (!displayName) return { error: "Display name is required." }
  if (!organisationId)   return { error: "No active organisation selected." }

  const name = `${organisationId}-${displayName}`

  try {
    const created = await createProduct({
      name,
      displayName,
      description,
      visibility,
      organisationId,
      createdBy,
    })
    return redirect(`/products/${created.id}`)
  } catch (err) {
    console.error("[product-create] createProduct failed", err)
    return { error: "Something went wrong while creating the product. Please try again." }
  }
}

export default function ProductCreatePage() {
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const submitting = navigation.state === "submitting"

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/products" className="hover:underline">Products</Link>
        {" / New"}
      </div>

      <div className="px-6 pt-2 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900">New Product</h1>
      </div>

      <div className="px-6 max-w-xl">
        <Form method="post" className="space-y-5">
          {actionData?.error && (
            <p className="text-sm text-destructive">{actionData.error}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input id="displayName" name="displayName" placeholder="e.g. Tracking Product" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Describe what this product offers…"
              className="min-h-[120px] resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visibility">Visibility</Label>
            <Select name="visibility" defaultValue="authenticated">
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invisible">Invisible</SelectItem>
                <SelectItem value="authenticated">Authenticated</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create Product"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/products">Cancel</Link>
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

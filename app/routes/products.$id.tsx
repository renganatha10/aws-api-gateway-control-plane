import { useState } from "react"
import { Form, Link, redirect, useFetcher, useLoaderData, useNavigation } from "react-router"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { findProductById, updateProduct, deleteProduct } from "~/repositories/product.repository.server"
import { listApisByProduct, syncApiAssociations } from "~/repositories/api-association.repository.server"
import { listPlansByProduct, syncPlanAssociations } from "~/repositories/plan-association.repository.server"
import { listApisByGateway } from "~/repositories/api.repository.server"
import { listPlansByGateway } from "~/repositories/plan.repository.server"
import { listDeploymentsByProduct } from "~/repositories/product-deployment.repository.server"
import { listEnvironmentsByGateway } from "~/repositories/environment.repository.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { Route } from "./+types/products.$id"

export function meta({ data }: Route.MetaArgs) {
  const product = (data as { product?: { displayName: string } } | undefined)?.product
  return [{ title: product ? `${product.displayName} — Product` : "Product" }]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const gatewayId       = await getActiveGatewayId(request)
  const id              = Number(params.id)

  const product = await findProductById(id)
  if (!product) throw new Response("Not Found", { status: 404 })

  const [associatedApis, associatedPlans, allApis, allPlans, deployments, allEnvironments] = await Promise.all([
    listApisByProduct(id),
    listPlansByProduct(id),
    gatewayId ? listApisByGateway(gatewayId) : [],
    gatewayId ? listPlansByGateway(gatewayId) : [],
    listDeploymentsByProduct(id),
    gatewayId ? listEnvironmentsByGateway(gatewayId) : [],
  ])

  return { product, associatedApis, associatedPlans, allApis, allPlans, email, gatewayId, deployments, allEnvironments }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const createdBy = getUserProfile(accessToken).email
  const gatewayId = await getActiveGatewayId(request)
  const id        = Number(params.id)

  const formData = await request.formData()
  const intent   = formData.get("_intent") as string

  if (intent === "update") {
    const displayName = (formData.get("displayName") as string)?.trim()
    const description = (formData.get("description") as string)?.trim() || null
    const visibility  = (formData.get("visibility") as string) || "authenticated"
    if (!displayName) return { error: "Display name is required." }

    const apiIds  = formData.getAll("apiIds").map(Number).filter(Boolean)
    const planIds = formData.getAll("planIds").map(Number).filter(Boolean)

    await updateProduct(id, { displayName, description, visibility, updatedBy: createdBy, updatedAt: new Date() })
    if (gatewayId) {
      await syncApiAssociations(id, apiIds, gatewayId, createdBy)
      await syncPlanAssociations(id, planIds, gatewayId, createdBy)
    }
    return { ok: true }
  }

  if (intent === "delete") {
    await deleteProduct(id)
    return redirect("/products")
  }

  return { error: "Unknown intent." }
}

type Section = "Product setup" | "Visibility" | "APIs" | "Plans" | "Deployments"
const LEFT_NAV: Section[] = ["Product setup", "Visibility", "APIs", "Plans", "Deployments"]

const SPEC_TYPE_LABEL: Record<string, string> = {
  swagger2: "OpenAPI 2.0",
  openapi3: "OpenAPI 3.0",
}

export default function ProductDetailPage() {
  const { product, associatedApis, associatedPlans, allApis, allPlans, deployments, allEnvironments } =
    useLoaderData<typeof loader>()
  const navigation = useNavigation()
  const saving = navigation.state === "submitting" &&
    navigation.formData?.get("_intent") === "update"

  const [activeSection, setActiveSection] = useState<Section>("Product setup")

  // Editable product fields
  const [displayName, setDisplayName] = useState(product.displayName)
  const [description, setDescription] = useState(product.description ?? "")
  const [visibility,  setVisibility]  = useState(product.visibility)

  // Client-side association state — initialized from DB, mutated locally until Save
  const [selectedApiIds,  setSelectedApiIds]  = useState<Set<number>>(
    () => new Set(associatedApis.map((a) => a.id)),
  )
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(
    () => new Set(associatedPlans.map((p) => p.id)),
  )

  // Derived lists
  const displayedApis  = allApis.filter((a) => selectedApiIds.has(a.id))
  const availableApis  = allApis.filter((a) => !selectedApiIds.has(a.id))
  const displayedPlans = allPlans.filter((p) => selectedPlanIds.has(p.id))
  const availablePlans = allPlans.filter((p) => !selectedPlanIds.has(p.id))

  const [dropdownApiId,  setDropdownApiId]  = useState<string>("")
  const [dropdownPlanId, setDropdownPlanId] = useState<string>("")

  function addApi() {
    const id = Number(dropdownApiId)
    if (!id) return
    setSelectedApiIds((prev) => new Set([...prev, id]))
    setDropdownApiId("")
  }

  function removeApi(id: number) {
    setSelectedApiIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  function addPlan() {
    const id = Number(dropdownPlanId)
    if (!id) return
    setSelectedPlanIds((prev) => new Set([...prev, id]))
    setDropdownPlanId("")
  }

  function removePlan(id: number) {
    setSelectedPlanIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  // Deployments sub-nav
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(
    () => deployments[0]?.environmentId ?? null,
  )
  const selectedDeployment = deployments.find((d) => d.environmentId === selectedEnvId) ?? null

  // Delete
  const deleteFetcher   = useFetcher()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/products" className="hover:underline">Products</Link>
        {" /"}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 pt-1 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 truncate">{product.displayName}</h1>

        <div className="flex items-center gap-2 shrink-0">
          {confirmDelete ? (
            <>
              <span className="text-sm text-gray-600">Delete this product?</span>
              <deleteFetcher.Form method="post">
                <input type="hidden" name="_intent" value="delete" />
                <Button type="submit" variant="destructive" size="sm" disabled={deleteFetcher.state !== "idle"}>
                  {deleteFetcher.state !== "idle" ? "Deleting…" : "Confirm Delete"}
                </Button>
              </deleteFetcher.Form>
              <Button variant="outline" size="sm" disabled={deleteFetcher.state !== "idle"} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </>
          ) : (
            <>
              {/* Single Save form that includes all current state */}
              <Form method="post">
                <input type="hidden" name="_intent"     value="update" />
                <input type="hidden" name="displayName" value={displayName} />
                <input type="hidden" name="description" value={description} />
                <input type="hidden" name="visibility"  value={visibility} />
                {[...selectedApiIds].map((id) => (
                  <input key={id} type="hidden" name="apiIds" value={id} />
                ))}
                {[...selectedPlanIds].map((id) => (
                  <input key={id} type="hidden" name="planIds" value={id} />
                ))}
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </Form>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1">
        {/* Left nav */}
        <aside className="w-56 shrink-0 border-r border-gray-200 pt-1">
          {LEFT_NAV.map((section) => {
            const active = activeSection === section
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={[
                  "w-full text-left py-2 text-sm transition-colors",
                  active
                    ? "border-l-4 border-blue-600 pl-5 font-semibold text-gray-900 bg-gray-50"
                    : "border-l-4 border-transparent pl-5 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                ].join(" ")}
              >
                {section}
              </button>
            )
          })}
        </aside>

        {/* Main content */}
        <main className="flex-1 px-8 py-6">

          {/* ── Product setup ── */}
          {activeSection === "Product setup" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-medium text-amber-600">Info</h2>
                <Separator className="mt-2" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prodName">Name</Label>
                <Input
                  id="prodName"
                  value={product.name}
                  readOnly
                  className="bg-gray-100 text-muted-foreground cursor-default"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[140px] resize-y"
                />
              </div>
            </div>
          )}

          {/* ── Visibility ── */}
          {activeSection === "Visibility" && (
            <div className="max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-medium text-amber-600">Visibility</h2>
                <Separator className="mt-2" />
              </div>

              <p className="text-sm text-muted-foreground">
                Control who can discover and subscribe to this product in the Developer Portal.
              </p>

              <RadioGroup value={visibility} onValueChange={setVisibility} className="space-y-3">
                {[
                  {
                    value: "public",
                    badge: { text: "Open access",     className: "bg-green-100 text-green-700" },
                    label: "Public",
                    desc:  "Visible to everyone. Any user can browse and subscribe without signing in.",
                  },
                  {
                    value: "authenticated",
                    badge: { text: "Sign-in required", className: "bg-blue-100 text-blue-700" },
                    label: "Authenticated",
                    desc:  "Only visible to signed-in users.",
                  },
                  {
                    value: "invisible",
                    badge: { text: "Hidden",           className: "bg-gray-100 text-gray-600" },
                    label: "Invisible",
                    desc:  "Not visible in the Developer Portal.",
                  },
                ].map((opt) => (
                  <Label
                    key={opt.value}
                    htmlFor={`vis-${opt.value}`}
                    className={[
                      "flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors",
                      visibility === opt.value
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <RadioGroupItem value={opt.value} id={`vis-${opt.value}`} className="mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{opt.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${opt.badge.className}`}>
                          {opt.badge.text}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{opt.desc}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* ── APIs ── */}
          {activeSection === "APIs" && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-base font-medium text-amber-600">APIs</h2>
                <Separator className="mt-2" />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={dropdownApiId}
                  onValueChange={setDropdownApiId}
                  disabled={availableApis.length === 0}
                >
                  <SelectTrigger className="flex-1 max-w-xs">
                    <SelectValue placeholder={availableApis.length === 0 ? "All APIs added" : "Select an API…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableApis.map((api) => (
                      <SelectItem key={api.id} value={String(api.id)}>
                        {api.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!dropdownApiId}
                  onClick={addApi}
                >
                  Add
                </Button>
              </div>

              {displayedApis.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                  <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">No APIs added yet</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                        <TableHead className="font-semibold text-gray-700">Name</TableHead>
                        <TableHead className="font-semibold text-gray-700">Base Path</TableHead>
                        <TableHead className="font-semibold text-gray-700">Type</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedApis.map((api) => (
                        <TableRow key={api.id} className="group">
                          <TableCell className="font-medium text-gray-900">{api.displayName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{api.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{api.basePath ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {SPEC_TYPE_LABEL[api.specType] ?? api.specType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => removeApi(api.id)}
                              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove API"
                            >
                              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* ── Plans ── */}
          {activeSection === "Plans" && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-base font-medium text-amber-600">Plans</h2>
                <Separator className="mt-2" />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={dropdownPlanId}
                  onValueChange={setDropdownPlanId}
                  disabled={availablePlans.length === 0}
                >
                  <SelectTrigger className="flex-1 max-w-xs">
                    <SelectValue placeholder={availablePlans.length === 0 ? "All plans added" : "Select a plan…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={String(plan.id)}>
                        {plan.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!dropdownPlanId}
                  onClick={addPlan}
                >
                  Add
                </Button>
              </div>

              {displayedPlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                  <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 12h6M9 16h4" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">No plans added yet</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                        <TableHead className="font-semibold text-gray-700">Name</TableHead>
                        <TableHead className="font-semibold text-gray-700">Throttle</TableHead>
                        <TableHead className="font-semibold text-gray-700">Burst</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPlans.map((plan) => (
                        <TableRow key={plan.id} className="group">
                          <TableCell className="font-medium text-gray-900">{plan.displayName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">{plan.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {plan.throttle != null ? `${plan.throttle} req/s` : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {plan.burst != null ? `${plan.burst} req/s` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <button
                              type="button"
                              onClick={() => removePlan(plan.id)}
                              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove plan"
                            >
                              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* ── Deployments ── */}
          {activeSection === "Deployments" && (
            <div className="flex h-full -mx-8 -my-6">
              {/* env sub-sidebar */}
              <aside className="w-44 shrink-0 border-r border-gray-200 pt-2">
                {deployments.length === 0 ? (
                  <p className="px-5 py-3 text-sm text-muted-foreground">No deployments yet</p>
                ) : (
                  deployments.map((d) => {
                    const env    = allEnvironments.find((e) => e.id === d.environmentId)
                    const active = d.environmentId === selectedEnvId
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedEnvId(d.environmentId)}
                        className={[
                          "w-full text-left py-2 text-sm transition-colors",
                          active
                            ? "border-l-4 border-blue-600 pl-5 font-semibold text-gray-900 bg-gray-50"
                            : "border-l-4 border-transparent pl-5 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                        ].join(" ")}
                      >
                        {env?.name ?? `env ${d.environmentId}`}
                      </button>
                    )
                  })
                )}
              </aside>

              {/* detail panel */}
              <div className="flex-1 px-8 py-6 space-y-6">
                {selectedDeployment ? (
                  <>
                    <div>
                      <h2 className="text-base font-medium text-amber-600">Deployment</h2>
                      <Separator className="mt-2" />
                    </div>

                    <div className="space-y-5 max-w-xl">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500">Status</p>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 capitalize">
                          {selectedDeployment.status}
                        </span>
                      </div>

                      {selectedDeployment.invokeUrl ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500">Invoke URL</p>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm text-gray-800 select-all break-all flex-1" data-testid="invoke-url">
                              {selectedDeployment.invokeUrl}
                            </p>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(selectedDeployment.invokeUrl!)}
                              className="shrink-0 p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                              title="Copy"
                            >
                              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-gray-500">Invoke URL</p>
                          <p className="text-sm text-muted-foreground">—</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2 border-t border-gray-100">
                        <div>
                          <span className="font-medium text-gray-500">Deployed by</span>
                          <p className="mt-0.5">{selectedDeployment.createdBy}</p>
                          <p>{new Date(selectedDeployment.createdAt).toLocaleString()}</p>
                        </div>
                        {selectedDeployment.updatedBy && selectedDeployment.updatedBy !== selectedDeployment.createdBy && (
                          <div>
                            <span className="font-medium text-gray-500">Last redeployed by</span>
                            <p className="mt-0.5">{selectedDeployment.updatedBy}</p>
                            <p>{new Date(selectedDeployment.updatedAt).toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
                    <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <p className="text-sm">Select an environment to view its deployment.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}

import { useEffect, useState } from "react"
import { Link, useFetcher, useLoaderData, useLocation } from "react-router"
import { MoreHorizontal, Rocket, Trash2 } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { deleteProduct, listProductsByGateway } from "~/repositories/product.repository.server"
import { listConsumersByProduct } from "~/repositories/consumer.repository.server"
import { listEnvironmentsByGateway } from "~/repositories/environment.repository.server"
import { findEnvironmentById } from "~/repositories/environment.repository.server"
import { listApisByProduct } from "~/repositories/api-association.repository.server"
import { findApiById } from "~/repositories/api.repository.server"
import { listDeploymentsByGateway, upsertProductDeployment } from "~/repositories/product-deployment.repository.server"
import { publishProductToEnvironment } from "~/aws/publish-product.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { Label } from "~/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { Route } from "./+types/products"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Develop — Products" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const gatewayId       = await getActiveGatewayId(request)

  const [products, environments, deployments] = await Promise.all([
    gatewayId ? listProductsByGateway(gatewayId) : [],
    gatewayId ? listEnvironmentsByGateway(gatewayId) : [],
    gatewayId ? listDeploymentsByGateway(gatewayId) : [],
  ])

  return { products, environments, deployments, gatewayId, email }
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const gatewayId       = await getActiveGatewayId(request)
  const formData        = await request.formData()
  const intent          = formData.get("_intent") as string

  if (intent === "delete") {
    const id = Number(formData.get("id"))
    if (!id) return { error: "Missing id" }

    let activeConsumers: { id: number; name: string }[]
    try {
      activeConsumers = await listConsumersByProduct(id)
    } catch (err) {
      console.error("[products] listConsumersByProduct failed", err)
      return { error: "Something went wrong. Please try again." }
    }
    if (activeConsumers.length > 0) {
      return {
        error: `${activeConsumers.length} consumer${activeConsumers.length === 1 ? "" : "s"} are using this product. Delete them first.`,
      }
    }

    try {
      await deleteProduct(id)
    } catch (err) {
      console.error("[products] deleteProduct failed", err)
      return { error: "Something went wrong while deleting. Please try again." }
    }
    return { ok: true }
  }

  if (intent === "publish") {
    const productId   = Number(formData.get("productId"))
    const envId       = Number(formData.get("environmentId"))
    if (!productId || !envId || !gatewayId) return { error: "Invalid request." }

    const [assocApis, environment] = await Promise.all([
      listApisByProduct(productId),
      findEnvironmentById(envId),
    ])

    if (!environment) return { error: "Environment not found." }

    // Load full API records so we have the spec (for hosts stage variable resolution)
    const fullApis = await Promise.all(
      assocApis.filter((a) => !!a.awsApiId).map((a) => findApiById(a.id)),
    )

    const apisToPublish = fullApis
      .filter((a): a is NonNullable<typeof a> => !!a?.awsApiId)
      .map((a) => ({
        awsApiId: a.awsApiId!,
        spec:     a.spec as Record<string, unknown>,
      }))

    if (apisToPublish.length === 0) {
      return { error: "No AWS-synced APIs found in this product. Sync your APIs to AWS first." }
    }

    let warnings: string[]
    let invokeUrl: string
    try {
      ;({ warnings, invokeUrl } = await publishProductToEnvironment(apisToPublish, environment.name))
    } catch (err) {
      console.error("[products] publishProductToEnvironment failed", err)
      return { error: "Failed to deploy to AWS. Please try again." }
    }

    try {
      await upsertProductDeployment({
        productId,
        environmentId: envId,
        gatewayId,
        status:    "deployed",
        invokeUrl,
        createdBy: email,
        updatedBy: email,
      })
    } catch (err) {
      console.error("[products] upsertProductDeployment failed", err)
      return { error: "Deployed to AWS but failed to save deployment record. Please try again." }
    }

    return { ok: true, publishedTo: environment.name, warnings }
  }

  return { error: "Unknown intent." }
}

// ── Types ──────────────────────────────────────────────────────────────────

type LoaderData     = Awaited<ReturnType<typeof loader>>
type Environment    = LoaderData["environments"][number]
type ProductRow     = LoaderData["products"][number]

// ── Constants ──────────────────────────────────────────────────────────────

const DEV_TABS = [
  { label: "APIs",     to: "/apis"     },
  { label: "Products", to: "/products" },
]

const VISIBILITY_BADGE: Record<string, { label: string; className: string }> = {
  public:        { label: "Public",        className: "bg-green-100 text-green-700 border-green-200" },
  authenticated: { label: "Authenticated", className: "bg-blue-100 text-blue-700 border-blue-200"   },
  invisible:     { label: "Invisible",     className: "bg-gray-100 text-gray-600 border-gray-200"   },
}

// ── Publish Modal ──────────────────────────────────────────────────────────

function PublishModal({
  product,
  environments,
  onClose,
}: {
  product: ProductRow | null
  environments: Environment[]
  onClose: () => void
}) {
  const fetcher     = useFetcher<typeof action>()
  const [envId, setEnvId] = useState<string>("")
  const busy        = fetcher.state !== "idle"
  const error       = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null
  const succeeded   = fetcher.data && "ok" in fetcher.data && fetcher.data.ok

  // Close on success
  useEffect(() => {
    if (succeeded) {
      const t = setTimeout(onClose, 800)
      return () => clearTimeout(t)
    }
  }, [succeeded, onClose])

  // Reset env selection when product changes
  useEffect(() => { setEnvId("") }, [product?.id])

  if (!product) return null

  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish Product</DialogTitle>
        </DialogHeader>

        {/* Loading overlay */}
        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-white/80">
            <svg
              className="size-8 animate-spin text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">Deploying to AWS…</p>
          </div>
        )}

        {succeeded ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-green-100">
              <svg className="size-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">
              Published to{" "}
              <span className="font-semibold">
                {"publishedTo" in (fetcher.data ?? {}) ? (fetcher.data as { publishedTo: string }).publishedTo : ""}
              </span>
            </p>
          </div>
        ) : environments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            <p className="text-sm font-medium text-gray-700">No environments found.</p>
            <p className="text-xs text-muted-foreground">
              <Link to="/environments" className="underline underline-offset-2 hover:text-gray-900" onClick={onClose}>
                Create an environment first →
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select an environment to deploy <span className="font-medium text-gray-900">{product.displayName}</span> to:
            </p>

            <RadioGroup value={envId} onValueChange={setEnvId} className="space-y-2">
              {environments.map((env) => (
                <Label
                  key={env.id}
                  htmlFor={`env-${env.id}`}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors",
                    envId === String(env.id)
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <RadioGroupItem value={String(env.id)} id={`env-${env.id}`} />
                  <span className="text-sm font-medium text-gray-900">{env.name}</span>
                </Label>
              ))}
            </RadioGroup>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          {!succeeded && environments.length > 0 && (
            <fetcher.Form method="post">
              <input type="hidden" name="_intent"       value="publish" />
              <input type="hidden" name="productId"     value={product.id} />
              <input type="hidden" name="environmentId" value={envId} />
              <Button type="submit" disabled={!envId || busy}>
                <Rocket className="size-4 mr-1.5" />
                Deploy
              </Button>
            </fetcher.Form>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Per-row actions ────────────────────────────────────────────────────────

function ProductActions({
  product,
  onPublish,
}: {
  product: ProductRow
  onPublish: (p: ProductRow) => void
}) {
  const fetcher = useFetcher<typeof action>()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const deleting     = fetcher.state !== "idle"
  const deleteError  = fetcher.data && "error" in fetcher.data ? fetcher.data.error : null

  if (deleting) {
    return (
      <div className="flex items-center justify-end pr-1">
        <svg className="size-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    )
  }

  if (deleteError) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <span className="text-xs text-destructive max-w-[180px] text-right leading-tight">{deleteError}</span>
        <button
          onClick={() => fetcher.submit({ _intent: "delete", id: String(product.id) }, { method: "post" })}
          className="text-xs text-red-600 font-medium hover:underline shrink-0"
        >
          Retry
        </button>
      </div>
    )
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => {
            fetcher.submit({ _intent: "delete", id: String(product.id) }, { method: "post" })
            setConfirmDelete(false)
          }}
          className="text-xs text-red-600 font-medium hover:underline"
        >
          Delete
        </button>
        <span className="text-gray-300">|</span>
        <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPublish(product)}>
          <Rocket className="size-4 mr-2 text-blue-600" />
          Publish
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setConfirmDelete(true)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="size-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { products, environments, deployments } = useLoaderData<typeof loader>()
  const location = useLocation()

  const [search,           setSearch]           = useState("")
  const [publishingProduct, setPublishingProduct] = useState<ProductRow | null>(null)

  const filtered = products.filter(
    (p) =>
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()),
  )

  // Build a set of deployed product IDs for badge display
  const deployedProductIds = new Set(deployments.map((d) => d.productId))

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 px-6">
        {DEV_TABS.map((tab) => {
          const active = location.pathname === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={[
                "border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button size="sm" asChild>
          <Link to="/products/new">New Product</Link>
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">
              {products.length === 0 ? "No products yet" : "No products match your search"}
            </p>
            {products.length === 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <Link to="/products/new" className="underline underline-offset-2">Create your first product</Link>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Visibility</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const vis      = VISIBILITY_BADGE[product.visibility] ?? VISIBILITY_BADGE.authenticated
                const deployed = deployedProductIds.has(product.id)
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <Link to={`/products/${product.id}`} className="hover:underline text-gray-900">
                        {product.displayName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${vis.className}`}>{vis.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {deployed ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <Rocket className="size-3 mr-1" /> Deployed
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not deployed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <ProductActions
                        product={product}
                        onPublish={setPublishingProduct}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Publish modal (rendered outside the table to avoid z-index issues) */}
      <PublishModal
        product={publishingProduct}
        environments={environments}
        onClose={() => setPublishingProduct(null)}
      />
    </div>
  )
}

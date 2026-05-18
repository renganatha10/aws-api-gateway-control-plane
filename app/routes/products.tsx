import { useState } from "react"
import { Link, useFetcher, useLoaderData, useLocation } from "react-router"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/keycloak.server"
import { deleteProduct, listProductsByGateway } from "~/repositories/product.repository.server"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
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
  const products        = gatewayId ? await listProductsByGateway(gatewayId) : []
  return { products, gatewayId, email }
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request)
  const formData = await request.formData()
  const id = Number(formData.get("id"))
  if (!id) return { error: "Missing id" }
  await deleteProduct(id)
  return { ok: true }
}

const DEV_TABS = [
  { label: "APIs",     to: "/apis"     },
  { label: "Products", to: "/products" },
]

const VISIBILITY_BADGE: Record<string, { label: string; className: string }> = {
  public:        { label: "Public",        className: "bg-green-100 text-green-700 border-green-200" },
  authenticated: { label: "Authenticated", className: "bg-blue-100 text-blue-700 border-blue-200"   },
  invisible:     { label: "Invisible",     className: "bg-gray-100 text-gray-600 border-gray-200"   },
}

function DeleteButton({ id }: { id: number }) {
  const fetcher  = useFetcher()
  const [confirm, setConfirm] = useState(false)
  const deleting = fetcher.state !== "idle"

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            fetcher.submit({ id: String(id) }, { method: "post" })
            setConfirm(false)
          }}
          className="text-xs text-red-600 font-medium hover:underline"
        >
          Delete
        </button>
        <span className="text-gray-300">|</span>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      disabled={deleting}
      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
      aria-label="Delete product"
    >
      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
      </svg>
    </button>
  )
}

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>()
  const location = useLocation()

  const [search, setSearch] = useState("")

  const filtered = products.filter(
    (p) =>
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()),
  )

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
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const vis = VISIBILITY_BADGE[product.visibility] ?? VISIBILITY_BADGE.authenticated
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
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteButton id={product.id} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

import { useState } from "react"
import { Link, useFetcher, useLocation, useNavigation, useNavigate } from "react-router"
import { Trash2, Zap } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { deleteApi, listApisByGateway } from "~/repositories/api.repository.server"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { Route } from "./+types/apis"

export function meta({}: Route.MetaArgs) {
  return [{ title: "APIs" }]
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request)
  const formData = await request.formData()
  const id = Number(formData.get("id"))
  if (!id) return { error: "Missing id" }
  try {
    await deleteApi(id)
  } catch (err) {
    console.error("[apis] deleteApi failed", err)
    return { error: "Something went wrong while deleting. Please try again." }
  }
  return { ok: true }
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const gatewayId       = await getActiveGatewayId(request)
  try {
    const apis = gatewayId ? await listApisByGateway(gatewayId) : []
    return { apis, gatewayId, email }
  } catch (err) {
    console.error("[apis] loader failed", err)
    return { apis: [], gatewayId, email }
  }
}

const DEV_TABS = [
  { label: "APIs",     to: "/apis"     },
  { label: "Products", to: "/products" },
]

const SPEC_TYPE_LABEL: Record<string, string> = {
  swagger2: "OpenAPI 2.0 (REST)",
  openapi3: "OpenAPI 3.0 (REST)",
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
        <button
          onClick={() => setConfirm(false)}
          className="text-xs text-gray-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      disabled={deleting}
      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      aria-label="Delete API"
    >
      <Trash2 className="size-4" />
    </button>
  )
}

export default function ApisPage({ loaderData }: Route.ComponentProps) {
  const { apis, gatewayId } = loaderData
  const location  = useLocation()
  const navigate  = useNavigate()
  const navigation = useNavigation()
  const [search, setSearch] = useState("")

  const isLoading = navigation.state === "loading"

  const filtered = apis.filter(
    (api) =>
      api.displayName.toLowerCase().includes(search.toLowerCase()) ||
      (api.scope ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-3xl font-normal text-gray-900">APIs</h1>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm px-6"
          onClick={() => navigate("/apis/new")}
        >
          Add
        </Button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 px-6">
        {DEV_TABS.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className={[
              "border-b-2 px-4 pb-2 text-sm font-medium transition-colors",
              location.pathname === to
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 bg-gray-100 border-b border-gray-200 px-4 py-2">
        <svg className="size-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="What are you looking for today?"
          className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-gray-400 h-8 px-1"
        />
      </div>

      {/* Spinner */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <svg className="size-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      )}

      {/* No gateway selected */}
      {!isLoading && !gatewayId && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-500 text-sm">Select a gateway from the sidebar to view its APIs.</p>
        </div>
      )}

      {/* Empty state — gateway selected but no APIs */}
      {!isLoading && gatewayId && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-700 font-medium">No APIs yet</p>
          <p className="text-gray-500 text-sm">
            {search ? "No APIs match your search." : "Create your first API to get started."}
          </p>
          {!search && (
            <Button
              size="sm"
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => navigate("/apis/new")}
            >
              Create API
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && gatewayId && filtered.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead className="w-[25%] font-semibold text-gray-700">Name</TableHead>
              <TableHead className="w-[18%] font-semibold text-gray-700">Base Path</TableHead>
              <TableHead className="w-[15%] font-semibold text-gray-700">Scope</TableHead>
              <TableHead className="w-[18%] font-semibold text-gray-700">Type</TableHead>
              <TableHead className="w-[16%] font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  Created
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </span>
              </TableHead>
              <TableHead className="w-[8%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((api) => (
              <TableRow key={api.id} className="border-b border-gray-200">
                <TableCell>
                  <Link to={`/apis/${api.id}`} className="text-gray-900 hover:underline">
                    {api.displayName}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-gray-600">{api.basePath ?? "—"}</TableCell>
                <TableCell className="text-gray-500 text-sm">{api.scope ?? "—"}</TableCell>
                <TableCell className="text-gray-700">{SPEC_TYPE_LABEL[api.specType] ?? api.specType}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(api.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right pr-4">
                  <DeleteButton id={api.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

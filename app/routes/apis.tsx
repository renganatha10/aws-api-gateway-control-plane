import { Link, useNavigate, useNavigation } from "react-router"
import { Zap } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { listApisByGateway } from "~/repositories/api.repository.server"
import { Button } from "~/components/ui/button"
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

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  const gatewayId = await getActiveGatewayId(request)
  try {
    const apis = gatewayId ? await listApisByGateway(gatewayId) : []
    return { apis, gatewayId }
  } catch (err) {
    console.error("[apis] loader failed", err)
    return { apis: [], gatewayId }
  }
}

const SPEC_TYPE_LABEL: Record<string, string> = {
  swagger2: "OpenAPI 2.0 (REST)",
  openapi3: "OpenAPI 3.0 (REST)",
}

export default function ApisPage({ loaderData }: Route.ComponentProps) {
  const { apis, gatewayId } = loaderData
  const navigate   = useNavigate()
  const navigation = useNavigation()

  const isLoading = navigation.state === "loading"

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-normal text-gray-900">APIs</h1>
        <Button size="sm" onClick={() => navigate("/apis/new")}>
          Add
        </Button>
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

      {/* Empty state */}
      {!isLoading && gatewayId && apis.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 mt-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <Zap className="size-10 text-gray-300" />
          <div>
            <p className="text-sm font-medium text-gray-600">No APIs yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link to="/apis/new" className="underline underline-offset-2">Create your first API</Link>
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && gatewayId && apis.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead className="w-[28%] font-semibold text-gray-700">Name</TableHead>
              <TableHead className="w-[20%] font-semibold text-gray-700">Base Path</TableHead>
              <TableHead className="w-[17%] font-semibold text-gray-700">Scope</TableHead>
              <TableHead className="w-[20%] font-semibold text-gray-700">Type</TableHead>
              <TableHead className="w-[15%] font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  Created
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apis.map((api) => (
              <TableRow
                key={api.id}
                className="border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/apis/${api.id}`)}
              >
                <TableCell className="font-medium text-gray-900">{api.displayName}</TableCell>
                <TableCell className="font-mono text-xs text-gray-600">{api.basePath ?? "—"}</TableCell>
                <TableCell className="text-gray-500 text-sm">{api.scope ?? "—"}</TableCell>
                <TableCell className="text-gray-700">{SPEC_TYPE_LABEL[api.specType] ?? api.specType}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(api.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

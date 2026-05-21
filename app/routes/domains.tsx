import { useState } from "react"
import { Link, useFetcher, useLoaderData } from "react-router"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { listDomainsByGateway, deleteDomain } from "~/repositories/domain.repository.server"
import { countMappingsByDomain } from "~/repositories/domain-route-mapping.repository.server"
import { deleteCustomDomain } from "~/aws/custom-domain.server"
import { extractSubdomain, removeCname } from "~/lib/godaddy.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { Route } from "./+types/domains"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Develop — Domains" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  const gatewayId = await getActiveGatewayId(request)
  const domainList = gatewayId ? await listDomainsByGateway(gatewayId) : []
  return { domains: domainList, gatewayId }
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request)
  const formData   = await request.formData()
  const intent     = formData.get("_intent") as string

  if (intent === "delete") {
    const id         = Number(formData.get("id"))
    const domainName = (formData.get("domainName") as string)?.trim()
    if (!id || !domainName) return { error: "Missing required fields." }

    let mappingCount: number
    try {
      mappingCount = await countMappingsByDomain(id)
    } catch (err) {
      console.error("[domains] countMappingsByDomain failed", err)
      return { error: "Something went wrong. Please try again." }
    }

    if (mappingCount > 0) {
      return {
        error: `This domain has ${mappingCount} route mapping${mappingCount === 1 ? "" : "s"}. Remove all mappings on the edit page before deleting.`,
      }
    }

    try {
      await deleteCustomDomain(domainName)
    } catch (err) {
      console.error("[domains] deleteCustomDomain failed", err)
      return { error: "Failed to sync with AWS. Please try again." }
    }

    const godaddyDomain = (formData.get("godaddyDomain") as string)?.trim() || null
    if (godaddyDomain) {
      const subdomain = extractSubdomain(domainName, godaddyDomain)
      if (subdomain) {
        try {
          await removeCname(godaddyDomain, subdomain)
        } catch {
          // non-fatal — logged inside removeCname
        }
      }
    }

    try {
      await deleteDomain(id)
    } catch (err) {
      console.error("[domains] deleteDomain failed", err)
      return { error: "Something went wrong while deleting. Please try again." }
    }

    return { ok: true }
  }

  return { error: "Unknown intent." }
}

// ── Types ──────────────────────────────────────────────────────────────────

type DomainRow = Awaited<ReturnType<typeof listDomainsByGateway>>[number]

// ── Per-row actions ────────────────────────────────────────────────────────

function DomainActions({ domain }: { domain: DomainRow }) {
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
        <span className="text-xs text-destructive max-w-[200px] text-right leading-tight">{deleteError}</span>
        <button
          onClick={() =>
            fetcher.submit(
              { _intent: "delete", id: String(domain.id), domainName: domain.domainName, godaddyDomain: domain.godaddyDomain ?? "" },
              { method: "post" },
            )
          }
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
            fetcher.submit(
              { _intent: "delete", id: String(domain.id), domainName: domain.domainName, godaddyDomain: domain.godaddyDomain ?? "" },
              { method: "post" },
            )
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
        <DropdownMenuItem asChild>
          <Link to={`/domains/${domain.id}`}>
            <Pencil className="size-4 mr-2" />
            Edit
          </Link>
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

const ENDPOINT_BADGE: Record<string, { label: string; className: string }> = {
  REGIONAL: { label: "Regional", className: "bg-blue-50 text-blue-700 border-blue-200"  },
  EDGE:     { label: "Edge",     className: "bg-purple-50 text-purple-700 border-purple-200" },
}

export default function DomainsPage() {
  const { domains } = useLoaderData<typeof loader>()
  const [search, setSearch] = useState("")

  const filtered = domains.filter((d) =>
    d.domainName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <Input
          placeholder="Search domains…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Button size="sm" asChild>
          <Link to="/domains/new">New Domain</Link>
        </Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">
              {domains.length === 0 ? "No custom domains yet" : "No domains match your search"}
            </p>
            {domains.length === 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <Link to="/domains/new" className="underline underline-offset-2">
                  Add your first custom domain →
                </Link>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-700">Domain</TableHead>
                <TableHead className="font-semibold text-gray-700">Endpoint</TableHead>
                <TableHead className="font-semibold text-gray-700">AWS Target</TableHead>
                <TableHead className="font-semibold text-gray-700">Mappings</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((domain) => {
                const ep = ENDPOINT_BADGE[domain.endpointType] ?? ENDPOINT_BADGE.REGIONAL
                return (
                  <TableRow key={domain.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/domains/${domain.id}`}
                        className="hover:underline text-gray-900"
                      >
                        {domain.domainName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${ep.className}`}>
                        {ep.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate text-xs font-mono text-muted-foreground">
                        {domain.awsDomainName ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {domain.mappingCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(domain.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DomainActions domain={domain} />
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

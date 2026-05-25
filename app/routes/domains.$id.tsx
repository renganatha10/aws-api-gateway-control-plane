import { useState } from "react"
import { Form, Link, redirect, useFetcher, useLoaderData, useNavigation } from "react-router"
import { Plus, X } from "lucide-react"

import { getActiveOrganisationId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { findDomainById, deleteDomain } from "~/repositories/domain.repository.server"
import {
  countMappingsByDomain,
  listMappingsWithApiByDomain,
  replaceMappings,
} from "~/repositories/domain-route-mapping.repository.server"
import { listApisByOrganisation } from "~/repositories/api.repository.server"
import {
  createBasePathMapping,
  deleteBasePathMapping,
  deleteCustomDomain,
} from "~/aws/custom-domain.server"
import { extractSubdomain, removeCname } from "~/lib/godaddy.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { Route } from "./+types/domains.$id"

export function meta({ data }: Route.MetaArgs) {
  const d = (data as { domain?: { domainName: string } } | undefined)?.domain
  return [{ title: d ? `${d.domainName} — Domain` : "Domain" }]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request)
  const organisationId = await getActiveOrganisationId(request)
  const id        = Number(params.id)

  const domain = await findDomainById(id)
  if (!domain) throw new Response("Not Found", { status: 404 })

  const [mappings, allApis] = await Promise.all([
    listMappingsWithApiByDomain(id),
    organisationId ? listApisByOrganisation(organisationId) : [],
  ])

  const syncedApis = allApis.filter((a) => !!a.awsApiId)

  return { domain, mappings, syncedApis }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const updatedBy       = getUserProfile(accessToken).email
  const id              = Number(params.id)

  const formData = await request.formData()
  const intent   = formData.get("_intent") as string

  // ── Update mappings ───────────────────────────────────────────────────────
  if (intent === "update") {
    const domain = await findDomainById(id)
    if (!domain) return { error: "Domain not found." }

    let newMappings: Array<{ apiId: string; stage: string; basePath: string }>
    try {
      newMappings = JSON.parse((formData.get("mappings") as string) || "[]")
    } catch {
      return { error: "Invalid mapping data." }
    }

    for (const m of newMappings) {
      if (!m.apiId)         return { error: "All mappings must have an API selected." }
      if (!m.stage?.trim()) return { error: "All mappings must have a stage." }
    }

    // Load old mappings (with awsApiId) and all APIs for awsApiId lookup on new mappings
    const [oldMappings, allApis] = await Promise.all([
      listMappingsWithApiByDomain(id),
      listApisByOrganisation(domain.organisationId),
    ])

    const apiMap = new Map(allApis.map((a) => [String(a.id), a]))

    for (const m of newMappings) {
      if (!apiMap.get(m.apiId)?.awsApiId) {
        return { error: "One or more selected APIs have not been synced to AWS yet." }
      }
    }

    // Reconcile by basePath (unique key per domain in AWS)
    const oldByBasePath = new Map(
      oldMappings.map((m) => [m.basePath, m]),
    )
    const newByBasePath = new Map(
      newMappings.map((m) => [m.basePath.trim() || "(none)", m]),
    )

    const toDelete: string[] = []
    const toAdd: Array<{ apiId: string; stage: string; basePath: string }> = []

    for (const [bp, old] of oldByBasePath) {
      const next = newByBasePath.get(bp)
      if (!next) {
        // removed entirely
        toDelete.push(bp)
      } else if (String(old.apiId) !== next.apiId || old.stage !== next.stage.trim()) {
        // same basePath but different API or stage — replace
        toDelete.push(bp)
        toAdd.push({ apiId: next.apiId, stage: next.stage.trim(), basePath: bp })
      }
      // else: unchanged — no-op
    }

    for (const [bp, next] of newByBasePath) {
      if (!oldByBasePath.has(bp)) {
        toAdd.push({ apiId: next.apiId, stage: next.stage.trim(), basePath: bp })
      }
    }

    // Apply AWS deletes
    try {
      for (const bp of toDelete) {
        await deleteBasePathMapping(domain.domainName, bp)
      }
    } catch (err) {
      console.error("[domains.$id] deleteBasePathMapping failed", err)
      return { error: "Failed to sync with AWS. Please try again." }
    }

    // Apply AWS creates
    try {
      for (const m of toAdd) {
        const api = apiMap.get(m.apiId)!
        await createBasePathMapping(domain.domainName, api.awsApiId!, m.stage, m.basePath)
      }
    } catch (err) {
      console.error("[domains.$id] createBasePathMapping failed", err)
      return { error: "Failed to sync with AWS. Please try again." }
    }

    // Persist to DB
    try {
      await replaceMappings(
        id,
        newMappings.map((m) => ({
          apiId:    Number(m.apiId),
          stage:    m.stage.trim(),
          basePath: m.basePath.trim() || "(none)",
        })),
      )
    } catch (err) {
      console.error("[domains.$id] replaceMappings failed", err)
      return { error: "Something went wrong while saving. Please try again." }
    }

    return { ok: true }
  }

  // ── Delete domain ─────────────────────────────────────────────────────────
  if (intent === "delete") {
    const domain = await findDomainById(id)
    if (!domain) return { error: "Domain not found." }

    let mappingCount: number
    try {
      mappingCount = await countMappingsByDomain(id)
    } catch (err) {
      console.error("[domains.$id] countMappingsByDomain failed", err)
      return { error: "Something went wrong. Please try again." }
    }

    if (mappingCount > 0) {
      return {
        error: `Remove all ${mappingCount} route mapping${mappingCount === 1 ? "" : "s"} before deleting this domain.`,
      }
    }

    try {
      await deleteCustomDomain(domain.domainName)
    } catch (err) {
      console.error("[domains.$id] deleteCustomDomain failed", err)
      return { error: "Failed to sync with AWS. Please try again." }
    }

    if (domain.godaddyDomain) {
      const subdomain = extractSubdomain(domain.domainName, domain.godaddyDomain)
      if (subdomain) {
        try {
          await removeCname(domain.godaddyDomain, subdomain)
        } catch {
          // non-fatal — logged inside removeCname
        }
      }
    }

    try {
      await deleteDomain(id)
    } catch (err) {
      console.error("[domains.$id] deleteDomain failed", err)
      return { error: "Something went wrong while deleting. Please try again." }
    }

    throw redirect("/domains")
  }

  return { error: "Unknown intent." }
}

// ── Types ──────────────────────────────────────────────────────────────────

type LoaderData   = Awaited<ReturnType<typeof loader>>
type MappingEntry = { key: number; apiId: string; stage: string; basePath: string }

// ── Mapping row ────────────────────────────────────────────────────────────

function MappingRow({
  entry,
  apis,
  canRemove,
  onUpdate,
  onRemove,
}: {
  entry: MappingEntry
  apis: LoaderData["syncedApis"]
  canRemove: boolean
  onUpdate: (key: number, field: keyof Omit<MappingEntry, "key">, value: string) => void
  onRemove: (key: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Select value={entry.apiId} onValueChange={(v) => onUpdate(entry.key, "apiId", v)}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Select API…" />
        </SelectTrigger>
        <SelectContent>
          {apis.length === 0 ? (
            <SelectItem value="_none" disabled>No AWS-synced APIs found</SelectItem>
          ) : (
            apis.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.displayName}</SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <Input
        value={entry.stage}
        onChange={(e) => onUpdate(entry.key, "stage", e.target.value)}
        placeholder="stage (e.g. prod)"
        className="w-36"
      />

      <Input
        value={entry.basePath}
        onChange={(e) => onUpdate(entry.key, "basePath", e.target.value)}
        placeholder="base path (optional)"
        className="w-44"
      />

      <button
        type="button"
        onClick={() => onRemove(entry.key)}
        disabled={!canRemove}
        className="text-gray-400 hover:text-red-600 disabled:opacity-30 transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

const ENDPOINT_BADGE: Record<string, { label: string; className: string }> = {
  REGIONAL: { label: "Regional", className: "bg-blue-50 text-blue-700 border-blue-200"       },
  EDGE:     { label: "Edge",     className: "bg-purple-50 text-purple-700 border-purple-200" },
}

export default function DomainDetailPage() {
  const { domain, mappings, syncedApis } = useLoaderData<typeof loader>()
  const navigation = useNavigation()

  const saving = navigation.state === "submitting" &&
    navigation.formData?.get("_intent") === "update"

  // Initialize mapping state from DB
  const [entries, setEntries] = useState<MappingEntry[]>(() =>
    mappings.length > 0
      ? mappings.map((m, i) => ({
          key:      i,
          apiId:    String(m.apiId),
          stage:    m.stage,
          basePath: m.basePath,
        }))
      : [{ key: 0, apiId: "", stage: "", basePath: "" }],
  )
  const [nextKey, setNextKey] = useState(mappings.length || 1)

  function addEntry() {
    setEntries((prev) => [...prev, { key: nextKey, apiId: "", stage: "", basePath: "" }])
    setNextKey((k) => k + 1)
  }

  function removeEntry(key: number) {
    setEntries((prev) => prev.filter((e) => e.key !== key))
  }

  function updateEntry(key: number, field: keyof Omit<MappingEntry, "key">, value: string) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, [field]: value } : e)))
  }

  // Delete
  const deleteFetcher   = useFetcher<typeof action>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteError = deleteFetcher.data && "error" in deleteFetcher.data ? deleteFetcher.data.error : null

  // Save result
  const saveFetcher  = useFetcher<typeof action>()
  const saveOk       = saveFetcher.data && "ok" in saveFetcher.data
  const saveError    = saveFetcher.data && "error" in saveFetcher.data ? saveFetcher.data.error : null
  const saveBusy     = saveFetcher.state !== "idle"

  const ep = ENDPOINT_BADGE[domain.endpointType] ?? ENDPOINT_BADGE.REGIONAL

  const mappingPayload = JSON.stringify(
    entries.map(({ apiId, stage, basePath }) => ({
      apiId,
      stage,
      basePath: basePath.trim() || "(none)",
    })),
  )

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/domains" className="hover:underline">Domains</Link>
        {" /"}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 pt-1 pb-3 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 truncate">{domain.domainName}</h1>

        <div className="flex items-center gap-2 shrink-0">
          {deleteError && (
            <p className="text-xs text-destructive max-w-[240px] text-right leading-tight">{deleteError}</p>
          )}
          {confirmDelete ? (
            <>
              <span className="text-sm text-gray-600">Delete this domain?</span>
              <deleteFetcher.Form method="post">
                <input type="hidden" name="_intent" value="delete" />
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={deleteFetcher.state !== "idle"}
                >
                  {deleteFetcher.state !== "idle" ? "Deleting…" : "Confirm Delete"}
                </Button>
              </deleteFetcher.Form>
              <Button
                variant="outline"
                size="sm"
                disabled={deleteFetcher.state !== "idle"}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-8 px-6 py-6 max-w-2xl">

        {/* Domain details (read-only) */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Domain Details</h2>

          <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
            <span className="text-muted-foreground">Domain Name</span>
            <span className="font-mono font-medium text-gray-900">{domain.domainName}</span>

            <span className="text-muted-foreground">Endpoint Type</span>
            <span>
              <Badge variant="outline" className={`text-xs ${ep.className}`}>{ep.label}</Badge>
            </span>

            <span className="text-muted-foreground">AWS Target</span>
            <span className="font-mono text-xs text-gray-700 break-all">
              {domain.awsDomainName ?? "—"}
            </span>

            <span className="text-muted-foreground">Certificate ARN</span>
            <span className="font-mono text-xs text-gray-700 break-all">{domain.certificateArn}</span>

            <span className="text-muted-foreground">GoDaddy Domain</span>
            <span className="text-gray-700">{domain.godaddyDomain ?? <span className="text-muted-foreground">—</span>}</span>

            <span className="text-muted-foreground">Created</span>
            <span className="text-gray-700">{new Date(domain.createdAt).toLocaleString()}</span>
          </div>
        </div>

        <Separator />

        {/* Route mappings (editable) */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Route Mappings</h2>
          <p className="text-xs text-muted-foreground">
            Changes are synced to AWS immediately on save. Leave base path empty to serve at the domain root.
          </p>

          {saveError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
          )}
          {saveOk && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Mappings saved.</p>
          )}

          {/* Column headers */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-52">API</span>
            <span className="w-36">Stage</span>
            <span className="w-44">Base Path</span>
          </div>

          <div className="space-y-2">
            {entries.map((e) => (
              <MappingRow
                key={e.key}
                entry={e}
                apis={syncedApis}
                canRemove={entries.length > 1}
                onUpdate={updateEntry}
                onRemove={removeEntry}
              />
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addEntry}>
            <Plus className="size-3.5 mr-1.5" />
            Add Mapping
          </Button>

          <div className="pt-2">
            <saveFetcher.Form method="post">
              <input type="hidden" name="_intent"  value="update" />
              <input type="hidden" name="mappings" value={mappingPayload} />
              <Button
                type="submit"
                disabled={saveBusy}
                className="bg-black hover:bg-gray-900 text-white"
              >
                {saveBusy ? "Saving…" : "Save Mappings"}
              </Button>
            </saveFetcher.Form>
          </div>
        </div>
      </div>
    </div>
  )
}

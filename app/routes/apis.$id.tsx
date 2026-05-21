import * as React from "react"
import * as yaml from "js-yaml"
import { Form, Link, useActionData, useNavigation } from "react-router"
import { toast } from "sonner"

import { requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { findApiById, findApiByGatewayAndBasePath, updateApi } from "~/repositories/api.repository.server"
import { buildAwsSpec, extractBasePath } from "~/aws/build-aws-spec.server"
import { importApiSpec, putApiSpec } from "~/aws/import-api.server"
import type { Route } from "./+types/apis.$id"

// ─── raw spec types (Swagger 2.0 / OAS 3) ────────────────────────────────────

interface RawSpec {
  info?:       { title?: string; version?: string }
  hosts?:      Record<string, string>
  host?:       string
  basePath?:   string
  tags?:       Array<{ name: string; description?: string }>
  paths?:      Record<string, Record<string, RawOperation>>
  definitions?: Record<string, RawSchema>
  components?: { schemas?: Record<string, RawSchema> }
}

interface RawOperation {
  summary?:     string
  description?: string
  operationId?: string
  tags?:        string[]
  parameters?:  RawParam[]
  responses?:   Record<string, RawResponse>
  requestBody?: { content?: Record<string, { schema?: RawSchema }> }
  consumes?:    string[]
}

interface RawParam {
  name:         string
  in:           string
  required?:    boolean
  description?: string
  type?:        string
  format?:      string
  schema?:      RawSchema
  $ref?:        string
}

interface RawResponse {
  description?: string
  schema?:      RawSchema
  $ref?:        string
}

interface RawSchema {
  type?:        string
  format?:      string
  $ref?:        string
  properties?:  Record<string, RawSchema>
  items?:       RawSchema
  enum?:        unknown[]
  example?:     unknown
}

// ─── normalized types ─────────────────────────────────────────────────────────

interface ParsedParam {
  name:        string
  in:          string
  required:    boolean
  description: string
  type:        string
}

interface ParsedResponse {
  code:        string
  description: string
}

interface ParsedEndpoint {
  method:       string
  path:         string
  summary:      string
  description:  string
  tags:         string[]
  parameters:   ParsedParam[]
  bodyType:     string | null
  bodySample:   string | null
  responses:    ParsedResponse[]
}

interface EndpointGroup {
  tag:         string
  description: string
  endpoints:   ParsedEndpoint[]
}

// ─── method colours ───────────────────────────────────────────────────────────

const METHOD_BG: Record<string, string> = {
  get:     "bg-blue-600",
  post:    "bg-green-600",
  put:     "bg-amber-500",
  delete:  "bg-red-600",
  patch:   "bg-purple-600",
  head:    "bg-zinc-500",
  options: "bg-zinc-500",
}

const METHOD_BORDER: Record<string, string> = {
  get:    "border-blue-600/40",
  post:   "border-green-600/40",
  put:    "border-amber-500/40",
  delete: "border-red-600/40",
  patch:  "border-purple-600/40",
}

// ─── spec parser ──────────────────────────────────────────────────────────────

const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"]

function resolveRef(spec: RawSpec, ref?: string): RawSchema | null {
  if (!ref) return null
  const parts = ref.replace("#/", "").split("/")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parts.reduce((o: any, k) => o?.[k], spec) ?? null
}

function schemaType(spec: RawSpec, schema?: RawSchema): string {
  if (!schema) return "any"
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? schema.$ref
    const resolved = resolveRef(spec, schema.$ref)
    return resolved?.type ? `${name} (${resolved.type})` : name
  }
  if (schema.type === "array" && schema.items) return `array[${schemaType(spec, schema.items)}]`
  if (schema.enum) return schema.enum.join(" | ")
  return schema.type ?? "any"
}

function generateSample(spec: RawSpec, schema: RawSchema, depth = 0): unknown {
  if (depth > 5) return "…"

  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref) as RawSchema | null
    return resolved ? generateSample(spec, resolved, depth + 1) : null
  }

  if (schema.example !== undefined) return schema.example
  if (schema.enum?.length) return schema.enum[0]

  if (schema.type === "array" && schema.items) {
    return [generateSample(spec, schema.items, depth + 1)]
  }

  if (schema.type === "object" || schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(schema.properties ?? {})) {
      obj[k] = generateSample(spec, v, depth + 1)
    }
    return obj
  }

  switch (schema.type) {
    case "integer": return 0
    case "number":  return 0.0
    case "boolean": return false
    case "string":
      if (schema.format === "date-time") return "2024-01-01T00:00:00Z"
      if (schema.format === "date")      return "2024-01-01"
      if (schema.format === "int64")     return 0
      return "string"
    default: return null
  }
}

function parseSpec(yamlStr: string): { spec: RawSpec; groups: EndpointGroup[]; hosts: Record<string, string> } {
  let spec: RawSpec = {}
  try {
    spec = (yaml.load(yamlStr) as RawSpec) ?? {}
  } catch {
    return { spec, groups: [], hosts: {} }
  }

  const hosts = spec.hosts ?? {}
  const tagDescriptions: Record<string, string> = {}
  for (const t of spec.tags ?? []) tagDescriptions[t.name] = t.description ?? ""

  const groupMap: Record<string, EndpointGroup> = {}

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue

      const tags = op.tags?.length ? op.tags : ["default"]
      const tag  = tags[0]

      if (!groupMap[tag]) {
        groupMap[tag] = { tag, description: tagDescriptions[tag] ?? "", endpoints: [] }
      }

      // parameters
      const params: ParsedParam[] = (op.parameters ?? []).map((p) => {
        const resolved = p.$ref ? resolveRef(spec, p.$ref) as RawParam | null : p
        const r = resolved ?? p
        return {
          name:        r.name ?? "",
          in:          r.in   ?? "",
          required:    r.required ?? false,
          description: r.description ?? "",
          type:        r.type ?? schemaType(spec, (r as RawParam).schema),
        }
      })

      // body type + sample (Swagger 2.0 body param or OAS3 requestBody)
      const rawBodyParam = (op.parameters ?? []).find((p) => p.in === "body" || p.in === "formData")
      const bodyParam    = params.find((p) => p.in === "body" || p.in === "formData")
      let bodyType:   string | null = null
      let bodySample: string | null = null

      if (bodyParam && rawBodyParam) {
        bodyType = bodyParam.in === "formData" ? "multipart/form-data" : "application/json"
        const rawSchema = rawBodyParam.schema ?? null
        if (rawSchema) {
          try {
            bodySample = JSON.stringify(generateSample(spec, rawSchema), null, 2)
          } catch { bodySample = null }
        }
      } else if (op.requestBody?.content) {
        const [ct, ctObj] = Object.entries(op.requestBody.content)[0] ?? []
        bodyType = ct ?? "application/json"
        if (ctObj?.schema) {
          try {
            bodySample = JSON.stringify(generateSample(spec, ctObj.schema), null, 2)
          } catch { bodySample = null }
        }
      }

      // responses
      const responses: ParsedResponse[] = Object.entries(op.responses ?? {}).map(([code, r]) => ({
        code,
        description: r.description ?? "",
      }))

      groupMap[tag].endpoints.push({
        method,
        path,
        summary:     op.summary     ?? op.operationId ?? "",
        description: op.description ?? "",
        tags,
        parameters:  params.filter((p) => p.in !== "body" && p.in !== "formData"),
        bodyType,
        bodySample,
        responses,
      })
    }
  }

  return { spec, groups: Object.values(groupMap), hosts }
}

function parseHosts(yamlStr: string): Record<string, string> {
  try {
    return ((yaml.load(yamlStr) as RawSpec)?.hosts) ?? {}
  } catch { return {} }
}

function parseEndpointList(yamlStr: string) {
  try {
    const spec = yaml.load(yamlStr) as RawSpec
    return Object.entries(spec?.paths ?? {}).flatMap(([path, methods]) =>
      Object.entries(methods)
        .filter(([m]) => HTTP_METHODS.includes(m))
        .map(([method, op]) => ({ method, path, summary: op.summary ?? op.operationId ?? "" }))
    )
  } catch { return [] }
}

// ─── loader / action ──────────────────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request)
  const api = await findApiById(Number(params.id))
  if (!api) throw new Response("Not found", { status: 404 })
  const yamlStr = yaml.dump(api.spec, { indent: 2, lineWidth: -1 })
  return { api, yamlStr }
}

export async function action({ request, params }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const updatedBy = getUserProfile(accessToken).email
  const id        = Number(params.id)
  const formData  = await request.formData()
  const yamlStr   = (formData.get("yaml") as string)?.trim()
  const scope     = (formData.get("scope") as string)?.trim() || null

  if (!yamlStr) return { error: "YAML cannot be empty." }
  let spec: unknown
  try { spec = yaml.load(yamlStr) } catch { return { error: "Invalid YAML." } }
  if (!spec || typeof spec !== "object") return { error: "YAML must define an object." }

  const basePath = extractBasePath(spec as Record<string, unknown>)

  const existing = await findApiById(id)
  if (existing?.gatewayId) {
    const conflict = await findApiByGatewayAndBasePath(existing.gatewayId, basePath, id)
    if (conflict) return { error: `Base path "${basePath}" is already in use by another API in this gateway.` }
  }

  let awsApiId = existing?.awsApiId ?? null
  try {
    const specObj    = spec as Record<string, unknown>
    const specForAws = { ...specObj, info: { ...(specObj.info as object ?? {}), title: existing?.name ?? "" } }
    const awsSpec    = buildAwsSpec(specForAws, scope, existing?.name)
    if (awsApiId) {
      await putApiSpec(awsApiId, awsSpec)
    } else {
      awsApiId = await importApiSpec(awsSpec)
    }
  } catch (err) {
    console.error("[api-update] AWS sync failed", err)
    return { error: "Something went wrong while syncing to AWS. Please try again." }
  }

  try {
    await updateApi(id, { scope, spec, basePath, awsApiId, updatedBy, updatedAt: new Date() })
  } catch (err) {
    console.error("[api-update] DB update failed", err)
    return { error: "Something went wrong while saving. Please try again." }
  }
  return { ok: true }
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: (data as { api?: { displayName?: string } })?.api?.displayName ?? "API" }]
}

// ─── shared sub-components ────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`shrink-0 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white min-w-[52px] ${METHOD_BG[method] ?? "bg-zinc-600"}`}>
      {method.toUpperCase()}
    </span>
  )
}

function StatusBadge({ code }: { code: string }) {
  const n = parseInt(code)
  const cls = n < 300 ? "text-green-400 border-green-700"
            : n < 400 ? "text-blue-400 border-blue-700"
            : n < 500 ? "text-amber-400 border-amber-700"
            :           "text-red-400 border-red-700"
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-mono font-semibold ${cls}`}>
      {code}
    </span>
  )
}

// ─── endpoint accordion card (UI tab) ─────────────────────────────────────────

function EndpointCard({ ep }: { ep: ParsedEndpoint }) {
  const [open, setOpen] = React.useState(false)
  const borderCls = METHOD_BORDER[ep.method] ?? "border-zinc-700"

  return (
    <div className={`rounded-md border ${borderCls} bg-zinc-900 overflow-hidden`}>
      {/* trigger row */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono text-white/90 flex-1 truncate">{ep.path}</code>
        <span className="text-sm text-zinc-400 hidden sm:block truncate max-w-xs">{ep.summary}</span>
        <svg className={`size-4 text-zinc-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-4">
          {ep.description && (
            <p className="text-sm text-zinc-400">{ep.description}</p>
          )}

          {/* parameters */}
          {ep.parameters.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Parameters</p>
              <div className="rounded border border-white/10 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-800 border-b border-white/10">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-1/4">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-16">In</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-20">Type</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ep.parameters.map((p) => (
                      <tr key={`${p.in}-${p.name}`}>
                        <td className="px-3 py-2">
                          <code className="text-xs font-mono text-white/90">{p.name}</code>
                          {p.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">{p.in}</span>
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-zinc-400">{p.type}</td>
                        <td className="px-3 py-2 text-xs text-zinc-500">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* request body with generated sample */}
          {ep.bodyType && (
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">
                Request body{" "}
                <span className="font-normal normal-case text-zinc-600">({ep.bodyType})</span>
              </p>
              <pre className="rounded border border-white/10 bg-zinc-950 px-3 py-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                {ep.bodySample ?? "{}"}
              </pre>
            </div>
          )}

          {/* responses */}
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Responses</p>
            <div className="space-y-1.5">
              {ep.responses.map((r) => (
                <div key={r.code} className="flex items-center gap-3 rounded border border-white/10 bg-zinc-950 px-3 py-2">
                  <StatusBadge code={r.code} />
                  <span className="text-xs text-zinc-400">{r.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── source tab ───────────────────────────────────────────────────────────────

function SourceTab({ yamlValue, setYamlValue, hosts, host }: {
  yamlValue:    string
  setYamlValue: (v: string) => void
  hosts:        Record<string, string>
  host:         string
}) {
  const endpoints = React.useMemo(() => parseEndpointList(yamlValue), [yamlValue])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* YAML editor */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-white/10">
        <div className="px-4 py-2 text-xs text-zinc-500 border-b border-white/10 bg-zinc-950">YAML</div>
        <textarea
          value={yamlValue}
          onChange={(e) => setYamlValue(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full bg-black text-white font-mono text-xs leading-relaxed px-4 py-4 resize-none focus:outline-none caret-white"
        />
      </div>

      {/* endpoint list */}
      <div className="flex flex-col w-80 shrink-0 overflow-y-auto bg-zinc-950">
        <div className="px-4 py-2 text-xs text-zinc-500 border-b border-white/10 sticky top-0 bg-zinc-950">
          {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
          {host && hosts[host] && (
            <span className="ml-2 text-zinc-700 font-mono text-[11px] truncate">{hosts[host]}</span>
          )}
        </div>
        {endpoints.length === 0 ? (
          <div className="flex items-center justify-center flex-1 text-zinc-600 text-xs p-6 text-center">
            No paths found in spec
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {endpoints.map(({ method, path, summary }, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2.5 hover:bg-white/5">
                <MethodBadge method={method} />
                <div className="min-w-0 mt-0.5">
                  <p className="font-mono text-xs text-white/90 truncate">{path}</p>
                  {summary && <p className="text-[11px] text-zinc-500 truncate">{summary}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ui tab ───────────────────────────────────────────────────────────────────

function UiTab({ yamlValue }: { yamlValue: string }) {
  const { groups, spec } = React.useMemo(() => parseSpec(yamlValue), [yamlValue])

  const definitions = Object.entries(
    spec.definitions ?? spec.components?.schemas ?? {}
  )

  if (groups.length === 0 && definitions.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-600 text-sm">
        No endpoints found in spec
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">
      {/* endpoint groups */}
      {groups.map((group) => (
        <div key={group.tag}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-white">{group.tag}</h2>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-600 shrink-0">
              {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? "s" : ""}
            </span>
          </div>
          {group.description && (
            <p className="text-xs text-zinc-500 mb-3">{group.description}</p>
          )}
          <div className="space-y-2">
            {group.endpoints.map((ep, i) => (
              <EndpointCard key={i} ep={ep} />
            ))}
          </div>
        </div>
      ))}

      {/* definitions / schemas */}
      {definitions.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-semibold text-white">Definitions</h2>
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-600 shrink-0">{definitions.length} model{definitions.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="space-y-4">
            {definitions.map(([name, schema]) => {
              const props    = Object.entries(schema.properties ?? {})
              const required: string[] = (schema as RawSchema & { required?: string[] }).required ?? []
              let sample = ""
              try { sample = JSON.stringify(generateSample(spec, schema), null, 2) } catch { sample = "{}" }

              return (
                <div key={name} className="rounded-md border border-white/10 bg-zinc-900 overflow-hidden">
                  {/* model header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-zinc-800">
                    <span className="text-sm font-mono font-semibold text-white">{name}</span>
                    {schema.type && (
                      <span className="text-xs text-zinc-500 bg-zinc-700 rounded px-1.5 py-0.5">{schema.type}</span>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {/* properties table */}
                    {props.length > 0 && (
                      <div className="rounded border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-800 border-b border-white/10">
                              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-1/4">Property</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-32">Type</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400 w-20">Required</th>
                              <th className="text-left px-3 py-2 text-xs font-semibold text-zinc-400">Enum / Format</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {props.map(([propName, propSchema]) => (
                              <tr key={propName}>
                                <td className="px-3 py-2">
                                  <code className="text-xs font-mono text-white/90">{propName}</code>
                                </td>
                                <td className="px-3 py-2 text-xs font-mono text-zinc-400">
                                  {schemaType(spec, propSchema)}
                                </td>
                                <td className="px-3 py-2 text-xs">
                                  {required.includes(propName)
                                    ? <span className="text-red-400">yes</span>
                                    : <span className="text-zinc-600">no</span>}
                                </td>
                                <td className="px-3 py-2 text-xs text-zinc-500">
                                  {propSchema.enum ? propSchema.enum.join(" | ") : propSchema.format ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* sample */}
                    <div>
                      <p className="text-xs text-zinc-600 mb-1">Sample</p>
                      <pre className="rounded border border-white/10 bg-zinc-950 px-3 py-3 text-xs font-mono text-green-300 overflow-x-auto whitespace-pre-wrap">
                        {sample}
                      </pre>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ApiDetailPage({ loaderData }: Route.ComponentProps) {
  const { api, yamlStr: initialYaml } = loaderData
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const saving     = navigation.state === "submitting"

  const [activeTab, setActiveTab] = React.useState<"source" | "ui">("source")
  const [yamlValue, setYamlValue] = React.useState(initialYaml)
  const [scope,     setScope]     = React.useState(api.scope ?? "")
  const [editScope, setEditScope] = React.useState(false)
  const [host,      setHost]      = React.useState("")

  const hosts    = React.useMemo(() => parseHosts(yamlValue), [yamlValue])
  const hostKeys = Object.keys(hosts)

  React.useEffect(() => {
    if (!host && hostKeys.length > 0) setHost(hostKeys[0])
  }, [hostKeys.join(",")])

  React.useEffect(() => {
    if (actionData && "ok"    in actionData) toast.success("Saved")
    if (actionData && "error" in actionData) toast.error((actionData as { error: string }).error)
  }, [actionData])

  return (
    <div className="flex flex-col bg-black text-white min-h-svh h-full">

      {/* ── header ─────────────────────────────────────────────────────────── */}
      <Form method="post">
        <input type="hidden" name="yaml"  value={yamlValue} />
        <input type="hidden" name="scope" value={scope}     />

        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-zinc-950 sticky top-0 z-10 min-w-0">
          <Link to="/apis" className="text-zinc-400 hover:text-white text-sm shrink-0">← APIs</Link>
          <span className="text-white/20 shrink-0">/</span>
          <h1 className="text-sm font-semibold text-white truncate">{api.displayName}</h1>
          <span className="text-xs text-zinc-600 font-mono shrink-0">{api.specType}</span>

          <div className="flex-1" />

          {/* scope */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-zinc-500">scope</span>
            {editScope ? (
              <input
                autoFocus
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                onBlur={() => setEditScope(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditScope(false)}
                className="bg-zinc-800 border border-white/20 rounded px-2 py-0.5 text-xs text-white w-28 focus:outline-none focus:border-white/50"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditScope(true)}
                className="text-xs text-white bg-zinc-800 border border-white/20 rounded px-2 py-0.5 hover:border-white/40"
              >
                {scope || <span className="text-zinc-500">—</span>}
                <span className="ml-1.5 text-zinc-600">✎</span>
              </button>
            )}
          </div>

          {/* host */}
          {hostKeys.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-zinc-500">host</span>
              <select
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="bg-zinc-800 border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-white/50"
              >
                {hostKeys.map((k) => (
                  <option key={k} value={k}>{k} — {hosts[k]}</option>
                ))}
              </select>
            </div>
          )}

          {/* save */}
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 rounded bg-white text-black text-xs font-semibold px-4 py-1.5 hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Form>

      {/* ── tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/10 px-5 bg-zinc-950 shrink-0">
        {(["source", "ui"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "border-b-2 px-4 pb-2 pt-2 text-xs font-medium capitalize transition-colors",
              activeTab === tab
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            {tab === "ui" ? "Preview" : "Source"}
          </button>
        ))}
      </div>

      {/* ── tab content ────────────────────────────────────────────────────── */}
      {activeTab === "source" && (
        <SourceTab
          yamlValue={yamlValue}
          setYamlValue={setYamlValue}
          hosts={hosts}
          host={host}
        />
      )}
      {activeTab === "ui" && (
        <UiTab yamlValue={yamlValue} />
      )}
    </div>
  )
}

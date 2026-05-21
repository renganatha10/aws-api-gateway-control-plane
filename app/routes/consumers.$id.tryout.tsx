import { useCallback, useEffect, useState } from "react"
import { Link, useFetcher, useLoaderData } from "react-router"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  Plus,
  Send,
  Trash2,
} from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { findConsumerWithDetailById } from "~/repositories/consumer.repository.server"
import { listApisWithSpecByProduct } from "~/repositories/api-association.repository.server"
import { listDeploymentsByProduct } from "~/repositories/product-deployment.repository.server"
import { Badge } from "~/components/ui/badge"
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
import { Textarea } from "~/components/ui/textarea"
import type { Route } from "./+types/consumers.$id.tryout"

export function meta({ data }: Route.MetaArgs) {
  const name = (data as { consumer?: { name?: string } })?.consumer?.name
  return [{ title: name ? `Try Out — ${name}` : "Try Out" }]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request)
  await getActiveGatewayId(request)

  const consumer = await findConsumerWithDetailById(Number(params.id))
  if (!consumer) throw new Response("Not found", { status: 404 })

  const [productApis, deployments] = await Promise.all([
    listApisWithSpecByProduct(consumer.productId),
    listDeploymentsByProduct(consumer.productId),
  ])

  const invokeUrl =
    deployments.find((d) => d.environmentId === consumer.environmentId)?.invokeUrl ?? null

  return { consumer, productApis, invokeUrl }
}

// ── Spec parsing ──────────────────────────────────────────────────────────────

const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"] as const
type HttpMethod = (typeof HTTP_METHODS)[number]

interface SpecParam {
  name: string
  in: "path" | "query" | "header" | "body" | "formData" | "cookie"
  required?: boolean
  description?: string
}

interface ParsedEndpoint {
  method: HttpMethod
  path: string
  summary?: string
  operationId?: string
  pathParams: string[]
  queryParams: SpecParam[]
  hasBody: boolean
}

function parseEndpoints(spec: Record<string, unknown>): ParsedEndpoint[] {
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>
  const endpoints: ParsedEndpoint[] = []

  for (const [path, methods] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = methods[method] as Record<string, unknown> | undefined
      if (!op) continue

      const params = (op.parameters ?? []) as SpecParam[]
      const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
      const queryParams = params.filter((p) => p.in === "query")
      const hasBody =
        ["post", "put", "patch"].includes(method) ||
        params.some((p) => p.in === "body" || p.in === "formData") ||
        !!(op.requestBody)

      endpoints.push({
        method,
        path,
        summary:     (op.summary as string | undefined) || (op.operationId as string | undefined),
        operationId: op.operationId as string | undefined,
        pathParams,
        queryParams,
        hasBody,
      })
    }
  }

  return endpoints
}

// ── Helper: copy to clipboard ─────────────────────────────────────────────────

function useCopy(value: string) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [value])
  return { copied, copy }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CopyButton({ value, size = "sm" }: { value: string; size?: "sm" | "xs" }) {
  const { copied, copy } = useCopy(value)
  return (
    <button
      onClick={copy}
      title="Copy"
      className={`text-gray-400 hover:text-gray-700 transition-colors ${size === "xs" ? "p-0.5" : "p-1"}`}
    >
      {copied
        ? <Check className={size === "xs" ? "size-3" : "size-3.5"} />
        : <Copy className={size === "xs" ? "size-3" : "size-3.5"} />}
    </button>
  )
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    get:    "bg-blue-50 text-blue-700 border-blue-200",
    post:   "bg-green-50 text-green-700 border-green-200",
    put:    "bg-yellow-50 text-yellow-700 border-yellow-200",
    patch:  "bg-orange-50 text-orange-700 border-orange-200",
    delete: "bg-red-50 text-red-700 border-red-200",
    head:   "bg-purple-50 text-purple-700 border-purple-200",
    options:"bg-gray-50 text-gray-700 border-gray-200",
  }
  const cls = colors[method.toLowerCase()] ?? "bg-gray-50 text-gray-700 border-gray-200"
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold uppercase ${cls}`}>
      {method.toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: number }) {
  let cls = ""
  if (status >= 200 && status < 300) cls = "bg-green-50 text-green-700 border-green-300"
  else if (status >= 300 && status < 400) cls = "bg-yellow-50 text-yellow-700 border-yellow-300"
  else if (status >= 400 && status < 500) cls = "bg-orange-50 text-orange-700 border-orange-300"
  else cls = "bg-red-50 text-red-700 border-red-300"

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-sm font-semibold ${cls}`}>
      <span className={`size-2 rounded-full ${status < 300 ? "bg-green-500" : status < 400 ? "bg-yellow-500" : status < 500 ? "bg-orange-500" : "bg-red-500"}`} />
      {status}
    </span>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{children}</h3>
  )
}

// ── Key-value row editor ──────────────────────────────────────────────────────

interface KVRow { key: string; value: string }

function KVEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: {
  rows: KVRow[]
  onChange: (rows: KVRow[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            value={row.key}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...next[i], key: e.target.value }
              onChange(next)
            }}
            placeholder={keyPlaceholder}
            className="h-8 text-sm font-mono"
          />
          <Input
            value={row.value}
            onChange={(e) => {
              const next = [...rows]
              next[i] = { ...next[i], value: e.target.value }
              onChange(next)
            }}
            placeholder={valuePlaceholder}
            className="h-8 text-sm font-mono"
          />
          <button
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, { key: "", value: "" }])}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <Plus className="size-3.5" />
        Add row
      </button>
    </div>
  )
}

// ── Response viewer ───────────────────────────────────────────────────────────

interface ProxyResponse {
  httpStatus: number
  statusText: string
  resHeaders: Record<string, string>
  resBody: string
  ms: number
}

function ResponsePanel({ data }: { data: ProxyResponse }) {
  const [headersOpen, setHeadersOpen] = useState(false)

  let prettyBody = data.resBody
  const contentType = data.resHeaders["content-type"] ?? ""
  if (contentType.includes("json")) {
    try { prettyBody = JSON.stringify(JSON.parse(data.resBody), null, 2) } catch { /* keep raw */ }
  }

  const bodyBg =
    data.httpStatus >= 200 && data.httpStatus < 300 ? "bg-green-50 border-green-200" :
    data.httpStatus >= 400 && data.httpStatus < 500 ? "bg-orange-50 border-orange-200" :
    data.httpStatus >= 500                          ? "bg-red-50 border-red-200"       :
                                                     "bg-gray-50 border-gray-200"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <StatusBadge status={data.httpStatus} />
        <span className="text-sm text-gray-500">{data.statusText}</span>
        <span className="text-xs text-gray-400 ml-auto">{data.ms}ms</span>
      </div>

      <div>
        <button
          onClick={() => setHeadersOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-1"
        >
          {headersOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          Response headers ({Object.keys(data.resHeaders).length})
        </button>
        {headersOpen && (
          <div className="rounded border border-gray-200 bg-gray-50 p-3 space-y-1 text-xs font-mono">
            {Object.entries(data.resHeaders).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-gray-500 shrink-0">{k}:</span>
                <span className="text-gray-800 break-all">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`rounded border p-4 text-xs font-mono whitespace-pre-wrap break-all ${bodyBg}`}>
        {prettyBody || <span className="text-gray-400 italic">Empty response body</span>}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsumerTryout() {
  const { consumer, productApis, invokeUrl } = useLoaderData<typeof loader>()

  const tokenFetcher = useFetcher<{
    access_token?: string; expires_in?: number; token_type?: string; error?: string
  }>()
  const proxyFetcher = useFetcher<ProxyResponse & { error?: string }>()

  // ── Credentials state
  const [token, setToken]           = useState("")
  const [tokenVisible, setTokenVisible] = useState(false)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const apiKeyValue = consumer.clientId ?? ""

  useEffect(() => {
    if (tokenFetcher.data?.access_token) setToken(tokenFetcher.data.access_token)
  }, [tokenFetcher.data])

  // ── Request state
  const [selectedApiId, setSelectedApiId] = useState<string>(
    productApis.length === 1 ? String(productApis[0].id) : "",
  )
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("")
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [queryRows, setQueryRows]   = useState<KVRow[]>([])
  const [headerRows, setHeaderRows] = useState<KVRow[]>([])
  const [body, setBody]             = useState("")

  const selectedApi = productApis.find((a) => String(a.id) === selectedApiId)
  const endpoints: ParsedEndpoint[] = selectedApi
    ? parseEndpoints((selectedApi.spec as unknown) as Record<string, unknown>)
    : []

  const currentEndpoint = endpoints.find(
    (e) => `${e.method} ${e.path}` === selectedEndpoint,
  )

  // Reset endpoint + path params when API changes
  useEffect(() => {
    setSelectedEndpoint("")
    setPathParams({})
  }, [selectedApiId])

  // Seed path-param inputs when endpoint changes
  useEffect(() => {
    if (!currentEndpoint) { setPathParams({}); return }
    setPathParams(
      Object.fromEntries(currentEndpoint.pathParams.map((p) => [p, pathParams[p] ?? ""])),
    )
    // Seed query rows from spec if not already set
    if (currentEndpoint.queryParams.length > 0 && queryRows.length === 0) {
      setQueryRows(currentEndpoint.queryParams.map((q) => ({ key: q.name, value: "" })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEndpoint])

  function buildRequestUrl(): string {
    if (!invokeUrl || !currentEndpoint) return ""
    let path = currentEndpoint.path
    for (const [k, v] of Object.entries(pathParams)) {
      path = path.replace(`{${k}}`, encodeURIComponent(v))
    }
    const qs = queryRows
      .filter((r) => r.key.trim())
      .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
      .join("&")
    return `${invokeUrl}${path}${qs ? `?${qs}` : ""}`
  }

  function handleSend() {
    if (!invokeUrl || !currentEndpoint) return
    const url = buildRequestUrl()

    const headers: Record<string, string> = {}
    if (token)       headers["Authorization"] = `Bearer ${token}`
    if (apiKeyValue) headers["x-api-key"]     = apiKeyValue
    for (const { key, value } of headerRows) {
      if (key.trim()) headers[key.trim()] = value
    }
    const hasBody = ["post", "put", "patch"].includes(currentEndpoint.method)
    if (hasBody && body.trim()) {
      headers["Content-Type"] = "application/json"
    }

    const payload: Record<string, unknown> = {
      consumerId: consumer.id,
      method:     currentEndpoint.method.toUpperCase(),
      url,
      headers,
    }
    if (hasBody && body.trim()) payload.body = body

    proxyFetcher.submit(
      payload as unknown as Record<string, string>,
      { method: "post", action: "/api/consumer-proxy", encType: "application/json" },
    )
  }

  const isSending = proxyFetcher.state !== "idle"
  const requestUrl = buildRequestUrl()
  const canSend = !!invokeUrl && !!currentEndpoint

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
        <Link
          to="/consumers"
          className="text-gray-400 hover:text-gray-700 transition-colors"
          title="Back to Consumers"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <FlaskConical className="size-5 text-blue-600" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">Try Out — {consumer.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            {consumer.productName}
          </Badge>
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            {consumer.environmentName}
          </Badge>
          <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
            {consumer.planName}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

          {!invokeUrl && (
            <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              This product has not been deployed to the consumer's stage yet. Publish the product first.
            </div>
          )}

          {/* ── Credentials ────────────────────────────────────────────────── */}
          <section className="rounded-lg border border-gray-200 p-5 space-y-4">
            <SectionHeader>Credentials</SectionHeader>

            {/* Token */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">OAuth2 Token</Label>
              {consumer.tokenUrl ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400 font-mono truncate max-w-xs" title={consumer.tokenUrl}>
                    {consumer.tokenUrl}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-3"
                    disabled={tokenFetcher.state !== "idle"}
                    onClick={() => tokenFetcher.load(`/api/consumer-token/${consumer.id}`)}
                  >
                    {tokenFetcher.state !== "idle" ? "Fetching…" : "Get Token"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No token URL configured.</p>
              )}

              {tokenFetcher.data?.error && (
                <p className="text-xs text-destructive">{tokenFetcher.data.error}</p>
              )}

              {token && (
                <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
                  <span className="font-mono text-xs text-gray-800 flex-1 truncate select-all">
                    {tokenVisible ? token : "•".repeat(Math.min(token.length, 48))}
                  </span>
                  <button
                    onClick={() => setTokenVisible((v) => !v)}
                    className="text-gray-400 hover:text-gray-700 flex-shrink-0"
                  >
                    {tokenVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <CopyButton value={token} size="xs" />
                </div>
              )}
            </div>

            {/* API Key */}
            {apiKeyValue && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">API Key (x-api-key)</Label>
                <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
                  <span className="font-mono text-xs text-gray-800 flex-1 truncate select-all">
                    {apiKeyVisible ? apiKeyValue : "•".repeat(Math.min(apiKeyValue.length, 32))}
                  </span>
                  <button
                    onClick={() => setApiKeyVisible((v) => !v)}
                    className="text-gray-400 hover:text-gray-700 flex-shrink-0"
                  >
                    {apiKeyVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <CopyButton value={apiKeyValue} size="xs" />
                </div>
              </div>
            )}
          </section>

          {/* ── Request Builder ─────────────────────────────────────────────── */}
          <section className="rounded-lg border border-gray-200 p-5 space-y-5">
            <SectionHeader>Request</SectionHeader>

            {/* API selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-600">API</Label>
              {productApis.length === 0 ? (
                <p className="text-xs text-muted-foreground">No APIs associated with this product.</p>
              ) : (
                <Select value={selectedApiId} onValueChange={setSelectedApiId}>
                  <SelectTrigger className="max-w-sm h-9">
                    <SelectValue placeholder="Select an API…" />
                  </SelectTrigger>
                  <SelectContent>
                    {productApis.map((api) => (
                      <SelectItem key={api.id} value={String(api.id)}>
                        {api.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Endpoint selector */}
            {selectedApi && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Endpoint</Label>
                {endpoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No endpoints found in spec.</p>
                ) : (
                  <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                    <SelectTrigger className="max-w-lg h-9 font-mono text-xs">
                      <SelectValue placeholder="Select an endpoint…" />
                    </SelectTrigger>
                    <SelectContent>
                      {endpoints.map((e) => (
                        <SelectItem
                          key={`${e.method} ${e.path}`}
                          value={`${e.method} ${e.path}`}
                          className="font-mono text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <MethodBadge method={e.method} />
                            <span>{e.path}</span>
                            {e.summary && <span className="text-gray-400 truncate max-w-[180px]">— {e.summary}</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* URL preview */}
            {currentEndpoint && (
              <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
                <MethodBadge method={currentEndpoint.method} />
                <span className="font-mono text-xs text-gray-700 flex-1 break-all">{requestUrl || "(fill path params)"}</span>
                {requestUrl && <CopyButton value={requestUrl} size="xs" />}
              </div>
            )}

            {/* Path params */}
            {currentEndpoint && currentEndpoint.pathParams.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Path Parameters</Label>
                <div className="space-y-2">
                  {currentEndpoint.pathParams.map((param) => (
                    <div key={param} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-600 w-28 shrink-0">{`{${param}}`}</span>
                      <Input
                        value={pathParams[param] ?? ""}
                        onChange={(e) =>
                          setPathParams((prev) => ({ ...prev, [param]: e.target.value }))
                        }
                        placeholder={`value for ${param}`}
                        className="h-8 text-sm font-mono max-w-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Query params */}
            {currentEndpoint && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Query Parameters</Label>
                <KVEditor
                  rows={queryRows}
                  onChange={setQueryRows}
                  keyPlaceholder="param"
                  valuePlaceholder="value"
                />
              </div>
            )}

            {/* Headers */}
            {currentEndpoint && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Headers</Label>
                <div className="space-y-1.5 mb-2">
                  {token && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 w-32 shrink-0">Authorization</span>
                      <span className="text-xs font-mono text-gray-500 truncate">Bearer {token.substring(0, 20)}…</span>
                      <span className="text-xs text-gray-400 italic">(auto)</span>
                    </div>
                  )}
                  {apiKeyValue && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400 w-32 shrink-0">x-api-key</span>
                      <span className="text-xs font-mono text-gray-500 truncate">{apiKeyValue.substring(0, 20)}…</span>
                      <span className="text-xs text-gray-400 italic">(auto)</span>
                    </div>
                  )}
                </div>
                <KVEditor
                  rows={headerRows}
                  onChange={setHeaderRows}
                  keyPlaceholder="Header-Name"
                  valuePlaceholder="value"
                />
              </div>
            )}

            {/* Body */}
            {currentEndpoint?.hasBody && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-600">Request Body (JSON)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={'{\n  "key": "value"\n}'}
                  className="font-mono text-xs min-h-[120px] resize-y"
                />
              </div>
            )}

            {/* Send button */}
            {currentEndpoint && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSend}
                  disabled={!canSend || isSending}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="size-4" />
                  {isSending ? "Sending…" : "Send Request"}
                </Button>
              </div>
            )}
          </section>

          {/* ── Response ───────────────────────────────────────────────────── */}
          {(proxyFetcher.data || isSending) && (
            <section className="rounded-lg border border-gray-200 p-5 space-y-4">
              <SectionHeader>Response</SectionHeader>
              {isSending && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="size-2 rounded-full bg-blue-400 animate-pulse" />
                  Waiting for response…
                </div>
              )}
              {!isSending && proxyFetcher.data && (
                <>
                  {proxyFetcher.data.error ? (
                    <p className="text-sm text-destructive">{proxyFetcher.data.error}</p>
                  ) : (
                    <ResponsePanel data={proxyFetcher.data as ProxyResponse} />
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

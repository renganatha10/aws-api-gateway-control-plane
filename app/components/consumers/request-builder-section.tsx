import { useEffect, useState } from "react"
import { useFetcher } from "react-router"
import { Send } from "lucide-react"

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
import { CopyButton } from "./copy-button"
import { KVEditor } from "./kv-editor"
import { MethodBadge } from "./method-badge"
import { ResponsePanel } from "./response-panel"
import { parseEndpoints } from "./parse-endpoints"
import type { KVRow, ParsedEndpoint, ProxyResponse } from "./tryout-types"

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
      {children}
    </h3>
  )
}

interface ProductApi {
  id: number
  displayName: string
  spec: unknown
}

interface RequestBuilderSectionProps {
  productApis: ProductApi[]
  invokeUrl: string | null
  token: string
  apiKeyValue: string
}

export function RequestBuilderSection({
  productApis,
  invokeUrl,
  token,
  apiKeyValue,
}: RequestBuilderSectionProps) {
  const proxyFetcher = useFetcher<ProxyResponse & { error?: string }>()

  const [selectedApiId, setSelectedApiId] = useState<string>(
    productApis.length === 1 ? String(productApis[0].id) : "",
  )
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("")
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [queryRows, setQueryRows] = useState<KVRow[]>([])
  const [headerRows, setHeaderRows] = useState<KVRow[]>([])
  const [body, setBody] = useState("")

  const selectedApi = productApis.find((a) => String(a.id) === selectedApiId)
  const endpoints: ParsedEndpoint[] = selectedApi
    ? parseEndpoints(selectedApi.spec as Record<string, unknown>)
    : []

  const currentEndpoint = endpoints.find((e) => `${e.method} ${e.path}` === selectedEndpoint)

  useEffect(() => {
    setSelectedEndpoint("")
    setPathParams({})
  }, [selectedApiId])

  useEffect(() => {
    if (!currentEndpoint) { setPathParams({}); return }
    setPathParams(
      Object.fromEntries(currentEndpoint.pathParams.map((p) => [p, pathParams[p] ?? ""])),
    )
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
    if (hasBody && body.trim()) headers["Content-Type"] = "application/json"

    const payload: Record<string, unknown> = {
      consumerId: undefined,
      method:     currentEndpoint.method.toUpperCase(),
      url,
      headers,
    }
    if (hasBody && body.trim()) payload.body = body

    proxyFetcher.submit(payload as unknown as Record<string, string>, {
      method: "post",
      action: "/api/consumer-proxy",
      encType: "application/json",
    })
  }

  const isSending = proxyFetcher.state !== "idle"
  const requestUrl = buildRequestUrl()
  const canSend = !!invokeUrl && !!currentEndpoint

  return (
    <>
      <section className="rounded-lg border border-gray-200 p-5 space-y-5">
        <SectionHeader>Request</SectionHeader>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-600">API</Label>
          {productApis.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No APIs associated with this product.
            </p>
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
                        {e.summary && (
                          <span className="text-gray-400 truncate max-w-[180px]">
                            — {e.summary}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {currentEndpoint && (
          <div className="flex items-center gap-2 rounded bg-gray-50 border border-gray-200 px-3 py-2">
            <MethodBadge method={currentEndpoint.method} />
            <span className="font-mono text-xs text-gray-700 flex-1 break-all">
              {requestUrl || "(fill path params)"}
            </span>
            {requestUrl && <CopyButton value={requestUrl} size="xs" />}
          </div>
        )}

        {currentEndpoint && currentEndpoint.pathParams.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Path Parameters</Label>
            <div className="space-y-2">
              {currentEndpoint.pathParams.map((param) => (
                <div key={param} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-600 w-28 shrink-0">
                    {`{${param}}`}
                  </span>
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

        {currentEndpoint && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-600">Headers</Label>
            <div className="space-y-1.5 mb-2">
              {token && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-32 shrink-0">
                    Authorization
                  </span>
                  <span className="text-xs font-mono text-gray-500 truncate">
                    Bearer {token.substring(0, 20)}…
                  </span>
                  <span className="text-xs text-gray-400 italic">(auto)</span>
                </div>
              )}
              {apiKeyValue && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-32 shrink-0">x-api-key</span>
                  <span className="text-xs font-mono text-gray-500 truncate">
                    {apiKeyValue.substring(0, 20)}…
                  </span>
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

        {currentEndpoint && (
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSend}
              disabled={!canSend || isSending}
              className="gap-2 bg-black hover:bg-gray-900 text-white"
            >
              <Send className="size-4" />
              {isSending ? "Sending…" : "Send Request"}
            </Button>
          </div>
        )}
      </section>

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
    </>
  )
}

import { useState } from "react"
import { Link, useParams } from "react-router"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
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
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import type { Route } from "./+types/apis.$id"

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `${params.id} — API` }]
}

// ─── types ────────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface Parameter {
  name: string
  in: "path" | "query" | "header" | "body"
  type: string
  required: boolean
  description: string
  example?: string
}

interface ResponseDef {
  code: string
  description: string
  example?: string
}

interface Endpoint {
  method: HttpMethod
  path: string
  summary: string
  description?: string
  parameters: Parameter[]
  requestBody?: { contentType: string; schema: string }
  responses: ResponseDef[]
}

interface EndpointGroup {
  tag: string
  description?: string
  endpoints: Endpoint[]
}

// ─── colours per method ───────────────────────────────────────────────────────

const METHOD_STYLE: Record<HttpMethod, { bg: string; text: string; border: string; light: string }> = {
  GET:    { bg: "bg-blue-600",   text: "text-white", border: "border-blue-600",   light: "bg-blue-50 border-blue-200"   },
  POST:   { bg: "bg-green-600",  text: "text-white", border: "border-green-600",  light: "bg-green-50 border-green-200"  },
  PUT:    { bg: "bg-amber-500",  text: "text-white", border: "border-amber-500",  light: "bg-amber-50 border-amber-200"  },
  DELETE: { bg: "bg-red-600",    text: "text-white", border: "border-red-600",    light: "bg-red-50 border-red-200"    },
  PATCH:  { bg: "bg-purple-600", text: "text-white", border: "border-purple-600", light: "bg-purple-50 border-purple-200" },
}

// ─── sample OpenAPI spec ───────────────────────────────────────────────────────

const SPEC_GROUPS: EndpointGroup[] = [
  {
    tag: "Authentication",
    description: "Endpoints for obtaining and managing access tokens",
    endpoints: [
      {
        method: "POST", path: "/auth/token", summary: "Obtain access token",
        description: "Authenticates user credentials using OAuth 2 client credentials flow and returns a bearer token.",
        parameters: [],
        requestBody: {
          contentType: "application/json",
          schema: `{\n  "grant_type": "client_credentials",\n  "client_id": "string",\n  "client_secret": "string"\n}`,
        },
        responses: [
          { code: "200", description: "Access token issued successfully", example: `{\n  "access_token": "eyJhbGciOiJSUzI1NiJ9...",\n  "token_type": "Bearer",\n  "expires_in": 3600\n}` },
          { code: "401", description: "Invalid client credentials" },
          { code: "400", description: "Bad request — missing required fields" },
        ],
      },
      {
        method: "POST", path: "/auth/refresh", summary: "Refresh access token",
        description: "Issues a new access token using a valid refresh token.",
        parameters: [],
        requestBody: {
          contentType: "application/json",
          schema: `{\n  "grant_type": "refresh_token",\n  "refresh_token": "string"\n}`,
        },
        responses: [
          { code: "200", description: "New access token issued", example: `{\n  "access_token": "eyJhbGci...",\n  "expires_in": 3600\n}` },
          { code: "401", description: "Refresh token expired or invalid" },
        ],
      },
      {
        method: "DELETE", path: "/auth/token", summary: "Revoke token",
        description: "Revokes the current bearer token, effectively logging the client out.",
        parameters: [
          { name: "Authorization", in: "header", type: "string", required: true, description: "Bearer token to revoke", example: "Bearer eyJhbGci..." },
        ],
        responses: [
          { code: "204", description: "Token revoked — no content" },
          { code: "401", description: "Unauthorized" },
        ],
      },
    ],
  },
  {
    tag: "Users",
    description: "CRUD operations for portal user accounts",
    endpoints: [
      {
        method: "GET", path: "/users", summary: "List users",
        description: "Returns a paginated list of all portal users.",
        parameters: [
          { name: "page",   in: "query", type: "integer", required: false, description: "Page number (default: 1)",   example: "1"  },
          { name: "limit",  in: "query", type: "integer", required: false, description: "Items per page (default: 20)", example: "20" },
          { name: "search", in: "query", type: "string",  required: false, description: "Filter by name or email"                    },
        ],
        responses: [
          { code: "200", description: "Paginated user list", example: `{\n  "total": 42,\n  "page": 1,\n  "data": [\n    { "id": "usr_01", "email": "john@example.com", "name": "John Doe" }\n  ]\n}` },
          { code: "401", description: "Unauthorized" },
        ],
      },
      {
        method: "POST", path: "/users", summary: "Create user",
        description: "Creates a new portal user account.",
        parameters: [],
        requestBody: {
          contentType: "application/json",
          schema: `{\n  "email": "string",\n  "name": "string",\n  "role": "admin | viewer"\n}`,
        },
        responses: [
          { code: "201", description: "User created", example: `{\n  "id": "usr_01",\n  "email": "jane@example.com",\n  "name": "Jane Smith",\n  "role": "viewer"\n}` },
          { code: "409", description: "Email already registered" },
          { code: "400", description: "Validation error" },
        ],
      },
      {
        method: "GET", path: "/users/{id}", summary: "Get user by ID",
        description: "Returns a single user record.",
        parameters: [
          { name: "id", in: "path", type: "string", required: true, description: "Unique user identifier", example: "usr_01" },
        ],
        responses: [
          { code: "200", description: "User found", example: `{\n  "id": "usr_01",\n  "email": "john@example.com",\n  "name": "John Doe",\n  "role": "admin"\n}` },
          { code: "404", description: "User not found" },
        ],
      },
      {
        method: "PUT", path: "/users/{id}", summary: "Update user",
        description: "Updates an existing user's details.",
        parameters: [
          { name: "id", in: "path", type: "string", required: true, description: "User ID", example: "usr_01" },
        ],
        requestBody: {
          contentType: "application/json",
          schema: `{\n  "name": "string",\n  "role": "admin | viewer"\n}`,
        },
        responses: [
          { code: "200", description: "User updated successfully" },
          { code: "404", description: "User not found" },
        ],
      },
      {
        method: "DELETE", path: "/users/{id}", summary: "Delete user",
        description: "Permanently removes a user account.",
        parameters: [
          { name: "id", in: "path", type: "string", required: true, description: "User ID to delete", example: "usr_01" },
        ],
        responses: [
          { code: "204", description: "User deleted — no content" },
          { code: "404", description: "User not found" },
        ],
      },
    ],
  },
  {
    tag: "Sessions",
    description: "Active session management",
    endpoints: [
      {
        method: "GET", path: "/sessions", summary: "List active sessions",
        parameters: [
          { name: "user_id", in: "query", type: "string", required: false, description: "Filter sessions by user" },
        ],
        responses: [
          { code: "200", description: "Session list returned" },
          { code: "401", description: "Unauthorized" },
        ],
      },
      {
        method: "DELETE", path: "/sessions/{sessionId}", summary: "Terminate session",
        parameters: [
          { name: "sessionId", in: "path", type: "string", required: true, description: "Session identifier" },
        ],
        responses: [
          { code: "204", description: "Session terminated" },
          { code: "404", description: "Session not found" },
        ],
      },
    ],
  },
]

const SERVERS = [
  { label: "Production",   url: "https://api.company.com/v1"         },
  { label: "Staging",      url: "https://api-staging.company.com/v1" },
  { label: "Development",  url: "https://api-dev.company.com/v1"     },
]

const ENV_ROWS = [
  { env: "Production",  proxyUrl: "https://api.company.com/v1",         key: "prod"    },
  { env: "Staging",     proxyUrl: "https://api-staging.company.com/v1", key: "staging" },
  { env: "Development", proxyUrl: "https://api-dev.company.com/v1",     key: "dev"     },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: HttpMethod }) {
  const s = METHOD_STYLE[method]
  return (
    <span className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold tracking-wider ${s.bg} ${s.text} min-w-[56px]`}>
      {method}
    </span>
  )
}

function ResponseCodeBadge({ code }: { code: string }) {
  const c = parseInt(code)
  const cls =
    c < 300 ? "bg-green-100 text-green-800 border-green-200" :
    c < 400 ? "bg-blue-100 text-blue-800 border-blue-200"   :
    c < 500 ? "bg-amber-100 text-amber-800 border-amber-200" :
              "bg-red-100 text-red-800 border-red-200"
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-mono font-semibold ${cls}`}>
      {code}
    </span>
  )
}

// ─── try-it-out mini panel ────────────────────────────────────────────────────

function TryItOut({ endpoint, serverUrl }: { endpoint: Endpoint; serverUrl: string }) {
  const [params, setParams] = useState<Record<string, string>>({})
  const [body, setBody] = useState(endpoint.requestBody?.schema ?? "")
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resolvedPath = endpoint.path.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`)
  const queryString = endpoint.parameters
    .filter((p) => p.in === "query" && params[p.name])
    .map((p) => `${p.name}=${encodeURIComponent(params[p.name])}`)
    .join("&")
  const fullUrl = `${serverUrl}${resolvedPath}${queryString ? "?" + queryString : ""}`

  function handleExecute() {
    setLoading(true)
    setTimeout(() => {
      const first200 = endpoint.responses.find((r) => r.code.startsWith("2"))
      setResponse(first200?.example ?? `HTTP ${first200?.code ?? "200"} ${first200?.description ?? "OK"}`)
      setLoading(false)
    }, 800)
  }

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 space-y-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Try it out</p>

      {/* URL preview */}
      <div className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-700 overflow-x-auto">
        <MethodBadge method={endpoint.method} />
        <span className="truncate">{fullUrl}</span>
      </div>

      {/* Path / query params */}
      {endpoint.parameters.filter((p) => p.in !== "header").length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">Parameters</p>
          {endpoint.parameters.filter((p) => p.in !== "header").map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <Label className="w-28 text-xs text-gray-600 shrink-0">
                {p.name}
                {p.required && <span className="text-red-500 ml-0.5">*</span>}
                <span className="ml-1 text-gray-400">({p.in})</span>
              </Label>
              <Input
                className="h-7 text-xs"
                placeholder={p.example ?? p.type}
                value={params[p.name] ?? ""}
                onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Request body */}
      {endpoint.requestBody && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">Request body <span className="text-gray-400">({endpoint.requestBody.contentType})</span></p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-xs min-h-[80px] bg-white resize-y"
          />
        </div>
      )}

      <Button size="sm" onClick={handleExecute} disabled={loading}>
        {loading ? "Sending…" : "Execute"}
      </Button>

      {/* Response */}
      {response !== null && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">Response</p>
          <pre className="rounded bg-gray-900 text-green-400 text-xs p-3 overflow-x-auto whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ApiDetailPage() {
  const { id } = useParams()

  const [activeTab,   setActiveTab]   = useState<"spec" | "details">("spec")
  const [serverUrl,   setServerUrl]   = useState(SERVERS[0].url)
  const [tryItOpen,   setTryItOpen]   = useState<string | null>(null)
  const [proxyUrls,   setProxyUrls]   = useState<Record<string, string>>(
    Object.fromEntries(ENV_ROWS.map((r) => [r.key, r.proxyUrl])),
  )

  const apiTitle = id
    ? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "API"

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/apis" className="hover:underline">Develop</Link>
        {" /"}
      </div>

      {/* Header */}
      <div className="px-6 pt-1 pb-3">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h1 className="text-2xl font-normal text-gray-900">{id}</h1>
          <Badge variant="outline" className="text-xs">1.0</Badge>
          <Badge className="text-xs bg-green-100 text-green-800 border-green-200 hover:bg-green-100">OpenAPI 2.0 (REST)</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{apiTitle} — authentication and user management endpoints.</p>
      </div>

      {/* Spec / API Details tabs */}
      <div className="flex border-b border-gray-200 px-6">
        {(["spec", "details"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "border-b-2 px-4 pb-2 text-sm font-medium capitalize transition-colors",
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900",
            ].join(" ")}
          >
            {tab === "spec" ? "Spec" : "API Details"}
          </button>
        ))}
      </div>

      {/* ── SPEC TAB ──────────────────────────────────────────────────────── */}
      {activeTab === "spec" && (
        <div className="flex-1 px-6 py-5 max-w-4xl space-y-6">
          {/* Server selector */}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Server</span>
            <Select value={serverUrl} onValueChange={setServerUrl}>
              <SelectTrigger className="flex-1 h-8 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVERS.map((s) => (
                  <SelectItem key={s.url} value={s.url}>
                    <span className="font-medium mr-2">{s.label}</span>
                    <span className="text-muted-foreground text-xs">{s.url}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint groups */}
          {SPEC_GROUPS.map((group) => (
            <div key={group.tag}>
              {/* Tag header */}
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-base font-semibold text-gray-800">{group.tag}</h2>
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">{group.endpoints.length} endpoint{group.endpoints.length > 1 ? "s" : ""}</span>
              </div>
              {group.description && (
                <p className="text-xs text-muted-foreground mb-3">{group.description}</p>
              )}

              {/* Endpoints accordion */}
              <Accordion type="multiple" className="space-y-1.5">
                {group.endpoints.map((ep, idx) => {
                  const key = `${group.tag}-${idx}`
                  const s   = METHOD_STYLE[ep.method]
                  const isTrying = tryItOpen === key
                  return (
                    <AccordionItem
                      key={key}
                      value={key}
                      className={`rounded-md border ${s.light} overflow-hidden`}
                    >
                      <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-black/5 [&>svg]:text-gray-500">
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <MethodBadge method={ep.method} />
                          <code className="text-sm font-mono text-gray-800">{ep.path}</code>
                          <span className="text-sm text-gray-600 hidden sm:block">{ep.summary}</span>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-4 pb-4 pt-1 bg-white border-t border-gray-100">
                        {ep.description && (
                          <p className="text-sm text-gray-600 mb-4">{ep.description}</p>
                        )}

                        {/* Parameters */}
                        {ep.parameters.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Parameters</p>
                            <div className="rounded-md border border-gray-200 overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 w-1/4">Name</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 w-16">In</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 w-16">Type</th>
                                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ep.parameters.map((p) => (
                                    <tr key={p.name} className="border-b border-gray-100 last:border-0">
                                      <td className="px-3 py-2">
                                        <code className="text-xs font-mono text-gray-800">{p.name}</code>
                                        {p.required && <span className="text-red-500 ml-1 text-xs">*</span>}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{p.in}</span>
                                      </td>
                                      <td className="px-3 py-2 text-xs text-gray-500 font-mono">{p.type}</td>
                                      <td className="px-3 py-2 text-xs text-gray-600">
                                        {p.description}
                                        {p.example && <span className="ml-1 text-gray-400">e.g. {p.example}</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Request body */}
                        {ep.requestBody && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Request body <span className="font-normal normal-case text-gray-400">({ep.requestBody.contentType})</span>
                            </p>
                            <pre className="rounded-md border border-gray-200 bg-gray-50 text-xs font-mono p-3 overflow-x-auto text-gray-700">{ep.requestBody.schema}</pre>
                          </div>
                        )}

                        {/* Responses */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Responses</p>
                          <div className="space-y-2">
                            {ep.responses.map((r) => (
                              <div key={r.code} className="rounded-md border border-gray-200 overflow-hidden">
                                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50">
                                  <ResponseCodeBadge code={r.code} />
                                  <span className="text-xs text-gray-600">{r.description}</span>
                                </div>
                                {r.example && (
                                  <pre className="px-3 py-2 text-xs font-mono text-gray-700 overflow-x-auto bg-white border-t border-gray-100">{r.example}</pre>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Try it out toggle */}
                        <Button
                          size="sm"
                          variant={isTrying ? "default" : "outline"}
                          onClick={() => setTryItOpen(isTrying ? null : key)}
                        >
                          {isTrying ? "Close" : "Try it out"}
                        </Button>

                        {isTrying && <TryItOut endpoint={ep} serverUrl={serverUrl} />}
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </div>
          ))}
        </div>
      )}

      {/* ── API DETAILS TAB ────────────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="flex-1 px-6 py-5 max-w-3xl space-y-8">
          {/* General info */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-amber-600">General</h2>
              <Separator className="mt-2" />
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                <p className="font-mono font-medium text-gray-800">{id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Version</p>
                <p className="font-medium text-gray-800">1.0</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                <p className="text-gray-800">OpenAPI 2.0 (REST)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Last modified</p>
                <p className="text-gray-800">3 days ago</p>
              </div>
            </div>
          </div>

          {/* Environment proxy URLs */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-amber-600">Environment Configuration</h2>
              <Separator className="mt-2" />
            </div>
            <p className="text-sm text-muted-foreground">
              Configure the proxy URL and gateway endpoint for each deployment environment.
            </p>

            <div className="space-y-4">
              {ENV_ROWS.map((row) => (
                <div key={row.key} className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">{row.env}</span>
                    <Badge
                      variant="outline"
                      className={
                        row.key === "prod"
                          ? "text-xs border-green-300 text-green-700 bg-green-50"
                          : row.key === "staging"
                          ? "text-xs border-amber-300 text-amber-700 bg-amber-50"
                          : "text-xs border-blue-300 text-blue-700 bg-blue-50"
                      }
                    >
                      {row.key === "prod" ? "production" : row.key === "staging" ? "staging" : "development"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Proxy URL</Label>
                      <Input
                        value={proxyUrls[row.key]}
                        onChange={(e) => setProxyUrls((p) => ({ ...p, [row.key]: e.target.value }))}
                        className="h-8 text-sm font-mono"
                        placeholder="https://..."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Gateway endpoint</Label>
                      <Input
                        defaultValue={`${proxyUrls[row.key]}/${id}`}
                        readOnly
                        className="h-8 text-sm font-mono bg-gray-50 text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button size="sm">Save configuration</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

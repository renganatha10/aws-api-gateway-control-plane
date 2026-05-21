import { useState } from "react"
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation } from "react-router"
import { Plus, X } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import { listApisByGateway } from "~/repositories/api.repository.server"
import { createDomain } from "~/repositories/domain.repository.server"
import { replaceMappings } from "~/repositories/domain-route-mapping.repository.server"
import { createCustomDomain, createBasePathMapping } from "~/aws/custom-domain.server"
import { listIssuedCertificates } from "~/aws/acm.server"
import { extractSubdomain, setCname } from "~/lib/godaddy.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import type { Route } from "./+types/domain-create"

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Domain" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  const gatewayId = await getActiveGatewayId(request)

  const [allApis, certs] = await Promise.all([
    gatewayId ? listApisByGateway(gatewayId) : [],
    listIssuedCertificates().catch(() => []),
  ])

  const apis = allApis.filter((a) => !!a.awsApiId)
  return { apis, certs, gatewayId }
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const createdBy       = getUserProfile(accessToken).email
  const gatewayId       = await getActiveGatewayId(request)

  if (!gatewayId) return { error: "No active gateway selected." }

  const formData       = await request.formData()
  const domainName     = (formData.get("domainName") as string)?.trim().toLowerCase()
  const certificateArn = (formData.get("certificateArn") as string)?.trim()
  const endpointType   = ((formData.get("endpointType") as string) || "REGIONAL") as "REGIONAL" | "EDGE"
  const godaddyDomain  = (formData.get("godaddyDomain") as string)?.trim().toLowerCase() || null

  if (!domainName)     return { error: "Domain name is required." }
  if (!certificateArn) return { error: "Please select a certificate." }

  let mappings: Array<{ apiId: string; stage: string; basePath: string }>
  try {
    mappings = JSON.parse((formData.get("mappings") as string) || "[]")
  } catch {
    return { error: "Invalid mapping data." }
  }

  if (mappings.length === 0) return { error: "At least one route mapping is required." }

  for (const m of mappings) {
    if (!m.apiId)         return { error: "All mappings must have an API selected." }
    if (!m.stage?.trim()) return { error: "All mappings must have a stage." }
  }

  // Load APIs to resolve awsApiId
  const allApis = await listApisByGateway(gatewayId)
  const apiMap  = new Map(allApis.map((a) => [String(a.id), a]))

  for (const m of mappings) {
    if (!apiMap.get(m.apiId)?.awsApiId) {
      return { error: "One or more selected APIs have not been synced to AWS yet." }
    }
  }

  // 1. Create custom domain in AWS
  let awsDomainName: string
  try {
    ;({ awsDomainName } = await createCustomDomain(domainName, certificateArn, endpointType))
  } catch (err) {
    console.error("[domain-create] createCustomDomain failed", err)
    return { error: "Failed to sync with AWS. Please try again." }
  }

  // 2. Create base path mappings in AWS
  try {
    for (const m of mappings) {
      const api = apiMap.get(m.apiId)!
      await createBasePathMapping(domainName, api.awsApiId!, m.stage.trim(), m.basePath.trim() || "(none)")
    }
  } catch (err) {
    console.error("[domain-create] createBasePathMapping failed", err)
    return { error: "Domain created in AWS but route mapping failed. Check AWS console." }
  }

  // 3. GoDaddy CNAME — non-fatal
  if (godaddyDomain) {
    const subdomain = extractSubdomain(domainName, godaddyDomain)
    if (subdomain) {
      try {
        await setCname(godaddyDomain, subdomain, awsDomainName)
      } catch {
        // logged inside setCname
      }
    }
  }

  // 4. Persist to DB
  try {
    const now    = new Date()
    const domain = await createDomain({
      gatewayId,
      domainName,
      certificateArn,
      awsDomainName,
      endpointType,
      godaddyDomain,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    })

    await replaceMappings(
      domain.id,
      mappings.map((m) => ({
        apiId:    Number(m.apiId),
        stage:    m.stage.trim(),
        basePath: m.basePath.trim() || "(none)",
      })),
    )
  } catch (err) {
    console.error("[domain-create] DB save failed", err)
    return { error: "Provisioned in AWS but failed to save record. Please try again." }
  }

  throw redirect("/domains")
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns true if a cert domain covers the custom domain the user typed. */
function certMatchesDomain(certDomain: string, inputDomain: string): boolean {
  if (!inputDomain) return true
  if (certDomain === inputDomain) return true
  if (certDomain.startsWith("*.")) {
    const root = certDomain.slice(2)
    return inputDomain === root || inputDomain.endsWith(`.${root}`)
  }
  return false
}

// ── Mapping row ────────────────────────────────────────────────────────────

type MappingEntry = { key: number; apiId: string; stage: string; basePath: string }

function MappingRow({
  entry,
  apis,
  canRemove,
  onUpdate,
  onRemove,
}: {
  entry: MappingEntry
  apis: { id: number; displayName: string }[]
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

export default function DomainCreatePage() {
  const { apis, certs } = useLoaderData<typeof loader>()
  const actionData      = useActionData<typeof action>()
  const navigate        = useNavigate()
  const navigation      = useNavigation()
  const submitting      = navigation.state === "submitting"

  const [domainName,      setDomainName]      = useState("")
  const [certificateArn,  setCertificateArn]  = useState("")
  const [mappings,        setMappings]        = useState<MappingEntry[]>([{ key: 0, apiId: "", stage: "", basePath: "" }])
  const [nextKey,         setNextKey]         = useState(1)

  function addMapping() {
    setMappings((prev) => [...prev, { key: nextKey, apiId: "", stage: "", basePath: "" }])
    setNextKey((k) => k + 1)
  }

  function removeMapping(key: number) {
    setMappings((prev) => prev.filter((m) => m.key !== key))
  }

  function updateMapping(key: number, field: keyof Omit<MappingEntry, "key">, value: string) {
    setMappings((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: value } : m)))
  }

  const primaryRegion  = certs.find((c) => c.region !== "us-east-1")?.region ?? ""
  const filteredCerts  = certs.filter((c) => certMatchesDomain(c.domain, domainName.trim()))
  const selectedCert   = certs.find((c) => c.arn === certificateArn)

  const mappingPayload = JSON.stringify(
    mappings.map(({ apiId, stage, basePath }) => ({
      apiId,
      stage,
      basePath: basePath.trim() || "(none)",
    })),
  )

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        <input type="hidden" name="mappings"       value={mappingPayload} />
        <input type="hidden" name="domainName"     value={domainName} />
        <input type="hidden" name="certificateArn" value={certificateArn} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">New Domain</h1>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            >
              {submitting ? "Creating…" : "Save Domain"}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6 max-w-2xl">
          {actionData?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionData.error}
            </p>
          )}

          {/* Domain Name */}
          <div className="space-y-2">
            <Label htmlFor="domainNameInput">Domain Name</Label>
            <Input
              id="domainNameInput"
              value={domainName}
              onChange={(e) => {
                setDomainName(e.target.value)
                setCertificateArn("") // reset cert selection when domain changes
              }}
              placeholder="e.g. api.example.com"
              className="max-w-sm"
            />
          </div>

          {/* Certificate */}
          <div className="space-y-2">
            <Label>ACM Certificate</Label>

            {certs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No issued certificates found in ACM. Deploy{" "}
                <code className="bg-gray-100 px-1 rounded text-[11px]">infra/acm-certificate.yaml</code>{" "}
                and ensure the certificate status is <strong>Issued</strong>.
              </p>
            ) : (
              <>
                <Select value={certificateArn} onValueChange={setCertificateArn}>
                  <SelectTrigger className="max-w-xl">
                    <SelectValue placeholder="Select a certificate…" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCerts.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No certificates match "{domainName}" — try clearing the domain field to see all
                      </SelectItem>
                    ) : (
                      filteredCerts.map((cert) => (
                        <SelectItem key={cert.arn} value={cert.arn}>
                          <span className="font-mono text-xs">{cert.domain}</span>
                          {cert.region === "us-east-1" && primaryRegion !== "us-east-1" && (
                            <span className="ml-2 text-[10px] text-muted-foreground">(us-east-1 / Edge)</span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {selectedCert && (
                  <p className="text-[11px] font-mono text-muted-foreground break-all">
                    {selectedCert.arn}
                  </p>
                )}

                {domainName && filteredCerts.length === 0 && certs.length > 0 && (
                  <p className="text-xs text-amber-600">
                    No certificates cover <strong>{domainName}</strong>. You may need a wildcard cert (
                    <code className="bg-gray-100 px-1 rounded">*.{domainName.split(".").slice(1).join(".")}</code>
                    ) or a cert for the exact domain.
                  </p>
                )}
              </>
            )}

            <p className="text-xs text-muted-foreground">
              Only <Badge variant="outline" className="text-[10px] px-1 py-0">Issued</Badge> certificates
              are shown. Certificates are pulled from{" "}
              {primaryRegion ? (
                <>
                  <strong>{primaryRegion}</strong> (Regional) and <strong>us-east-1</strong> (Edge).
                </>
              ) : (
                <strong>us-east-1</strong>
              )}
            </p>
          </div>

          {/* Endpoint Type */}
          <div className="space-y-2">
            <Label>Endpoint Type</Label>
            <RadioGroup defaultValue="REGIONAL" name="endpointType" className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REGIONAL" id="ep-regional" />
                <Label htmlFor="ep-regional" className="cursor-pointer font-normal">Regional</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="EDGE" id="ep-edge" />
                <Label htmlFor="ep-edge" className="cursor-pointer font-normal">Edge (CloudFront)</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Regional: cert must be in the same region as your gateway. Edge: cert must be in us-east-1.
            </p>
          </div>

          {/* GoDaddy Domain */}
          <div className="space-y-2">
            <Label htmlFor="godaddyDomain">
              GoDaddy Domain <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="godaddyDomain"
              name="godaddyDomain"
              placeholder="e.g. example.com"
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your GoDaddy root domain. When set, the CNAME record for this custom domain is created automatically after provisioning.
            </p>
          </div>

          {/* Route Mappings */}
          <div className="space-y-3">
            <div>
              <Label>Route Mappings</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Map this domain to an API + stage. Leave base path empty to serve the API at the domain root (stored as{" "}
                <code className="bg-gray-100 px-1 rounded text-[11px]">(none)</code>).
              </p>
            </div>

            {/* Column headers */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-52">API</span>
              <span className="w-36">Stage</span>
              <span className="w-44">Base Path</span>
            </div>

            <div className="space-y-2">
              {mappings.map((m) => (
                <MappingRow
                  key={m.key}
                  entry={m}
                  apis={apis}
                  canRemove={mappings.length > 1}
                  onUpdate={updateMapping}
                  onRemove={removeMapping}
                />
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addMapping}>
              <Plus className="size-3.5 mr-1.5" />
              Add Mapping
            </Button>
          </div>
        </div>
      </Form>
    </div>
  )
}

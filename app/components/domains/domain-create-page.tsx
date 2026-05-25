import { useState } from "react"
import { Form, useNavigate } from "react-router"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import { CertificatePicker } from "./certificate-picker"
import { CreateRouteMappingsSection } from "./create-route-mappings-section"
import type { MappingEntry, SyncedApi } from "./types"

interface CertEntry {
  arn: string
  domain: string
  region: string
}

interface DomainCreatePageProps {
  apis: SyncedApi[]
  certs: CertEntry[]
  actionError?: string
  submitting: boolean
}

function certMatchesDomain(certDomain: string, inputDomain: string): boolean {
  if (!inputDomain) return true
  if (certDomain === inputDomain) return true
  if (certDomain.startsWith("*.")) {
    const root = certDomain.slice(2)
    return inputDomain === root || inputDomain.endsWith(`.${root}`)
  }
  return false
}

export function DomainCreatePage({ apis, certs, actionError, submitting }: DomainCreatePageProps) {
  const navigate = useNavigate()

  const [domainName,     setDomainName]     = useState("")
  const [certificateArn, setCertificateArn] = useState("")
  const [mappings,       setMappings]       = useState<MappingEntry[]>([{ key: 0, apiId: "", stage: "", basePath: "" }])
  const [nextKey,        setNextKey]        = useState(1)

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

  const primaryRegion = certs.find((c) => c.region !== "us-east-1")?.region ?? ""
  const filteredCerts = certs.filter((c) => certMatchesDomain(c.domain, domainName.trim()))

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

        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">New Domain</h1>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-black hover:bg-gray-900 text-white px-6"
            >
              {submitting ? "Creating…" : "Save Domain"}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6 max-w-2xl">
          {actionError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="domainNameInput">Domain Name</Label>
            <Input
              id="domainNameInput"
              value={domainName}
              onChange={(e) => {
                setDomainName(e.target.value)
                setCertificateArn("")
              }}
              placeholder="e.g. api.example.com"
              className="max-w-sm"
            />
          </div>

          <CertificatePicker
            certs={certs}
            filteredCerts={filteredCerts}
            selectedArn={certificateArn}
            domainName={domainName}
            primaryRegion={primaryRegion}
            onChange={setCertificateArn}
          />

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
              Regional: cert must be in the same region as your organisation. Edge: cert must be in us-east-1.
            </p>
          </div>

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

          <CreateRouteMappingsSection
            entries={mappings}
            apis={apis}
            onAdd={addMapping}
            onUpdate={updateMapping}
            onRemove={removeMapping}
          />
        </div>
      </Form>
    </div>
  )
}

import { useState } from "react";
import { Form, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { CreateRouteMappingsSection } from "./create-route-mappings-section";
import type { MappingEntry, SyncedApi } from "./types";

interface ValidationRecord {
  name: string;
  value: string;
}

interface DomainCreatePageProps {
  apis: SyncedApi[];
  actionError?: string | null;
  submitting: boolean;
  pendingCertArn: string | null;
  validationRecords: ValidationRecord[];
  stillPending: boolean;
}

export function DomainCreatePage({
  apis,
  actionError,
  submitting,
  pendingCertArn,
  validationRecords,
  stillPending,
}: DomainCreatePageProps) {
  const navigate = useNavigate();

  const [domainName, setDomainName] = useState("");
  const [godaddyDomain, setGodaddyDomain] = useState("");
  const [endpointType, setEndpointType] = useState<"REGIONAL" | "EDGE">("REGIONAL");
  const [mappings, setMappings] = useState<MappingEntry[]>([
    { key: 0, apiId: "", stage: "", basePath: "" },
  ]);
  const [nextKey, setNextKey] = useState(1);

  function addMapping() {
    setMappings((prev) => [...prev, { key: nextKey, apiId: "", stage: "", basePath: "" }]);
    setNextKey((k) => k + 1);
  }

  function removeMapping(key: number) {
    setMappings((prev) => prev.filter((m) => m.key !== key));
  }

  function updateMapping(key: number, field: keyof Omit<MappingEntry, "key">, value: string) {
    setMappings((prev) => prev.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  }

  const mappingPayload = JSON.stringify(
    mappings.map(({ apiId, stage, basePath }) => ({
      apiId,
      stage,
      basePath: basePath.trim() || "(none)",
    }))
  );

  if (pendingCertArn) {
    return (
      <div className="flex flex-col h-full bg-white">
        <Form method="post" className="flex flex-col flex-1 min-h-0">
          <input type="hidden" name="_intent" value="finalize" />
          <input type="hidden" name="certificateArn" value={pendingCertArn} />
          <input type="hidden" name="domainName" value={domainName} />
          <input type="hidden" name="endpointType" value={endpointType} />
          <input type="hidden" name="godaddyDomain" value={godaddyDomain} />
          <input type="hidden" name="mappings" value={mappingPayload} />

          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
            <h1 className="text-2xl font-normal text-gray-900">New Domain</h1>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-black hover:bg-gray-900 text-white px-6"
              >
                {submitting ? "Checking…" : "Check Status & Continue"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/domains/new")}>
                Start Over
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-6 px-6 py-6 max-w-2xl">
            {actionError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </p>
            )}

            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 space-y-3">
              <p className="text-sm font-medium text-amber-800">
                {stillPending
                  ? "Certificate still validating…"
                  : "Certificate requested — awaiting DNS validation"}
              </p>
              <p className="text-sm text-amber-700">
                {stillPending
                  ? "DNS propagation can take a few minutes. Click \"Check Status & Continue\" again shortly."
                  : "Your ACM certificate has been requested and the DNS validation CNAME has been added to GoDaddy. ACM typically validates within 1–5 minutes once DNS propagates."}
              </p>
              <div>
                <p className="text-xs font-medium text-amber-800 mb-0.5">Certificate ARN</p>
                <p className="text-xs font-mono text-amber-900 break-all">{pendingCertArn}</p>
              </div>
            </div>

            {validationRecords.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">DNS Validation Records</h3>
                <p className="text-xs text-muted-foreground">
                  These CNAME records were added to GoDaddy automatically. You can verify them in
                  your GoDaddy DNS settings.
                </p>
                <div className="rounded-md border border-gray-200 divide-y divide-gray-100 text-xs font-mono">
                  {validationRecords.map((rec) => (
                    <div key={rec.name} className="px-4 py-3 space-y-1">
                      <div>
                        <span className="text-muted-foreground not-mono font-sans">Name: </span>
                        <span className="text-gray-800 break-all">{rec.name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground not-mono font-sans">Value: </span>
                        <span className="text-gray-800 break-all">{rec.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Domain</span>
              <span className="font-mono font-medium">{domainName}</span>
              <span className="text-muted-foreground">Endpoint Type</span>
              <span>{endpointType}</span>
              <span className="text-muted-foreground">GoDaddy Domain</span>
              <span>{godaddyDomain || "—"}</span>
            </div>
          </div>
        </Form>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        <input type="hidden" name="_intent" value="create" />
        <input type="hidden" name="domainName" value={domainName} />
        <input type="hidden" name="mappings" value={mappingPayload} />

        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">New Domain</h1>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-black hover:bg-gray-900 text-white px-6"
            >
              {submitting ? "Requesting Certificate…" : "Create Domain"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => navigate(-1)}
            >
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
              onChange={(e) => setDomainName(e.target.value)}
              placeholder="e.g. api.example.com"
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="godaddyDomainInput">GoDaddy Root Domain</Label>
            <Input
              id="godaddyDomainInput"
              name="godaddyDomain"
              value={godaddyDomain}
              onChange={(e) => setGodaddyDomain(e.target.value)}
              placeholder="e.g. example.com"
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              Your GoDaddy root domain. The ACM DNS validation CNAME and the API Gateway CNAME are
              both added to GoDaddy automatically using the{" "}
              <code className="bg-gray-100 px-1 rounded text-[11px]">GODADDY_KEY</code> /{" "}
              <code className="bg-gray-100 px-1 rounded text-[11px]">GODADDY_SECRET</code>{" "}
              environment variables.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Endpoint Type</Label>
            <RadioGroup
              value={endpointType}
              onValueChange={(v) => setEndpointType(v as "REGIONAL" | "EDGE")}
              name="endpointType"
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REGIONAL" id="ep-regional" />
                <Label htmlFor="ep-regional" className="cursor-pointer font-normal">
                  Regional
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="EDGE" id="ep-edge" />
                <Label htmlFor="ep-edge" className="cursor-pointer font-normal">
                  Edge (CloudFront)
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Regional: cert is created in{" "}
              <code className="bg-gray-100 px-1 rounded text-[11px]">AWS_REGION</code>. Edge: cert
              is created in <strong>us-east-1</strong> (required for CloudFront).
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
  );
}

import { Badge } from "~/components/ui/badge";
import type { DomainItem } from "./types";

const ENDPOINT_BADGE: Record<string, { label: string; className: string }> = {
  REGIONAL: { label: "Regional", className: "bg-blue-50 text-blue-700 border-blue-200" },
  EDGE: { label: "Edge", className: "bg-purple-50 text-purple-700 border-purple-200" },
};

interface DomainInfoSectionProps {
  domain: DomainItem;
}

export function DomainInfoSection({ domain }: DomainInfoSectionProps) {
  const ep = ENDPOINT_BADGE[domain.endpointType] ?? ENDPOINT_BADGE.REGIONAL;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Domain Details
      </h2>

      <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-sm">
        <span className="text-muted-foreground">Domain Name</span>
        <span className="font-mono font-medium text-gray-900">{domain.domainName}</span>

        <span className="text-muted-foreground">Endpoint Type</span>
        <span>
          <Badge variant="outline" className={`text-xs ${ep.className}`}>
            {ep.label}
          </Badge>
        </span>

        <span className="text-muted-foreground">AWS Target</span>
        <span className="font-mono text-xs text-gray-700 break-all">
          {domain.awsDomainName ?? "—"}
        </span>

        <span className="text-muted-foreground">Certificate ARN</span>
        <span className="font-mono text-xs text-gray-700 break-all">{domain.certificateArn}</span>

        <span className="text-muted-foreground">GoDaddy Domain</span>
        <span className="text-gray-700">
          {domain.godaddyDomain ?? <span className="text-muted-foreground">—</span>}
        </span>

        <span className="text-muted-foreground">Created</span>
        <span className="text-gray-700">{new Date(domain.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

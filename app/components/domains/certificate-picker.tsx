import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface CertEntry {
  arn: string;
  domain: string;
  region: string;
}

interface CertificatePickerProps {
  certs: CertEntry[];
  filteredCerts: CertEntry[];
  selectedArn: string;
  domainName: string;
  primaryRegion: string;
  onChange: (arn: string) => void;
}

export function CertificatePicker({
  certs,
  filteredCerts,
  selectedArn,
  domainName,
  primaryRegion,
  onChange,
}: CertificatePickerProps) {
  const selectedCert = certs.find((c) => c.arn === selectedArn);

  return (
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
          <Select value={selectedArn} onValueChange={onChange}>
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
                    {cert.region === "ap-south-1" && primaryRegion !== "ap-south-1" && (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        (ap-south-1 / Edge)
                      </span>
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
              <code className="bg-gray-100 px-1 rounded">
                *.{domainName.split(".").slice(1).join(".")}
              </code>
              ) or a cert for the exact domain.
            </p>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Only{" "}
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          Issued
        </Badge>{" "}
        certificates are shown. Certificates are pulled from{" "}
        {primaryRegion ? (
          <>
            <strong>{primaryRegion}</strong> (Regional) and <strong>ap-south-1</strong> (Edge).
          </>
        ) : (
          <strong>ap-south-1</strong>
        )}
      </p>
    </div>
  );
}

import { ListCertificatesCommand } from "@aws-sdk/client-acm";

import { createAcmClient } from "./acm-client.server";

export type CertSummary = {
  arn: string;
  domain: string;
  region: string;
};

async function listCertsInRegion(region: string): Promise<CertSummary[]> {
  const client = createAcmClient(region);
  const result = await client.send(
    new ListCertificatesCommand({
      CertificateStatuses: ["ISSUED"],
      MaxItems: 500,
    })
  );
  return (result.CertificateSummaryList ?? []).map((c) => ({
    arn: c.CertificateArn!,
    domain: c.DomainName ?? "",
    region,
  }));
}

/**
 * Lists all ISSUED ACM certificates from both the configured AWS_REGION and ap-south-1
 * (Edge-optimized API Gateway custom domains require a cert in ap-south-1).
 * Failures in either region are silently skipped so a misconfigured region
 * does not block the form from loading.
 */
export async function listIssuedCertificates(): Promise<CertSummary[]> {
  const primaryRegion = process.env.AWS_REGION ?? "ap-south-1";
  const regions = primaryRegion === "ap-south-1" ? ["ap-south-1"] : [primaryRegion, "ap-south-1"];

  const results = await Promise.allSettled(regions.map(listCertsInRegion));

  return results.flatMap((r) => {
    if (r.status === "fulfilled") return r.value;
    console.warn("[aws:acm] listCertsInRegion failed", r.reason);
    return [];
  });
}

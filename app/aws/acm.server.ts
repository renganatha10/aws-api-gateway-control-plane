import {
  DescribeCertificateCommand,
  RequestCertificateCommand,
} from "@aws-sdk/client-acm";

import { createAcmClient } from "./acm-client.server";

export type DnsValidationRecord = {
  name: string;
  value: string;
};

export async function requestCertificate(
  domainName: string,
  region: string
): Promise<{ certificateArn: string }> {
  const client = createAcmClient(region);
  const result = await client.send(
    new RequestCertificateCommand({
      DomainName: domainName,
      ValidationMethod: "DNS",
    })
  );
  if (!result.CertificateArn) throw new Error("ACM did not return a certificate ARN");
  console.log("[aws:acm] certificate requested", { domainName, region, arn: result.CertificateArn });
  return { certificateArn: result.CertificateArn };
}

export async function describeCertificate(
  certificateArn: string,
  region: string
): Promise<{ status: string; validationRecords: DnsValidationRecord[] }> {
  const client = createAcmClient(region);
  const result = await client.send(
    new DescribeCertificateCommand({ CertificateArn: certificateArn })
  );
  const cert = result.Certificate;
  if (!cert) throw new Error("Certificate not found");

  const status = cert.Status ?? "UNKNOWN";
  const validationRecords: DnsValidationRecord[] = (cert.DomainValidationOptions ?? [])
    .filter((opt) => opt.ResourceRecord?.Name && opt.ResourceRecord?.Value)
    .map((opt) => ({
      name: opt.ResourceRecord!.Name!,
      value: opt.ResourceRecord!.Value!,
    }));

  return { status, validationRecords };
}

import {
  CreateBasePathMappingCommand,
  CreateDomainNameCommand,
  DeleteBasePathMappingCommand,
  DeleteDomainNameCommand,
} from "@aws-sdk/client-api-gateway"

import { apigwClient } from "./client.server"

export async function createCustomDomain(
  domainName: string,
  certificateArn: string,
  endpointType: "REGIONAL" | "EDGE",
): Promise<{ awsDomainName: string }> {
  const result = await apigwClient.send(
    new CreateDomainNameCommand({
      domainName,
      ...(endpointType === "REGIONAL"
        ? {
            regionalCertificateArn: certificateArn,
            endpointConfiguration: { types: ["REGIONAL"] },
          }
        : {
            certificateArn,
            endpointConfiguration: { types: ["EDGE"] },
          }),
    }),
  )

  const awsDomainName =
    endpointType === "REGIONAL" ? result.regionalDomainName : result.distributionDomainName

  if (!awsDomainName) throw new Error("AWS returned no domain name for custom domain")

  console.log("[aws:custom-domain] created", { domainName, awsDomainName, endpointType })
  return { awsDomainName }
}

export async function deleteCustomDomain(domainName: string): Promise<void> {
  await apigwClient.send(new DeleteDomainNameCommand({ domainName }))
  console.log("[aws:custom-domain] deleted", { domainName })
}

export async function createBasePathMapping(
  domainName: string,
  restApiId: string,
  stage: string,
  basePath: string,
): Promise<void> {
  await apigwClient.send(
    new CreateBasePathMappingCommand({
      domainName,
      restApiId,
      stage,
      basePath,
    }),
  )
  console.log("[aws:custom-domain] base path mapping created", { domainName, restApiId, stage, basePath })
}

export async function deleteBasePathMapping(domainName: string, basePath: string): Promise<void> {
  await apigwClient.send(
    new DeleteBasePathMappingCommand({ domainName, basePath }),
  )
  console.log("[aws:custom-domain] base path mapping deleted", { domainName, basePath })
}

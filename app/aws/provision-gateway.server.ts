import { createGateway, createGatewayWithEnvironments, updateGatewayAwsId } from "~/repositories/gateway.repository.server"
import type { Gateway, NewGateway } from "~/lib/schema"
import { createRestApi } from "./rest-api.server"

async function provisionAwsResources(created: Gateway, gatewayName: string): Promise<string> {
  const restApi = await createRestApi(gatewayName, `Gateway: ${gatewayName}`)
  const restApiId = restApi.id!

  await updateGatewayAwsId(created.id, restApiId)
  console.log("[provision-gateway] done", { gatewayId: created.id, restApiId })
  return restApiId
}

/**
 * Provisions the REST API in AWS first, then saves the gateway to the
 * database with the AWS ID already set. Environments can be added later.
 */
export async function provisionGatewayOnly(gateway: NewGateway): Promise<Gateway> {
  const restApi = await createRestApi(gateway.name, `Gateway: ${gateway.name}`)
  const restApiId = restApi.id!
  console.log("[provision-gateway] AWS REST API created", { restApiId, gatewayName: gateway.name })

  const created = await createGateway({ ...gateway, awsRestApiId: restApiId })
  console.log("[provision-gateway] gateway saved", { gatewayId: created.id, restApiId })

  return created
}

/**
 * Creates a gateway + environments in the database, then provisions the
 * REST API in AWS API Gateway. Deployment and stages are created separately
 * when environments are configured.
 */
export async function provisionGateway(
  gateway: NewGateway,
  envNames: string[],
): Promise<Gateway> {
  const created = await createGatewayWithEnvironments(gateway, envNames)

  try {
    const restApiId = await provisionAwsResources(created, gateway.name)
    return { ...created, awsRestApiId: restApiId }
  } catch (err) {
    console.error("[provision-gateway] AWS provisioning failed", {
      gatewayId: created.id,
      gatewayName: gateway.name,
      error: err instanceof Error ? err.message : String(err),
    })
    return created
  }
}

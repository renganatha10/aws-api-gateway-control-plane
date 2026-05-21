import {
  CreateRestApiCommand,
  DeleteRestApiCommand,
  GetRestApiCommand,
  type RestApi,
} from "@aws-sdk/client-api-gateway"

import { apigwClient } from "./client.server"

/** Create a new REST API in API Gateway. Returns the created RestApi object. */
export async function createRestApi(name: string, description?: string): Promise<RestApi> {
  const command = new CreateRestApiCommand({
    name,
    description,
    endpointConfiguration: { types: ["REGIONAL"] },
  })
  const result = await apigwClient.send(command)
  console.log("[aws:rest-api] created", { id: result.id, name: result.name })
  return result
}

/** Fetch details of an existing REST API by ID. */
export async function getRestApi(restApiId: string): Promise<RestApi> {
  const command = new GetRestApiCommand({ restApiId })
  return apigwClient.send(command)
}

/** Permanently delete a REST API and all its resources. */
export async function deleteRestApi(restApiId: string): Promise<void> {
  const command = new DeleteRestApiCommand({ restApiId })
  await apigwClient.send(command)
  console.log("[aws:rest-api] deleted", { restApiId })
}

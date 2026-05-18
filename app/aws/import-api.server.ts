import { ImportRestApiCommand, PutRestApiCommand } from "@aws-sdk/client-api-gateway"

import { apigwClient } from "./client.server"

/** Import a new REST API from a spec. Returns the AWS API ID. */
export async function importApiSpec(specJson: Record<string, unknown>): Promise<string> {
  const body = Buffer.from(JSON.stringify(specJson))
  const command = new ImportRestApiCommand({
    body,
    failOnWarnings: false,
    parameters: { endpointConfigurationTypes: "REGIONAL" },
  })
  const result = await apigwClient.send(command)
  if (!result.id) throw new Error("ImportRestApi returned no ID")
  console.log("[aws:import-api] imported", { id: result.id, name: result.name })
  return result.id
}

/** Overwrite an existing REST API with a new spec. */
export async function putApiSpec(restApiId: string, specJson: Record<string, unknown>): Promise<void> {
  const body = Buffer.from(JSON.stringify(specJson))
  const command = new PutRestApiCommand({
    restApiId,
    body,
    mode: "overwrite",
    failOnWarnings: false,
  })
  await apigwClient.send(command)
  console.log("[aws:import-api] updated", { restApiId })
}

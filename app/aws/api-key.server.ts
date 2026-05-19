import {
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  UpdateUsagePlanCommand,
} from "@aws-sdk/client-api-gateway"

import { apigwClient } from "./client.server"

/** Creates an enabled API Gateway API key and returns its ID. */
export async function createApiKey(name: string): Promise<{ id: string }> {
  const result = await apigwClient.send(
    new CreateApiKeyCommand({ name, enabled: true }),
  )
  if (!result.id) throw new Error("CreateApiKey returned no id")
  console.log("[aws:api-key] created", { id: result.id, name })
  return { id: result.id }
}

/**
 * Associates an API key with a usage plan and patches the plan to include
 * the given API + stage combinations. Duplicate stage additions are ignored.
 */
export async function provisionConsumerKey(
  usagePlanId: string,
  apiKeyId: string,
  apiStages: Array<{ apiId: string; stage: string }>,
): Promise<void> {
  await apigwClient.send(
    new CreateUsagePlanKeyCommand({ usagePlanId, keyId: apiKeyId, keyType: "API_KEY" }),
  )
  console.log("[aws:api-key] associated with usage plan", { usagePlanId, apiKeyId })

  if (apiStages.length === 0) return

  // Add each API+stage to the usage plan. Existing entries are silently skipped.
  for (const { apiId, stage } of apiStages) {
    try {
      await apigwClient.send(
        new UpdateUsagePlanCommand({
          usagePlanId,
          patchOperations: [
            { op: "add", path: "/apiStages", value: `${apiId}:${stage}` },
          ],
        }),
      )
      console.log("[aws:api-key] usage plan stage added", { usagePlanId, apiId, stage })
    } catch (err: unknown) {
      // ConflictException means this API+stage is already on the plan — safe to ignore
      if ((err as { name?: string }).name === "ConflictException") continue
      throw err
    }
  }
}

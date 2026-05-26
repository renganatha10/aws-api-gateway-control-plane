import {
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  GetApiKeyCommand,
  UpdateUsagePlanCommand,
} from "@aws-sdk/client-api-gateway";

import { apigwClient } from "./client.server";

/** Retrieves the plaintext value of an API key. */
export async function getApiKeyValue(apiKeyId: string): Promise<string> {
  const result = await apigwClient.send(
    new GetApiKeyCommand({ apiKey: apiKeyId, includeValue: true })
  );
  if (!result.value) throw new Error("API key has no value");
  return result.value;
}

/** Creates an enabled API Gateway API key and returns its ID. Pass `value` to pin the key to a specific string (e.g. a Cognito clientId). */
export async function createApiKey(name: string, value?: string): Promise<{ id: string }> {
  const result = await apigwClient.send(
    new CreateApiKeyCommand({ name, enabled: true, ...(value ? { value } : {}) })
  );
  if (!result.id) throw new Error("CreateApiKey returned no id");
  console.log("[aws:api-key] created", { id: result.id, name });
  return { id: result.id };
}

/** Deletes an API Gateway API key by its ID. */
export async function deleteApiKey(apiKeyId: string): Promise<void> {
  await apigwClient.send(new DeleteApiKeyCommand({ apiKey: apiKeyId }));
  console.log("[aws:api-key] deleted", { apiKeyId });
}

/**
 * Associates an API key with a usage plan and patches the plan to include
 * the given API + stage combinations. Duplicate stage additions are ignored.
 */
export async function provisionConsumerKey(
  usagePlanId: string,
  apiKeyId: string,
  apiStages: Array<{ apiId: string; stage: string }>
): Promise<void> {
  await apigwClient.send(
    new CreateUsagePlanKeyCommand({ usagePlanId, keyId: apiKeyId, keyType: "API_KEY" })
  );
  console.log("[aws:api-key] associated with usage plan", { usagePlanId, apiKeyId });

  if (apiStages.length === 0) return;

  // Add each API+stage to the usage plan. Existing entries are silently skipped.
  for (const { apiId, stage } of apiStages) {
    try {
      await apigwClient.send(
        new UpdateUsagePlanCommand({
          usagePlanId,
          patchOperations: [{ op: "add", path: "/apiStages", value: `${apiId}:${stage}` }],
        })
      );
      console.log("[aws:api-key] usage plan stage added", { usagePlanId, apiId, stage });
    } catch (err: unknown) {
      // ConflictException means this API+stage is already on the plan — safe to ignore
      if ((err as { name?: string }).name === "ConflictException") continue;
      throw err;
    }
  }
}

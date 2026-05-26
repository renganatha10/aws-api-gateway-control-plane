import {
  CreateDeploymentCommand,
  ImportRestApiCommand,
  PutRestApiCommand,
} from "@aws-sdk/client-api-gateway";

import { apigwClient } from "./client.server";

/** Import a new REST API from a spec, then deploy to no stage. Returns the AWS API ID. */
export async function importApiSpec(specJson: Record<string, unknown>): Promise<string> {
  const body = Buffer.from(JSON.stringify(specJson));
  const result = await apigwClient.send(
    new ImportRestApiCommand({
      body,
      failOnWarnings: false,
      parameters: { endpointConfigurationTypes: "REGIONAL" },
    })
  );
  if (!result.id) throw new Error("ImportRestApi returned no ID");
  await deployToNoStage(result.id);
  console.log("[aws:import-api] imported", { id: result.id, name: result.name });
  return result.id;
}

/** Overwrite an existing REST API with a new spec, then deploy to no stage. */
export async function putApiSpec(
  restApiId: string,
  specJson: Record<string, unknown>
): Promise<void> {
  const body = Buffer.from(JSON.stringify(specJson));
  await apigwClient.send(
    new PutRestApiCommand({
      restApiId,
      body,
      mode: "overwrite",
      failOnWarnings: false,
    })
  );
  await deployToNoStage(restApiId);
  console.log("[aws:import-api] updated", { restApiId });
}

/** Create a deployment without attaching it to any stage. */
async function deployToNoStage(restApiId: string): Promise<void> {
  await apigwClient.send(new CreateDeploymentCommand({ restApiId }));
  console.log("[aws:import-api] deployed (no stage)", { restApiId });
}

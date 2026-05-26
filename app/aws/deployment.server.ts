import { CreateDeploymentCommand, type Deployment } from "@aws-sdk/client-api-gateway";

import { apigwClient } from "./client.server";

/**
 * Create a deployment for a REST API.
 * A deployment is required before stages can be created.
 * Returns the deployment ID.
 */
export async function createDeployment(restApiId: string, description?: string): Promise<string> {
  const command = new CreateDeploymentCommand({ restApiId, description });
  const result: Deployment = await apigwClient.send(command);

  if (!result.id) throw new Error(`Deployment created but no ID returned for API ${restApiId}`);

  console.log("[aws:deployment] created", { restApiId, deploymentId: result.id });
  return result.id;
}

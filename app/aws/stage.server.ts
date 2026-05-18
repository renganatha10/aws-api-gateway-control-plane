import {
  CreateStageCommand,
  DeleteStageCommand,
  GetStagesCommand,
  type Stage,
} from "@aws-sdk/client-api-gateway"

import { apigwClient } from "./client.server"

/** Create a stage for a REST API, linked to the given deployment. */
export async function createStage(
  restApiId: string,
  stageName: string,
  deploymentId: string,
): Promise<Stage> {
  const command = new CreateStageCommand({
    restApiId,
    stageName: sanitizeStageName(stageName),
    deploymentId,
  })
  const result = await apigwClient.send(command)
  console.log("[aws:stage] created", { restApiId, stageName: result.stageName })
  return result
}

/** Create one stage per environment name in a single API. */
export async function createStagesForEnvironments(
  restApiId: string,
  deploymentId: string,
  envNames: string[],
): Promise<Stage[]> {
  return Promise.all(
    envNames.map((name) => createStage(restApiId, name, deploymentId)),
  )
}

/** List all stages for a REST API. */
export async function listStages(restApiId: string): Promise<Stage[]> {
  const command = new GetStagesCommand({ restApiId })
  const result = await apigwClient.send(command)
  return result.item ?? []
}

/** Delete a specific stage from a REST API. */
export async function deleteStage(restApiId: string, stageName: string): Promise<void> {
  const command = new DeleteStageCommand({ restApiId, stageName })
  await apigwClient.send(command)
  console.log("[aws:stage] deleted", { restApiId, stageName })
}

/** AWS stage names must be alphanumeric + hyphens/underscores only. */
function sanitizeStageName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128)
}

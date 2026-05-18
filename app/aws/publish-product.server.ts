import { createDeployment } from "./deployment.server"
import { createStage, listStages, sanitizeStageName, updateStageDeployment } from "./stage.server"

export interface ApiToPublish {
  awsApiId: string
  spec:     Record<string, unknown>
}

function resolveBackendHost(
  spec: Record<string, unknown>,
  envName: string,
): string | undefined {
  const hosts = spec.hosts as Record<string, string> | undefined
  return hosts?.[envName]
}

/**
 * Deploys all APIs in a product to an AWS stage matching the environment name.
 * For each API, reads spec.hosts[envName] and sets it as the backendHost stage variable
 * so the x-amazon-apigateway-integration URI resolves correctly per environment.
 */
export async function publishProductToEnvironment(
  apis:    ApiToPublish[],
  envName: string,
): Promise<{ warnings: string[] }> {
  const stageName = sanitizeStageName(envName)
  const warnings: string[] = []

  for (const api of apis) {
    const backendHost = resolveBackendHost(api.spec, envName)

    if (!backendHost) {
      warnings.push(
        `API ${api.awsApiId}: no hosts.${envName} in spec — backendHost stage variable not set`,
      )
    }

    const variables    = backendHost ? { backendHost } : undefined
    const deploymentId = await createDeployment(api.awsApiId, `Published to ${envName}`)
    const stages       = await listStages(api.awsApiId)
    const existing     = stages.find((s) => s.stageName === stageName)

    if (existing) {
      await updateStageDeployment(api.awsApiId, stageName, deploymentId, variables)
    } else {
      await createStage(api.awsApiId, stageName, deploymentId, variables)
    }
  }

  return { warnings }
}

import { requireAuth } from "~/lib/session.server"
import { findConsumerById } from "~/repositories/consumer.repository.server"
import { getApiKeyValue } from "~/aws/api-key.server"
import type { Route } from "./+types/api.consumer-apikey.$id"

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request)

  const consumer = await findConsumerById(Number(params.id))
  if (!consumer?.awsApiKeyId) {
    return Response.json({ error: "Consumer has no API key" }, { status: 404 })
  }

  try {
    const apiKeyValue = await getApiKeyValue(consumer.awsApiKeyId)
    return Response.json({ apiKeyValue })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve API key" },
      { status: 500 },
    )
  }
}

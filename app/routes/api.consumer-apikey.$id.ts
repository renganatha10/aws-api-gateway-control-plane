import { requireAuth } from "~/lib/session.server";
import { findConsumerById } from "~/repositories/consumer.repository.server";
import type { Route } from "./+types/api.consumer-apikey.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);

  const consumer = await findConsumerById(Number(params.id));
  if (!consumer?.clientId) {
    return Response.json({ error: "Consumer has no client ID" }, { status: 404 });
  }

  return Response.json({ apiKeyValue: consumer.clientId });
}

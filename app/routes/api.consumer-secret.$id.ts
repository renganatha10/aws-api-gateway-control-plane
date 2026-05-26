import { getClientSecret } from "~/aws/cognito-app-client.server";
import { USER_POOL_ID } from "~/aws/cognito-client.server";
import { requireAuth } from "~/lib/session.server";
import { findConsumerById } from "~/repositories/consumer.repository.server";
import type { Route } from "./+types/api.consumer-secret.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);

  const consumer = await findConsumerById(Number(params.id));
  if (!consumer?.clientId) {
    return Response.json({ error: "Consumer has no client ID" }, { status: 404 });
  }

  try {
    const secret = await getClientSecret(USER_POOL_ID, consumer.clientId);
    return Response.json({ secret });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve secret" },
      { status: 500 }
    );
  }
}

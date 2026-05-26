import { getClientSecret } from "~/aws/cognito-app-client.server";
import { USER_POOL_ID } from "~/aws/cognito-client.server";
import { requireAuth } from "~/lib/session.server";
import { findConsumerById } from "~/repositories/consumer.repository.server";
import type { Route } from "./+types/api.consumer-token.$id";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);

  const consumer = await findConsumerById(Number(params.id));
  if (!consumer?.clientId || !consumer.tokenUrl) {
    return Response.json({ error: "Consumer not provisioned" }, { status: 404 });
  }

  try {
    const secret = await getClientSecret(USER_POOL_ID, consumer.clientId);
    const credentials = Buffer.from(`${consumer.clientId}:${secret}`).toString("base64");

    const res = await fetch(consumer.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: "grant_type=client_credentials",
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return Response.json(
        {
          error:
            (data.error_description as string) || (data.error as string) || "Token request failed",
        },
        { status: res.status }
      );
    }

    return Response.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to retrieve token" },
      { status: 500 }
    );
  }
}

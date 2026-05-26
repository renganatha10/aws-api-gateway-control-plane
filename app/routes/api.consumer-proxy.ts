import { requireAuth } from "~/lib/session.server";
import { findConsumerById } from "~/repositories/consumer.repository.server";
import { listDeploymentsByProduct } from "~/repositories/product-deployment.repository.server";
import type { Route } from "./+types/api.consumer-proxy";

interface ProxyRequest {
  consumerId: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);

  const payload = (await request.json()) as ProxyRequest;
  const { consumerId, method, url, headers, body } = payload;

  const consumer = await findConsumerById(Number(consumerId));
  if (!consumer) {
    return Response.json({ error: "Consumer not found" }, { status: 404 });
  }

  const deployments = await listDeploymentsByProduct(consumer.productId);
  const invokeUrl = deployments.find((d) => d.environmentId === consumer.environmentId)?.invokeUrl;
  if (!invokeUrl || !url.startsWith(invokeUrl)) {
    return Response.json(
      { error: "Target URL is not authorized for this consumer" },
      { status: 403 }
    );
  }

  const fetchOptions: RequestInit = { method: method.toUpperCase(), headers };
  if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
    fetchOptions.body = body;
  }

  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(url, fetchOptions);
  } catch (err) {
    console.error("[consumer-proxy] network error", err);
    return Response.json({
      error: "Request failed — could not reach the endpoint.",
      ms: Date.now() - start,
    });
  }

  const ms = Date.now() - start;
  const responseBody = await res.text().catch(() => "");

  let responseHeaders: Record<string, string> = {};
  try {
    responseHeaders = Object.fromEntries(res.headers.entries());
  } catch {
    // headers not iterable in this runtime — proceed without them
  }

  // NOTE: field names here must NOT match React Router's isResponse duck-type check:
  //   { status: number, statusText: string, headers: object, body: non-undefined }
  // Using `httpStatus`, `resHeaders`, `resBody` to avoid the collision.
  return Response.json({
    httpStatus: res.status,
    statusText: res.statusText,
    resHeaders: responseHeaders,
    resBody: responseBody,
    ms,
  });
}

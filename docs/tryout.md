# Try Out

The **Try Out** tab on a consumer detail page is an in-browser API sandbox. It lets you test the consumer's credentials against the live deployed API without leaving the portal.

## How it works

The Try Out tab loads:

- The **OpenAPI specs** of all APIs in the consumer's product.
- The **invoke URL** for the consumer's environment (e.g. `https://abc123.execute-api.ap-south-1.amazonaws.com/prod`).

All requests are proxied through the portal's server-side proxy route (`/api/consumer-proxy`) to avoid CORS issues. The proxy injects the consumer's API key into the `x-api-key` header before forwarding to AWS.

## Credentials section

Click **Get Token** to exchange the consumer's Cognito client credentials for an OAuth access token via the `client_credentials` grant. The portal calls the consumer's stored `tokenUrl` with the client ID and secret fetched live from AWS.

Once a token is fetched it is shown in the Credentials section and automatically used for all subsequent requests in the session.

You can also click **Show API Key** to display the raw API key value (fetched from AWS on demand).

## Making a request

1. Select an **endpoint** from the dropdown (format: `METHOD /path — summary`).
2. Fill in any **path parameters** and **query parameters** that appear in the form.
3. For endpoints with a request body, paste or type JSON in the body field.
4. Click **Send Request**.

The response section shows the HTTP status code, response headers, and the response body as formatted JSON (if applicable).

## Scope enforcement

The access token obtained via **Get Token** carries only the scopes that belong to the APIs in the consumer's product. If you try to call an endpoint that requires a scope outside the consumer's product the gateway will return `403 Forbidden`.

## Notes

- The sandbox always targets the invoke URL for the consumer's assigned environment. You cannot switch environments in the Try Out tab.
- AWS API key associations can take 30–60 seconds to propagate after a consumer is created. If you see `403 Forbidden` shortly after creating a consumer, wait a moment and retry.
- Request proxying is performed server-side; the consumer's API key is never exposed to the browser.

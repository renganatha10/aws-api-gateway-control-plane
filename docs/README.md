# ApiGateway Control Plane — Documentation

This portal manages APIs, products, plans, environments, and consumers on top of AWS API Gateway and Amazon Cognito.

## Concepts

| Concept | Description |
|---------|-------------|
| [API](api.md) | An OpenAPI spec synced to AWS API Gateway. Defines endpoints, scope, and per-environment backend hosts. |
| [Environment](environment.md) | A named deployment target (e.g. `dev`, `prod`). Becomes an AWS stage when a product is published. |
| [Plan](plan.md) | A rate-limit / quota policy mapped to an AWS Usage Plan. Assigned to consumers. |
| [Product](product.md) | A bundle of APIs + Plans published to one or more environments. The unit consumers subscribe to. |
| [Consumer](consumer.md) | A provisioned client: Cognito App Client + API key, scoped to a product + environment + plan. |
| [Try Out](tryout.md) | In-browser API sandbox on the consumer detail page for testing live endpoints with real credentials. |
| [Users & Access Control](users.md) | Organisation membership, roles, first-login password flow, and how permissions gate UI and server actions. |
| [Self-Hosted Runner](self-hosted-runner.md) | Register this Ubuntu machine as a GitHub Actions runner for CI/CD. |

## How things fit together

```
Organisation
  └─ APIs          (OpenAPI specs, synced to AWS REST APIs)
  └─ Environments  (dev / staging / prod — become AWS stages)
  └─ Plans         (rate limits — become AWS Usage Plans)
  └─ Products
       ├─ API Associations     (which APIs are in this product)
       ├─ Plan Associations    (which Plans consumers can choose)
       ├─ Deployments          (per-environment invoke URLs)
       └─ Consumers
            ├─ Cognito App Client  (OAuth machine credentials)
            └─ AWS API Key         (x-api-key header value)
```

## Typical workflow

1. **Create APIs** — paste your OpenAPI YAML. Add a `hosts` map for each environment. Set a scope.
2. **Create Environments** — add `dev`, `staging`, `prod` etc.
3. **Create Plans** — define throttle / burst / quota limits.
4. **Create a Product** — bundle one or more APIs, associate one or more Plans.
5. **Publish the Product** to an Environment — the portal creates AWS stages and stores invoke URLs.
6. **Create a Consumer** — select the product, environment, and plan. The portal provisions Cognito + API key automatically.
7. **Try Out** — use the in-browser sandbox on the consumer detail page to verify the integration.

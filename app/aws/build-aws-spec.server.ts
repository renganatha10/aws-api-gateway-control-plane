const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"]

/** Extract base path from a Swagger 2.0 or OAS3 spec. */
export function extractBasePath(spec: Record<string, unknown>): string {
  if (typeof spec.basePath === "string" && spec.basePath) return spec.basePath
  const servers = spec.servers as Array<{ url?: string }> | undefined
  if (servers?.[0]?.url) {
    try { return new URL(servers[0].url).pathname } catch { return servers[0].url }
  }
  return "/"
}

/**
 * Takes a clean Swagger 2.0 or OAS3 spec (with custom `hosts` field) and returns an
 * AWS API Gateway-compatible spec by injecting x-amazon-apigateway-integration
 * blocks for each path/method, plus api_key + CognitoAuth security schemes.
 * The integration URI uses `${stageVariables.backendHost}` so each stage can
 * point to the corresponding URL from `hosts`. The custom `hosts` field is removed.
 */
export function buildAwsSpec(spec: Record<string, unknown>, scope?: string | null): Record<string, unknown> {
  const aws = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>
  const isOas3 = typeof aws.openapi === "string"
  const scopeValue = scope?.trim() ?? ""

  aws["x-amazon-apigateway-api-key-source"] = "HEADER"
  aws["x-amazon-apigateway-request-validators"] = {
    basic: { validateRequestBody: true, validateRequestParameters: false },
  }

  const cognitoArn = process.env.COGNITO_USER_POOL_ARN ?? ""
  const apiKeyScheme = { type: "apiKey", name: "x-api-key", in: "header" }
  const cognitoScheme = {
    type: "apiKey",
    name: "Authorization",
    in: "header",
    "x-amazon-apigateway-authtype": "cognito_user_pools",
    "x-amazon-apigateway-authorizer": {
      type: "cognito_user_pools",
      providerARNs: [cognitoArn],
    },
  }

  if (isOas3) {
    const components = (aws.components ?? {}) as Record<string, unknown>
    const schemes = (components.securitySchemes ?? {}) as Record<string, unknown>
    schemes["api_key"] = apiKeyScheme
    schemes["CognitoAuth"] = cognitoScheme
    components.securitySchemes = schemes
    aws.components = components
  } else {
    const secDefs = (aws.securityDefinitions ?? {}) as Record<string, unknown>
    delete secDefs["apigw_key"]
    secDefs["api_key"] = apiKeyScheme
    secDefs["CognitoAuth"] = cognitoScheme
    aws.securityDefinitions = secDefs
  }

  delete aws.hosts

  const paths = (aws.paths ?? {}) as Record<string, Record<string, unknown>>
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue
      const operation = op as Record<string, unknown>
      const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
      const opParams = (operation.parameters ?? []) as Array<{ in?: string; name?: string }>
      const queryParams = opParams.filter((p) => p.in === "query" && p.name).map((p) => p.name!)
      const requestParameters = {
        ...Object.fromEntries(pathParams.map((p) => [`integration.request.path.${p}`, `method.request.path.${p}`])),
        ...Object.fromEntries(queryParams.map((q) => [`integration.request.querystring.${q}`, `method.request.querystring.${q}`])),
      }
      operation["x-amazon-apigateway-integration"] = {
        type: "http_proxy",
        httpMethod: method.toUpperCase(),
        // `https://` must be a static prefix — AWS rejects URIs without a visible protocol at import time.
        // The backendHost stage variable should hold host+path without protocol (e.g. "api.example.com/v2").
        uri: `https://\${stageVariables.backendHost}${path}`,
        passthroughBehavior: "when_no_match",
        connectionType: "INTERNET",
        ...(Object.keys(requestParameters).length > 0 && { requestParameters }),
      }
      operation["security"] = [{ api_key: [], CognitoAuth: [scopeValue] }]
    }
  }

  return aws
}

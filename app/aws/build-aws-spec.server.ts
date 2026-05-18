const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"]

/**
 * Takes a clean Swagger 2.0 spec (with custom `hosts` field) and returns an
 * AWS API Gateway-compatible spec by injecting x-amazon-apigateway-integration
 * blocks for each path/method. The integration URI uses `${stageVariables.backendHost}`
 * so each stage (dev/prod) can point to the corresponding URL from `hosts`.
 * The custom `hosts` field is removed from the output.
 */
export function buildAwsSpec(spec: Record<string, unknown>): Record<string, unknown> {
  const aws = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>

  aws["x-amazon-apigateway-api-key-source"] = "HEADER"
  aws["x-amazon-apigateway-request-validators"] = {
    basic: { validateRequestBody: true, validateRequestParameters: false },
  }

  const secDefs = (aws.securityDefinitions ?? {}) as Record<string, unknown>
  secDefs["apigw_key"] = { type: "apiKey", name: "x-api-key", in: "header" }
  aws.securityDefinitions = secDefs

  delete aws.hosts

  const paths = (aws.paths ?? {}) as Record<string, Record<string, unknown>>
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue
      const operation = op as Record<string, unknown>
      operation["x-amazon-apigateway-integration"] = {
        type: "http_proxy",
        httpMethod: method.toUpperCase(),
        uri: `\${stageVariables.backendHost}${path}`,
        passthroughBehavior: "when_no_match",
        connectionType: "INTERNET",
      }
      operation["security"] = [{ apigw_key: [] }]
    }
  }

  return aws
}

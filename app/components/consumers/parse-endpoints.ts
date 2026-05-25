import { HTTP_METHODS, type ParsedEndpoint, type SpecParam } from "./tryout-types"

export function parseEndpoints(spec: Record<string, unknown>): ParsedEndpoint[] {
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>
  const endpoints: ParsedEndpoint[] = []

  for (const [path, methods] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = methods[method] as Record<string, unknown> | undefined
      if (!op) continue

      const params = (op.parameters ?? []) as SpecParam[]
      const pathParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
      const queryParams = params.filter((p) => p.in === "query")
      const hasBody =
        ["post", "put", "patch"].includes(method) ||
        params.some((p) => p.in === "body" || p.in === "formData") ||
        !!op.requestBody

      endpoints.push({
        method,
        path,
        summary: (op.summary as string | undefined) || (op.operationId as string | undefined),
        operationId: op.operationId as string | undefined,
        pathParams,
        queryParams,
        hasBody,
      })
    }
  }

  return endpoints
}

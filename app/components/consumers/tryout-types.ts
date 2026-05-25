export const HTTP_METHODS = ["get", "post", "put", "delete", "patch", "head", "options"] as const
export type HttpMethod = (typeof HTTP_METHODS)[number]

export interface SpecParam {
  name: string
  in: "path" | "query" | "header" | "body" | "formData" | "cookie"
  required?: boolean
  description?: string
}

export interface ParsedEndpoint {
  method: HttpMethod
  path: string
  summary?: string
  operationId?: string
  pathParams: string[]
  queryParams: SpecParam[]
  hasBody: boolean
}

export interface KVRow {
  key: string
  value: string
}

export interface ProxyResponse {
  httpStatus: number
  statusText: string
  resHeaders: Record<string, string>
  resBody: string
  ms: number
}

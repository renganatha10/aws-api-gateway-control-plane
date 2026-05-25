// ── raw spec types (Swagger 2.0 / OAS 3) ─────────────────────────────────────

export interface RawSpec {
  info?:        { title?: string; version?: string }
  hosts?:       Record<string, string>
  host?:        string
  basePath?:    string
  tags?:        Array<{ name: string; description?: string }>
  paths?:       Record<string, Record<string, RawOperation>>
  definitions?: Record<string, RawSchema>
  components?:  { schemas?: Record<string, RawSchema> }
}

export interface RawOperation {
  summary?:     string
  description?: string
  operationId?: string
  tags?:        string[]
  parameters?:  RawParam[]
  responses?:   Record<string, RawResponse>
  requestBody?: { content?: Record<string, { schema?: RawSchema }> }
  consumes?:    string[]
}

export interface RawParam {
  name:         string
  in:           string
  required?:    boolean
  description?: string
  type?:        string
  format?:      string
  schema?:      RawSchema
  $ref?:        string
}

export interface RawResponse {
  description?: string
  schema?:      RawSchema
  $ref?:        string
}

export interface RawSchema {
  type?:       string
  format?:     string
  $ref?:       string
  properties?: Record<string, RawSchema>
  items?:      RawSchema
  enum?:       unknown[]
  example?:    unknown
  required?:   string[]
}

// ── normalized types ──────────────────────────────────────────────────────────

export interface ParsedParam {
  name:        string
  in:          string
  required:    boolean
  description: string
  type:        string
}

export interface ParsedResponse {
  code:        string
  description: string
}

export interface ParsedEndpoint {
  method:      string
  path:        string
  summary:     string
  description: string
  tags:        string[]
  parameters:  ParsedParam[]
  bodyType:    string | null
  bodySample:  string | null
  responses:   ParsedResponse[]
}

export interface EndpointGroup {
  tag:         string
  description: string
  endpoints:   ParsedEndpoint[]
}

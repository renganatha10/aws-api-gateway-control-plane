import * as yaml from "js-yaml";

import { HTTP_METHODS } from "./constants";
import type {
  EndpointGroup,
  ParsedParam,
  ParsedResponse,
  RawParam,
  RawSchema,
  RawSpec,
} from "./types";

export function resolveRef(spec: RawSpec, ref?: string): RawSchema | null {
  if (!ref) return null;
  const parts = ref.replace("#/", "").split("/");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parts.reduce((o: any, k) => o?.[k], spec) ?? null;
}

export function schemaType(spec: RawSpec, schema?: RawSchema): string {
  if (!schema) return "any";
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? schema.$ref;
    const resolved = resolveRef(spec, schema.$ref);
    return resolved?.type ? `${name} (${resolved.type})` : name;
  }
  if (schema.type === "array" && schema.items) return `array[${schemaType(spec, schema.items)}]`;
  if (schema.enum) return schema.enum.join(" | ");
  return schema.type ?? "any";
}

export function generateSample(spec: RawSpec, schema: RawSchema, depth = 0): unknown {
  if (depth > 5) return "…";

  if (schema.$ref) {
    const resolved = resolveRef(spec, schema.$ref) as RawSchema | null;
    return resolved ? generateSample(spec, resolved, depth + 1) : null;
  }

  if (schema.example !== undefined) return schema.example;
  if (schema.enum?.length) return schema.enum[0];

  if (schema.type === "array" && schema.items) {
    return [generateSample(spec, schema.items, depth + 1)];
  }

  if (schema.type === "object" || schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) {
      obj[k] = generateSample(spec, v, depth + 1);
    }
    return obj;
  }

  switch (schema.type) {
    case "integer":
      return 0;
    case "number":
      return 0.0;
    case "boolean":
      return false;
    case "string":
      if (schema.format === "date-time") return "2024-01-01T00:00:00Z";
      if (schema.format === "date") return "2024-01-01";
      if (schema.format === "int64") return 0;
      return "string";
    default:
      return null;
  }
}

export function parseSpec(yamlStr: string): {
  spec: RawSpec;
  groups: EndpointGroup[];
  hosts: Record<string, string>;
} {
  let spec: RawSpec = {};
  try {
    spec = (yaml.load(yamlStr) as RawSpec) ?? {};
  } catch {
    return { spec, groups: [], hosts: {} };
  }

  const hosts = spec.hosts ?? {};
  const tagDescriptions: Record<string, string> = {};
  for (const t of spec.tags ?? []) tagDescriptions[t.name] = t.description ?? "";

  const groupMap: Record<string, EndpointGroup> = {};

  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue;

      const tags = op.tags?.length ? op.tags : ["default"];
      const tag = tags[0];

      if (!groupMap[tag]) {
        groupMap[tag] = { tag, description: tagDescriptions[tag] ?? "", endpoints: [] };
      }

      const params: ParsedParam[] = (op.parameters ?? []).map((p) => {
        const resolved = p.$ref ? (resolveRef(spec, p.$ref) as RawParam | null) : p;
        const r = resolved ?? p;
        return {
          name: r.name ?? "",
          in: r.in ?? "",
          required: r.required ?? false,
          description: r.description ?? "",
          type: r.type ?? schemaType(spec, (r as RawParam).schema),
        };
      });

      const rawBodyParam = (op.parameters ?? []).find(
        (p) => p.in === "body" || p.in === "formData"
      );
      const bodyParam = params.find((p) => p.in === "body" || p.in === "formData");
      let bodyType: string | null = null;
      let bodySample: string | null = null;

      if (bodyParam && rawBodyParam) {
        bodyType = bodyParam.in === "formData" ? "multipart/form-data" : "application/json";
        const rawSchema = rawBodyParam.schema ?? null;
        if (rawSchema) {
          try {
            bodySample = JSON.stringify(generateSample(spec, rawSchema), null, 2);
          } catch {
            bodySample = null;
          }
        }
      } else if (op.requestBody?.content) {
        const [ct, ctObj] = Object.entries(op.requestBody.content)[0] ?? [];
        bodyType = ct ?? "application/json";
        if (ctObj?.schema) {
          try {
            bodySample = JSON.stringify(generateSample(spec, ctObj.schema), null, 2);
          } catch {
            bodySample = null;
          }
        }
      }

      const responses: ParsedResponse[] = Object.entries(op.responses ?? {}).map(([code, r]) => ({
        code,
        description: r.description ?? "",
      }));

      groupMap[tag].endpoints.push({
        method,
        path,
        summary: op.summary ?? op.operationId ?? "",
        description: op.description ?? "",
        tags,
        parameters: params.filter((p) => p.in !== "body" && p.in !== "formData"),
        bodyType,
        bodySample,
        responses,
      });
    }
  }

  return { spec, groups: Object.values(groupMap), hosts };
}

export function parseHosts(yamlStr: string): Record<string, string> {
  try {
    return (yaml.load(yamlStr) as RawSpec)?.hosts ?? {};
  } catch {
    return {};
  }
}

export function parseEndpointList(yamlStr: string) {
  try {
    const spec = yaml.load(yamlStr) as RawSpec;
    return Object.entries(spec?.paths ?? {}).flatMap(([path, methods]) =>
      Object.entries(methods)
        .filter(([m]) => HTTP_METHODS.includes(m))
        .map(([method, op]) => ({ method, path, summary: op.summary ?? op.operationId ?? "" }))
    );
  } catch {
    return [];
  }
}

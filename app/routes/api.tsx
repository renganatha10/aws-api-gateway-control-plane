import * as React from "react";
import { Form, useNavigate } from "react-router";

import { requireAuth } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Route } from "./+types/api";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create API" }];
}

function buildTemplate(name: string, specType: string) {
  const title = name || "My API";
  if (specType === "swagger2") {
    return `swagger: "2.0"
info:
  title: ${title}
  version: "1.0.0"
  description: ""
host: "api.example.com"
basePath: "/v1"
schemes:
  - https
paths:
  /health:
    get:
      summary: Health check
      responses:
        200:
          description: OK
`;
  }
  return `openapi: "3.0.3"
info:
  title: ${title}
  version: "1.0.0"
  description: ""
servers:
  - url: https://api.example.com/v1
paths:
  /health:
    get:
      summary: Health check
      responses:
        "200":
          description: OK
`;
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const formData = await request.formData();
  const apiName = (formData.get("apiName") as string)?.trim();
  const specType = (formData.get("specType") as string) ?? "openapi3";
  const spec = (formData.get("spec") as string)?.trim();

  if (!apiName) return { error: "API name is required." };
  if (!spec) return { error: "API specification cannot be empty." };

  // TODO: replace with real backend call
  console.log("Create API", { apiName, specType, spec });
  return {
    error:
      "Failed to save API: could not connect to the gateway service. Please try again.",
  };
}

export default function ApiCreate({ actionData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [apiName, setApiName] = React.useState("");
  const [specType, setSpecType] = React.useState("openapi3");
  const [spec, setSpec] = React.useState(() => buildTemplate("", "openapi3"));
  const specTouched = React.useRef(false);

  React.useEffect(() => {
    if (!specTouched.current) {
      setSpec(buildTemplate(apiName, specType));
    }
  }, [apiName, specType]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-3.5rem)] bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Create API</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/apis")}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="api-form"
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            Save
          </Button>
        </div>
      </div>

      <Form
        id="api-form"
        method="post"
        className="flex flex-col flex-1 overflow-hidden"
      >
        {/* Meta strip — labels above inputs */}
        <div className="flex items-end gap-6 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <Label
              htmlFor="apiName"
              className="py-1 text-sm font-medium text-gray-700"
            >
              API name
            </Label>
            <Input
              id="apiName"
              name="apiName"
              value={apiName}
              onChange={(e) => setApiName(e.target.value)}
              placeholder="e.g. payments-api"
              className="h-9 text-sm w-56"
              required
            />
          </div>

          <div>
            <Label className="py-1 text-sm font-medium text-gray-700">
              Type
            </Label>
            <Select
              name="specType"
              value={specType}
              onValueChange={(v) => setSpecType(v)}
            >
              <SelectTrigger className="h-9 text-sm w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openapi3">OpenAPI 3.0</SelectItem>
                <SelectItem value="swagger2">Swagger 2.0</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error banner */}
        {actionData?.error && (
          <div className="mx-6 mt-3 shrink-0 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <svg
              className="size-4 mt-0.5 shrink-0 text-red-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            {actionData.error}
          </div>
        )}

        {/* Editor label bar */}
        <div className="flex items-center gap-3 px-6 py-1.5 bg-gray-950 mt-3 shrink-0">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">
            {specType === "openapi3" ? "OpenAPI 3.0" : "Swagger 2.0"} · YAML
          </span>
        </div>

        {/* Code editor */}
        <textarea
          name="spec"
          value={spec}
          onChange={(e) => {
            specTouched.current = true;
            setSpec(e.target.value);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="flex-1 w-full resize-none font-mono text-sm bg-gray-950 text-emerald-400 px-6 py-4 outline-none leading-6 min-h-0"
          placeholder="Write or paste your API spec here…"
        />
      </Form>
    </div>
  );
}

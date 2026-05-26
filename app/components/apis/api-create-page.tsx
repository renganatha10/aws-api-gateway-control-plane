import * as React from "react";
import { Form, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ApiTypeSelector } from "./api-type-selector";
import { OPENAPI3_PLACEHOLDER, PET_SWAGGER_YAML } from "./yaml-placeholders";

interface ApiCreatePageProps {
  actionError?: string;
  submitting: boolean;
}

export function ApiCreatePage({ actionError, submitting }: ApiCreatePageProps) {
  const navigate = useNavigate();
  const [type, setType] = React.useState("swagger2");

  return (
    <div className="flex flex-col h-full bg-white">
      <Form method="post" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200 shrink-0">
          <h1 className="text-2xl font-normal text-gray-900">Create API</h1>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-black hover:bg-gray-900 text-white px-6"
            >
              {submitting ? "Saving…" : "Save API"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 px-6 py-6 gap-6">
          {actionError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive shrink-0">
              {actionError}
            </p>
          )}

          <div className="space-y-2 shrink-0">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. payments-api"
              required
              className="max-w-sm"
            />
          </div>

          <div className="flex gap-6 items-end shrink-0">
            <ApiTypeSelector value={type} onChange={setType} />
            <div className="w-64 space-y-2">
              <Label htmlFor="scope">Scope</Label>
              <Input id="scope" name="scope" placeholder="e.g. read:orders" defaultValue="pets" />
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 space-y-2">
            <Label htmlFor="yaml">Definition (YAML)</Label>
            <textarea
              id="yaml"
              name="yaml"
              defaultValue={type === "swagger2" ? PET_SWAGGER_YAML : OPENAPI3_PLACEHOLDER}
              className="flex-1 w-full rounded-md border border-input bg-gray-950 px-4 py-3 font-mono text-sm text-white placeholder:text-gray-600 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              required
            />
          </div>
        </div>
      </Form>
    </div>
  );
}

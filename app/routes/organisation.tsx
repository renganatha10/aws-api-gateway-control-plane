import * as React from "react";
import { Form, redirect, useActionData, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getUserProfile } from "~/lib/cognito.server";
import { requireAuth } from "~/lib/session.server";
import { createOrganisation } from "~/repositories/organisation.repository.server";
import type { Route } from "./+types/organisation";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Create Organisation" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const user = getUserProfile(accessToken);
  const createdBy = user.email;

  const formData = await request.formData();
  const name = (formData.get("name") as string)?.trim();

  if (!name) return { error: "Organisation name is required." };

  try {
    await createOrganisation({ name, createdBy });
  } catch (err) {
    console.error("[organisation] create failed", err);
    return { error: "Failed to create organisation. Please try again." };
  }

  throw redirect("/");
}

export default function OrganisationCreate() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (actionData?.error) {
      toast.error(actionData.error);
    }
  }, [actionData]);

  return (
    <div className="flex min-h-full items-start justify-center px-4 py-12">
      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create an Organisation</CardTitle>
          <CardDescription>
            Give your organisation a name. You can add environments after it's created.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form method="post" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Organisation name</Label>
              <Input id="name" name="name" placeholder="e.g. my-organisation" required />
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="flex-1" size="lg">
                Create Organisation
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

import { EnvironmentsPage } from "~/components/environments/environments-page";
import { getUserProfile } from "~/lib/cognito.server";
import { requirePermission } from "~/lib/require-role.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import {
  createEnvironment,
  listEnvironmentsByOrganisation,
} from "~/repositories/environment.repository.server";
import type { Route } from "./+types/environments";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Environments" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);
  const organisationId = await getActiveOrganisationId(request);
  const environments = organisationId ? await listEnvironmentsByOrganisation(organisationId) : [];
  return { environments, organisationId, email };
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);
  const orgId = await getActiveOrganisationId(request);
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create") {
    if (orgId) await requirePermission(request, orgId, "create:resources");
    const name = String(formData.get("name") ?? "").trim();
    const organisationId = Number(formData.get("organisationId"));
    if (!name || !organisationId) return { error: "Invalid data" };
    try {
      await createEnvironment({ name, organisationId, createdBy: email });
    } catch (err) {
      console.error("[environments] createEnvironment failed", err);
      return { error: "Something went wrong while creating the environment. Please try again." };
    }
    return { ok: true };
  }

  return { error: "Unknown intent" };
}

export default function EnvironmentsRoute({ loaderData }: Route.ComponentProps) {
  return (
    <EnvironmentsPage
      environments={loaderData.environments}
      organisationId={loaderData.organisationId}
    />
  );
}

import * as yaml from "js-yaml";
import { redirect, useActionData, useNavigation } from "react-router";
import { buildAwsSpec, extractBasePath } from "~/aws/build-aws-spec.server";
import { importApiSpec } from "~/aws/import-api.server";
import { ApiCreatePage } from "~/components/apis/api-create-page";
import { getUserProfile } from "~/lib/cognito.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { createApi, findApiByOrganisationAndBasePath } from "~/repositories/api.repository.server";
import type { Route } from "./+types/api-create";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Create API" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const createdBy = getUserProfile(accessToken).email;

  const organisationId = await getActiveOrganisationId(request);

  const formData = await request.formData();
  const displayName = (formData.get("name") as string)?.trim();
  const specType = formData.get("type") as string;
  const yamlStr = (formData.get("yaml") as string)?.trim();
  const scope = (formData.get("scope") as string)?.trim() || null;

  if (!displayName) return { error: "API name is required." };
  const name = organisationId ? `${displayName}-${organisationId}` : displayName;
  if (!specType) return { error: "Please select an API type." };
  if (!yamlStr) return { error: "YAML definition is required." };

  let spec: unknown;
  try {
    spec = yaml.load(yamlStr);
  } catch {
    return { error: "Invalid YAML — could not parse the definition." };
  }

  if (!spec || typeof spec !== "object") return { error: "YAML must define an object." };

  const basePath = extractBasePath(spec as Record<string, unknown>);

  if (organisationId) {
    const conflict = await findApiByOrganisationAndBasePath(organisationId, basePath);
    if (conflict)
      return {
        error: `Base path "${basePath}" is already in use by another API in this organisation.`,
      };
  }

  let awsApiId: string;
  try {
    const specObj = spec as Record<string, unknown>;
    const specForAws = { ...specObj, info: { ...((specObj.info as object) ?? {}), title: name } };
    awsApiId = await importApiSpec(buildAwsSpec(specForAws, scope, name));
  } catch (err) {
    console.error("[api-create] AWS import failed", err);
    return { error: "Something went wrong while importing to AWS. Please try again." };
  }

  const now = new Date();
  try {
    await createApi({
      name,
      displayName,
      scope,
      specType,
      spec,
      basePath,
      organisationId,
      createdBy,
      updatedBy: createdBy,
      awsApiId,
      updatedAt: now,
    });
  } catch (err) {
    console.error("[api-create] DB insert failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }

  throw redirect("/apis");
}

export default function ApiCreate() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <ApiCreatePage actionError={actionData?.error} submitting={navigation.state === "submitting"} />
  );
}

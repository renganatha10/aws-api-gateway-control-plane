import * as yaml from "js-yaml";
import { redirect, useLoaderData } from "react-router";
import { buildAwsSpec, extractBasePath } from "~/aws/build-aws-spec.server";
import { importApiSpec, putApiSpec } from "~/aws/import-api.server";
import { deleteRestApi } from "~/aws/rest-api.server";
import { ApiDetailPage } from "~/components/apis/api-detail-page";
import { getUserProfile } from "~/lib/cognito.server";
import { requirePermission } from "~/lib/require-role.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import {
  deleteApi,
  findApiById,
  findApiByOrganisationAndBasePath,
  updateApi,
} from "~/repositories/api.repository.server";
import { listProductsByApi } from "~/repositories/api-association.repository.server";
import type { Route } from "./+types/apis.$id";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: (data as { api?: { displayName?: string } })?.api?.displayName ?? "API" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const api = await findApiById(Number(params.id));
  if (!api) throw new Response("Not found", { status: 404 });
  const yamlStr = yaml.dump(api.spec, { indent: 2, lineWidth: -1 });
  return { api, yamlStr };
}

async function handleDelete(id: number) {
  let linkedProducts: { id: number; displayName: string }[];
  try {
    linkedProducts = await listProductsByApi(id);
  } catch (err) {
    console.error("[apis.$id] listProductsByApi failed", err);
    return { deleteError: "Something went wrong. Please try again." };
  }
  if (linkedProducts.length > 0) {
    return {
      deleteError: `This API is used by ${linkedProducts.length} product${linkedProducts.length === 1 ? "" : "s"}. Remove it from all products first.`,
    };
  }

  const api = await findApiById(id);
  if (api?.awsApiId) {
    try {
      await deleteRestApi(api.awsApiId);
    } catch (err) {
      console.error("[apis.$id] deleteRestApi failed", { awsApiId: api.awsApiId, err });
      return { deleteError: "Failed to delete from AWS. Please try again." };
    }
  }

  try {
    await deleteApi(id);
  } catch (err) {
    console.error("[apis.$id] deleteApi failed", err);
    return { deleteError: "Something went wrong while deleting. Please try again." };
  }
  throw redirect("/apis");
}

async function handleUpdate(id: number, formData: FormData, updatedBy: string) {
  const yamlStr = (formData.get("yaml") as string)?.trim();
  const scope = (formData.get("scope") as string)?.trim() || null;

  if (!yamlStr) return { error: "YAML cannot be empty." };
  let spec: unknown;
  try {
    spec = yaml.load(yamlStr);
  } catch {
    return { error: "Invalid YAML." };
  }
  if (!spec || typeof spec !== "object") return { error: "YAML must define an object." };

  const basePath = extractBasePath(spec as Record<string, unknown>);

  const existing = await findApiById(id);
  if (existing?.organisationId) {
    const conflict = await findApiByOrganisationAndBasePath(existing.organisationId, basePath, id);
    if (conflict) {
      return {
        error: `Base path "${basePath}" is already in use by another API in this organisation.`,
      };
    }
  }

  let awsApiId = existing?.awsApiId ?? null;
  try {
    const specObj = spec as Record<string, unknown>;
    const specForAws = {
      ...specObj,
      info: { ...((specObj.info as object) ?? {}), title: existing?.name ?? "" },
    };
    const awsSpec = buildAwsSpec(specForAws, scope, existing?.name);
    if (awsApiId) {
      await putApiSpec(awsApiId, awsSpec);
    } else {
      awsApiId = await importApiSpec(awsSpec);
    }
  } catch (err) {
    console.error("[api-update] AWS sync failed", err);
    return { error: "Something went wrong while syncing to AWS. Please try again." };
  }

  try {
    await updateApi(id, { scope, spec, basePath, awsApiId, updatedBy, updatedAt: new Date() });
  } catch (err) {
    console.error("[api-update] DB update failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }
  return { ok: true };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const updatedBy = getUserProfile(accessToken).email;
  const id = Number(params.id);
  const orgId = await getActiveOrganisationId(request);
  const formData = await request.formData();
  const intent = formData.get("_intent") as string | null;

  if (intent === "delete") {
    if (orgId) await requirePermission(request, orgId, "delete:resources");
    return handleDelete(id);
  }
  if (orgId) await requirePermission(request, orgId, "edit:resources");
  return handleUpdate(id, formData, updatedBy);
}

export default function ApiDetailRoute() {
  const { api, yamlStr } = useLoaderData<typeof loader>();
  return <ApiDetailPage api={api} initialYaml={yamlStr} />;
}

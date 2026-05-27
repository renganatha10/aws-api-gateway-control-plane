import { redirect, useLoaderData } from "react-router";
import {
  createBasePathMapping,
  deleteBasePathMapping,
  deleteCustomDomain,
} from "~/aws/custom-domain.server";
import { DomainDetailPage } from "~/components/domains/domain-detail-page";
import { extractSubdomain, removeCname } from "~/lib/godaddy.server";
import { requirePermission } from "~/lib/require-role.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { listApisByOrganisation } from "~/repositories/api.repository.server";
import { deleteDomain, findDomainById } from "~/repositories/domain.repository.server";
import {
  countMappingsByDomain,
  listMappingsWithApiByDomain,
  replaceMappings,
} from "~/repositories/domain-route-mapping.repository.server";
import type { Route } from "./+types/domains.$id";

export function meta({ data }: Route.MetaArgs) {
  const d = (data as { domain?: { domainName: string } } | undefined)?.domain;
  return [{ title: d ? `${d.domainName} — Domain` : "Domain" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);
  const id = Number(params.id);

  const domain = await findDomainById(id);
  if (!domain) throw new Response("Not Found", { status: 404 });

  const [mappings, allApis] = await Promise.all([
    listMappingsWithApiByDomain(id),
    organisationId ? listApisByOrganisation(organisationId) : [],
  ]);

  const syncedApis = allApis.filter((a) => !!a.awsApiId);

  return { domain, mappings, syncedApis };
}

async function handleUpdate(id: number, formData: FormData, _organisationId: number | null) {
  const domain = await findDomainById(id);
  if (!domain) return { error: "Domain not found." };

  let newMappings: Array<{ apiId: string; stage: string; basePath: string }>;
  try {
    newMappings = JSON.parse((formData.get("mappings") as string) || "[]");
  } catch {
    return { error: "Invalid mapping data." };
  }

  for (const m of newMappings) {
    if (!m.apiId) return { error: "All mappings must have an API selected." };
    if (!m.stage?.trim()) return { error: "All mappings must have a stage." };
  }

  const [oldMappings, allApis] = await Promise.all([
    listMappingsWithApiByDomain(id),
    listApisByOrganisation(domain.organisationId),
  ]);

  const apiMap = new Map(allApis.map((a) => [String(a.id), a]));

  for (const m of newMappings) {
    if (!apiMap.get(m.apiId)?.awsApiId) {
      return { error: "One or more selected APIs have not been synced to AWS yet." };
    }
  }

  const oldByBasePath = new Map(oldMappings.map((m) => [m.basePath, m]));
  const newByBasePath = new Map(newMappings.map((m) => [m.basePath.trim() || "(none)", m]));

  const toDelete: string[] = [];
  const toAdd: Array<{ apiId: string; stage: string; basePath: string }> = [];

  for (const [bp, old] of oldByBasePath) {
    const next = newByBasePath.get(bp);
    if (!next) {
      toDelete.push(bp);
    } else if (String(old.apiId) !== next.apiId || old.stage !== next.stage.trim()) {
      toDelete.push(bp);
      toAdd.push({ apiId: next.apiId, stage: next.stage.trim(), basePath: bp });
    }
  }

  for (const [bp, next] of newByBasePath) {
    if (!oldByBasePath.has(bp)) {
      toAdd.push({ apiId: next.apiId, stage: next.stage.trim(), basePath: bp });
    }
  }

  try {
    for (const bp of toDelete) {
      await deleteBasePathMapping(domain.domainName, bp);
    }
  } catch (err) {
    console.error("[domains.$id] deleteBasePathMapping failed", err);
    return { error: "Failed to sync with AWS. Please try again." };
  }

  try {
    for (const m of toAdd) {
      const api = apiMap.get(m.apiId);
      await createBasePathMapping(domain.domainName, api?.awsApiId ?? "", m.stage, m.basePath);
    }
  } catch (err) {
    console.error("[domains.$id] createBasePathMapping failed", err);
    return { error: "Failed to sync with AWS. Please try again." };
  }

  try {
    await replaceMappings(
      id,
      newMappings.map((m) => ({
        apiId: Number(m.apiId),
        stage: m.stage.trim(),
        basePath: m.basePath.trim() || "(none)",
      }))
    );
  } catch (err) {
    console.error("[domains.$id] replaceMappings failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }

  return { ok: true };
}

async function handleDelete(id: number) {
  const domain = await findDomainById(id);
  if (!domain) return { deleteError: "Domain not found." };

  let mappingCount: number;
  try {
    mappingCount = await countMappingsByDomain(id);
  } catch (err) {
    console.error("[domains.$id] countMappingsByDomain failed", err);
    return { deleteError: "Something went wrong. Please try again." };
  }

  if (mappingCount > 0) {
    return {
      deleteError: `Remove all ${mappingCount} route mapping${mappingCount === 1 ? "" : "s"} before deleting this domain.`,
    };
  }

  try {
    await deleteCustomDomain(domain.domainName);
  } catch (err) {
    console.error("[domains.$id] deleteCustomDomain failed", err);
    return { deleteError: "Failed to sync with AWS. Please try again." };
  }

  if (domain.godaddyDomain) {
    const subdomain = extractSubdomain(domain.domainName, domain.godaddyDomain);
    if (subdomain) {
      try {
        await removeCname(domain.godaddyDomain, subdomain);
      } catch {
        // non-fatal — logged inside removeCname
      }
    }
  }

  try {
    await deleteDomain(id);
  } catch (err) {
    console.error("[domains.$id] deleteDomain failed", err);
    return { deleteError: "Something went wrong while deleting. Please try again." };
  }

  throw redirect("/domains");
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);
  const id = Number(params.id);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "delete") {
    if (organisationId) await requirePermission(request, organisationId, "delete:resources");
    return handleDelete(id);
  }
  if (organisationId) await requirePermission(request, organisationId, "edit:resources");
  return handleUpdate(id, formData, organisationId);
}

export default function DomainDetailRoute() {
  const { domain, mappings, syncedApis } = useLoaderData<typeof loader>();

  return <DomainDetailPage domain={domain} mappings={mappings} syncedApis={syncedApis} />;
}

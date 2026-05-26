import { redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { listIssuedCertificates } from "~/aws/acm.server";
import { createBasePathMapping, createCustomDomain } from "~/aws/custom-domain.server";
import { DomainCreatePage } from "~/components/domains/domain-create-page";
import { getUserProfile } from "~/lib/cognito.server";
import { extractSubdomain, setCname } from "~/lib/godaddy.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { listApisByOrganisation } from "~/repositories/api.repository.server";
import { createDomain } from "~/repositories/domain.repository.server";
import { replaceMappings } from "~/repositories/domain-route-mapping.repository.server";
import type { Route } from "./+types/domain-create";

export function meta(_: Route.MetaArgs) {
  return [{ title: "New Domain" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);

  const [allApis, certs] = await Promise.all([
    organisationId ? listApisByOrganisation(organisationId) : [],
    listIssuedCertificates().catch(() => []),
  ]);

  const apis = allApis.filter((a) => !!a.awsApiId);
  return { apis, certs, organisationId };
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const createdBy = getUserProfile(accessToken).email;
  const organisationId = await getActiveOrganisationId(request);

  if (!organisationId) return { error: "No active organisation selected." };

  const formData = await request.formData();
  const domainName = (formData.get("domainName") as string)?.trim().toLowerCase();
  const certificateArn = (formData.get("certificateArn") as string)?.trim();
  const endpointType = ((formData.get("endpointType") as string) || "REGIONAL") as
    | "REGIONAL"
    | "EDGE";
  const godaddyDomain = (formData.get("godaddyDomain") as string)?.trim().toLowerCase() || null;

  if (!domainName) return { error: "Domain name is required." };
  if (!certificateArn) return { error: "Please select a certificate." };

  let mappings: Array<{ apiId: string; stage: string; basePath: string }>;
  try {
    mappings = JSON.parse((formData.get("mappings") as string) || "[]");
  } catch {
    return { error: "Invalid mapping data." };
  }

  if (mappings.length === 0) return { error: "At least one route mapping is required." };

  for (const m of mappings) {
    if (!m.apiId) return { error: "All mappings must have an API selected." };
    if (!m.stage?.trim()) return { error: "All mappings must have a stage." };
  }

  const allApis = await listApisByOrganisation(organisationId);
  const apiMap = new Map(allApis.map((a) => [String(a.id), a]));

  for (const m of mappings) {
    if (!apiMap.get(m.apiId)?.awsApiId) {
      return { error: "One or more selected APIs have not been synced to AWS yet." };
    }
  }

  let awsDomainName: string;
  try {
    ({ awsDomainName } = await createCustomDomain(domainName, certificateArn, endpointType));
  } catch (err) {
    console.error("[domain-create] createCustomDomain failed", err);
    return { error: "Failed to sync with AWS. Please try again." };
  }

  try {
    for (const m of mappings) {
      const api = apiMap.get(m.apiId);
      await createBasePathMapping(
        domainName,
        api?.awsApiId ?? "",
        m.stage.trim(),
        m.basePath.trim() || "(none)"
      );
    }
  } catch (err) {
    console.error("[domain-create] createBasePathMapping failed", err);
    return { error: "Domain created in AWS but route mapping failed. Check AWS console." };
  }

  if (godaddyDomain) {
    const subdomain = extractSubdomain(domainName, godaddyDomain);
    if (subdomain) {
      try {
        await setCname(godaddyDomain, subdomain, awsDomainName);
      } catch {
        // logged inside setCname
      }
    }
  }

  try {
    const now = new Date();
    const domain = await createDomain({
      organisationId,
      domainName,
      certificateArn,
      awsDomainName,
      endpointType,
      godaddyDomain,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await replaceMappings(
      domain.id,
      mappings.map((m) => ({
        apiId: Number(m.apiId),
        stage: m.stage.trim(),
        basePath: m.basePath.trim() || "(none)",
      }))
    );
  } catch (err) {
    console.error("[domain-create] DB save failed", err);
    return { error: "Provisioned in AWS but failed to save record. Please try again." };
  }

  throw redirect("/domains");
}

export default function DomainCreate() {
  const { apis, certs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <DomainCreatePage
      apis={apis}
      certs={certs}
      actionError={actionData?.error}
      submitting={navigation.state === "submitting"}
    />
  );
}

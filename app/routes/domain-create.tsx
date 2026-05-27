import { redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import {
  type DnsValidationRecord,
  describeCertificate,
  requestCertificate,
} from "~/aws/acm.server";
import { createBasePathMapping, createCustomDomain } from "~/aws/custom-domain.server";
import { DomainCreatePage } from "~/components/domains/domain-create-page";
import { getUserProfile } from "~/lib/cognito.server";
import { extractSubdomain, setAcmValidationCname, setCname } from "~/lib/godaddy.server";
import { can } from "~/lib/permissions";
import { requirePermission } from "~/lib/require-role.server";
import { getActiveOrganisationId, getActiveUserRole, requireAuth } from "~/lib/session.server";
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
  if (organisationId) {
    const role = await getActiveUserRole(request);
    if (!can(role, "create:resources")) throw redirect("/domains");
  }
  const allApis = organisationId ? await listApisByOrganisation(organisationId) : [];
  const apis = allApis.filter((a) => !!a.awsApiId);
  return { apis };
}

function certRegion(endpointType: "REGIONAL" | "EDGE"): string {
  return endpointType === "EDGE" ? "us-east-1" : (process.env.AWS_REGION ?? "ap-south-1");
}

async function pollValidationRecords(
  certArn: string,
  region: string,
  maxWaitMs = 30_000
): Promise<DnsValidationRecord[]> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { validationRecords } = await describeCertificate(certArn, region);
    if (validationRecords.length > 0) return validationRecords;
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return [];
}

async function buildDomain(
  domainName: string,
  certificateArn: string,
  endpointType: "REGIONAL" | "EDGE",
  godaddyDomain: string | null,
  mappings: Array<{ apiId: string; stage: string; basePath: string }>,
  apiMap: Map<string, { awsApiId: string | null }>,
  organisationId: number,
  createdBy: string
): Promise<{ error: string } | null> {
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

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const createdBy = getUserProfile(accessToken).email;
  const organisationId = await getActiveOrganisationId(request);

  if (!organisationId) return { error: "No active organisation selected." };
  await requirePermission(request, organisationId, "create:resources");

  const formData = await request.formData();
  const intent = (formData.get("_intent") as string) || "create";
  const domainName = (formData.get("domainName") as string)?.trim().toLowerCase();
  const endpointType = ((formData.get("endpointType") as string) || "REGIONAL") as
    | "REGIONAL"
    | "EDGE";
  const godaddyDomain = (formData.get("godaddyDomain") as string)?.trim().toLowerCase() || null;

  if (!domainName) return { error: "Domain name is required." };
  if (!godaddyDomain) return { error: "GoDaddy root domain is required for DNS validation." };

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

  const region = certRegion(endpointType);

  if (intent === "finalize") {
    const certificateArn = (formData.get("certificateArn") as string)?.trim();
    if (!certificateArn) return { error: "Certificate ARN is missing." };

    let status: string;
    let validationRecords: DnsValidationRecord[];
    try {
      ({ status, validationRecords } = await describeCertificate(certificateArn, region));
    } catch (err) {
      console.error("[domain-create] describeCertificate failed", err);
      return { error: "Failed to check certificate status. Please try again." };
    }

    if (status !== "ISSUED") {
      return { pendingCertArn: certificateArn, validationRecords, stillPending: true };
    }

    const err = await buildDomain(
      domainName,
      certificateArn,
      endpointType,
      godaddyDomain,
      mappings,
      apiMap,
      organisationId,
      createdBy
    );
    if (err) return err;
    throw redirect("/domains");
  }

  // intent === "create": request a new certificate
  let certificateArn: string;
  try {
    ({ certificateArn } = await requestCertificate(domainName, region));
  } catch (err) {
    console.error("[domain-create] requestCertificate failed", err);
    return { error: "Failed to request ACM certificate. Please try again." };
  }

  let validationRecords: DnsValidationRecord[] = [];
  try {
    validationRecords = await pollValidationRecords(certificateArn, region);
  } catch (err) {
    console.error("[domain-create] pollValidationRecords failed", err);
  }

  for (const record of validationRecords) {
    await setAcmValidationCname(godaddyDomain, record.name, record.value);
  }

  return { pendingCertArn: certificateArn, validationRecords, stillPending: false };
}

export default function DomainCreate() {
  const { apis } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const pendingCertArn =
    actionData && "pendingCertArn" in actionData ? actionData.pendingCertArn : null;
  const validationRecords =
    actionData && "validationRecords" in actionData ? actionData.validationRecords : [];
  const stillPending = actionData && "stillPending" in actionData ? actionData.stillPending : false;
  const actionError = actionData && "error" in actionData ? actionData.error : null;

  return (
    <DomainCreatePage
      apis={apis}
      actionError={actionError}
      submitting={navigation.state === "submitting"}
      pendingCertArn={pendingCertArn}
      validationRecords={validationRecords ?? []}
      stillPending={stillPending}
    />
  );
}

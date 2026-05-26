import { createUsagePlan, deleteUsagePlan, updateUsagePlan } from "~/aws/usage-plan.server";
import { PlansPage } from "~/components/plans/plans-page";
import { getUserProfile } from "~/lib/cognito.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import {
  createPlan,
  deletePlan,
  findPlanById,
  listPlansByOrganisation,
  updatePlan,
} from "~/repositories/plan.repository.server";
import { listProductsByPlan } from "~/repositories/plan-association.repository.server";
import type { Route } from "./+types/plans";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Plans" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);
  const organisationId = await getActiveOrganisationId(request);
  const plans = organisationId ? await listPlansByOrganisation(organisationId) : [];
  return { plans, organisationId, email };
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "create") return handleCreate(formData, email);
  if (intent === "update") return handleUpdate(formData, email);
  if (intent === "delete") return handleDelete(formData);
  return { error: "Unknown intent" };
}

async function handleCreate(formData: FormData, email: string) {
  const organisationId = Number(formData.get("organisationId"));
  if (!organisationId) return { error: "No organisation" };

  const name = String(formData.get("name")).trim();
  const displayName = `${name}-${organisationId}`;
  const params = {
    name,
    displayName,
    throttle: toIntOrNull(formData.get("throttle")),
    burst: toIntOrNull(formData.get("burst")),
    quotaLimit: toIntOrNull(formData.get("quotaLimit")),
    quotaPeriod: (formData.get("quotaPeriod") as string) || null,
  };

  let awsUsagePlanId: string | null = null;
  try {
    awsUsagePlanId = await createUsagePlan({ ...params, name: displayName });
  } catch (err) {
    console.error("[plans] AWS createUsagePlan failed", err);
    return { error: "Failed to sync with AWS. Please try again." };
  }

  try {
    await createPlan({ ...params, organisationId, createdBy: email, awsUsagePlanId });
  } catch (err) {
    console.error("[plans] createPlan DB failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }
  return { ok: true };
}

async function handleUpdate(formData: FormData, email: string) {
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing id" };

  const existing = await findPlanById(id);
  if (!existing) return { error: "Plan not found" };

  const name = String(formData.get("name")).trim();
  const displayName = `${name}-${existing.organisationId}`;
  const params = {
    name,
    displayName,
    throttle: toIntOrNull(formData.get("throttle")),
    burst: toIntOrNull(formData.get("burst")),
    quotaLimit: toIntOrNull(formData.get("quotaLimit")),
    quotaPeriod: (formData.get("quotaPeriod") as string) || null,
  };

  if (existing.awsUsagePlanId) {
    try {
      await updateUsagePlan(existing.awsUsagePlanId, { ...params, name: displayName });
    } catch (err) {
      console.error("[plans] AWS updateUsagePlan failed", err);
      return { error: "Failed to sync with AWS. Please try again." };
    }
  }

  try {
    await updatePlan(id, {
      ...params,
      awsUsagePlanId: existing.awsUsagePlanId ?? null,
      updatedBy: email,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error("[plans] updatePlan DB failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }
  return { ok: true };
}

async function handleDelete(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return { error: "Missing id" };

  const existing = await findPlanById(id);
  if (!existing) return { error: "Plan not found" };

  let linkedProducts: { id: number; displayName: string }[];
  try {
    linkedProducts = await listProductsByPlan(id);
  } catch (err) {
    console.error("[plans] listProductsByPlan failed", err);
    return { error: "Something went wrong. Please try again." };
  }
  if (linkedProducts.length > 0) {
    return {
      error: `${linkedProducts.length} product${linkedProducts.length === 1 ? "" : "s"} include this plan. Remove it from all products first.`,
    };
  }

  if (existing.awsUsagePlanId) {
    try {
      await deleteUsagePlan(existing.awsUsagePlanId);
    } catch (err) {
      console.error("[plans] AWS deleteUsagePlan failed", err);
      return { error: "Failed to sync with AWS. Please try again." };
    }
  }

  try {
    await deletePlan(id);
  } catch (err) {
    console.error("[plans] deletePlan DB failed", err);
    return { error: "Something went wrong while deleting. Please try again." };
  }
  return { ok: true };
}

function toIntOrNull(v: FormDataEntryValue | null): number | null {
  if (!v || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export default function PlansRoute({ loaderData }: Route.ComponentProps) {
  return <PlansPage plans={loaderData.plans} organisationId={loaderData.organisationId} />;
}

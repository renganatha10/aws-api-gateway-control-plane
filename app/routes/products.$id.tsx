import { redirect, useLoaderData } from "react-router";
import { publishProductToEnvironment } from "~/aws/publish-product.server";
import { ProductDetailPage } from "~/components/products/product-detail-page";
import { getUserProfile } from "~/lib/cognito.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { findApiById, listApisByOrganisation } from "~/repositories/api.repository.server";
import {
  listApisByProduct,
  syncApiAssociations,
} from "~/repositories/api-association.repository.server";
import { listConsumersByProduct } from "~/repositories/consumer.repository.server";
import {
  findEnvironmentById,
  listEnvironmentsByOrganisation,
} from "~/repositories/environment.repository.server";
import { listPlansByOrganisation } from "~/repositories/plan.repository.server";
import {
  listPlansByProduct,
  syncPlanAssociations,
} from "~/repositories/plan-association.repository.server";
import {
  deleteProduct,
  findProductById,
  updateProduct,
} from "~/repositories/product.repository.server";
import {
  listDeploymentsByProduct,
  upsertProductDeployment,
} from "~/repositories/product-deployment.repository.server";
import type { Route } from "./+types/products.$id";

export function meta({ data }: Route.MetaArgs) {
  const product = (data as { product?: { displayName: string } } | undefined)?.product;
  return [{ title: product ? `${product.displayName} — Product` : "Product" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);
  const organisationId = await getActiveOrganisationId(request);
  const id = Number(params.id);

  const product = await findProductById(id);
  if (!product) throw new Response("Not Found", { status: 404 });

  const [associatedApis, associatedPlans, allApis, allPlans, deployments, allEnvironments] =
    await Promise.all([
      listApisByProduct(id),
      listPlansByProduct(id),
      organisationId ? listApisByOrganisation(organisationId) : [],
      organisationId ? listPlansByOrganisation(organisationId) : [],
      listDeploymentsByProduct(id),
      organisationId ? listEnvironmentsByOrganisation(organisationId) : [],
    ]);

  return {
    product,
    associatedApis,
    associatedPlans,
    allApis,
    allPlans,
    email,
    organisationId,
    deployments,
    allEnvironments,
  };
}

async function handleUpdate(
  id: number,
  formData: FormData,
  organisationId: number | null,
  createdBy: string
) {
  const displayName = (formData.get("displayName") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const visibility = (formData.get("visibility") as string) || "authenticated";
  if (!displayName) return { error: "Display name is required." };

  const apiIds = formData.getAll("apiIds").map(Number).filter(Boolean);
  const planIds = formData.getAll("planIds").map(Number).filter(Boolean);

  try {
    await updateProduct(id, {
      displayName,
      description,
      visibility,
      updatedBy: createdBy,
      updatedAt: new Date(),
    });
    if (organisationId) {
      await syncApiAssociations(id, apiIds, organisationId, createdBy);
      await syncPlanAssociations(id, planIds, organisationId, createdBy);
    }
  } catch (err) {
    console.error("[products.$id] update failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }
  return { ok: true };
}

async function handleDelete(id: number) {
  let activeConsumers: { id: number; name: string }[];
  try {
    activeConsumers = await listConsumersByProduct(id);
  } catch (err) {
    console.error("[products.$id] listConsumersByProduct failed", err);
    return { deleteError: "Something went wrong. Please try again." };
  }
  if (activeConsumers.length > 0) {
    return {
      deleteError: `${activeConsumers.length} consumer${activeConsumers.length === 1 ? "" : "s"} are using this product. Delete them first.`,
    };
  }

  try {
    await deleteProduct(id);
  } catch (err) {
    console.error("[products.$id] delete failed", err);
    return { deleteError: "Something went wrong while deleting. Please try again." };
  }
  throw redirect("/products");
}

async function handlePublish(
  id: number,
  formData: FormData,
  organisationId: number | null,
  createdBy: string
) {
  const envId = Number(formData.get("environmentId"));
  if (!envId || !organisationId) return { publishError: "Invalid request." };

  const [assocApis, environment] = await Promise.all([
    listApisByProduct(id),
    findEnvironmentById(envId),
  ]);

  if (!environment) return { publishError: "Environment not found." };

  const fullApis = await Promise.all(
    assocApis.filter((a) => !!a.awsApiId).map((a) => findApiById(a.id))
  );

  const apisToPublish = fullApis
    .filter((a): a is NonNullable<typeof a> => !!a?.awsApiId)
    .map((a) => ({
      awsApiId: a.awsApiId ?? "",
      spec: a.spec as Record<string, unknown>,
    }));

  if (apisToPublish.length === 0) {
    return {
      publishError: "No AWS-synced APIs found in this product. Sync your APIs to AWS first.",
    };
  }

  let invokeUrl: string;
  try {
    ({ invokeUrl } = await publishProductToEnvironment(apisToPublish, environment.name));
  } catch (err) {
    console.error("[products.$id] publishProductToEnvironment failed", err);
    return { publishError: "Failed to deploy to AWS. Please try again." };
  }

  try {
    await upsertProductDeployment({
      productId: id,
      environmentId: envId,
      organisationId,
      status: "deployed",
      invokeUrl,
      createdBy,
      updatedBy: createdBy,
    });
  } catch (err) {
    console.error("[products.$id] upsertProductDeployment failed", err);
    return {
      publishError: "Deployed to AWS but failed to save deployment record. Please try again.",
    };
  }

  return { publishOk: true, publishedTo: environment.name };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const createdBy = getUserProfile(accessToken).email;
  const organisationId = await getActiveOrganisationId(request);
  const id = Number(params.id);

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "update") return handleUpdate(id, formData, organisationId, createdBy);
  if (intent === "delete") return handleDelete(id);
  if (intent === "publish") return handlePublish(id, formData, organisationId, createdBy);

  return { error: "Unknown intent." };
}

export default function ProductDetailRoute() {
  const {
    product,
    associatedApis,
    associatedPlans,
    allApis,
    allPlans,
    deployments,
    allEnvironments,
  } = useLoaderData<typeof loader>();

  return (
    <ProductDetailPage
      product={product}
      associatedApis={associatedApis}
      associatedPlans={associatedPlans}
      allApis={allApis}
      allPlans={allPlans}
      deployments={deployments}
      allEnvironments={allEnvironments}
    />
  );
}

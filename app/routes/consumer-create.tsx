import { redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { createApiKey, provisionConsumerKey } from "~/aws/api-key.server";
import { createMachineClient, getTokenUrl } from "~/aws/cognito-app-client.server";
import { USER_POOL_ID } from "~/aws/cognito-client.server";
import { ensureResourceServer } from "~/aws/cognito-resource-server.server";
import { ConsumerCreatePage } from "~/components/consumers/consumer-create-page";
import { getUserProfile } from "~/lib/cognito.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { listApiScopesForProduct } from "~/repositories/api-association.repository.server";
import { createConsumer } from "~/repositories/consumer.repository.server";
import {
  findEnvironmentById,
  listEnvironmentsByOrganisation,
} from "~/repositories/environment.repository.server";
import { findPlanById, listPlansByOrganisation } from "~/repositories/plan.repository.server";
import { listProductsByOrganisation } from "~/repositories/product.repository.server";
import { listDeploymentsByOrganisation } from "~/repositories/product-deployment.repository.server";
import type { Route } from "./+types/consumer-create";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Consumer" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);

  const [allProducts, allEnvironments, plans, deployments] = await Promise.all([
    organisationId ? listProductsByOrganisation(organisationId) : [],
    organisationId ? listEnvironmentsByOrganisation(organisationId) : [],
    organisationId ? listPlansByOrganisation(organisationId) : [],
    organisationId ? listDeploymentsByOrganisation(organisationId) : [],
  ]);

  const deployedProductIds = new Set(deployments.map((d) => d.productId));
  const products = allProducts.filter((p) => deployedProductIds.has(p.id));

  return { products, allEnvironments, plans, deployments, organisationId };
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const createdBy = getUserProfile(accessToken).email;
  const organisationId = await getActiveOrganisationId(request);

  if (!organisationId) return { error: "No active organisation selected." };

  const formData = await request.formData();
  const name = (formData.get("name") as string)?.trim();
  const productId = Number(formData.get("productId"));
  const environmentId = Number(formData.get("environmentId"));
  const planId = Number(formData.get("planId"));

  if (!name) return { error: "Name is required." };
  if (!productId) return { error: "Please select a product." };
  if (!environmentId) return { error: "Please select a stage." };
  if (!planId) return { error: "Please select a plan." };

  const [apis, environment, plan] = await Promise.all([
    listApiScopesForProduct(productId),
    findEnvironmentById(environmentId),
    findPlanById(planId),
  ]);

  if (!environment) return { error: "Selected stage not found." };
  if (!plan?.awsUsagePlanId) return { error: "Selected plan has not been synced to AWS yet." };
  if (apis.length === 0) return { error: "No AWS-synced APIs with scopes found in this product." };

  let clientId: string;
  let tokenUrl: string;
  let awsApiKeyId: string;

  try {
    for (const api of apis) {
      await ensureResourceServer(USER_POOL_ID, api.name, api.displayName, [api.scope!]);
    }

    const fullScopes = apis.map((api) => `${api.name}/${api.scope}`);
    const awsResourceName = `${name}-${organisationId}`;
    const [machineClient, resolvedTokenUrl] = await Promise.all([
      createMachineClient(USER_POOL_ID, awsResourceName, fullScopes),
      getTokenUrl(USER_POOL_ID),
    ]);
    clientId = machineClient.clientId;
    tokenUrl = resolvedTokenUrl;

    const apiKey = await createApiKey(awsResourceName, clientId);
    awsApiKeyId = apiKey.id;

    await provisionConsumerKey(
      plan.awsUsagePlanId,
      awsApiKeyId,
      apis.map((api) => ({ apiId: api.awsApiId!, stage: environment.name }))
    );
  } catch (err) {
    console.error("[consumer-create] AWS provisioning failed", err);
    return { error: "Failed to provision consumer in AWS. Please try again." };
  }

  try {
    const now = new Date();
    await createConsumer({
      name,
      productId,
      environmentId,
      planId,
      organisationId,
      clientId,
      awsApiKeyId,
      tokenUrl,
      createdBy,
      updatedBy: createdBy,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    console.error("[consumer-create] DB insert failed", err);
    return { error: "Something went wrong while saving. Please try again." };
  }

  throw redirect("/consumers");
}

export default function ConsumerCreate() {
  const { products, allEnvironments, plans, deployments } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <ConsumerCreatePage
      products={products}
      allEnvironments={allEnvironments}
      plans={plans}
      deployments={deployments}
      actionError={actionData?.error}
      submitting={navigation.state === "submitting"}
    />
  );
}

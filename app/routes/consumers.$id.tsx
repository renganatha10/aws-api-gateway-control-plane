import { redirect, useLoaderData } from "react-router";
import { deleteApiKey } from "~/aws/api-key.server";
import { deleteAppClient } from "~/aws/cognito-app-client.server";
import { USER_POOL_ID } from "~/aws/cognito-client.server";
import { ConsumerDetailPage } from "~/components/consumers/consumer-detail-page";
import { getUserProfile } from "~/lib/cognito.server";
import { requirePermission } from "~/lib/require-role.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import {
  deleteConsumer,
  findConsumerById,
  updateConsumer,
} from "~/repositories/consumer.repository.server";
import { listEnvironmentsByOrganisation } from "~/repositories/environment.repository.server";
import { listPlansByOrganisation } from "~/repositories/plan.repository.server";
import { listProductsByOrganisation } from "~/repositories/product.repository.server";
import type { Route } from "./+types/consumers.$id";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: (data as { consumer?: { name?: string } })?.consumer?.name ?? "Consumer" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);
  const consumer = await findConsumerById(Number(params.id));
  if (!consumer) throw new Response("Not found", { status: 404 });

  const [products, environments, plans] = await Promise.all([
    organisationId ? listProductsByOrganisation(organisationId) : [],
    organisationId ? listEnvironmentsByOrganisation(organisationId) : [],
    organisationId ? listPlansByOrganisation(organisationId) : [],
  ]);

  return { consumer, products, environments, plans };
}

async function handleDelete(id: number) {
  let consumer: Awaited<ReturnType<typeof findConsumerById>>;
  try {
    consumer = await findConsumerById(id);
  } catch (err) {
    console.error("[consumers.$id] findConsumerById failed", err);
    return { deleteError: "Something went wrong. Please try again." };
  }
  if (!consumer) return { deleteError: "Consumer not found." };

  if (consumer.clientId) {
    try {
      await deleteAppClient(USER_POOL_ID, consumer.clientId);
    } catch (err) {
      console.error("[consumers.$id] deleteAppClient failed", { clientId: consumer.clientId, err });
      return { deleteError: "Failed to remove the Cognito app client. Please try again." };
    }
  }

  if (consumer.awsApiKeyId) {
    try {
      await deleteApiKey(consumer.awsApiKeyId);
    } catch (err) {
      console.error("[consumers.$id] deleteApiKey failed", {
        awsApiKeyId: consumer.awsApiKeyId,
        err,
      });
      return { deleteError: "Failed to remove the API key. Please try again." };
    }
  }

  try {
    await deleteConsumer(id);
  } catch (err) {
    console.error("[consumers.$id] deleteConsumer DB failed", err);
    return {
      deleteError: "AWS resources removed but failed to delete the record. Please try again.",
    };
  }
  throw redirect("/consumers");
}

async function handleUpdate(id: number, formData: FormData, updatedBy: string) {
  const name = (formData.get("name") as string)?.trim();
  const productId = Number(formData.get("productId"));
  const environmentId = Number(formData.get("environmentId"));
  const planId = Number(formData.get("planId"));

  if (!name) return { error: "Name is required." };
  if (!productId) return { error: "Please select a product." };
  if (!environmentId) return { error: "Please select a stage." };
  if (!planId) return { error: "Please select a plan." };

  try {
    await updateConsumer(id, {
      name,
      productId,
      environmentId,
      planId,
      updatedBy,
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error("[consumers.$id] updateConsumer failed", err);
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
  const intent = formData.get("_intent") as string;

  if (orgId) await requirePermission(request, orgId, "manage:consumers");
  if (intent === "delete") return handleDelete(id);
  return handleUpdate(id, formData, updatedBy);
}

export default function ConsumerDetailRoute() {
  const { consumer, products, environments, plans } = useLoaderData<typeof loader>();
  return (
    <ConsumerDetailPage
      consumer={consumer}
      products={products}
      environments={environments}
      plans={plans}
    />
  );
}

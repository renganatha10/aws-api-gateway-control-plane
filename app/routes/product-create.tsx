import { redirect, useActionData, useNavigation } from "react-router";
import { ProductCreatePage } from "~/components/products/product-create-page";
import { getUserProfile } from "~/lib/cognito.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { createProduct } from "~/repositories/product.repository.server";
import type { Route } from "./+types/product-create";

export function meta({}: Route.MetaArgs) {
  return [{ title: "New Product" }];
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
  const displayName = (formData.get("displayName") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const visibility = (formData.get("visibility") as string) || "authenticated";

  if (!displayName) return { error: "Display name is required." };
  if (!organisationId) return { error: "No active organisation selected." };

  const name = `${organisationId}-${displayName}`;

  try {
    const created = await createProduct({
      name,
      displayName,
      description,
      visibility,
      organisationId,
      createdBy,
    });
    return redirect(`/products/${created.id}`);
  } catch (err) {
    console.error("[product-create] createProduct failed", err);
    return { error: "Something went wrong while creating the product. Please try again." };
  }
}

export default function ProductCreate() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  return (
    <ProductCreatePage
      actionError={actionData?.error}
      submitting={navigation.state === "submitting"}
    />
  );
}

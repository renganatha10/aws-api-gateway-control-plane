import { eq } from "drizzle-orm"
import { db } from "~/lib/db.server"
import { productDeployments, type NewProductDeployment } from "~/lib/schema"

export async function upsertProductDeployment(data: NewProductDeployment) {
  const [row] = await db
    .insert(productDeployments)
    .values(data)
    .onConflictDoUpdate({
      target: [productDeployments.productId, productDeployments.environmentId],
      set: {
        status:    data.status ?? "deployed",
        invokeUrl: data.invokeUrl,
        updatedBy: data.updatedBy ?? data.createdBy,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

export async function listDeploymentsByOrganisation(organisationId: number) {
  return db
    .select()
    .from(productDeployments)
    .where(eq(productDeployments.organisationId, organisationId))
}

export async function listDeploymentsByProduct(productId: number) {
  return db
    .select()
    .from(productDeployments)
    .where(eq(productDeployments.productId, productId))
}

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
        updatedBy: data.updatedBy ?? data.createdBy,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

export async function listDeploymentsByGateway(gatewayId: number) {
  return db
    .select()
    .from(productDeployments)
    .where(eq(productDeployments.gatewayId, gatewayId))
}

export async function listDeploymentsByProduct(productId: number) {
  return db
    .select()
    .from(productDeployments)
    .where(eq(productDeployments.productId, productId))
}

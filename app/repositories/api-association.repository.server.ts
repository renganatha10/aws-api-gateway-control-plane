import { and, eq } from "drizzle-orm"
import { db } from "~/lib/db.server"
import { apiAssociations, apis, type NewApiAssociation } from "~/lib/schema"

export async function addApiToProduct(data: NewApiAssociation) {
  const [created] = await db.insert(apiAssociations).values(data).returning()
  return created
}

export async function removeApiFromProduct(productId: number, apiId: number) {
  await db
    .delete(apiAssociations)
    .where(and(eq(apiAssociations.productId, productId), eq(apiAssociations.apiId, apiId)))
}

export async function syncApiAssociations(
  productId: number,
  newApiIds: number[],
  gatewayId: number,
  createdBy: string,
) {
  const existing = await db
    .select({ apiId: apiAssociations.apiId })
    .from(apiAssociations)
    .where(eq(apiAssociations.productId, productId))
  const existingIds = existing.map((r) => r.apiId)

  for (const apiId of existingIds) {
    if (!newApiIds.includes(apiId)) {
      await db
        .delete(apiAssociations)
        .where(and(eq(apiAssociations.productId, productId), eq(apiAssociations.apiId, apiId)))
    }
  }
  for (const apiId of newApiIds) {
    if (!existingIds.includes(apiId)) {
      await db.insert(apiAssociations).values({ productId, apiId, gatewayId, createdBy })
    }
  }
}

export async function listApisByProduct(productId: number) {
  return db
    .select({
      id:          apis.id,
      name:        apis.name,
      displayName: apis.displayName,
      basePath:    apis.basePath,
      specType:    apis.specType,
      gatewayId:   apis.gatewayId,
      createdAt:   apis.createdAt,
    })
    .from(apiAssociations)
    .innerJoin(apis, eq(apiAssociations.apiId, apis.id))
    .where(eq(apiAssociations.productId, productId))
}

import { and, eq, isNotNull } from "drizzle-orm"
import { db } from "~/lib/db.server"
import { apiAssociations, apis, products, type NewApiAssociation } from "~/lib/schema"

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
  organisationId: number,
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
      await db.insert(apiAssociations).values({ productId, apiId, organisationId, createdBy })
    }
  }
}

/** Returns APIs for a product that have both a scope and an AWS API ID — used during consumer provisioning. */
export async function listApiScopesForProduct(productId: number) {
  return db
    .select({
      id:          apis.id,
      name:        apis.name,
      displayName: apis.displayName,
      scope:       apis.scope,
      awsApiId:    apis.awsApiId,
    })
    .from(apiAssociations)
    .innerJoin(apis, eq(apiAssociations.apiId, apis.id))
    .where(
      and(
        eq(apiAssociations.productId, productId),
        isNotNull(apis.scope),
        isNotNull(apis.awsApiId),
      ),
    )
}

export async function listApisByProduct(productId: number) {
  return db
    .select({
      id:             apis.id,
      name:           apis.name,
      displayName:    apis.displayName,
      basePath:       apis.basePath,
      specType:       apis.specType,
      awsApiId:       apis.awsApiId,
      organisationId: apis.organisationId,
      createdAt:      apis.createdAt,
    })
    .from(apiAssociations)
    .innerJoin(apis, eq(apiAssociations.apiId, apis.id))
    .where(eq(apiAssociations.productId, productId))
}

export async function listProductsByApi(apiId: number) {
  return db
    .select({ id: products.id, displayName: products.displayName })
    .from(apiAssociations)
    .innerJoin(products, eq(apiAssociations.productId, products.id))
    .where(eq(apiAssociations.apiId, apiId))
}

export async function listApisWithSpecByProduct(productId: number) {
  return db
    .select({
      id:          apis.id,
      name:        apis.name,
      displayName: apis.displayName,
      basePath:    apis.basePath,
      specType:    apis.specType,
      spec:        apis.spec,
      awsApiId:    apis.awsApiId,
    })
    .from(apiAssociations)
    .innerJoin(apis, eq(apiAssociations.apiId, apis.id))
    .where(eq(apiAssociations.productId, productId))
}

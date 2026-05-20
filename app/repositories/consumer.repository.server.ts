import { eq } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { consumers, products, environments, plans, type Consumer, type NewConsumer } from "~/lib/schema"

export async function listConsumersByGateway(gatewayId: number) {
  return db
    .select({
      id:              consumers.id,
      name:            consumers.name,
      productId:       consumers.productId,
      environmentId:   consumers.environmentId,
      planId:          consumers.planId,
      gatewayId:       consumers.gatewayId,
      createdBy:       consumers.createdBy,
      updatedBy:       consumers.updatedBy,
      createdAt:       consumers.createdAt,
      updatedAt:       consumers.updatedAt,
      productName:     products.displayName,
      environmentName: environments.name,
      planName:        plans.displayName,
      clientId:        consumers.clientId,
      awsApiKeyId:     consumers.awsApiKeyId,
      tokenUrl:        consumers.tokenUrl,
    })
    .from(consumers)
    .innerJoin(products,     eq(consumers.productId,     products.id))
    .innerJoin(environments, eq(consumers.environmentId, environments.id))
    .innerJoin(plans,        eq(consumers.planId,        plans.id))
    .where(eq(consumers.gatewayId, gatewayId))
    .orderBy(consumers.createdAt)

}

export async function findConsumerById(id: number): Promise<Consumer | undefined> {
  const [row] = await db.select().from(consumers).where(eq(consumers.id, id))
  return row
}

export async function createConsumer(data: NewConsumer): Promise<Consumer> {
  const [created] = await db.insert(consumers).values(data).returning()
  return created
}

export async function updateConsumer(
  id: number,
  patch: Pick<NewConsumer, "name" | "productId" | "environmentId" | "planId" | "updatedBy" | "updatedAt">,
): Promise<void> {
  await db.update(consumers).set(patch).where(eq(consumers.id, id))
}

export async function deleteConsumer(id: number): Promise<void> {
  await db.delete(consumers).where(eq(consumers.id, id))
}

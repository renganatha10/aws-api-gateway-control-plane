import { count, eq, sql } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { environments, gateways, type Gateway, type NewGateway } from "~/lib/schema"

export async function createGateway(gateway: NewGateway): Promise<Gateway> {
  const [created] = await db.insert(gateways).values(gateway).returning()
  return created
}

export async function createGatewayWithEnvironments(
  gateway: NewGateway,
  envNames: string[],
): Promise<Gateway> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(gateways).values(gateway).returning()
    if (envNames.length > 0) {
      await tx.insert(environments).values(
        envNames.map((name) => ({ name, gatewayId: created.id, createdBy: gateway.createdBy })),
      )
    }
    return created
  })
}

export async function listGateways(createdBy: string): Promise<Gateway[]> {
  return db.select().from(gateways).where(eq(gateways.createdBy, createdBy)).orderBy(gateways.createdAt)
}

export async function findGatewayById(id: number): Promise<Gateway | undefined> {
  const [row] = await db.select().from(gateways).where(eq(gateways.id, id))
  return row
}

export async function deleteGateway(id: number): Promise<void> {
  await db.delete(gateways).where(eq(gateways.id, id))
}

export async function updateGatewayAwsId(id: number, awsRestApiId: string): Promise<void> {
  await db
    .update(gateways)
    .set({ awsRestApiId, updatedAt: sql`now()` })
    .where(eq(gateways.id, id))
}

export async function countGateways(createdBy: string): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(gateways).where(eq(gateways.createdBy, createdBy))
  return Number(value)
}

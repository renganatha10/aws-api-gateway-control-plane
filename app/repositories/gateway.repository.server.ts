import { count, eq } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { environments, gateways, type Gateway, type NewGateway } from "~/lib/schema"

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

export async function listGateways(): Promise<Gateway[]> {
  return db.select().from(gateways).orderBy(gateways.createdAt)
}

export async function findGatewayById(id: number): Promise<Gateway | undefined> {
  const [row] = await db.select().from(gateways).where(eq(gateways.id, id))
  return row
}

export async function deleteGateway(id: number): Promise<void> {
  await db.delete(gateways).where(eq(gateways.id, id))
}

export async function countGateways(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(gateways)
  return Number(value)
}

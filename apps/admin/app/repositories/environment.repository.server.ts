import { eq } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { environments, type Environment, type NewEnvironment } from "~/lib/schema"

export async function createEnvironment(data: NewEnvironment): Promise<Environment> {
  const [created] = await db.insert(environments).values(data).returning()
  return created
}

export async function listEnvironmentsByGateway(gatewayId: number): Promise<Environment[]> {
  return db.select().from(environments).where(eq(environments.gatewayId, gatewayId))
}

export async function findEnvironmentById(id: number): Promise<Environment | null> {
  const [row] = await db.select().from(environments).where(eq(environments.id, id))
  return row ?? null
}

export async function deleteEnvironment(id: number): Promise<void> {
  await db.delete(environments).where(eq(environments.id, id))
}

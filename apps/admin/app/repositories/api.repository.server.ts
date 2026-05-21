import { and, eq, ne } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { apis, type Api, type NewApi } from "~/lib/schema"

export async function createApi(api: NewApi): Promise<Api> {
  const [created] = await db.insert(apis).values(api).returning()
  return created
}

export async function listApisByGateway(gatewayId: number): Promise<Api[]> {
  return db.select().from(apis).where(eq(apis.gatewayId, gatewayId)).orderBy(apis.createdAt)
}

export async function findApiById(id: number): Promise<Api | undefined> {
  const [row] = await db.select().from(apis).where(eq(apis.id, id))
  return row
}

export async function findApiByGatewayAndBasePath(
  gatewayId: number,
  basePath: string,
  excludeId?: number,
): Promise<Api | undefined> {
  const conditions = [eq(apis.gatewayId, gatewayId), eq(apis.basePath, basePath)]
  if (excludeId !== undefined) conditions.push(ne(apis.id, excludeId))
  const [row] = await db.select().from(apis).where(and(...conditions))
  return row
}

export async function updateApi(
  id: number,
  patch: Pick<NewApi, "scope" | "spec" | "basePath" | "awsApiId" | "updatedBy" | "updatedAt">,
): Promise<void> {
  await db.update(apis).set(patch).where(eq(apis.id, id))
}

export async function deleteApi(id: number): Promise<void> {
  await db.delete(apis).where(eq(apis.id, id))
}

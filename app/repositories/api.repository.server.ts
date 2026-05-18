import { eq } from "drizzle-orm"

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

export async function updateApi(
  id: number,
  patch: Pick<NewApi, "scope" | "spec">,
): Promise<void> {
  await db.update(apis).set(patch).where(eq(apis.id, id))
}

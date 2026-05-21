import { eq, sql } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { domainRouteMappings, apis, type DomainRouteMapping } from "~/lib/schema"

export async function countMappingsByDomain(domainId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(domainRouteMappings)
    .where(eq(domainRouteMappings.domainId, domainId))
  return row?.count ?? 0
}

export async function listMappingsWithApiByDomain(domainId: number) {
  return db
    .select({
      id:             domainRouteMappings.id,
      domainId:       domainRouteMappings.domainId,
      apiId:          domainRouteMappings.apiId,
      stage:          domainRouteMappings.stage,
      basePath:       domainRouteMappings.basePath,
      createdAt:      domainRouteMappings.createdAt,
      awsApiId:       apis.awsApiId,
      apiDisplayName: apis.displayName,
    })
    .from(domainRouteMappings)
    .innerJoin(apis, eq(domainRouteMappings.apiId, apis.id))
    .where(eq(domainRouteMappings.domainId, domainId))
}

export async function replaceMappings(
  domainId: number,
  mappings: Array<{ apiId: number; stage: string; basePath: string }>,
): Promise<DomainRouteMapping[]> {
  await db.delete(domainRouteMappings).where(eq(domainRouteMappings.domainId, domainId))
  if (mappings.length === 0) return []
  return db
    .insert(domainRouteMappings)
    .values(mappings.map((m) => ({ ...m, domainId })))
    .returning()
}

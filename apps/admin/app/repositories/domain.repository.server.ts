import { eq, sql } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { domains, domainRouteMappings, type Domain, type NewDomain } from "~/lib/schema"

export async function createDomain(data: NewDomain): Promise<Domain> {
  const [created] = await db.insert(domains).values(data).returning()
  return created
}

export async function findDomainById(id: number): Promise<Domain | undefined> {
  const [row] = await db.select().from(domains).where(eq(domains.id, id))
  return row
}

export async function listDomainsByGateway(gatewayId: number) {
  return db
    .select({
      id:             domains.id,
      gatewayId:      domains.gatewayId,
      domainName:     domains.domainName,
      certificateArn: domains.certificateArn,
      awsDomainName:  domains.awsDomainName,
      endpointType:   domains.endpointType,
      godaddyDomain:  domains.godaddyDomain,
      createdBy:      domains.createdBy,
      createdAt:      domains.createdAt,
      mappingCount:   sql<number>`count(${domainRouteMappings.id})::int`.as("mapping_count"),
    })
    .from(domains)
    .leftJoin(domainRouteMappings, eq(domainRouteMappings.domainId, domains.id))
    .where(eq(domains.gatewayId, gatewayId))
    .groupBy(domains.id)
    .orderBy(domains.createdAt)
}

export async function updateDomainAwsTarget(id: number, awsDomainName: string): Promise<void> {
  await db
    .update(domains)
    .set({ awsDomainName, updatedAt: new Date() })
    .where(eq(domains.id, id))
}

export async function deleteDomain(id: number): Promise<void> {
  await db.delete(domains).where(eq(domains.id, id))
}

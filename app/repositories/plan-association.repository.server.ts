import { and, eq } from "drizzle-orm"
import { db } from "~/lib/db.server"
import { planAssociations, plans, type NewPlanAssociation } from "~/lib/schema"

export async function addPlanToProduct(data: NewPlanAssociation) {
  const [created] = await db.insert(planAssociations).values(data).returning()
  return created
}

export async function removePlanFromProduct(productId: number, planId: number) {
  await db
    .delete(planAssociations)
    .where(and(eq(planAssociations.productId, productId), eq(planAssociations.planId, planId)))
}

export async function syncPlanAssociations(
  productId: number,
  newPlanIds: number[],
  gatewayId: number,
  createdBy: string,
) {
  const existing = await db
    .select({ planId: planAssociations.planId })
    .from(planAssociations)
    .where(eq(planAssociations.productId, productId))
  const existingIds = existing.map((r) => r.planId)

  for (const planId of existingIds) {
    if (!newPlanIds.includes(planId)) {
      await db
        .delete(planAssociations)
        .where(and(eq(planAssociations.productId, productId), eq(planAssociations.planId, planId)))
    }
  }
  for (const planId of newPlanIds) {
    if (!existingIds.includes(planId)) {
      await db.insert(planAssociations).values({ productId, planId, gatewayId, createdBy })
    }
  }
}

export async function listPlansByProduct(productId: number) {
  return db
    .select({
      id:          plans.id,
      name:        plans.name,
      displayName: plans.displayName,
      throttle:    plans.throttle,
      burst:       plans.burst,
      quotaLimit:  plans.quotaLimit,
      quotaPeriod: plans.quotaPeriod,
      gatewayId:   plans.gatewayId,
      createdAt:   plans.createdAt,
    })
    .from(planAssociations)
    .innerJoin(plans, eq(planAssociations.planId, plans.id))
    .where(eq(planAssociations.productId, productId))
}

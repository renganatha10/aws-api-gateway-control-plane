import { eq } from "drizzle-orm"

import { db } from "~/lib/db.server"
import { plans, type Plan, type NewPlan } from "~/lib/schema"

export async function listPlansByGateway(gatewayId: number): Promise<Plan[]> {
  return db.select().from(plans).where(eq(plans.gatewayId, gatewayId)).orderBy(plans.createdAt)
}

export async function findPlanById(id: number): Promise<Plan | undefined> {
  const [row] = await db.select().from(plans).where(eq(plans.id, id))
  return row
}

export async function createPlan(data: NewPlan): Promise<Plan> {
  const [created] = await db.insert(plans).values(data).returning()
  return created
}

export async function updatePlan(
  id: number,
  patch: Pick<NewPlan, "displayName" | "name" | "throttle" | "burst" | "quotaLimit" | "quotaPeriod" | "awsUsagePlanId" | "updatedBy" | "updatedAt">,
): Promise<void> {
  await db.update(plans).set(patch).where(eq(plans.id, id))
}

export async function deletePlan(id: number): Promise<void> {
  await db.delete(plans).where(eq(plans.id, id))
}

import {
  CreateUsagePlanCommand,
  DeleteUsagePlanCommand,
  type Op,
  UpdateUsagePlanCommand,
} from "@aws-sdk/client-api-gateway";

import { apigwClient } from "./client.server";

export interface UsagePlanParams {
  name: string;
  throttle?: number | null;
  burst?: number | null;
  quotaLimit?: number | null;
  quotaPeriod?: string | null;
}

/** Create an AWS usage plan and return its ID. */
export async function createUsagePlan(params: UsagePlanParams): Promise<string> {
  const result = await apigwClient.send(
    new CreateUsagePlanCommand({
      name: params.name,
      throttle: buildThrottle(params),
      quota: buildQuota(params),
    })
  );
  if (!result.id) throw new Error("CreateUsagePlan returned no ID");
  console.log("[aws:usage-plan] created", { id: result.id, name: params.name });
  return result.id;
}

/** Update an existing AWS usage plan in-place. */
export async function updateUsagePlan(usagePlanId: string, params: UsagePlanParams): Promise<void> {
  const ops: Array<{ op: Op; path: string; value?: string }> = [
    { op: "replace", path: "/name", value: params.name },
  ];

  if (params.throttle != null) {
    ops.push({ op: "replace", path: "/throttle/rateLimit", value: String(params.throttle) });
  }
  if (params.burst != null) {
    ops.push({ op: "replace", path: "/throttle/burstLimit", value: String(params.burst) });
  }
  if (params.quotaLimit != null) {
    ops.push({ op: "replace", path: "/quota/limit", value: String(params.quotaLimit) });
  }
  if (params.quotaPeriod) {
    ops.push({ op: "replace", path: "/quota/period", value: params.quotaPeriod.toUpperCase() });
  }

  await apigwClient.send(new UpdateUsagePlanCommand({ usagePlanId, patchOperations: ops }));
  console.log("[aws:usage-plan] updated", { usagePlanId });
}

/** Delete an AWS usage plan by ID. */
export async function deleteUsagePlan(usagePlanId: string): Promise<void> {
  await apigwClient.send(new DeleteUsagePlanCommand({ usagePlanId }));
  console.log("[aws:usage-plan] deleted", { usagePlanId });
}

function buildThrottle(p: UsagePlanParams) {
  if (p.throttle == null && p.burst == null) return undefined;
  return {
    rateLimit: p.throttle ?? undefined,
    burstLimit: p.burst ?? undefined,
  };
}

function buildQuota(p: UsagePlanParams) {
  if (p.quotaLimit == null || !p.quotaPeriod) return undefined;
  return {
    limit: p.quotaLimit,
    period: p.quotaPeriod.toUpperCase() as "DAY" | "WEEK" | "MONTH",
  };
}

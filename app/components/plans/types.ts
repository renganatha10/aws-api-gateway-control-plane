import type { Plan } from "~/lib/schema"

export type QuotaPeriod = "day" | "week" | "month"

export const QUOTA_LABEL: Record<QuotaPeriod, string> = {
  day:   "day",
  week:  "week",
  month: "month",
}

export const EMPTY_FORM = {
  name:        "",
  throttle:    "" as number | "",
  burst:       "" as number | "",
  quotaLimit:  "" as number | "",
  quotaPeriod: "month" as QuotaPeriod,
}

export type PlanForm = typeof EMPTY_FORM
export type FormErrors = Partial<Record<"name", string>>

export function formFromPlan(p: Plan): PlanForm {
  return {
    name:        p.name,
    throttle:    p.throttle ?? "",
    burst:       p.burst ?? "",
    quotaLimit:  p.quotaLimit ?? "",
    quotaPeriod: (p.quotaPeriod as QuotaPeriod) ?? "month",
  }
}

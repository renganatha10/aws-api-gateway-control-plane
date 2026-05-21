import { useState } from "react"
import { useFetcher } from "react-router"
import { Zap } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import {
  createPlan,
  deletePlan,
  findPlanById,
  listPlansByGateway,
  updatePlan,
} from "~/repositories/plan.repository.server"
import {
  createUsagePlan,
  deleteUsagePlan,
  updateUsagePlan,
} from "~/aws/usage-plan.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import type { Plan } from "~/lib/schema"
import type { Route } from "./+types/plans"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Plans" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const gatewayId       = await getActiveGatewayId(request)
  const plans           = gatewayId ? await listPlansByGateway(gatewayId) : []
  return { plans, gatewayId, email }
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const formData        = await request.formData()
  const intent          = formData.get("_intent") as string

  if (intent === "create") {
    const gatewayId   = Number(formData.get("gatewayId"))
    if (!gatewayId) return { error: "No gateway" }

    const name        = String(formData.get("name")).trim()
    const displayName = `${name}-${gatewayId}`
    const params = {
      name,
      displayName,
      throttle:    toIntOrNull(formData.get("throttle")),
      burst:       toIntOrNull(formData.get("burst")),
      quotaLimit:  toIntOrNull(formData.get("quotaLimit")),
      quotaPeriod: (formData.get("quotaPeriod") as string) || null,
    }

    let awsUsagePlanId: string | null = null
    try {
      awsUsagePlanId = await createUsagePlan({ ...params, name: displayName })
    } catch (err) {
      console.error("[plans] AWS createUsagePlan failed", err)
      return { error: "Failed to sync with AWS. Please try again." }
    }

    try {
      await createPlan({ ...params, gatewayId, createdBy: email, awsUsagePlanId })
    } catch (err) {
      console.error("[plans] createPlan DB failed", err)
      return { error: "Something went wrong while saving. Please try again." }
    }
    return { ok: true }
  }

  if (intent === "update") {
    const id = Number(formData.get("id"))
    if (!id) return { error: "Missing id" }

    const existing = await findPlanById(id)
    if (!existing) return { error: "Plan not found" }

    const name        = String(formData.get("name")).trim()
    const displayName = `${name}-${existing.gatewayId}`
    const params = {
      name,
      displayName,
      throttle:    toIntOrNull(formData.get("throttle")),
      burst:       toIntOrNull(formData.get("burst")),
      quotaLimit:  toIntOrNull(formData.get("quotaLimit")),
      quotaPeriod: (formData.get("quotaPeriod") as string) || null,
    }

    if (existing.awsUsagePlanId) {
      try {
        await updateUsagePlan(existing.awsUsagePlanId, { ...params, name: displayName })
      } catch (err) {
        console.error("[plans] AWS updateUsagePlan failed", err)
        return { error: "Failed to sync with AWS. Please try again." }
      }
    }

    try {
      await updatePlan(id, {
        ...params,
        awsUsagePlanId: existing.awsUsagePlanId ?? null,
        updatedBy: email,
        updatedAt: new Date(),
      })
    } catch (err) {
      console.error("[plans] updatePlan DB failed", err)
      return { error: "Something went wrong while saving. Please try again." }
    }
    return { ok: true }
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"))
    if (!id) return { error: "Missing id" }

    const existing = await findPlanById(id)
    if (!existing) return { error: "Plan not found" }

    if (existing.awsUsagePlanId) {
      try {
        await deleteUsagePlan(existing.awsUsagePlanId)
      } catch (err) {
        console.error("[plans] AWS deleteUsagePlan failed", err)
        return { error: "Failed to sync with AWS. Please try again." }
      }
    }

    try {
      await deletePlan(id)
    } catch (err) {
      console.error("[plans] deletePlan DB failed", err)
      return { error: "Something went wrong while deleting. Please try again." }
    }
    return { ok: true }
  }

  return { error: "Unknown intent" }
}

function toIntOrNull(v: FormDataEntryValue | null): number | null {
  if (!v || v === "") return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

type QuotaPeriod = "day" | "week" | "month"

const QUOTA_LABEL: Record<QuotaPeriod, string> = { day: "day", week: "week", month: "month" }

const EMPTY_FORM = {
  name:        "",
  throttle:    "" as number | "",
  burst:       "" as number | "",
  quotaLimit:  "" as number | "",
  quotaPeriod: "month" as QuotaPeriod,
}

type PlanForm = typeof EMPTY_FORM
type FormErrors = Partial<Record<"name", string>>

function formFromPlan(p: Plan): PlanForm {
  return {
    name:        p.name,
    throttle:    p.throttle ?? "",
    burst:       p.burst ?? "",
    quotaLimit:  p.quotaLimit ?? "",
    quotaPeriod: (p.quotaPeriod as QuotaPeriod) ?? "month",
  }
}

export default function PlansPage({ loaderData }: Route.ComponentProps) {
  const { plans, gatewayId } = loaderData
  const fetcher = useFetcher()

  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [editingPlan,  setEditingPlan]  = useState<Plan | null>(null)
  const [form,         setForm]         = useState<PlanForm>(EMPTY_FORM)
  const [errors,       setErrors]       = useState<FormErrors>({})
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const submitting = fetcher.state !== "idle"

  function openCreate() {
    setEditingPlan(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setForm(formFromPlan(plan))
    setErrors({})
    setDialogOpen(true)
  }

  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.name.trim()) e.name = "Name is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    const base = {
      name:        form.name.trim(),
      throttle:    form.throttle   === "" ? "" : String(form.throttle),
      burst:       form.burst      === "" ? "" : String(form.burst),
      quotaLimit:  form.quotaLimit === "" ? "" : String(form.quotaLimit),
      quotaPeriod: form.quotaPeriod,
    }
    if (editingPlan) {
      fetcher.submit({ _intent: "update", id: String(editingPlan.id), ...base }, { method: "post" })
    } else {
      fetcher.submit({ _intent: "create", gatewayId: String(gatewayId), ...base }, { method: "post" })
    }
    setDialogOpen(false)
  }

  function handleDelete(id: number) {
    fetcher.submit({ _intent: "delete", id: String(id) }, { method: "post" })
    setDeleteConfirm(null)
  }

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-3xl font-normal text-gray-900">Plans</h1>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm px-6"
          disabled={!gatewayId}
          onClick={openCreate}
        >
          Add
        </Button>
      </div>

      <Separator />

      {/* No gateway */}
      {!gatewayId && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-500 text-sm">Select a gateway from the sidebar to view its plans.</p>
        </div>
      )}

      {/* Empty state */}
      {gatewayId && plans.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h4"/>
          </svg>
          <p className="text-gray-700 font-medium">No plans yet</p>
          <p className="text-gray-500 text-sm">Create your first plan to get started.</p>
          <Button size="sm" className="mt-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}>
            Create Plan
          </Button>
        </div>
      )}

      {/* Card grid */}
      {gatewayId && plans.length > 0 && (
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="group relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Name + hover actions */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(plan)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"
                      aria-label="Edit plan"
                    >
                      <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>

                    {deleteConfirm === plan.id ? (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          Delete
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(plan.id)}
                        className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                        aria-label="Delete plan"
                      >
                        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <dl className="space-y-2 text-sm">
                  {plan.throttle != null && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Throttle</dt>
                      <dd>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {plan.throttle}/sec
                        </Badge>
                      </dd>
                    </div>
                  )}
                  {plan.burst != null && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Burst</dt>
                      <dd>
                        <Badge variant="outline" className="font-mono text-xs">
                          {plan.burst}/sec
                        </Badge>
                      </dd>
                    </div>
                  )}
                  {plan.quotaLimit != null && plan.quotaPeriod && (
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Quota</dt>
                      <dd>
                        <Badge variant="outline" className="font-mono text-xs">
                          {plan.quotaLimit.toLocaleString()}/{QUOTA_LABEL[plan.quotaPeriod as QuotaPeriod]}
                        </Badge>
                      </dd>
                    </div>
                  )}
                  {plan.throttle == null && plan.burst == null && plan.quotaLimit == null && (
                    <p className="text-xs text-muted-foreground italic">No limits configured</p>
                  )}
                </dl>
              </div>
            ))}

            {/* Add new card */}
            <button
              onClick={openCreate}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 p-8 text-muted-foreground transition-colors hover:border-gray-400 hover:text-gray-700 min-h-[160px]"
            >
              <div className="flex size-9 items-center justify-center rounded-full border-2 border-current">
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span className="text-sm font-medium">New Plan</span>
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setErrors({}) }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="plan-name">Name</Label>
              <Input
                id="plan-name"
                placeholder="e.g. gold"
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((e) => ({ ...e, name: undefined })) }}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Throttle */}
            <div className="grid gap-1.5">
              <Label htmlFor="plan-throttle">
                Throttle <span className="text-muted-foreground font-normal">(requests/sec, optional)</span>
              </Label>
              <Input
                id="plan-throttle"
                type="number"
                min={1}
                placeholder="e.g. 100"
                value={form.throttle}
                onChange={(e) => setForm((f) => ({ ...f, throttle: e.target.value === "" ? "" : Number(e.target.value) }))}
              />
            </div>

            {/* Burst */}
            <div className="grid gap-1.5">
              <Label htmlFor="plan-burst">
                Burst <span className="text-muted-foreground font-normal">(requests/sec, optional)</span>
              </Label>
              <Input
                id="plan-burst"
                type="number"
                min={1}
                placeholder="e.g. 200"
                value={form.burst}
                onChange={(e) => setForm((f) => ({ ...f, burst: e.target.value === "" ? "" : Number(e.target.value) }))}
              />
            </div>

            {/* Quota */}
            <div className="grid gap-1.5">
              <Label>
                Quota <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 100000"
                  className="flex-1"
                  value={form.quotaLimit}
                  onChange={(e) => setForm((f) => ({ ...f, quotaLimit: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <Select
                  value={form.quotaPeriod}
                  onValueChange={(v) => setForm((f) => ({ ...f, quotaPeriod: v as QuotaPeriod }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">per day</SelectItem>
                    <SelectItem value="week">per week</SelectItem>
                    <SelectItem value="month">per month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {editingPlan ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

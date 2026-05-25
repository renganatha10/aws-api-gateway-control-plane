import { useState } from "react"
import { useFetcher } from "react-router"
import { Zap } from "lucide-react"
import type { Plan } from "~/lib/schema"
import { Button } from "~/components/ui/button"
import { PlanCard } from "./plan-card"
import { PlanFormDialog } from "./plan-form-dialog"
import {
  EMPTY_FORM,
  formFromPlan,
  type FormErrors,
  type PlanForm,
} from "./types"

interface PlansPageProps {
  plans: Plan[]
  organisationId: number | null
}

export function PlansPage({ plans, organisationId }: PlansPageProps) {
  const fetcher = useFetcher()

  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [form,        setForm]        = useState<PlanForm>(EMPTY_FORM)
  const [errors,      setErrors]      = useState<FormErrors>({})

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

  function handleFormChange(patch: Partial<PlanForm>) {
    setForm((f) => ({ ...f, ...patch }))
    if ("name" in patch) setErrors((e) => ({ ...e, name: undefined }))
  }

  function handleSave() {
    if (!form.name.trim()) {
      setErrors({ name: "Name is required" })
      return
    }
    const base = {
      name:        form.name.trim(),
      throttle:    form.throttle   === "" ? "" : String(form.throttle),
      burst:       form.burst      === "" ? "" : String(form.burst),
      quotaLimit:  form.quotaLimit === "" ? "" : String(form.quotaLimit),
      quotaPeriod: form.quotaPeriod,
    }
    if (editingPlan) {
      fetcher.submit(
        { _intent: "update", id: String(editingPlan.id), ...base },
        { method: "post" },
      )
    } else {
      fetcher.submit(
        { _intent: "create", organisationId: String(organisationId), ...base },
        { method: "post" },
      )
    }
    setDialogOpen(false)
  }

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-3xl font-normal text-gray-900">Plans</h1>
        <Button size="sm" disabled={!organisationId} onClick={openCreate}>
          Add
        </Button>
      </div>

      {!organisationId && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-500 text-sm">Select an Organisation from the sidebar to view its plans.</p>
        </div>
      )}

      {organisationId && plans.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 mt-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">No plans yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <button
                onClick={openCreate}
                className="underline underline-offset-2 hover:text-gray-700"
              >
                Create your first plan
              </button>
            </p>
          </div>
        </div>
      )}

      {organisationId && plans.length > 0 && (
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onEdit={openEdit} />
            ))}

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

      <PlanFormDialog
        open={dialogOpen}
        editingPlan={editingPlan}
        form={form}
        errors={errors}
        submitting={submitting}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setErrors({}) }}
        onFormChange={handleFormChange}
        onSave={handleSave}
      />
    </div>
  )
}

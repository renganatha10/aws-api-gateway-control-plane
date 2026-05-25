import type { Plan } from "~/lib/schema"
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
import type { FormErrors, PlanForm, QuotaPeriod } from "./types"

interface PlanFormDialogProps {
  open: boolean
  editingPlan: Plan | null
  form: PlanForm
  errors: FormErrors
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onFormChange: (patch: Partial<PlanForm>) => void
  onSave: () => void
}

export function PlanFormDialog({
  open,
  editingPlan,
  form,
  errors,
  submitting,
  onOpenChange,
  onFormChange,
  onSave,
}: PlanFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              placeholder="e.g. gold"
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

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
              onChange={(e) =>
                onFormChange({ throttle: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>

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
              onChange={(e) =>
                onFormChange({ burst: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>

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
                onChange={(e) =>
                  onFormChange({ quotaLimit: e.target.value === "" ? "" : Number(e.target.value) })
                }
              />
              <Select
                value={form.quotaPeriod}
                onValueChange={(v) => onFormChange({ quotaPeriod: v as QuotaPeriod })}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-black hover:bg-gray-900 text-white"
            onClick={onSave}
            disabled={submitting}
          >
            {editingPlan ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

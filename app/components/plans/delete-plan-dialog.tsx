import { useFetcher } from "react-router"
import type { Plan } from "~/lib/schema"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

interface DeletePlanDialogProps {
  plan: Plan
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePlanDialog({ plan, open, onOpenChange }: DeletePlanDialogProps) {
  const deleteFetcher = useFetcher()
  const deleteError =
    deleteFetcher.data && "error" in deleteFetcher.data
      ? (deleteFetcher.data as { error: string }).error
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Plan</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-medium text-foreground">{plan.name}</span>?
          This will also remove it from AWS.
        </p>
        {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <deleteFetcher.Form method="post">
            <input type="hidden" name="_intent" value="delete" />
            <input type="hidden" name="id" value={String(plan.id)} />
            <Button
              type="submit"
              variant="destructive"
              disabled={deleteFetcher.state !== "idle"}
            >
              {deleteFetcher.state !== "idle" ? "Deleting…" : "Delete"}
            </Button>
          </deleteFetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface DeleteProductDialogProps {
  open: boolean;
  productName: string;
  onOpenChange: (open: boolean) => void;
}

export function DeleteProductDialog({ open, productName, onOpenChange }: DeleteProductDialogProps) {
  const deleteFetcher = useFetcher();
  const data = deleteFetcher.data as { deleteError?: string } | undefined;
  const deleteError = data?.deleteError ?? null;
  const busy = deleteFetcher.state !== "idle";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-gray-900">{productName}</span>? All consumers must be
          removed first.
        </p>
        {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <deleteFetcher.Form method="post">
            <input type="hidden" name="_intent" value="delete" />
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </deleteFetcher.Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

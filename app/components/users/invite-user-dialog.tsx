import { useEffect } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const fetcher = useFetcher<{ inviteError?: string; ok?: boolean }>();
  const submitting = fetcher.state !== "idle";
  const inviteError =
    fetcher.data && "inviteError" in fetcher.data ? fetcher.data.inviteError : null;

  useEffect(() => {
    if (fetcher.data && "ok" in fetcher.data) onOpenChange(false);
  }, [fetcher.data, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
        </DialogHeader>

        <fetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="_intent" value="invite" />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" placeholder="Jane" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" placeholder="Doe" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="jane@company.com" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="viewer">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="portal-user">Portal User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-black hover:bg-gray-900 text-white"
              disabled={submitting}
            >
              {submitting ? "Inviting…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

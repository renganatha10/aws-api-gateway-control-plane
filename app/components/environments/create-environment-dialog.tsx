import { useState } from "react"
import { useFetcher } from "react-router"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"

interface CreateEnvironmentDialogProps {
  open: boolean
  organisationId: number | null
  onOpenChange: (open: boolean) => void
}

export function CreateEnvironmentDialog({
  open,
  organisationId,
  onOpenChange,
}: CreateEnvironmentDialogProps) {
  const fetcher = useFetcher()
  const [name,      setName]      = useState("")
  const [nameError, setNameError] = useState("")

  const creating = fetcher.state !== "idle"

  function handleCreate() {
    if (!name.trim()) { setNameError("Name is required"); return }
    if (!organisationId) { setNameError("No organisation selected"); return }
    fetcher.submit(
      { _intent: "create", name: name.trim(), organisationId: String(organisationId) },
      { method: "post" },
    )
    setName("")
    setNameError("")
    onOpenChange(false)
  }

  function handleOpenChange(v: boolean) {
    onOpenChange(v)
    if (!v) { setName(""); setNameError("") }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create Environment</DialogTitle>
          <DialogDescription>Give your new environment a name.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 py-4">
          <Label htmlFor="env-name">Name</Label>
          <Input
            id="env-name"
            placeholder="e.g. Production"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError("") }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-black hover:bg-gray-900 text-white"
            onClick={handleCreate}
            disabled={creating}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from "react"
import { Link, useFetcher } from "react-router"
import { Trash2, Zap } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { getUserProfile } from "~/lib/cognito.server"
import {
  createEnvironment,
  deleteEnvironment,
  listEnvironmentsByGateway,
} from "~/repositories/environment.repository.server"
import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Separator } from "~/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { Route } from "./+types/environments"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Environments" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const gatewayId       = await getActiveGatewayId(request)
  const environments    = gatewayId ? await listEnvironmentsByGateway(gatewayId) : []
  return { environments, gatewayId, email }
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request)
  const { email }       = getUserProfile(accessToken)
  const formData        = await request.formData()
  const intent          = formData.get("_intent") as string

  if (intent === "create") {
    const name      = String(formData.get("name") ?? "").trim()
    const gatewayId = Number(formData.get("gatewayId"))
    if (!name || !gatewayId) return { error: "Invalid data" }
    await createEnvironment({ name, gatewayId, createdBy: email })
    return { ok: true }
  }

  if (intent === "delete") {
    const id = Number(formData.get("id"))
    if (!id) return { error: "Missing id" }
    await deleteEnvironment(id)
    return { ok: true }
  }

  return { error: "Unknown intent" }
}

function DeleteButton({ id }: { id: number }) {
  const fetcher  = useFetcher()
  const [confirm, setConfirm] = useState(false)
  const deleting = fetcher.state !== "idle"

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            fetcher.submit({ _intent: "delete", id: String(id) }, { method: "post" })
            setConfirm(false)
          }}
          className="text-xs text-red-600 font-medium hover:underline"
        >
          Delete
        </button>
        <span className="text-gray-300">|</span>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-500 hover:underline">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      disabled={deleting}
      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
      aria-label="Delete environment"
    >
      <Trash2 className="size-4" />
    </button>
  )
}

export default function EnvironmentsPage({ loaderData }: Route.ComponentProps) {
  const { environments, gatewayId } = loaderData
  const fetcher  = useFetcher()
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState("")
  const [nameError, setNameError] = useState("")

  const creating = fetcher.state !== "idle"

  function handleCreate() {
    if (!name.trim()) { setNameError("Name is required"); return }
    if (!gatewayId)   { setNameError("No gateway selected"); return }
    fetcher.submit(
      { _intent: "create", name: name.trim(), gatewayId: String(gatewayId) },
      { method: "post" },
    )
    setName("")
    setNameError("")
    setOpen(false)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) { setName(""); setNameError("") }
  }

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-3xl font-normal text-gray-900">Environments</h1>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm px-6"
              disabled={!gatewayId}
            >
              Add
            </Button>
          </DialogTrigger>

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
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* No gateway selected */}
      {!gatewayId && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-500 text-sm">Select a gateway from the sidebar to view its environments.</p>
        </div>
      )}

      {/* Empty state */}
      {gatewayId && environments.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 py-24 text-center gap-3">
          <Zap className="size-10 text-gray-300" />
          <p className="text-gray-700 font-medium">No environments yet</p>
          <p className="text-gray-500 text-sm">Create your first environment to get started.</p>
          <Button
            size="sm"
            className="mt-2 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setOpen(true)}
          >
            Create Environment
          </Button>
        </div>
      )}

      {/* Table */}
      {gatewayId && environments.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-100 hover:bg-gray-100">
              <TableHead className="w-[35%] font-semibold text-gray-700">Name</TableHead>
              <TableHead className="w-[30%] font-semibold text-gray-700">Created By</TableHead>
              <TableHead className="w-[25%] font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  Created
                  <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </span>
              </TableHead>
              <TableHead className="w-[10%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {environments.map((env) => (
              <TableRow key={env.id} className="border-b border-gray-200">
                <TableCell>
                  <Link
                    to={`/environments/${env.id}`}
                    className="text-gray-900 hover:underline"
                  >
                    {env.name}
                  </Link>
                </TableCell>
                <TableCell className="text-gray-700">{env.createdBy}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(env.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right pr-4">
                  <DeleteButton id={env.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

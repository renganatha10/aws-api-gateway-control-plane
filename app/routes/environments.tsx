import { useState } from "react"
import { Link } from "react-router"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import type { Route } from "./+types/environments"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Environments" }]
}

type EnvType = "production" | "staging" | "development" | "sandbox"

interface Environment {
  id: number
  name: string
  type: EnvType
  baseUrl: string
  region: string
  lastDeployed: string
  apiCount: number
}

const TYPE_META: Record<EnvType, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  production: { label: "Production",  variant: "default"     },
  staging:    { label: "Staging",     variant: "secondary"   },
  development:{ label: "Development", variant: "outline"     },
  sandbox:    { label: "Sandbox",     variant: "outline"     },
}

const initialEnvs: Environment[] = [
  {
    id: 1,
    name: "Production",
    type: "production",
    baseUrl: "https://api.company.com",
    region: "us-east-1",
    lastDeployed: "2 hours ago",
    apiCount: 42,
  },
  {
    id: 2,
    name: "Staging",
    type: "staging",
    baseUrl: "https://api-staging.company.com",
    region: "us-east-1",
    lastDeployed: "1 day ago",
    apiCount: 42,
  },
  {
    id: 3,
    name: "Development",
    type: "development",
    baseUrl: "https://api-dev.company.com",
    region: "us-west-2",
    lastDeployed: "3 hours ago",
    apiCount: 38,
  },
  {
    id: 4,
    name: "Sandbox",
    type: "sandbox",
    baseUrl: "https://api-sandbox.company.com",
    region: "eu-west-1",
    lastDeployed: "5 days ago",
    apiCount: 15,
  },
]

const emptyForm = { name: "", type: "" as EnvType | "", baseUrl: "", region: "" as string }

type FormErrors = { name?: string; type?: string; baseUrl?: string; region?: string }

export default function EnvironmentsPage() {
  const [envs, setEnvs] = useState<Environment[]>(initialEnvs)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})

  function validate() {
    const e: FormErrors = {}
    if (!form.name.trim())    e.name    = "Name is required"
    if (!form.type)           e.type    = "Type is required"
    if (!form.baseUrl.trim()) e.baseUrl = "Base URL is required"
    if (!form.region.trim())  e.region  = "Region is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleCreate() {
    if (!validate()) return
    setEnvs((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: form.name.trim(),
        type: form.type as EnvType,
        baseUrl: form.baseUrl.trim(),
        region: form.region.trim(),
        lastDeployed: "Just now",
        apiCount: 0,
      },
    ])
    setForm(emptyForm)
    setErrors({})
    setOpen(false)
  }

  function handleDelete(id: number) {
    setEnvs((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Environments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your API deployment environments.
          </p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setErrors({}) } }}>
          <DialogTrigger asChild>
            <Button>
              <svg className="size-4 mr-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Environment
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Create Environment</DialogTitle>
              <DialogDescription>
                Add a new deployment environment for your APIs.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="grid gap-1.5">
                <Label htmlFor="env-name">Name</Label>
                <Input
                  id="env-name"
                  placeholder="e.g. Production"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              {/* Type */}
              <div className="grid gap-1.5">
                <Label htmlFor="env-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as EnvType }))}
                >
                  <SelectTrigger id="env-type">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
              </div>

              {/* Base URL */}
              <div className="grid gap-1.5">
                <Label htmlFor="env-url">Base URL</Label>
                <Input
                  id="env-url"
                  placeholder="https://api.example.com"
                  value={form.baseUrl}
                  onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                />
                {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl}</p>}
              </div>

              {/* Region */}
              <div className="grid gap-1.5">
                <Label htmlFor="env-region">Region</Label>
                <Select
                  value={form.region}
                  onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}
                >
                  <SelectTrigger id="env-region">
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                    <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                    <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                    <SelectItem value="ap-southeast-1">Asia Pacific (Singapore)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.region && <p className="text-xs text-destructive">{errors.region}</p>}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Separator />

      {/* Environment cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {envs.map((env) => {
          const meta = TYPE_META[env.type]
          return (
            <Card key={env.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{env.name}</CardTitle>
                  <Badge variant={meta.variant} className="shrink-0 text-xs">
                    {meta.label}
                  </Badge>
                </div>
                <CardDescription className="truncate text-xs">{env.baseUrl}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pb-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Region</dt>
                    <dd className="font-medium">{env.region}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">APIs</dt>
                    <dd className="font-medium">{env.apiCount}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Last deployed</dt>
                    <dd className="font-medium">{env.lastDeployed}</dd>
                  </div>
                </dl>
              </CardContent>

              <Separator />

              <CardFooter className="flex justify-between gap-2 pt-3">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link to={`/environments/${env.name.toLowerCase().replace(/\s+/g, "-")}`}>
                    View
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(env.id)}
                >
                  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </Button>
              </CardFooter>
            </Card>
          )
        })}

        {/* Add new card */}
        <button
          onClick={() => setOpen(true)}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 p-8 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground min-h-[200px]"
        >
          <div className="flex size-10 items-center justify-center rounded-full border-2 border-current">
            <svg className="size-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <span className="text-sm font-medium">New Environment</span>
        </button>
      </div>
    </div>
  )
}

import { useState } from "react"
import { Link, useFetcher, useLoaderData } from "react-router"
import { Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { getActiveGatewayId, requireAuth } from "~/lib/session.server"
import { deleteConsumer, listConsumersByGateway } from "~/repositories/consumer.repository.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Input } from "~/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import type { Route } from "./+types/consumers"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Consumers" }]
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request)
  const gatewayId = await getActiveGatewayId(request)
  const consumers = gatewayId ? await listConsumersByGateway(gatewayId) : []
  return { consumers, gatewayId }
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request)
  const formData = await request.formData()
  const intent   = formData.get("_intent") as string

  if (intent === "delete") {
    const id = Number(formData.get("id"))
    if (!id) return { error: "Missing id" }
    await deleteConsumer(id)
    return { ok: true }
  }

  return { error: "Unknown intent." }
}

type ConsumerRow = Awaited<ReturnType<typeof listConsumersByGateway>>[number]

// ── Reveal Secret ─────────────────────────────────────────────────────────────

function RevealSecret({ consumerId }: { consumerId: number }) {
  const fetcher  = useFetcher<{ secret?: string; error?: string }>()
  const [visible, setVisible] = useState(false)
  const secret   = fetcher.data?.secret
  const fetchErr = fetcher.data?.error

  if (fetchErr) {
    return <span className="text-xs text-destructive">{fetchErr}</span>
  }

  if (!secret) {
    return (
      <button
        onClick={() => fetcher.load(`/api/consumer-secret/${consumerId}`)}
        disabled={fetcher.state === "loading"}
        className="text-xs text-blue-600 hover:underline disabled:opacity-50"
      >
        {fetcher.state === "loading" ? "Loading…" : "Show secret"}
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className="font-mono text-xs text-gray-800 select-all">
        {visible ? secret : "••••••••••••••••"}
      </span>
      <button
        onClick={() => setVisible((v) => !v)}
        className="text-gray-400 hover:text-gray-700"
        title={visible ? "Hide" : "Show"}
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  )
}

// ── Row Actions ───────────────────────────────────────────────────────────────

function ConsumerActions({ consumer }: { consumer: ConsumerRow }) {
  const fetcher        = useFetcher()
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => {
            fetcher.submit({ _intent: "delete", id: String(consumer.id) }, { method: "post" })
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={`/consumers/${consumer.id}`}>
            <Pencil className="size-4 mr-2 text-gray-500" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setConfirm(true)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="size-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsumersPage() {
  const { consumers } = useLoaderData<typeof loader>()
  const [search, setSearch] = useState("")

  const filtered = consumers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.productName.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Consumers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage API consumers and their product subscriptions.</p>
        </div>
        <Button size="sm" asChild>
          <Link to="/consumers/new">New Consumer</Link>
        </Button>
      </div>

      <div className="px-6 py-4">
        <Input
          placeholder="Search consumers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">
              {consumers.length === 0 ? "No consumers yet" : "No consumers match your search"}
            </p>
            {consumers.length === 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <Link to="/consumers/new" className="underline underline-offset-2">Add your first consumer</Link>
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Product</TableHead>
                <TableHead className="font-semibold text-gray-700">Stage</TableHead>
                <TableHead className="font-semibold text-gray-700">Plan</TableHead>
                <TableHead className="font-semibold text-gray-700">Client ID</TableHead>
                <TableHead className="font-semibold text-gray-700">Client Secret</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((consumer) => (
                <TableRow key={consumer.id}>
                  <TableCell className="font-medium text-gray-900">{consumer.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {consumer.productName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                      {consumer.environmentName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-700 border-gray-200">
                      {consumer.planName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {consumer.clientId ? (
                      <span className="font-mono text-xs text-gray-700 select-all">{consumer.clientId}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {consumer.clientId ? (
                      <RevealSecret consumerId={consumer.id} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(consumer.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <ConsumerActions consumer={consumer} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

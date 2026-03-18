import { useRef, useState } from "react"
import { Link, useParams } from "react-router"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import type { Route } from "./+types/products.$id"

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `${params.id} — Product` }]
}

type RateUnit  = "second" | "minute" | "hour" | "day"
type QuotaUnit = "day" | "week" | "month"

interface Plan {
  id: number
  name: string
  rateLimit: number
  rateLimitUnit: RateUnit
  burstLimit: number | ""
  quota: number | ""
  quotaUnit: QuotaUnit
}

const RATE_UNIT_LABEL: Record<RateUnit, string>  = { second: "sec", minute: "min", hour: "hr", day: "day" }
const QUOTA_UNIT_LABEL: Record<QuotaUnit, string> = { day: "day", week: "week", month: "month" }

const SAMPLE_PLANS: Plan[] = [
  { id: 1, name: "Gold",   rateLimit: 1000, rateLimitUnit: "minute", burstLimit: 200, quota: 500000, quotaUnit: "month" },
  { id: 2, name: "Silver", rateLimit: 500,  rateLimitUnit: "minute", burstLimit: 100, quota: 100000, quotaUnit: "month" },
  { id: 3, name: "Bronze", rateLimit: 100,  rateLimitUnit: "minute", burstLimit: 20,  quota: 10000,  quotaUnit: "month" },
]

const EMPTY_PLAN_FORM = {
  name: "",
  rateLimit: "" as number | "",
  rateLimitUnit: "minute" as RateUnit,
  burstLimit: "" as number | "",
  quota: "" as number | "",
  quotaUnit: "month" as QuotaUnit,
}

interface ApiItem {
  name: string
  title: string
  version: string
  type: string
}

const ALL_APIS: ApiItem[] = [
  { title: "Portals - User Auth",        name: "portals-users-api",                 version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Out of home API",            name: "out-of-home-api",                   version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "HHT Tour API",               name: "hht-tour-api",                      version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Returns Api",                name: "portals-returns-api",               version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Client Query Api",           name: "portals-client-query-api",          version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "External Client Query Api",  name: "external-portals-client-query-api", version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "OTR Parcel API",             name: "otr-parcel-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "HHT Parcel API",             name: "hht-parcel-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "UTR Parcel API",             name: "utr-parcel-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Tour Event Query Api",       name: "tour-event-query-api",              version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Actus print service",        name: "actus-print-service",               version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Collections API",            name: "collections-api",                   version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "HHT Work Resourcing API",    name: "hht-work-resourcing-api",           version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "HHT Config API",             name: "hht-config-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "Actus Users Api",            name: "actus-users-api",                   version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "OTR Logger API",             name: "otr-logger-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)" },
  { title: "HHT Upload API",             name: "hht-upload-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)" },
]

const LEFT_NAV = [
  "Product setup",
  "Visibility",
  "APIs",
  "Plans",
  "Categories",
  "Billings",
]

const DEFAULT_DESCRIPTION = `#### **Tracking Product**
- This product provides functionality to enquire on the status of parcels.
- The API provides the details of how a parcel has been requested to be delivered, latest tracking information, tracking history, and the details captured at the point of delivery

#### **Authentication and Scope**
- Authentication is via the oauth 2 client credentials flow (see auth policy api)
- The following scope is available`

type EditorTab = "write" | "preview"
type DesignTab = "design" | "source"

export default function ProductDetailPage() {
  const { id } = useParams()

  const [activeSection, setActiveSection] = useState("Product setup")
  const [designTab,     setDesignTab]     = useState<DesignTab>("design")
  const [editorTab,     setEditorTab]     = useState<EditorTab>("write")
  const [version,       setVersion]       = useState("1.0.0")
  const [title,         setTitle]         = useState("Tracking")
  const [description,   setDescription]   = useState(DEFAULT_DESCRIPTION)
  const [summary,       setSummary]       = useState("")
  const [visibility,    setVisibility]    = useState("authenticated")

  // APIs section
  const [associatedApis,  setAssociatedApis]  = useState<ApiItem[]>([])
  const [apiDialogOpen,   setApiDialogOpen]   = useState(false)
  const [apiSearch,       setApiSearch]       = useState("")
  const [pendingNames,    setPendingNames]     = useState<Set<string>>(new Set())

  const availableApis = ALL_APIS.filter(
    (a) => !associatedApis.some((b) => b.name === a.name),
  )
  const filteredAvailable = availableApis.filter(
    (a) =>
      a.title.toLowerCase().includes(apiSearch.toLowerCase()) ||
      a.name.toLowerCase().includes(apiSearch.toLowerCase()),
  )

  function togglePending(name: string) {
    setPendingNames((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function confirmAddApis() {
    const toAdd = ALL_APIS.filter((a) => pendingNames.has(a.name))
    setAssociatedApis((prev) => [...prev, ...toAdd])
    setPendingNames(new Set())
    setApiSearch("")
    setApiDialogOpen(false)
  }

  function removeApi(name: string) {
    setAssociatedApis((prev) => prev.filter((a) => a.name !== name))
  }

  // Plans section
  const [plans,           setPlans]           = useState<Plan[]>(SAMPLE_PLANS)
  const [planDialogOpen,  setPlanDialogOpen]   = useState(false)
  const [editingPlan,     setEditingPlan]      = useState<Plan | null>(null)
  const [planForm,        setPlanForm]         = useState(EMPTY_PLAN_FORM)
  const [planErrors,      setPlanErrors]       = useState<Partial<Record<keyof typeof EMPTY_PLAN_FORM, string>>>({})

  function openCreatePlan() {
    setEditingPlan(null)
    setPlanForm(EMPTY_PLAN_FORM)
    setPlanErrors({})
    setPlanDialogOpen(true)
  }

  function openEditPlan(plan: Plan) {
    setEditingPlan(plan)
    setPlanForm({
      name:           plan.name,
      rateLimit:      plan.rateLimit,
      rateLimitUnit:  plan.rateLimitUnit,
      burstLimit:     plan.burstLimit,
      quota:          plan.quota,
      quotaUnit:      plan.quotaUnit,
    })
    setPlanErrors({})
    setPlanDialogOpen(true)
  }

  function validatePlan() {
    const e: typeof planErrors = {}
    if (!planForm.name.trim())  e.name      = "Plan name is required"
    if (!planForm.rateLimit)    e.rateLimit = "Rate limit is required"
    setPlanErrors(e)
    return Object.keys(e).length === 0
  }

  function savePlan() {
    if (!validatePlan()) return
    if (editingPlan) {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === editingPlan.id
            ? { ...p, ...planForm, rateLimit: Number(planForm.rateLimit) }
            : p,
        ),
      )
    } else {
      setPlans((prev) => [
        ...prev,
        { id: Date.now(), ...planForm, rateLimit: Number(planForm.rateLimit) },
      ])
    }
    setPlanDialogOpen(false)
  }

  function deletePlan(id: number) {
    setPlans((prev) => prev.filter((p) => p.id !== id))
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function wrap(before: string, after = "") {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = description.substring(start, end)
    setDescription(description.substring(0, start) + before + sel + after + description.substring(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }

  function insertLine(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const start  = el.selectionStart
    const lineStart = description.lastIndexOf("\n", start - 1) + 1
    setDescription(description.substring(0, lineStart) + prefix + description.substring(lineStart))
    requestAnimationFrame(() => { el.focus() })
  }

  // Simple markdown → HTML for preview
  function renderPreview(md: string) {
    return md
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^#### (.+)$/gm,  "<h4 class=\"text-base font-semibold mt-3 mb-1\">$1</h4>")
      .replace(/^### (.+)$/gm,   "<h3 class=\"text-lg font-semibold mt-3 mb-1\">$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g,       "<em>$1</em>")
      .replace(/~~(.+?)~~/g,     "<del>$1</del>")
      .replace(/`(.+?)`/g,       "<code class=\"bg-gray-100 px-1 rounded text-xs\">$1</code>")
      .replace(/^- (.+)$/gm,     "<li class=\"ml-4 list-disc\">$1</li>")
      .replace(/\n/g,             "<br/>")
  }

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/products" className="hover:underline">Develop</Link>
        {" /"}
      </div>

      {/* Header: product slug + version select */}
      <div className="flex items-center gap-4 px-6 pt-1 pb-0">
        <h1 className="text-3xl font-normal text-gray-900">{id}</h1>
        <Select value={version} onValueChange={setVersion}>
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1.0.0">1.0.0</SelectItem>
            <SelectItem value="1.1.0">1.1.0</SelectItem>
            <SelectItem value="2.0.0">2.0.0</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Design / Source tab bar */}
      <div className="flex border-b border-gray-200 px-6 mt-3">
        {(["design", "source"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setDesignTab(tab)}
            className={[
              "border-b-2 px-4 pb-2 text-sm font-medium capitalize transition-colors",
              designTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900",
            ].join(" ")}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Two-column body */}
      <div className="flex flex-1">
        {/* Left section nav */}
        <aside className="w-60 shrink-0 border-r border-gray-200 pt-1">
          {LEFT_NAV.map((section) => {
            const active = activeSection === section
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={[
                  "w-full text-left py-2 text-sm transition-colors",
                  active
                    ? "border-l-4 border-blue-600 pl-5 font-semibold text-gray-900 bg-gray-50"
                    : "border-l-4 border-transparent pl-5 text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                ].join(" ")}
              >
                {section}
              </button>
            )
          })}
        </aside>

        {/* Main form */}
        <main className="flex-1 px-8 py-6">
          {activeSection === "Product setup" ? (
            <div className="max-w-3xl space-y-6">
              {/* Section heading */}
              <div>
                <h2 className="text-base font-medium text-amber-600">Info</h2>
                <Separator className="mt-2" />
              </div>

              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="prod-title" className="text-sm text-amber-600">
                  Title
                </Label>
                <Input
                  id="prod-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-gray-50"
                />
              </div>

              {/* Name (read-only) */}
              <div className="space-y-1">
                <Label htmlFor="prod-name" className="text-sm text-amber-600">
                  Name
                </Label>
                <Input
                  id="prod-name"
                  value={id ?? ""}
                  readOnly
                  className="bg-gray-100 text-muted-foreground cursor-default"
                />
              </div>

              {/* Version */}
              <div className="space-y-1">
                <Label htmlFor="prod-version" className="text-sm text-amber-600">
                  Version
                </Label>
                <Input
                  id="prod-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="bg-gray-50"
                />
              </div>

              {/* Description — markdown editor */}
              <div className="space-y-1">
                <Label className="text-sm text-amber-600">
                  Description (optional)
                </Label>
                <div className="border border-gray-300 rounded-sm">
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
                    {/* Write / Preview */}
                    {(["write", "preview"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setEditorTab(t)}
                        className={[
                          "px-2.5 py-0.5 text-xs rounded capitalize",
                          editorTab === t
                            ? "bg-white border border-gray-300 shadow-sm font-medium text-gray-800"
                            : "text-gray-500 hover:text-gray-800",
                        ].join(" ")}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}

                    <div className="w-px h-4 bg-gray-300 mx-1" />

                    {/* Text-style buttons */}
                    <button onClick={() => insertLine("#### ")}  title="Heading"        className="px-1.5 py-0.5 text-xs hover:bg-gray-200 rounded text-gray-600 font-semibold">TT</button>
                    <button onClick={() => wrap("**", "**")}     title="Bold"           className="px-1.5 py-0.5 text-xs hover:bg-gray-200 rounded text-gray-600 font-bold">B</button>
                    <button onClick={() => wrap("_", "_")}       title="Italic"         className="px-1.5 py-0.5 text-xs hover:bg-gray-200 rounded text-gray-600 italic">I</button>
                    <button onClick={() => wrap("~~", "~~")}     title="Strikethrough"  className="px-1.5 py-0.5 text-xs hover:bg-gray-200 rounded text-gray-600 line-through">S</button>

                    <div className="w-px h-4 bg-gray-300 mx-1" />

                    {/* Icon buttons */}
                    {[
                      { title: "Link",        action: () => wrap("[", "](url)"),    svg: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></> },
                      { title: "Quote",       action: () => insertLine("> "),       svg: <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></> },
                      { title: "Code",        action: () => wrap("`", "`"),         svg: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></> },
                      { title: "Image",       action: () => wrap("![alt](", ")"),   svg: <><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></> },
                    ].map(({ title: t, action, svg }) => (
                      <button key={t} onClick={action} title={t} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                        <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{svg}</svg>
                      </button>
                    ))}

                    <div className="w-px h-4 bg-gray-300 mx-1" />

                    {/* List buttons */}
                    {[
                      { title: "Unordered list", action: () => insertLine("- "),   svg: <><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></> },
                      { title: "Ordered list",   action: () => insertLine("1. "),  svg: <><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></> },
                      { title: "Indent",         action: () => insertLine("  "),   svg: <><line x1="21" x2="10" y1="6" y2="6"/><line x1="21" x2="10" y1="12" y2="12"/><line x1="21" x2="10" y1="18" y2="18"/><path d="M4 6 3 7"/><path d="m3 12 1-1 1 1-1 1-1-1"/><path d="m5 18-2-1v-1"/></> },
                    ].map(({ title: t, action, svg }) => (
                      <button key={t} onClick={action} title={t} className="p-1 hover:bg-gray-200 rounded text-gray-600">
                        <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">{svg}</svg>
                      </button>
                    ))}
                  </div>

                  {/* Editor / Preview area */}
                  {editorTab === "write" ? (
                    <Textarea
                      ref={textareaRef}
                      id="description-editor"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[160px] rounded-none border-none shadow-none focus-visible:ring-0 bg-white font-mono text-sm resize-y"
                    />
                  ) : (
                    <div
                      className="min-h-[160px] p-3 text-sm prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderPreview(description) }}
                    />
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1">
                <Label className="text-sm text-amber-600">
                  Summary (optional)
                </Label>
                <Textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder=""
                  className="bg-gray-50 min-h-[100px] resize-y"
                />
              </div>
            </div>
          ) : activeSection === "Visibility" ? (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-base font-medium text-amber-600">Visibility</h2>
                <Separator className="mt-2" />
              </div>

              <p className="text-sm text-muted-foreground">
                Control who can discover and subscribe to this product in the Developer Portal.
              </p>

              <RadioGroup
                value={visibility}
                onValueChange={setVisibility}
                className="space-y-3"
              >
                {/* Public */}
                <Label
                  htmlFor="vis-public"
                  className={[
                    "flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors",
                    visibility === "public"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <RadioGroupItem value="public" id="vis-public" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">Public</span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Open access
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The product is visible to everyone in the Developer Portal. Any user can
                      browse and subscribe without needing to sign in.
                    </p>
                  </div>
                </Label>

                {/* Authenticated */}
                <Label
                  htmlFor="vis-authenticated"
                  className={[
                    "flex cursor-pointer items-start gap-4 rounded-lg border-2 p-4 transition-colors",
                    visibility === "authenticated"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <RadioGroupItem value="authenticated" id="vis-authenticated" className="mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">Authenticated</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Sign-in required
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      The product is only visible to signed-in users. Unauthenticated visitors
                      will not see it in the Developer Portal.
                    </p>
                  </div>
                </Label>
              </RadioGroup>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600">
                <span className="font-medium">Current setting: </span>
                {visibility === "public"
                  ? "This product is publicly visible to all Developer Portal visitors."
                  : "This product is only visible to authenticated Developer Portal users."}
              </div>
            </div>
          ) : activeSection === "APIs" ? (
            <div className="max-w-3xl space-y-6">
              {/* Section heading + Add button */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-base font-medium text-amber-600">APIs</h2>
                  <Separator className="mt-2" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {associatedApis.length === 0
                    ? "No APIs associated with this product yet."
                    : `${associatedApis.length} API${associatedApis.length > 1 ? "s" : ""} associated`}
                </p>
                <Button
                  size="sm"
                  onClick={() => { setApiDialogOpen(true); setApiSearch(""); setPendingNames(new Set()) }}
                >
                  <svg className="size-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add APIs
                </Button>
              </div>

              {/* Associated APIs table */}
              {associatedApis.length > 0 ? (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Title</TableHead>
                        <TableHead className="font-semibold text-gray-700">Name</TableHead>
                        <TableHead className="font-semibold text-gray-700 w-20">Version</TableHead>
                        <TableHead className="font-semibold text-gray-700">Type</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {associatedApis.map((api) => (
                        <TableRow key={api.name} className="group">
                          <TableCell className="text-blue-600 font-medium">{api.title}</TableCell>
                          <TableCell className="text-gray-600 text-sm">{api.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{api.version}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-600 text-sm">{api.type}</TableCell>
                          <TableCell className="text-right">
                            <button
                              onClick={() => removeApi(api.name)}
                              className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove API"
                            >
                              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M18 6 6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                  <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-600">No APIs added yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click "Add APIs" to associate APIs with this product.</p>
                  </div>
                </div>
              )}

              {/* Add APIs dialog */}
              <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
                <DialogContent className="sm:max-w-[560px]">
                  <DialogHeader>
                    <DialogTitle>Add APIs</DialogTitle>
                  </DialogHeader>

                  {/* Search */}
                  <div className="flex items-center gap-2 border border-gray-200 rounded-md px-3 py-1.5">
                    <svg className="size-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <Input
                      value={apiSearch}
                      onChange={(e) => setApiSearch(e.target.value)}
                      placeholder="Search APIs…"
                      className="border-none shadow-none focus-visible:ring-0 h-7 px-0 text-sm"
                    />
                  </div>

                  {/* Selection count */}
                  {pendingNames.size > 0 && (
                    <p className="text-xs text-blue-600 font-medium">
                      {pendingNames.size} API{pendingNames.size > 1 ? "s" : ""} selected
                    </p>
                  )}

                  {/* API list */}
                  <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                    {filteredAvailable.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        {availableApis.length === 0 ? "All APIs already added." : "No APIs match your search."}
                      </p>
                    ) : (
                      filteredAvailable.map((api) => {
                        const checked = pendingNames.has(api.name)
                        return (
                          <label
                            key={api.name}
                            className={[
                              "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                              checked ? "bg-blue-50" : "hover:bg-gray-50",
                            ].join(" ")}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePending(api.name)}
                              id={`api-${api.name}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{api.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{api.name}</p>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">{api.version}</Badge>
                          </label>
                        )
                      })
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setApiDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmAddApis} disabled={pendingNames.size === 0}>
                      Add {pendingNames.size > 0 ? `(${pendingNames.size})` : ""}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : activeSection === "Plans" ? (
            <div className="max-w-3xl space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-base font-medium text-amber-600">Plans</h2>
                  <Separator className="mt-2" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {plans.length === 0
                    ? "No plans defined yet."
                    : `${plans.length} plan${plans.length > 1 ? "s" : ""}`}
                </p>
                <Button size="sm" onClick={openCreatePlan}>
                  <svg className="size-4 mr-1.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Plan
                </Button>
              </div>

              {/* Plans grid */}
              {plans.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="group relative rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Plan name + actions */}
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditPlan(plan)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700"
                            aria-label="Edit plan"
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500"
                            aria-label="Delete plan"
                          >
                            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                            </svg>
                          </button>
                        </div>
                      </div>

                      <dl className="space-y-2 text-sm">
                        {/* Rate limit */}
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">Rate limit</dt>
                          <dd>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {plan.rateLimit}/{RATE_UNIT_LABEL[plan.rateLimitUnit]}
                            </Badge>
                          </dd>
                        </div>

                        {/* Burst limit */}
                        {plan.burstLimit !== "" && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">Burst limit</dt>
                            <dd>
                              <Badge variant="outline" className="font-mono text-xs">
                                {plan.burstLimit}/sec
                              </Badge>
                            </dd>
                          </div>
                        )}

                        {/* Quota */}
                        {plan.quota !== "" && (
                          <div className="flex items-center justify-between">
                            <dt className="text-muted-foreground">Quota</dt>
                            <dd>
                              <Badge variant="outline" className="font-mono text-xs">
                                {Number(plan.quota).toLocaleString()}/{QUOTA_UNIT_LABEL[plan.quotaUnit]}
                              </Badge>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center">
                  <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                    <path d="M9 12h6M9 16h4"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-600">No plans yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click "Create Plan" to add a rate-limited plan.</p>
                  </div>
                </div>
              )}

              {/* Create / Edit Plan dialog */}
              <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>{editingPlan ? "Edit Plan" : "Create Plan"}</DialogTitle>
                  </DialogHeader>

                  <div className="grid gap-4 py-2">
                    {/* Name */}
                    <div className="grid gap-1.5">
                      <Label htmlFor="plan-name">Plan name</Label>
                      <Input
                        id="plan-name"
                        placeholder="e.g. Gold, Silver, Ruby"
                        value={planForm.name}
                        onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                      />
                      {planErrors.name && <p className="text-xs text-destructive">{planErrors.name}</p>}
                    </div>

                    {/* Rate limit */}
                    <div className="grid gap-1.5">
                      <Label>Rate limit</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 100"
                          className="flex-1"
                          value={planForm.rateLimit}
                          onChange={(e) =>
                            setPlanForm((f) => ({ ...f, rateLimit: e.target.value === "" ? "" : Number(e.target.value) }))
                          }
                        />
                        <Select
                          value={planForm.rateLimitUnit}
                          onValueChange={(v) => setPlanForm((f) => ({ ...f, rateLimitUnit: v as RateUnit }))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="second">per second</SelectItem>
                            <SelectItem value="minute">per minute</SelectItem>
                            <SelectItem value="hour">per hour</SelectItem>
                            <SelectItem value="day">per day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {planErrors.rateLimit && <p className="text-xs text-destructive">{planErrors.rateLimit}</p>}
                    </div>

                    {/* Burst limit */}
                    <div className="grid gap-1.5">
                      <Label htmlFor="plan-burst">
                        Burst limit <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          id="plan-burst"
                          type="number"
                          min={1}
                          placeholder="e.g. 50"
                          className="flex-1"
                          value={planForm.burstLimit}
                          onChange={(e) =>
                            setPlanForm((f) => ({ ...f, burstLimit: e.target.value === "" ? "" : Number(e.target.value) }))
                          }
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">per second</span>
                      </div>
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
                          value={planForm.quota}
                          onChange={(e) =>
                            setPlanForm((f) => ({ ...f, quota: e.target.value === "" ? "" : Number(e.target.value) }))
                          }
                        />
                        <Select
                          value={planForm.quotaUnit}
                          onValueChange={(v) => setPlanForm((f) => ({ ...f, quotaUnit: v as QuotaUnit }))}
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
                    <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
                    <Button onClick={savePlan}>{editingPlan ? "Save changes" : "Create"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              {activeSection} — coming soon
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"

import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import type { Route } from "./+types/apis"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Develop — APIs" }]
}

const apis = [
  { title: "Portals - User Auth",        name: "portals-users-api",                 version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "3 days ago" },
  { title: "Out of home API",            name: "out-of-home-api",                   version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "3 days ago" },
  { title: "HHT Tour API",               name: "hht-tour-api",                      version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "3 days ago" },
  { title: "Returns Api",                name: "portals-returns-api",               version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "Client Query Api",           name: "portals-client-query-api",          version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "External Client Query Api",  name: "external-portals-client-query-api", version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "OTR Parcel API",             name: "otr-parcel-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "HHT Parcel API",             name: "hht-parcel-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "UTR Parcel API",             name: "utr-parcel-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "Tour Event Query Api",       name: "tour-event-query-api",              version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "Actus print service",        name: "actus-print-service",               version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "Collections API",            name: "collections-api",                   version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "4 days ago" },
  { title: "HHT Work Resourcing API",    name: "hht-work-resourcing-api",           version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "6 days ago" },
  { title: "HHT Config API",             name: "hht-config-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "6 days ago" },
  { title: "Actus Users Api",            name: "actus-users-api",                   version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "6 days ago" },
  { title: "OTR Logger API",             name: "otr-logger-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "6 days ago" },
  { title: "HHT Upload API",             name: "hht-upload-api",                    version: "1.0", type: "OpenAPI 2.0 (REST)", modified: "6 days ago" },
]

const DEV_TABS = [
  { label: "APIs",      to: "/apis"      },
  { label: "Products",  to: "/products"  },
]

export default function ApisPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")

  const filtered = apis.filter(
    (api) =>
      api.title.toLowerCase().includes(search.toLowerCase()) ||
      api.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-3xl font-normal text-gray-900">Develop</h1>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-sm px-6" onClick={() => navigate("/apis/new")}>
          Add
        </Button>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 px-6">
        {DEV_TABS.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className={[
              "border-b-2 px-4 pb-2 text-sm font-medium transition-colors",
              location.pathname === to
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 bg-gray-100 border-b border-gray-200 px-4 py-2">
        <svg className="size-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="What are you looking for today?"
          className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-gray-400 h-8 px-1"
        />
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500" aria-label="Refresh">
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500" aria-label="Settings">
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-100 hover:bg-gray-100">
            <TableHead className="w-[28%] font-semibold text-gray-700">Title</TableHead>
            <TableHead className="w-[28%] font-semibold text-gray-700">Name</TableHead>
            <TableHead className="w-[8%]  font-semibold text-gray-700">Version</TableHead>
            <TableHead className="w-[18%] font-semibold text-gray-700">Type</TableHead>
            <TableHead className="w-[12%] font-semibold text-gray-700">
              <span className="flex items-center gap-1">
                Modified
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              </span>
            </TableHead>
            <TableHead className="w-[6%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((api, i) => (
            <TableRow key={i} className="group border-b border-gray-200">
              <TableCell>
                <Link to={`/apis/${api.name}`} className="text-gray-900 hover:underline">
                  {api.title}
                </Link>
              </TableCell>
              <TableCell className="text-gray-700">{api.name}</TableCell>
              <TableCell className="text-gray-700">{api.version}</TableCell>
              <TableCell className="text-gray-700">{api.type}</TableCell>
              <TableCell className="text-gray-500">{api.modified}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 hover:bg-gray-100 rounded text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100" aria-label="More options">
                      <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem className="text-amber-600 focus:text-amber-600 focus:bg-amber-50 font-medium">
                      Publish
                    </DropdownMenuItem>
                    <DropdownMenuItem>Stage</DropdownMenuItem>
                    <DropdownMenuItem>Update APIs</DropdownMenuItem>
                    <DropdownMenuItem>Save as New Version</DropdownMenuItem>
                    <DropdownMenuItem>Download</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

import { useState } from "react"
import { Link, useParams } from "react-router"

import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import type { Route } from "./+types/environments.$id"

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `${toTitle(params.id ?? "")} — Environment` }]
}

function toTitle(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

const TABS = [
  "Products",
  "Consumers",
  "Applications",
  "Subscriptions",
  "Tasks",
  "Analytics",
  "Members",
  "Catalog settings",
  "Spaces",
]

const consumers = [
  { id: 1,  title: "Raghav M V",                   owner: "raghav.mv@yodel.co.uk",         subscriptions: 7,  modified: "a year ago"  },
  { id: 2,  title: "Renganatha10",                 owner: "renganatha.a@saksoft.com",       subscriptions: 17, modified: "a year ago"  },
  { id: 3,  title: "Renga Dev Org",                owner: "r.arunachalam@yodel.co.uk",      subscriptions: 0,  modified: "a year ago"  },
  { id: 4,  title: "bart-org",                     owner: "bartosz.gdula@yodel.co.uk",      subscriptions: 8,  modified: "a year ago"  },
  { id: 5,  title: "Keiran Brown",                 owner: "keiran.brown@yodel.co.uk",       subscriptions: 4,  modified: "2 years ago" },
  { id: 6,  title: "Yodel",                        owner: "geoff.james@yodel.co.uk",        subscriptions: 5,  modified: "3 years ago" },
  { id: 7,  title: "trackingGatling",              owner: "michael.walker@yodel.co.uk",     subscriptions: 9,  modified: "3 years ago" },
  { id: 8,  title: "raviDevOrg",                   owner: "ravi.nerella@yodel.co.uk",       subscriptions: 3,  modified: "3 years ago" },
  { id: 9,  title: "peter-cross",                  owner: "peter.cross+c85b@yodel.co.uk",   subscriptions: 1,  modified: "3 years ago" },
  { id: 10, title: "Mila Rose Shields",            owner: "milarose.shiels@yodel.co.uk",    subscriptions: 1,  modified: "3 years ago" },
  { id: 11, title: "Lee Richards",                 owner: "lee.p.richards@gmail.com",       subscriptions: 3,  modified: "3 years ago" },
  { id: 12, title: "DW-test",                      owner: "daniel.waterhouse@yodel.co.uk",  subscriptions: 3,  modified: "3 years ago" },
  { id: 13, title: "DigitalWeb",                   owner: "dev@collectplus.yodel.co.uk",    subscriptions: 1,  modified: "3 years ago" },
  { id: 14, title: "Development Test Organization",owner: "ashraf.adil@yodel.co.uk",        subscriptions: 13, modified: "3 years ago" },
  { id: 15, title: "Dave Gray",                    owner: "david.gray@yodel.co.uk",         subscriptions: 14, modified: "3 years ago" },
  { id: 16, title: "Andrew Cox",                   owner: "andrew@accox.co.uk",             subscriptions: 0,  modified: "3 years ago" },
]

const PER_PAGE_OPTIONS = ["10", "25", "50", "100"]

export default function EnvironmentDetailPage() {
  const { id } = useParams()
  const name = toTitle(id ?? "environment")

  const [search, setSearch]   = useState("")
  const [perPage, setPerPage] = useState("50")

  const filtered = consumers.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.owner.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Breadcrumb */}
      <div className="px-6 pt-4 text-sm text-muted-foreground">
        <Link to="/environments" className="hover:underline">
          Manage
        </Link>
        {" /"}
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-1 pb-0">
        <h1 className="text-3xl font-normal text-gray-900">{name}</h1>
        <div className="flex items-center gap-1">
          <Button className="bg-black hover:bg-gray-900 text-white rounded-sm px-6">
            Add
          </Button>
          <Button variant="ghost" size="icon" className="text-gray-600">
            <svg className="size-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5"  r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="consumers" className="flex flex-col flex-1 mt-2">
        {/* Tab bar */}
        <div className="border-b border-gray-200 px-6 overflow-x-auto">
          <TabsList className="justify-start rounded-none bg-transparent h-auto p-0 gap-0 w-max">
            {TABS.map((tab) => {
              const value = tab.toLowerCase().replace(/\s+/g, "-")
              return (
                <TabsTrigger
                  key={tab}
                  value={value}
                  className="rounded-none border-b-2 border-transparent px-4 pb-2 pt-1 text-sm font-medium whitespace-nowrap data-[state=active]:border-gray-900 data-[state=active]:text-gray-900 data-[state=active]:shadow-none bg-transparent text-gray-500 hover:text-gray-900"
                >
                  {tab}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        {/* Consumers tab */}
        <TabsContent value="consumers" className="mt-0 flex flex-col flex-1">
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
            <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500" aria-label="Column settings">
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100 hover:bg-gray-100">
                  <TableHead className="w-[30%] font-semibold text-gray-700">Title</TableHead>
                  <TableHead className="w-[35%] font-semibold text-gray-700">Owner</TableHead>
                  <TableHead className="w-[13%] font-semibold text-gray-700">Subscriptions</TableHead>
                  <TableHead className="w-[16%] font-semibold text-gray-700">
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
                {filtered.map((consumer) => (
                  <TableRow key={consumer.id} className="group border-b border-gray-200">
                    <TableCell>
                      <a href="#" className="text-gray-900 hover:underline">
                        {consumer.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-gray-700">{consumer.owner}</TableCell>
                    <TableCell className="text-gray-700">{consumer.subscriptions}</TableCell>
                    <TableCell className="text-gray-500">{consumer.modified}</TableCell>
                    <TableCell className="text-right">
                      <button
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="More options"
                      >
                        <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5"  r="1.5" />
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination footer */}
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-sm text-gray-600 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap">Consumer Organizations per page</span>
              <Select value={perPage} onValueChange={setPerPage}>
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <span className="text-xs text-gray-500">
              1–{filtered.length} of {filtered.length} Consumer Organizations
            </span>

            <div className="flex items-center gap-2">
              <Select defaultValue="1">
                <SelectTrigger className="h-7 w-14 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-500 whitespace-nowrap">1 of 1 page</span>
              <Button variant="outline" size="icon" className="size-7" disabled aria-label="Previous page">
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Button>
              <Button variant="outline" size="icon" className="size-7" disabled aria-label="Next page">
                <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Empty state for other tabs */}
        {TABS.filter((t) => t !== "Consumers").map((tab) => (
          <TabsContent
            key={tab}
            value={tab.toLowerCase().replace(/\s+/g, "-")}
            className="mt-0 px-6 py-8 text-sm text-muted-foreground"
          >
            No {tab.toLowerCase()} found.
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

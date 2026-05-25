import { Link, useLoaderData, useNavigate } from "react-router"

import { getActiveOrganisationId, requireAuth } from "~/lib/session.server"
import { listConsumersByOrganisation } from "~/repositories/consumer.repository.server"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
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
  const organisationId = await getActiveOrganisationId(request)
  const consumers = organisationId ? await listConsumersByOrganisation(organisationId) : []
  return { consumers, organisationId }
}

export default function ConsumersPage() {
  const { consumers } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

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

      {consumers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 mt-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg className="size-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">No consumers yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link to="/consumers/new" className="underline underline-offset-2">Add your first consumer</Link>
            </p>
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
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consumers.map((consumer) => (
                <TableRow
                  key={consumer.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/consumers/${consumer.id}`)}
                >
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
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(consumer.createdAt).toLocaleDateString()}
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

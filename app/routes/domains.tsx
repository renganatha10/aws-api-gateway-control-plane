import { Link, useLoaderData, useNavigate } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import { listDomainsByOrganisation } from "~/repositories/domain.repository.server";
import type { Route } from "./+types/domains";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Domains" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);
  const domainList = organisationId ? await listDomainsByOrganisation(organisationId) : [];
  return { domains: domainList, organisationId };
}

const ENDPOINT_BADGE: Record<string, { label: string; className: string }> = {
  REGIONAL: { label: "Regional", className: "bg-blue-50 text-blue-700 border-blue-200" },
  EDGE: { label: "Edge", className: "bg-purple-50 text-purple-700 border-purple-200" },
};

export default function DomainsPage() {
  const { domains } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-3xl font-normal text-gray-900">Domains</h1>
        <Button size="sm" asChild>
          <Link to="/domains/new">New Domain</Link>
        </Button>
      </div>

      {/* Empty state */}
      {domains.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 mt-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg
            className="size-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">No custom domains yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link to="/domains/new" className="underline underline-offset-2">
                Add your first custom domain
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-700">Domain</TableHead>
                <TableHead className="font-semibold text-gray-700">Endpoint</TableHead>
                <TableHead className="font-semibold text-gray-700">AWS Target</TableHead>
                <TableHead className="font-semibold text-gray-700">Mappings</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.map((domain) => {
                const ep = ENDPOINT_BADGE[domain.endpointType] ?? ENDPOINT_BADGE.REGIONAL;
                return (
                  <TableRow
                    key={domain.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/domains/${domain.id}`)}
                  >
                    <TableCell className="font-medium text-gray-900">{domain.domainName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${ep.className}`}>
                        {ep.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="block truncate text-xs font-mono text-muted-foreground">
                        {domain.awsDomainName ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {domain.mappingCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(domain.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

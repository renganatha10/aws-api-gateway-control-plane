import { Rocket } from "lucide-react";
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
import { listProductsByOrganisation } from "~/repositories/product.repository.server";
import { listDeploymentsByOrganisation } from "~/repositories/product-deployment.repository.server";
import type { Route } from "./+types/products";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Develop — Products" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const organisationId = await getActiveOrganisationId(request);

  const [products, deployments] = await Promise.all([
    organisationId ? listProductsByOrganisation(organisationId) : [],
    organisationId ? listDeploymentsByOrganisation(organisationId) : [],
  ]);

  return { products, deployments, organisationId };
}

const VISIBILITY_BADGE: Record<string, { label: string; className: string }> = {
  public: { label: "Public", className: "bg-green-100 text-green-700 border-green-200" },
  authenticated: { label: "Authenticated", className: "bg-blue-100 text-blue-700 border-blue-200" },
  invisible: { label: "Invisible", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export default function ProductsPage() {
  const { products, deployments } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const deployedProductIds = new Set(deployments.map((d) => d.productId));

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h1 className="text-3xl font-normal text-gray-900">Products</h1>
        <Button size="sm" asChild>
          <Link to="/products/new">New Product</Link>
        </Button>
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 mx-6 mt-6 rounded-lg border-2 border-dashed border-gray-200 py-16 text-center">
          <svg
            aria-hidden="true"
            className="size-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-600">No products yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link to="/products/new" className="underline underline-offset-2">
                Create your first product
              </Link>
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-gray-700">Display Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Name</TableHead>
                <TableHead className="font-semibold text-gray-700">Visibility</TableHead>
                <TableHead className="font-semibold text-gray-700">Status</TableHead>
                <TableHead className="font-semibold text-gray-700">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const vis = VISIBILITY_BADGE[product.visibility] ?? VISIBILITY_BADGE.authenticated;
                const deployed = deployedProductIds.has(product.id);
                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <TableCell className="font-medium text-gray-900">
                      {product.displayName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${vis.className}`}>
                        {vis.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {deployed ? (
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-50 text-green-700 border-green-200"
                        >
                          <Rocket className="size-3 mr-1" /> Deployed
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not deployed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(product.createdAt).toLocaleDateString()}
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

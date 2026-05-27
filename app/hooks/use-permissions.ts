import { useRouteLoaderData } from "react-router";

import { can, type Permission } from "~/lib/permissions";
import type { OrgRole } from "~/lib/schema";

export function usePermissions() {
  const data = useRouteLoaderData("routes/layout") as
    | { activeUserRole: OrgRole | null }
    | undefined;
  const role = data?.activeUserRole ?? null;
  return { role, can: (p: Permission) => can(role, p) };
}

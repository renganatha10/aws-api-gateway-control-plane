import type { ReactNode } from "react";

import { usePermissions } from "~/hooks/use-permissions";
import type { Permission } from "~/lib/permissions";

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = usePermissions();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}

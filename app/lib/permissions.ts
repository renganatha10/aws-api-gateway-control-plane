import type { OrgRole } from "~/lib/schema";

export type Permission =
  | "view:all"
  | "view:consumers"
  | "view:users"
  | "create:resources"
  | "edit:resources"
  | "delete:resources"
  | "publish:products"
  | "manage:consumers"
  | "invite:users";

const ROLE_PERMISSIONS: Record<OrgRole, Permission[]> = {
  admin: [
    "view:all",
    "view:consumers",
    "view:users",
    "create:resources",
    "edit:resources",
    "delete:resources",
    "publish:products",
    "manage:consumers",
    "invite:users",
  ],
  editor: [
    "view:all",
    "view:consumers",
    "view:users",
    "create:resources",
    "edit:resources",
    "delete:resources",
    "publish:products",
    "manage:consumers",
  ],
  viewer: ["view:all", "view:consumers", "view:users"],
  "portal-user": ["view:consumers", "manage:consumers"],
};

export function can(role: OrgRole | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: OrgRole | null): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}

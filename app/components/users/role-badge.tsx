import { Badge } from "~/components/ui/badge";
import type { OrgRole } from "~/lib/schema";

const ROLE_STYLES: Record<OrgRole, string> = {
  admin: "bg-violet-100 text-violet-800 border-violet-200",
  editor: "bg-blue-100 text-blue-800 border-blue-200",
  viewer: "bg-gray-100 text-gray-700 border-gray-200",
  "portal-user": "bg-amber-100 text-amber-800 border-amber-200",
};

const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  "portal-user": "Portal User",
};

export function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <Badge variant="outline" className={ROLE_STYLES[role]}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

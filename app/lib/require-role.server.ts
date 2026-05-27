import { data } from "react-router";

import { getUserProfile } from "~/lib/cognito.server";
import { can, type Permission } from "~/lib/permissions";
import type { OrgRole } from "~/lib/schema";
import { getActiveUserRole, requireAuth } from "~/lib/session.server";
import { getMemberRole } from "~/repositories/organisation-member.repository.server";

export async function requirePermission(
  request: Request,
  orgId: number,
  permission: Permission
): Promise<OrgRole> {
  // Fast path: role cached by the layout loader on the previous navigation.
  let role = await getActiveUserRole(request);

  if (!role) {
    // Slow path: first request in a session before the layout loader has run
    // (e.g. a direct POST after login). Hit the DB once and accept the cost.
    const { accessToken } = await requireAuth(request);
    const { email } = getUserProfile(accessToken);
    role = await getMemberRole(orgId, email);
  }

  if (!role || !can(role, permission)) {
    throw data({ error: "Forbidden" }, { status: 403 });
  }
  return role;
}

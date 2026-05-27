import { redirect } from "react-router";
import { UsersPage } from "~/components/users/users-page";
import { deleteUser, getUserProfile, inviteUser } from "~/lib/cognito.server";
import { can } from "~/lib/permissions";
import { requirePermission } from "~/lib/require-role.server";
import { getActiveOrganisationId, requireAuth } from "~/lib/session.server";
import {
  addMember,
  countMembershipsForUser,
  getMemberRole,
  listMembersByOrganisation,
  removeMember,
} from "~/repositories/organisation-member.repository.server";
import type { OrgRole } from "~/lib/schema";
import type { Route } from "./+types/users";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Users" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { accessToken } = await requireAuth(request);
  const { email } = getUserProfile(accessToken);
  const orgId = await getActiveOrganisationId(request);
  if (!orgId) throw redirect("/");

  const role = await getMemberRole(orgId, email);
  if (!can(role, "view:users")) throw redirect("/");

  const members = await listMembersByOrganisation(orgId);
  return { members, currentUserEmail: email };
}

export async function action({ request }: Route.ActionArgs) {
  const { accessToken } = await requireAuth(request);
  const orgId = await getActiveOrganisationId(request);
  if (!orgId) return { inviteError: "No active organisation." };

  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "invite") return handleInvite(request, formData, accessToken, orgId);
  if (intent === "remove") return handleRemove(request, formData, orgId);
  if (intent === "update-role") return handleUpdateRole(request, formData, orgId);
  return { inviteError: "Unknown intent." };
}

async function handleInvite(request: Request, formData: FormData, accessToken: string, orgId: number) {
  try {
    await requirePermission(request, orgId, "invite:users");
  } catch {
    return { inviteError: "You don't have permission to invite users." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const role = String(formData.get("role") ?? "viewer") as OrgRole;

  if (!email) return { inviteError: "Email is required." };

  const { email: inviterEmail } = getUserProfile(accessToken);

  try {
    await inviteUser({ email, firstName, lastName });
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (name !== "UsernameExistsException") {
      console.error("[users] inviteUser failed", err);
      return { inviteError: "Failed to send invite. Please try again." };
    }
    // User already exists in Cognito — just add to org
  }

  try {
    await addMember(orgId, email, role, inviterEmail);
  } catch (err) {
    console.error("[users] addMember failed", err);
    return { inviteError: "Failed to add member. They may already be in this organisation." };
  }

  return { ok: true };
}

async function handleRemove(request: Request, formData: FormData, orgId: number) {
  try {
    await requirePermission(request, orgId, "invite:users");
  } catch {
    return { removeError: "You don't have permission to remove users." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { removeError: "Email is required." };

  try {
    await removeMember(orgId, email);
  } catch (err) {
    console.error("[users] removeMember failed", err);
    return { removeError: "Failed to remove member. Please try again." };
  }

  // If the user no longer belongs to any organisation, remove them from Cognito too.
  const remaining = await countMembershipsForUser(email);
  if (remaining === 0) {
    try {
      await deleteUser(email);
    } catch (err) {
      // DB removal already succeeded — log but don't surface to the caller.
      console.error("[users] deleteUser (cognito) failed after member removal", { email, err });
    }
  }

  return { ok: true };
}

async function handleUpdateRole(request: Request, formData: FormData, orgId: number) {
  try {
    await requirePermission(request, orgId, "invite:users");
  } catch {
    return { updateError: "You don't have permission to change roles." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "") as OrgRole;
  if (!email || !role) return { updateError: "Missing fields." };

  try {
    const { updateMemberRole } = await import(
      "~/repositories/organisation-member.repository.server"
    );
    await updateMemberRole(orgId, email, role);
  } catch (err) {
    console.error("[users] updateMemberRole failed", err);
    return { updateError: "Failed to update role. Please try again." };
  }

  return { ok: true };
}

export default function UsersRoute({ loaderData }: Route.ComponentProps) {
  return (
    <UsersPage
      members={loaderData.members}
      currentUserEmail={loaderData.currentUserEmail}
    />
  );
}

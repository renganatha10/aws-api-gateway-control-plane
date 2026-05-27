import { and, count, eq } from "drizzle-orm";

import { db } from "~/lib/db.server";
import {
  type OrganisationMember,
  type OrgRole,
  organisationMembers,
} from "~/lib/schema";

export async function getMemberRole(
  orgId: number,
  email: string
): Promise<OrgRole | null> {
  const [row] = await db
    .select({ role: organisationMembers.role })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, orgId),
        eq(organisationMembers.userEmail, email)
      )
    );
  return row?.role ?? null;
}

export async function listMembersByOrganisation(
  orgId: number
): Promise<OrganisationMember[]> {
  return db
    .select()
    .from(organisationMembers)
    .where(eq(organisationMembers.organisationId, orgId))
    .orderBy(organisationMembers.createdAt);
}

export async function addMember(
  orgId: number,
  email: string,
  role: OrgRole,
  invitedBy?: string
): Promise<OrganisationMember> {
  const [row] = await db
    .insert(organisationMembers)
    .values({ organisationId: orgId, userEmail: email, role, invitedBy })
    .returning();
  return row;
}

export async function removeMember(orgId: number, email: string): Promise<void> {
  await db
    .delete(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, orgId),
        eq(organisationMembers.userEmail, email)
      )
    );
}

export async function countMembershipsForUser(email: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(organisationMembers)
    .where(eq(organisationMembers.userEmail, email));
  return Number(value);
}

export async function updateMemberRole(
  orgId: number,
  email: string,
  role: OrgRole
): Promise<void> {
  await db
    .update(organisationMembers)
    .set({ role, updatedAt: new Date() })
    .where(
      and(
        eq(organisationMembers.organisationId, orgId),
        eq(organisationMembers.userEmail, email)
      )
    );
}

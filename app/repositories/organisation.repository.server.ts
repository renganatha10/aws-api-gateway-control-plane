import { count, eq } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";

import { db } from "~/lib/db.server";
import {
  environments,
  type NewOrganisation,
  type Organisation,
  organisationMembers,
  organisations,
} from "~/lib/schema";

export async function createOrganisation(organisation: NewOrganisation): Promise<Organisation> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(organisations).values(organisation).returning();
    await tx.insert(organisationMembers).values({
      organisationId: created.id,
      userEmail: organisation.createdBy,
      role: "admin",
    });
    return created;
  });
}

export async function createOrganisationWithEnvironments(
  organisation: NewOrganisation,
  envNames: string[]
): Promise<Organisation> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(organisations).values(organisation).returning();
    await tx.insert(organisationMembers).values({
      organisationId: created.id,
      userEmail: organisation.createdBy,
      role: "admin",
    });
    if (envNames.length > 0) {
      await tx.insert(environments).values(
        envNames.map((name) => ({
          name,
          organisationId: created.id,
          createdBy: organisation.createdBy,
        }))
      );
    }
    return created;
  });
}

export async function listOrganisations(email: string): Promise<Organisation[]> {
  const cols = {
    id: organisations.id,
    name: organisations.name,
    createdBy: organisations.createdBy,
    createdAt: organisations.createdAt,
    updatedAt: organisations.updatedAt,
  };

  const ownedQ = db.select(cols).from(organisations).where(eq(organisations.createdBy, email));

  const memberQ = db
    .select(cols)
    .from(organisations)
    .innerJoin(
      organisationMembers,
      eq(organisationMembers.organisationId, organisations.id)
    )
    .where(eq(organisationMembers.userEmail, email));

  const rows = await union(ownedQ, memberQ);
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function findOrganisationById(id: number): Promise<Organisation | undefined> {
  const [row] = await db.select().from(organisations).where(eq(organisations.id, id));
  return row;
}

export async function deleteOrganisation(id: number): Promise<void> {
  await db.delete(organisations).where(eq(organisations.id, id));
}

export async function countOrganisations(email: string): Promise<number> {
  const cols = { id: organisations.id };

  const ownedQ = db.select(cols).from(organisations).where(eq(organisations.createdBy, email));
  const memberQ = db
    .select(cols)
    .from(organisations)
    .innerJoin(
      organisationMembers,
      eq(organisationMembers.organisationId, organisations.id)
    )
    .where(eq(organisationMembers.userEmail, email));

  const rows = await union(ownedQ, memberQ);
  return rows.length;
}

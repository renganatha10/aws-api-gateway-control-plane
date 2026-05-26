import { count, eq } from "drizzle-orm";

import { db } from "~/lib/db.server";
import { environments, type NewOrganisation, type Organisation, organisations } from "~/lib/schema";

export async function createOrganisation(organisation: NewOrganisation): Promise<Organisation> {
  const [created] = await db.insert(organisations).values(organisation).returning();
  return created;
}

export async function createOrganisationWithEnvironments(
  organisation: NewOrganisation,
  envNames: string[]
): Promise<Organisation> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(organisations).values(organisation).returning();
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

export async function listOrganisations(createdBy: string): Promise<Organisation[]> {
  return db
    .select()
    .from(organisations)
    .where(eq(organisations.createdBy, createdBy))
    .orderBy(organisations.createdAt);
}

export async function findOrganisationById(id: number): Promise<Organisation | undefined> {
  const [row] = await db.select().from(organisations).where(eq(organisations.id, id));
  return row;
}

export async function deleteOrganisation(id: number): Promise<void> {
  await db.delete(organisations).where(eq(organisations.id, id));
}

export async function countOrganisations(createdBy: string): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(organisations)
    .where(eq(organisations.createdBy, createdBy));
  return Number(value);
}

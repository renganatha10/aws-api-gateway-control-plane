import { eq } from "drizzle-orm"
import { db } from "~/lib/db.server"
import { products, type NewProduct } from "~/lib/schema"

export async function createProduct(data: NewProduct) {
  const [created] = await db.insert(products).values(data).returning()
  return created
}

export async function listProductsByGateway(gatewayId: number) {
  return db.select().from(products).where(eq(products.gatewayId, gatewayId))
}

export async function findProductById(id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id))
  return row ?? null
}

export async function updateProduct(id: number, patch: Partial<NewProduct>) {
  const [updated] = await db.update(products).set(patch).where(eq(products.id, id)).returning()
  return updated
}

export async function deleteProduct(id: number) {
  await db.delete(products).where(eq(products.id, id))
}

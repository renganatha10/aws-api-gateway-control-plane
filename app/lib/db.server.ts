import pg from "pg"

declare global {
  // Persist pool across HMR reloads in development
  var __db_pool__: pg.Pool | undefined
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set")
  }
  return new pg.Pool({ connectionString: process.env.DATABASE_URL })
}

export const db: pg.Pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (global.__db_pool__ ??= createPool())

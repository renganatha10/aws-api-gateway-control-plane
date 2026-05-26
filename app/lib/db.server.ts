import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

declare global {
  // Persist pool across HMR reloads in development
  var __db_pool__: pg.Pool | undefined;
}

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

function getOrCreatePool(): pg.Pool {
  if (process.env.NODE_ENV === "production") return createPool();
  if (!global.__db_pool__) global.__db_pool__ = createPool();
  return global.__db_pool__;
}

const pool: pg.Pool = getOrCreatePool();

export const db = drizzle(pool, { schema });

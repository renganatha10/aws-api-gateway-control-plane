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

const pool: pg.Pool =
  process.env.NODE_ENV === "production" ? createPool() : (global.__db_pool__ ??= createPool());

export const db = drizzle(pool, { schema });

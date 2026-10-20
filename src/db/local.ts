import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/** Embedded Postgres for local development only (never used when DATABASE_URL is set). */
export async function createLocalDb() {
  const dir = path.join(process.cwd(), ".data", "pglite");
  mkdirSync(dir, { recursive: true });
  const db = drizzle({ client: new PGlite(dir), schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

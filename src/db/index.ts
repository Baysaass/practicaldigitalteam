import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const g = globalThis as unknown as { __db?: Promise<Db> };

/**
 * Production: Postgres via DATABASE_URL (Neon, Supabase, Vercel Postgres …).
 * Local development without DATABASE_URL: an embedded PGlite database in ./.data,
 * migrated automatically, so `npm run dev` works with no setup.
 */
export function getDb(): Promise<Db> {
  g.__db ??= create();
  return g.__db;
}

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false, max: 5 });
    return drizzle({ client, schema });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL тохируулагдаагүй байна.");
  }
  const { createLocalDb } = await import("./local");
  return (await createLocalDb()) as unknown as Db;
}

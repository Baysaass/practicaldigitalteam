"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { managerRatings, settings } from "@/db/schema";
import { DEFAULT_WEIGHTS, METRICS, QUAL, type Weights } from "@/lib/metrics";
import { runSync } from "@/lib/sync";

// Every page (and so every action) sits behind the Basic Auth check in src/proxy.ts.

export async function syncNow(): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await runSync("manual");
    refresh();
    return { ok: true, message: `${r.issues} task, ${r.sprints} sprint шинэчлэгдлээ` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

const QUAL_KEYS = QUAL.map(([k]) => k) as string[];

export async function saveRating(person: string, period: string, field: string, value: string) {
  if (!person || !/^\d{4}-Q[1-4]$/.test(period)) throw new Error("Буруу утга");
  const db = await getDb();
  let patch: Record<string, unknown>;
  if (QUAL_KEYS.includes(field)) {
    const n = value === "" ? null : Number(value);
    if (n != null && !(Number.isInteger(n) && n >= 1 && n <= 5)) throw new Error("1–5 оноо байх ёстой");
    patch = { [field]: n };
  } else if (field === "note") {
    patch = { note: value.slice(0, 2000) };
  } else {
    throw new Error("Буруу талбар");
  }
  await db
    .insert(managerRatings)
    .values({ person, period, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [managerRatings.person, managerRatings.period], set: { ...patch, updatedAt: new Date() } });
  refresh();
}

export async function saveWeights(input: Partial<Weights>) {
  const value: Weights = { ...DEFAULT_WEIGHTS };
  for (const m of METRICS) {
    const n = Number(input[m.k]);
    value[m.k] = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : m.w;
  }
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: "weights", value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  refresh();
}

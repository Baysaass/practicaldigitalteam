"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { getDb } from "@/db";
import { managerRatings, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_WEIGHTS, METRICS, QUAL, type Weights } from "@/lib/metrics";
import { runSync } from "@/lib/sync";

export async function getZakiPin(): Promise<string> {
  try {
    const db = await getDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, "zaki_pin"));
    if (row?.value && typeof (row.value as Record<string, unknown>).pin === "string") {
      return (row.value as { pin: string }).pin;
    }
  } catch (e) {
    // fallback
  }
  return process.env.ZAKI_PIN || "2026";
}

export async function verifyZakiPin(pin: string): Promise<{ ok: boolean; error?: string }> {
  const expectedPin = await getZakiPin();
  if (pin.trim() === expectedPin.trim()) {
    const c = await cookies();
    c.set("zaki_token", "authorized", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return { ok: true };
  }
  return { ok: false, error: "PIN код буруу байна." };
}

export async function updateZakiPin(newPin: string): Promise<{ ok: boolean; error?: string }> {
  if (!newPin || newPin.trim().length < 4) {
    return { ok: false, error: "PIN код хамгийн багадаа 4 оронтой байх ёстой." };
  }
  const isAuth = await isZakiAuthorized();
  if (!isAuth) return { ok: false, error: "Нэвтрэх эрх хүрэлцэхгүй байна." };

  const db = await getDb();
  await db
    .insert(settings)
    .values({ key: "zaki_pin", value: { pin: newPin.trim() }, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { pin: newPin.trim() }, updatedAt: new Date() },
    });

  return { ok: true };
}

export async function clearZakiPin(): Promise<{ ok: boolean }> {
  const c = await cookies();
  c.delete("zaki_token");
  refresh();
  return { ok: true };
}

export async function isZakiAuthorized(): Promise<boolean> {
  const c = await cookies();
  const token = c.get("zaki_token")?.value;
  return token === "authorized";
}

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

export type KpiProfileInput = {
  fullName?: string;
  jobTitle?: string;
  department?: string;
  role?: string;
  routineTasks?: string;
  manager?: string;
  training?: string;
  voluntary?: string;
  improvements?: string;
  conclusion?: string;
  lateMinutes?: number;
  absentDays?: number;
  vacationDays?: number;
};

export async function saveKpiProfile(person: string, period: string, data: KpiProfileInput) {
  if (!person || !/^\d{4}-Q[1-4]$/.test(period)) throw new Error("Буруу ажилтан эсвэл улирал");
  const db = await getDb();
  const patch: Record<string, unknown> = {
    fullName: data.fullName?.trim() || null,
    jobTitle: data.jobTitle?.trim() || null,
    department: data.department?.trim() || null,
    role: data.role?.trim() || null,
    routineTasks: data.routineTasks?.trim() || null,
    manager: data.manager?.trim() || null,
    training: data.training?.trim() || null,
    voluntary: data.voluntary?.trim() || null,
    improvements: data.improvements?.trim() || null,
    conclusion: data.conclusion?.trim() || null,
    lateMinutes: Number.isFinite(data.lateMinutes) ? Number(data.lateMinutes) : 0,
    absentDays: Number.isFinite(data.absentDays) ? Number(data.absentDays) : 0,
    vacationDays: Number.isFinite(data.vacationDays) ? Number(data.vacationDays) : 0,
    updatedAt: new Date(),
  };

  await db
    .insert(managerRatings)
    .values({ person, period, ...patch })
    .onConflictDoUpdate({
      target: [managerRatings.person, managerRatings.period],
      set: patch,
    });

  // Also update persistent person_profiles in settings so it applies to any future periods
  try {
    const [settingsRow] = await db.select().from(settings).where(eq(settings.key, "person_profiles"));
    const currentProfiles = (settingsRow?.value as Record<string, Record<string, unknown>>) || {};
    currentProfiles[person] = {
      ...(currentProfiles[person] || {}),
      fullName: patch.fullName,
      jobTitle: patch.jobTitle,
      department: patch.department,
      role: patch.role,
      routineTasks: patch.routineTasks,
      manager: patch.manager,
    };
    await db
      .insert(settings)
      .values({ key: "person_profiles", value: currentProfiles, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: currentProfiles, updatedAt: new Date() },
      });
  } catch (err) {
    console.error("Failed to update persistent person_profiles:", err);
  }

  refresh();
  return { ok: true };
}

export async function setPersonStatus(person: string, status: "active" | "inactive"): Promise<{ ok: boolean }> {
  const isAuth = await isZakiAuthorized();
  if (!isAuth) throw new Error("Удирдлагын эрх шаардлагатай");

  const db = await getDb();
  const [settingsRow] = await db.select().from(settings).where(eq(settings.key, "person_profiles"));
  const currentProfiles = (settingsRow?.value as Record<string, Record<string, unknown>>) || {};
  currentProfiles[person] = {
    ...(currentProfiles[person] || {}),
    status,
  };
  await db
    .insert(settings)
    .values({ key: "person_profiles", value: currentProfiles, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: currentProfiles, updatedAt: new Date() },
    });

  refresh();
  return { ok: true };
}

export async function removePerson(person: string): Promise<{ ok: boolean }> {
  const isAuth = await isZakiAuthorized();
  if (!isAuth) throw new Error("Удирдлагын эрх шаардлагатай");

  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "excluded_people"));
  const currentList = Array.isArray(row?.value) ? (row.value as string[]) : [];
  if (!currentList.includes(person)) {
    const nextList = [...currentList, person];
    await db
      .insert(settings)
      .values({ key: "excluded_people", value: nextList, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: nextList, updatedAt: new Date() },
      });
  }

  refresh();
  return { ok: true };
}

export async function restorePerson(person: string): Promise<{ ok: boolean }> {
  const isAuth = await isZakiAuthorized();
  if (!isAuth) throw new Error("Удирдлагын эрх шаардлагатай");

  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, "excluded_people"));
  const currentList = Array.isArray(row?.value) ? (row.value as string[]) : [];
  const nextList = currentList.filter((p) => p !== person);
  await db
    .insert(settings)
    .values({ key: "excluded_people", value: nextList, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: nextList, updatedAt: new Date() },
    });

  refresh();
  return { ok: true };
}

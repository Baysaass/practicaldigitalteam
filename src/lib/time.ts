/**
 * All day boundaries are computed in the team's timezone, not the server's (Vercel runs in UTC).
 * Ulaanbaatar has a fixed +08:00 offset (no DST), configurable via APP_TZ_OFFSET_MINUTES.
 */
export const TZ_OFFSET_MIN = Number(process.env.APP_TZ_OFFSET_MINUTES ?? 480);
const OFFSET_MS = TZ_OFFSET_MIN * 60_000;
export const DAY = 86_400_000;

/** "YYYY-MM-DD" of a moment in the team's timezone. */
export function dayKey(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of the given local day (YYYY-MM-DD) as an instant. */
export function startOfDay(ymd: string): Date {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) - OFFSET_MS);
}

/** Last millisecond of the given local day. */
export function endOfDay(ymd: string): Date {
  return new Date(startOfDay(ymd).getTime() + DAY - 1);
}

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

export function weekday(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

/** Quarter label used for manager ratings, e.g. "2026-Q4". */
export function quarterOf(d: Date): string {
  const k = dayKey(d);
  return `${k.slice(0, 4)}-Q${Math.floor((Number(k.slice(5, 7)) - 1) / 3) + 1}`;
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

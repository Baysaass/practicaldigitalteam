export const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
export const num = (v: number | null, p = 2) => (v == null ? "—" : v.toFixed(p));

/** Text color class for a ratio against good / warning thresholds. */
export function tone(v: number | null, good: number, warn: number) {
  if (v == null) return "text-muted-foreground";
  if (v >= good) return "text-green-700 dark:text-green-400";
  if (v >= warn) return "text-orange-700 dark:text-orange-400";
  return "text-red-700 dark:text-red-400";
}

export const initials = (n: string) => n.replace(/^[^.]+\./, "").slice(0, 2);

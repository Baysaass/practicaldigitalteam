/** Deterministic 4-digit PIN based on employee name. */
export function generateDefaultKpiPassword(person: string): string {
  if (!person) return "2026";
  const clean = person.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  const pin = 1000 + (hash % 9000);
  return String(pin);
}

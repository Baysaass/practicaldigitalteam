/** Deterministic 4-digit PIN based on employee name. */
export function generateDefaultKpiPassword(person: string): string {
  if (!person) return "2026";
  let hash = 0;
  for (let i = 0; i < person.length; i++) {
    hash = (hash * 31 + person.charCodeAt(i)) >>> 0;
  }
  const pin = 1000 + (hash % 9000);
  return String(pin);
}

/**
 * Pure catalog helpers — safe to import from client or server.
 * Money parsing uses integer cents only (AGENTS.md).
 */

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function makeSku(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) =>
      p
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "")
        .slice(0, 8)
    )
    .join("-")
    .slice(0, 40);
}

/** Parse "24.99" / "$24.99" → integer cents. Rejects floats via digit parsing. */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const m = cleaned.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const dollars = Number.parseInt(m[1], 10);
  const cents = m[2] ? Number.parseInt(m[2].padEnd(2, "0"), 10) : 0;
  return dollars * 100 + cents;
}

export function centsToDisplay(cents: number): string {
  const d = Math.floor(cents / 100);
  const c = Math.abs(cents % 100);
  return `${d}.${c.toString().padStart(2, "0")}`;
}

/**
 * Tolerant date parser for real-world Excel exports — handles the shapes
 * this business's historical files are likely to use. Indian business
 * data is assumed DD-MM-YYYY / DD/MM/YYYY when ambiguous (not US MM/DD).
 * Returns null (never throws) so callers can report "invalid date" as a
 * per-row validation error rather than crashing the whole import.
 */
export function parseFlexibleDate(input: string): Date | null {
  const s = input.trim();
  if (!s) return null;

  // ISO: 2024-09-15
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return makeDate(+m[1], +m[2], +m[3]);

  // DD-MM-YYYY or DD/MM/YYYY
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return makeDate(+m[3], +m[2], +m[1]);

  // DD-MM-YY or DD/MM/YY
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/.exec(s);
  if (m) return makeDate(2000 + +m[3], +m[2], +m[1]);

  // DD-Mon-YYYY (e.g. 15-Sep-2024)
  m = /^(\d{1,2})[-\s](\w{3,9})[-\s](\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month) return makeDate(+m[3], month, +m[1]);
  }

  // Fallback: let the JS Date parser try (handles e.g. "Sep 15, 2024").
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Guard against JS's rollover behaviour (e.g. day 32 rolling into next month).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

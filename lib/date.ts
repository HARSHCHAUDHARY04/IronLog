// ═══════════════════════════════════════════════════════
// Local-date helpers
// Workout dates are stored as plain 'YYYY-MM-DD' strings in the
// user's local calendar. Never derive them from toISOString(),
// which is UTC and shifts the day for non-UTC timezones.
// ═══════════════════════════════════════════════════════

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local calendar date as 'YYYY-MM-DD' */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse 'YYYY-MM-DD' (or a full ISO timestamp) as a local-midnight Date */
export function parseLocalDate(str: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!match) return new Date(str);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whole calendar days from b to a (a - b), DST-safe */
export function daysBetween(a: string, b: string): number {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcA - utcB) / MS_PER_DAY);
}

/** Monday 00:00 local of the week containing `date` */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 🕑 A TIME AS THE COORDINATOR WROTE IT — "About 3:15 PM", or "2:15/2:30 PM" (owner 2026-11-02, DECISION_LOG
 * "SCHEDULE FITS THE COORDINATOR'S TIMELINE AS WRITTEN: 4 ADDITIONS" (2); migration 20271303051692).
 *
 *   'at'    — exactly (every row until now): "3:15 PM"
 *   'about' — approximately: "About 3:15 PM"
 *   'or'    — one of two times, decided on the day: "2:15/2:30 PM". The second time is `time_or_minutes` after
 *             `start_at` (minutes, never a second clock — it moves whenever the start moves).
 *
 * `start_at` is always the EARLIEST time written, so a reader that does not know the shape still draws a true clock.
 * Leaf module (no imports), safe for any client bundle.
 */
export const TIME_SHAPES = ['at', 'about', 'or'] as const;
export type TimeShape = (typeof TIME_SHAPES)[number];

export function isTimeShape(v: unknown): v is TimeShape {
  return typeof v === 'string' && (TIME_SHAPES as readonly string[]).includes(v);
}

/** The second time's limits (the column's CHECK): within four hours of the first. */
export const OR_MINUTES_MAX = 240;

export function isOrMinutes(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= OR_MINUTES_MAX;
}

/** The second time of an 'or' as an ISO string (wall-clock digits in a UTC instant, like `start_at`). */
export function orAt(startIso: string, orMinutes: number): string {
  return new Date(Date.parse(startIso) + orMinutes * 60_000).toISOString();
}

/** Minutes from the first time to the second; null when the second is not after the first or too far. */
export function orMinutesBetween(startIso: string, secondIso: string): number | null {
  const n = Math.round((Date.parse(secondIso) - Date.parse(startIso)) / 60_000);
  return isOrMinutes(n) ? n : null;
}

/**
 * The words for a row's clock, as written. `clock` draws one instant ("2:15 PM"). Two times sharing AM/PM share it once
 * ("2:15/2:30 PM"); across noon both keep theirs ("11:45 AM/12:00 PM").
 */
export function timeAsWritten(
  row: { start_at: string; time_shape?: string | null; time_or_minutes?: number | null },
  clock: (iso: string) => string,
): string {
  const first = clock(row.start_at);
  if (row.time_shape === 'about') return `About ${first}`;
  if (row.time_shape === 'or' && isOrMinutes(row.time_or_minutes)) {
    const second = clock(orAt(row.start_at, row.time_or_minutes));
    const tail = (s: string) => /\s(AM|PM)$/i.exec(s)?.[1] ?? null;
    const a = tail(first);
    if (a && a === tail(second)) return `${first.replace(/\s(AM|PM)$/i, '')}/${second}`;
    return `${first}/${second}`;
  }
  return first;
}

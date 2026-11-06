/** A chapter whose time is not known yet (owner 2026-11-01, ruled yes): no clock, no call time (plan §3). */
export const TIME_TBA = 'Time TBA';

/**
 * ⏰ IS THIS ROW'S CLOCK UNKNOWN? (migration 20271300482585, plan §3 "Chapter time TBA = no call time"). A TBA chapter
 * keeps its DAY in `start_at` at 00:00 — that midnight is a placeholder, never a time. Every reader that draws a clock,
 * ranks by time, picks "now", or derives a call time asks THIS before it touches `start_at`: a TBA row is listed as
 * "Time TBA" (or left out), never drawn as 12:00 AM, never "now", never a call time. Held by
 * `a-tba-chapter-is-never-midnight.test.ts`.
 */
export function isTimeTba(row: { time_tba?: boolean | null }): boolean {
  return row.time_tba === true;
}

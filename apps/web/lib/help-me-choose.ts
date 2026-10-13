/**
 * help-me-choose.ts — the Suppliers page's "Help me choose" (PR5; owner 2026-10-10 answer 8: *"every price picked"* —
 * the days offered are the days EVERY PRICED pick is free).
 *
 * The shipped Find your date ranks a month's Saturdays by how many shortlisted suppliers are free and offers only the
 * days every BOOKED supplier can do (`fittingDates`). On the Suppliers page the couple has already priced a build, so
 * the bar is higher: a day one of the build's PRICED picks cannot take is not offered at all — offering it would turn
 * the build they priced into one they cannot book. Booked suppliers are priced picks too (they hold the date).
 *
 * A pick whose calendar is not set (`unknown` in the matrix, P5) does not remove a day: "Not set" is not "not
 * available" (2026-10-10). The ranking, words and pin are the shipped finder's own (`find-your-date.tsx`).
 */
import type { MatrixDate } from './schedule-matrix';

/** The days of the month that every priced pick can take, in the shipped ranking's order. */
export function daysFreeForPricedPicks(dates: readonly MatrixDate[], priced: ReadonlySet<string>): MatrixDate[] {
  return dates.filter((d) => !d.categories.some((c) => c.vendors.some((v) => priced.has(v.key) && v.state === 'booked')));
}

/** The month Help me choose opens on: the one asked, else the date's own month, else none (the couple names one). */
export function helpMonthOf(
  asked: string | null | undefined,
  date: string | null | undefined,
  precision: string | null | undefined,
): string | null {
  if (asked && /^\d{4}-(0[1-9]|1[0-2])$/.test(asked)) return asked;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (precision === 'year') return null;
  return date.slice(0, 7);
}

/** The words said when no day of the month works — never an empty list with no reason. */
export function noDayWords(pricedCount: number): string {
  return pricedCount > 0
    ? 'No Saturday that month works for every supplier you priced. Choose another month below.'
    : 'No Saturday that month works with your booked suppliers. Choose another month below.';
}

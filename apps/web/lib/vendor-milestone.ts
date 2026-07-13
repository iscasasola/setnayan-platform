/**
 * vendor-milestone.ts — a NEW vendor's first-year "business monthsary".
 *
 * The vendor-dashboard counterpart to the couple's Your-Year monthsaries (owner
 * 2026-07-13: "monthsary for everything on the first year … new business"). A
 * newly-opened shop celebrates monthly through year one, then graduates to a
 * yearly shop anniversary. Pure + dependency-free (reuses the event-anchor
 * derivation primitives), so it's trivially unit-testable.
 */
import { nextMonthsary, parseISO } from './event-anchor';
import { ordinal } from './year-moments';

export type BusinessMonthsary = { label: string; dateISO: string; daysUntil: number };

/**
 * The next "business monthsary" line for a shop, anchored to its open date on
 * Setnayan (`vendor_profiles.created_at`). Through year one it's the monthly
 * "3rd month in business"; the single NEXT monthsary is returned as a quiet
 * celebratory line while the shop is in its first year (ordinal 1..11).
 *
 * Returns null once year one is done (month 12 is the shop's 1-year mark), on a
 * bad date, OR for an ESTABLISHED business that merely joined Setnayan recently
 * — an old `establishedYear` (`in_business_since_year`) suppresses the line so a
 * 10-year shop never reads "3rd month in business". A shop that left the year
 * blank is treated as new (the honest default for an early adopter).
 */
export function nextBusinessMonthsary(
  openISO: string,
  todayISO: string,
  establishedYear?: number | null,
): BusinessMonthsary | null {
  const today = parseISO(todayISO);
  if (!today) return null;
  // Suppress for a business founded before it opened its Setnayan shop.
  const isNew = establishedYear == null || establishedYear >= today.getUTCFullYear() - 1;
  if (!isNew) return null;
  const ms = nextMonthsary(openISO, todayISO);
  if (!ms || ms.n < 1 || ms.n > 11) return null;
  const target = parseISO(ms.dateISO);
  return {
    label: `${ordinal(ms.n)} month in business`,
    dateISO: ms.dateISO,
    daysUntil: target ? Math.round((target.getTime() - today.getTime()) / 86400000) : 0,
  };
}

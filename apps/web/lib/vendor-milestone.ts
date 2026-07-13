/**
 * vendor-milestone.ts — a shop's "business birthday": a MONTHSARY while the
 * business is new (its first year) and an ANNIVERSARY every year after.
 *
 * The vendor-dashboard counterpart to the couple's Your-Year monthsaries (owner
 * 2026-07-13: "when they have a business recorded with us as to when they
 * started or if they just started a new one with Setnayan, they will also have
 * reminders about their business monthsary and anniversary — reasons to
 * celebrate and create events"). Pure + dependency-free (reuses the event-anchor
 * derivation primitives), so it's trivially unit-testable.
 *
 * Date source (best available today): the shop's open date on Setnayan
 * (`vendor_profiles.created_at`) gives the celebration month/day; the recorded
 * founding year (`in_business_since_year`) gives the TRUE years-in-business
 * count. A precise founding DATE for existing shops is a follow-up — until then
 * an established shop's anniversary count is exact even if the day is anchored to
 * when they joined Setnayan.
 */
import { nextMonthsary, nextAnniversary, parseISO } from './event-anchor';
import { ordinal } from './year-moments';

export type BusinessMilestone = {
  kind: 'monthsary' | 'anniversary';
  label: string;
  dateISO: string;
  daysUntil: number;
};

const DAY_MS = 86400000;

function dayCount(fromISO: string, toISO: string): number {
  const f = parseISO(fromISO);
  const t = parseISO(toISO);
  if (!f || !t) return 0;
  return Math.round((t.getTime() - f.getTime()) / DAY_MS);
}

/**
 * The shop's next business milestone — a first-year MONTHSARY ("3rd month in
 * business") or, once past year one, the yearly ANNIVERSARY ("11th year in
 * business"). Every shop gets one (a reason to celebrate); null only on a bad
 * date.
 *
 * `sinceYear` (`in_business_since_year`) decides new-vs-established and supplies
 * the true year count: an established shop that merely joined Setnayan recently
 * shows its real "11th year in business", never "3rd month in business". A blank
 * year falls back to the shop's Setnayan tenure (the honest early-adopter
 * default: a brand-new shop reads as new).
 */
export function businessMilestone(
  createdAtISO: string,
  todayISO: string,
  sinceYear?: number | null,
): BusinessMilestone | null {
  const today = parseISO(todayISO);
  const created = parseISO(createdAtISO);
  if (!today || !created) return null;
  const currentYear = today.getUTCFullYear();

  // FIRST YEAR → a monthsary. New-ness comes from the recorded founding year
  // when set (started this year), else from the Setnayan tenure (< 1 year).
  const ms = nextMonthsary(createdAtISO, todayISO);
  const newBySetnayan = !!ms && ms.n >= 1 && ms.n <= 11;
  const isNew = sinceYear != null ? sinceYear >= currentYear : newBySetnayan;
  if (isNew && ms && ms.n >= 1 && ms.n <= 11) {
    return {
      kind: 'monthsary',
      label: `${ordinal(ms.n)} month in business`,
      dateISO: ms.dateISO,
      daysUntil: dayCount(todayISO, ms.dateISO),
    };
  }

  // ESTABLISHED → the yearly anniversary, on the best date we have (the shop's
  // Setnayan open-date anniversary), counting the TRUE years in business.
  const ann = nextAnniversary(createdAtISO, todayISO);
  if (!ann) return null;
  const target = parseISO(ann.dateISO)!;
  const years = sinceYear != null ? target.getUTCFullYear() - sinceYear : ann.n;
  if (years < 1) return null;
  return {
    kind: 'anniversary',
    label: `${ordinal(years)} year in business`,
    dateISO: ann.dateISO,
    daysUntil: dayCount(todayISO, ann.dateISO),
  };
}

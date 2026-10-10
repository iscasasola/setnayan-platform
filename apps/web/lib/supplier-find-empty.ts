/**
 * supplier-find-empty.ts — what Find a supplier says when a category's list is
 * empty. Its own file, read by the SERVER page only: it writes dates the way
 * the Suppliers page's date line does (`suppliersDateFact`), and that module
 * must not ride into the bundle of Find's small client controls, which import
 * `supplier-find`.
 */
import { suppliersDateFact } from '@/lib/suppliers-shell';

/* ─── WHY A CATEGORY'S LIST IS EMPTY (2026-10-11) ───────────────────────────
 * Find hides a supplier who cannot be booked on the event's date (owner
 * 2026-10-10). An empty list therefore has THREE causes, and the page used to
 * have two sentences: with every supplier in a category full on the date it
 * said "No supplier lists this yet. Check back soon." — untrue, and worded
 * exactly like a category nobody has joined.
 *
 * HOW IT IS KNOWN, with no extra query: the search returns `hiddenForDate`,
 * the number of rows its own hide removed, and `hiddenForDateScope`, the
 * date(s) it judged them on. Nothing found AND somebody hidden is the "nobody
 * is free" case; nothing found and nobody hidden is the empty category.
 */
export const FIND_NONE_LISTED = 'No supplier lists this yet. Check back soon.';
export const FIND_NO_FILTER_MATCH = 'No supplier matches this filter. Try fewer.';

export type FindEmptyState = 'nobody_free' | 'no_filter_match' | 'none_listed';

/** The date(s) the hide judged on — `UnbookableScope` (lib/bench-bookable-days). */
export type FindDateScope = { kind: 'day' | 'days' | 'window' | 'month'; days: readonly string[] };

/**
 * PURE. Which sentence an empty list earns — or null when there are rows.
 *   found          what the search returned (after its hide)
 *   shown          what is on screen (after the couple's Filter)
 *   hiddenForDate  what the hide removed (0 when it removed nobody)
 *   filtering      the couple has a Filter picked
 * "Nobody is free" wins over the filter: when the search found nobody, the
 * Filter is not why the list is empty.
 */
export function findEmptyState(a: {
  found: number;
  shown: number;
  hiddenForDate: number;
  filtering: boolean;
}): FindEmptyState | null {
  if (a.shown > 0) return null;
  if (a.found === 0 && a.hiddenForDate > 0) return 'nobody_free';
  if (a.filtering) return 'no_filter_match';
  return 'none_listed';
}

/**
 * "Nobody is free on Sat, Dec 12, 2026." — THE APPROVED WORDS
 * (`prototypes/suppliers_page_2026-10-07_fable.html`, the unfolded category:
 * `Nobody is free ${dateKnown==='day' ? 'on '+shortDate(date)+' — try another
 * day in Help me choose' : 'in '+monthOf(date)}.`), with the date written the
 * way the page's own date line writes it (`suppliersDateFact`).
 *
 *   one day              Nobody is free on Sat, Dec 12, 2026.
 *   a month              Nobody is free in December 2026.
 *
 * 🧵 SEAM — "Help me choose". The prototype's day sentence goes on: "— try
 * another day in Help me choose." That names a control (the date sheet) which
 * is not on this screen yet, and a sentence may not point at a control that is
 * not there. When the date sheet is built, the day form gains that half HERE.
 *
 * ⚠ TWO FORMS THE PROTOTYPE DOES NOT HAVE — it only knows a day and a month.
 * An event still choosing between days, or holding a flexible window, can be
 * hidden for too (2026-10-10/11). They are written with the prototype's own
 * words and nothing added but the dates:
 *   several days         Nobody is free on Sat, Oct 2, 2027 · Sat, Nov 20, 2027.
 *   a window             Nobody is free on Sun, Oct 10, 2027 – Tue, Oct 12, 2027.
 */
export function findNobodyFreeWords(scope: FindDateScope | null | undefined): string {
  const day = (iso: string) => suppliersDateFact(iso, 'day').text;
  const days = scope?.days ?? [];
  const first = days[0];
  const last = days[days.length - 1];
  if (!scope || !first || !last) return FIND_NOBODY_FREE_BARE;
  if (scope.kind === 'month') return `Nobody is free in ${suppliersDateFact(first, 'month').text}.`;
  if (scope.kind === 'window') return `Nobody is free on ${day(first)} – ${day(last)}.`;
  if (scope.kind === 'days') return `Nobody is free on ${days.map(day).join(' · ')}.`;
  return `Nobody is free on ${day(first)}.`;
}

/** The hide removed somebody but the date it judged on did not arrive — it
 *  cannot happen while both come from one function; if it ever does, the page
 *  still must not say "nobody lists this". The prototype's three words. */
const FIND_NOBODY_FREE_BARE = 'Nobody is free.';

/** The sentence for an empty list. */
export function findEmptyWords(state: FindEmptyState, scope?: FindDateScope | null): string {
  if (state === 'nobody_free') return findNobodyFreeWords(scope);
  return state === 'no_filter_match' ? FIND_NO_FILTER_MATCH : FIND_NONE_LISTED;
}

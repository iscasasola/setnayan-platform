/**
 * supplier-find-empty.ts — what a supplier list says when it is empty. Read by SERVER pages only (Find's category
 * page, Discover's supplier view): it writes dates the way the Suppliers page's date line does
 * (`suppliersDateFact`).
 *
 * Carried over from the unmerged `rd/suppliers-find-fits-the-event` (2026-10-11), cut to the two date shapes this
 * tree's hide knows (`describeUnbookableScope`: a day, or a whole month).
 */
import { suppliersDateFact } from '@/lib/suppliers-shell';
import type { UnbookableScope } from '@/lib/bench-bookable-days';

/* ─── WHY A LIST IS EMPTY ───────────────────────────────────────────────────
 * A supplier who cannot be booked on the event's date is not shown (owner 2026-10-10; again 2026-11-13: "If a
 * supplier is unavailable for that day, then we do not need to show them. we only show what fits."). An empty list
 * therefore has THREE causes, and the page used to have two sentences: with every supplier in a category full on
 * the date it said "No supplier lists this yet. Check back soon." — untrue, and worded exactly like a category
 * nobody has joined.
 *
 * HOW IT IS KNOWN, with no extra query: the search returns `hiddenForDate`, the number of rows its own hide removed,
 * and `hiddenForDateScope`, the date(s) it judged them on. Nothing found AND somebody hidden is the "nobody is free"
 * case; nothing found and nobody hidden is the empty category.
 */
export const FIND_NONE_LISTED = 'No supplier lists this yet. Check back soon.';
export const FIND_NO_FILTER_MATCH = 'No supplier matches this filter. Try fewer.';

export type FindEmptyState = 'nobody_free' | 'no_filter_match' | 'none_listed';

/**
 * PURE. Which sentence an empty list earns — or null when there are rows.
 *   found          what the search returned (after its hide)
 *   shown          what is on screen (after the couple's Filter)
 *   hiddenForDate  what the hide removed (0 when it removed nobody)
 *   filtering      the couple has a Filter picked
 * "Nobody is free" wins over the filter: when the search found nobody, the Filter is not why the list is empty.
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
 * "Nobody is free on Sat, Dec 12, 2026." — THE APPROVED WORDS (`prototypes/suppliers_page_2026-10-07_fable.html`,
 * the unfolded category: `Nobody is free ${dateKnown==='day' ? 'on '+shortDate(date)+' — try another day in Help me
 * choose' : 'in '+monthOf(date)}.`), with the date written the way the page's own date line writes it
 * (`suppliersDateFact`).
 *
 *   one day              Nobody is free on Sat, Dec 12, 2026.
 *   a month              Nobody is free in December 2026.
 *
 * 🧵 SEAM — "Help me choose". The prototype's day sentence goes on: "— try another day in Help me choose." That names
 * a control which is not on these screens, and a sentence may not point at a control that is not there. When it is,
 * the day form gains that half HERE.
 */
export function findNobodyFreeWords(scope: UnbookableScope | null | undefined): string {
  const first = scope?.days[0];
  if (!scope || !first) return FIND_NOBODY_FREE_BARE;
  if (scope.kind === 'month') return `Nobody is free in ${suppliersDateFact(first, 'month').text}.`;
  return `Nobody is free on ${suppliersDateFact(first, 'day').text}.`;
}

/** The hide removed somebody but the date it judged on did not arrive — it cannot happen while both come from one
 *  function; if it ever does, the page still must not say "nobody lists this". The prototype's three words. */
const FIND_NOBODY_FREE_BARE = 'Nobody is free.';

/** The sentence for an empty list. */
export function findEmptyWords(state: FindEmptyState, scope?: UnbookableScope | null): string {
  if (state === 'nobody_free') return findNobodyFreeWords(scope);
  return state === 'no_filter_match' ? FIND_NO_FILTER_MATCH : FIND_NONE_LISTED;
}

/* ─── WHEN THE DATE COULD NOT BE CHECKED ─────────────────────────────────────
 * Discover hides suppliers full on the couple's date. When the capacity read fails it hides nobody — and must SAY
 * so, or the unfiltered list reads exactly like a filtered one (audit of #7556, 2026-11-13). Shown above the list,
 * whether or not the list has rows.
 *
 *   one day              Couldn't check who's free on Sat, Dec 12, 2026. Some of these suppliers may already be booked.
 *   a month              Couldn't check who's free in December 2026. Some of these suppliers may already be booked.
 */
export const DATE_UNCHECKED_TAIL = 'Some of these suppliers may already be booked.';

export function dateUncheckedWords(scope: UnbookableScope | null | undefined): string {
  const first = scope?.days[0];
  if (!scope || !first) return `Couldn't check who's free on your date. ${DATE_UNCHECKED_TAIL}`;
  if (scope.kind === 'month') return `Couldn't check who's free in ${suppliersDateFact(first, 'month').text}. ${DATE_UNCHECKED_TAIL}`;
  return `Couldn't check who's free on ${suppliersDateFact(first, 'day').text}. ${DATE_UNCHECKED_TAIL}`;
}

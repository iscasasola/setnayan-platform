/**
 * bench-sort.ts — reason-labeled sort for the couple Shortlist bench (2026-07-09).
 *
 * The bench orders each category's considered vendors by one of three lenses,
 * and every card carries a one-line "why it's here" pill so the re-order
 * explains itself (owner (d): "follow and filter and sort"). Pure + framework-
 * free (no React) so it's unit-testable and reusable by the two-column workspace
 * (PR-4). Reuses the fit fields the bench already computes (reachesVenue /
 * budgetFit / dateFit — see `shortlist-taxonomy.ts`).
 */

import type { ShortlistVendor } from '@/lib/shortlist-taxonomy';

export type BenchSort = 'fit' | 'price' | 'rating';

export const BENCH_SORTS: { key: BenchSort; label: string }[] = [
  { key: 'fit', label: 'Best fit' },
  { key: 'price', label: 'Lowest price' },
  { key: 'rating', label: 'Top rated' },
];

/** A per-card reason pill. `ok` reads positive (accent), `soft` is a quiet
 *  neutral qualifier (e.g. a rating readout). */
export type SortReason = { label: string; tone: 'ok' | 'soft' };

/** How many of the three live fit-checks (reach + budget + date) this vendor
 *  passes. A warn (out-of-range / over-budget / booked) or an unknown all count
 *  as "not passed", so the strongest fits float up. Date-free vendors rank up
 *  (fast-follow 2026-07-09). Max score is now 3. */
export function fitScore(v: ShortlistVendor): number {
  return (
    (v.reachesVenue === true ? 1 : 0) +
    (v.budgetFit === 'fits' ? 1 : 0) +
    (v.dateFit === 'free' ? 1 : 0)
  );
}

/**
 * Sort a category's vendors by the active lens and attach a per-card reason.
 * Returns a NEW array (never mutates the input). The reason explains the card's
 * position under the current lens — the sort leader gets the headline label,
 * the rest get an honest qualifier or nothing (calm by default).
 */
export function sortWithReasons(
  vendors: ShortlistVendor[],
  mode: BenchSort,
): { v: ShortlistVendor; reason: SortReason | null }[] {
  const arr = [...vendors];
  if (mode === 'price') {
    arr.sort((a, b) => (a.totalCostPhp ?? Infinity) - (b.totalCostPhp ?? Infinity));
  } else if (mode === 'rating') {
    arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else {
    arr.sort(
      (a, b) =>
        fitScore(b) - fitScore(a) ||
        (b.rating ?? 0) - (a.rating ?? 0) ||
        (a.totalCostPhp ?? Infinity) - (b.totalCostPhp ?? Infinity),
    );
  }
  return arr.map((v, i) => {
    let reason: SortReason | null = null;
    if (mode === 'price') {
      reason = i === 0 && v.totalCostPhp != null ? { label: 'Lowest price', tone: 'ok' } : null;
    } else if (mode === 'rating') {
      reason =
        i === 0 && v.rating != null
          ? { label: 'Top rated', tone: 'ok' }
          : v.rating != null
            ? { label: `${v.rating.toFixed(1)}★`, tone: 'soft' }
            : null;
    } else {
      const s = fitScore(v);
      reason =
        i === 0
          ? { label: 'Best fit', tone: 'ok' }
          : s >= 2
            ? { label: 'Strong fit', tone: 'ok' }
            : s === 1
              ? { label: 'Fair fit', tone: 'soft' }
              : null;
    }
    return { v, reason };
  });
}

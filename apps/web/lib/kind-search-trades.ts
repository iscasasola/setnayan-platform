import { rankTaxonomyOptions, MAX_SUGGESTIONS } from '@/lib/taxonomy-search-rank';

/**
 * kind-search-trades.ts — WHAT THE CARD MAKER'S SEARCH RETURNS WHEN A SUPPLIER
 * TYPES A TRADE (C1, 2026-08-28).
 *
 * 🔴 THE GAP THIS CLOSES. The kind sheet's search box only ever matched the
 * ~46 legacy department pills, by a plain `label.includes(query)`. The 262
 * real trades in the live coverage taxonomy were not searchable there at
 * all — measured: generator hire, tent rental, sorbetes carts, bridesmaid
 * dresses and 47 others have NO word of their own in that list, and three
 * funeral kinds render in no group at all. A shop selling exactly one of
 * those had to file under "Miscellaneous" or a department that is not
 * theirs, even though the trade's own name has been sitting in the admin
 * taxonomy the whole time.
 *
 * ⛔ THIS FILE DOES NOT MATCH ANYTHING ITSELF. `lib/taxonomy-search-rank.ts`
 * already exists, is pure, is tested, and has four tiers — written BECAUSE
 * the single word "photobooth" used to return zero results. Writing a
 * second matcher here would be the exact two-hand-typed-things failure this
 * repo keeps paying for, so this file only IMPORTS it and adds the one
 * thing the shared ranker cannot know on its own: which trades are already
 * shown elsewhere on this screen and must not be repeated.
 *
 * 🔒 STANDING IS NOT COMPUTED HERE. A `TradeMatch`'s `standing` is handed in
 * already resolved (by `lib/vendor-category-parents.ts`, server-side, the
 * same function the save enforces) — this file never re-derives whether a
 * kind is offerable. Rendering a ranked result without that would resurrect
 * the exact defect the card maker's own docblock records repairing: a
 * capped supplier picks a trade, writes the whole card, and is refused only
 * at Publish.
 */

/** One live trade, as the search band needs it. */
export type TradeMatch = {
  /** The `canonical_service` key — this IS what gets stored on the card. */
  key: string;
  /** The trade's own name, e.g. "Sorbetes Cart". */
  label: string;
  /** The branch it sits under, e.g. "Food Cart" — told apart on screen. */
  branch: string;
  standing: 'covered' | 'open' | 'locked';
  /** Only set when `standing === 'locked'`. */
  why?: string;
};

/**
 * Rank the live trades against a typed query, excluding anything already
 * shown elsewhere on the kind sheet (the shop's own coverage band, and any
 * legacy pill whose value happens to be the same key — 16 of the 262 leaves
 * are exact matches with a legacy card-kind key).
 *
 * Search-results-only by construction: an empty or sub-minimum query yields
 * `rankTaxonomyOptions([], …)` → `[]` (see `MIN_QUERY_LEN` there), so this
 * never becomes a rendered wall of 262 pills — the owner's lock on this
 * screen (coverage-first, the rest one tap away).
 */
export function rankTradeMatches(
  candidates: ReadonlyArray<TradeMatch>,
  query: string,
  excludeKeys: ReadonlySet<string>,
  limit: number = MAX_SUGGESTIONS,
): TradeMatch[] {
  // Filtered BEFORE ranking, not after — filtering the ranked output could
  // hand back fewer than `limit` results even when more eligible trades
  // exist further down the real ranking.
  const eligible = candidates.filter((c) => !excludeKeys.has(c.key));
  return rankTaxonomyOptions(eligible, query, limit);
}

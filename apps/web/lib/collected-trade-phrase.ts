import { MIN_QUERY_LEN } from '@/lib/taxonomy-search-rank';

/**
 * collected-trade-phrase.ts — WHAT COUNTS AS "THE SEARCH MISSED, AND THE
 * SUPPLIER PICKED ANYWAY" (C3, 2026-08-28. "It remembers what suppliers
 * confirm.")
 *
 * 🔑 THIS IS THE ONLY PLACE THAT DECIDES A MISS. The kind sheet's own
 * "Nothing matches…" message and the maker's collection hook must agree on
 * exactly the same condition or they drift — one telling the supplier their
 * word found nothing while the other silently believes it found something
 * (or the reverse). `isTradeSearchMiss` is imported by BOTH; neither
 * re-derives it. See `canvas-maker.tsx`'s `kindSearchMissed`.
 *
 * 🚨 THE POISONING RISK THIS FILE EXISTS TO BOUND (register 2026-08-28 § C3):
 * a supplier could type "catering", deliberately pick a wrong trade, save a
 * real card, and teach that pairing to every future supplier. Two floors,
 * both enforced here, both re-checked server-side in
 * `service-trade-aliases-db.ts` because nothing posted by a browser is
 * trusted from here:
 *   1. ONLY a genuine miss is collectible — a query the ranked-trade search
 *      (which already carries C1's search AND C2's reviewed aliases folded
 *      into the SAME candidate list, see `kind-search-trades.ts`) came back
 *      empty for. A phrase either search already answers is never learned —
 *      that alone caps the whole mechanism to obscure wordings nobody has
 *      taught the ranker yet.
 *   2. ONLY a pick that resolves to one of the live coverage TRADES is kept.
 *      Miscellaneous and every legacy department pill teach nothing useful
 *      (they are not what the search band or the alias table are about) and
 *      are dropped here rather than laundered through a low-value row.
 *
 * ⚖ WHAT THIS FILE DOES NOT DECIDE: whether the pairing goes LIVE. It never
 * does, from here — the row it produces lands `reviewed_at IS NULL` in
 * `canonical_service_aliases`, the same queue C2's mined rows sit in, and
 * only an admin approving it at /admin/taxonomy/aliases makes it answer
 * anybody. "Collect first, then recommend" (owner, 2026-08-28) is enforced
 * by the REVIEW GATE, not by anything in this file.
 */

/**
 * Did the ranked-trade search (which already includes C2's reviewed
 * aliases) come back with nothing for this query, AND did no legacy
 * department pill's own label match it either?
 *
 * Mirrors the maker's own "Nothing matches…" condition exactly — the single
 * source of truth for both the on-screen message and the collection hook.
 */
export function isTradeSearchMiss(params: {
  query: string;
  rankedTradeCount: number;
  anyLegacyLabelMatches: boolean;
}): boolean {
  const q = params.query.trim();
  return q.length >= MIN_QUERY_LEN && params.rankedTradeCount === 0 && !params.anyLegacyLabelMatches;
}

/**
 * Given a miss that was just observed and a trade the supplier went on to
 * pick, is this a pairing worth remembering?
 *
 * `missedQuery` is `null` once no miss is pending (nothing typed yet, the
 * last miss was already consumed by an earlier pick, or a later query
 * stopped missing). `liveTradeKeys` is the exact set the search band draws
 * candidates from (`tradeOptions`, C1) — the same 262-ish keys, never a
 * second list that could disagree with it.
 */
export function collectiblePhraseFor(params: {
  missedQuery: string | null;
  pickedKey: string;
  liveTradeKeys: ReadonlySet<string>;
}): string | null {
  const q = params.missedQuery?.trim() ?? '';
  if (q.length < MIN_QUERY_LEN) return null;
  if (!params.liveTradeKeys.has(params.pickedKey)) return null;
  return q;
}

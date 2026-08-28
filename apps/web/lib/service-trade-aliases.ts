/**
 * service-trade-aliases.ts — ONE TRADE, MANY NAMES (C2, 2026-08-28).
 *
 * A supplier types "sorbetes", "sorbetero" or "ice cream cart" and none of
 * those words needs to appear inside the trade's own label for the maker to
 * find it — this file is the resolution logic for a curated alias list,
 * done the cheap way instead of embeddings (see § R of
 * WHATS_NEXT_The_Category_Suggester_2026-08-28.md for why embeddings were
 * demoted for this project's size).
 *
 * ⛔ THIS FILE DOES NOT NORMALISE PHRASES ITSELF. `normalisePhrase` already
 * exists in `lib/admin-map/ask-the-admin.ts` — same normalisation on the way
 * IN (seeding, review) and the way OUT (matching), or a lookup never hits.
 * Writing a second normaliser here would be the exact two-hand-typed-things
 * failure this repo keeps paying for.
 *
 * 🔒 AN ALIAS IS NEVER TRUSTED TO STILL NAME A LIVE TRADE. A trade can be
 * merged into another (service-merge-forward.ts) or retired from the
 * visible tree after an alias row is written. `reviewedAliasesByLiveTrade`
 * resolves every alias's stored key through the merge-forward map and drops
 * it — silently, never rendering a stale trade — if the resolved key is not
 * one of the currently VISIBLE trades handed in. This is the same posture
 * `ask-the-admin.ts` takes with a stored href: validate on the way OUT, not
 * only on the way in.
 */
import { normalisePhrase } from '@/lib/admin-map/ask-the-admin';
import { resolveMergedService, type MergeForwardMap } from './service-merge-forward';

export { normalisePhrase };

/** One alias row, exactly as read from `canonical_service_aliases`. */
export type TradeAliasRow = {
  phrase: string;
  canonical_service: string;
  reviewed_at: string | null;
};

/** How many aliases a single trade may carry into the search band. */
const MAX_ALIASES_PER_TRADE = 12;

/**
 * Reviewed aliases, grouped by the LIVE trade they resolve to.
 *
 * Three filters, in order — an alias survives only if it clears all three:
 *   1. It is reviewed (`reviewed_at` is set). An unreviewed alias answers
 *      nobody — this is enforced again here even though RLS already hides
 *      unreviewed rows from an ordinary read, because a caller that reads
 *      with the admin client (bypassing RLS, e.g. the review screen itself
 *      re-using this function) must not accidentally serve one.
 *   2. Its stored `canonical_service` resolves, through the merge-forward
 *      map, to a key that is still one of `liveKeys` — the visible trades
 *      on screen right now. A merged-away or retired target is dropped
 *      silently, never rendered.
 *   3. The resolved trade has room left (capped per trade so one
 *      over-eager seeding pass cannot bury a search result under fifty
 *      synonyms of the same thing).
 */
export function reviewedAliasesByLiveTrade(
  rows: readonly TradeAliasRow[],
  forwards: MergeForwardMap,
  liveKeys: ReadonlySet<string>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.reviewed_at) continue;
    const live = resolveMergedService(row.canonical_service, forwards);
    if (!liveKeys.has(live)) continue;
    const phrase = row.phrase.trim();
    if (!phrase) continue;
    const existing = out.get(live);
    if (existing) {
      if (existing.length < MAX_ALIASES_PER_TRADE && !existing.includes(phrase)) {
        existing.push(phrase);
      }
    } else {
      out.set(live, [phrase]);
    }
  }
  return out;
}

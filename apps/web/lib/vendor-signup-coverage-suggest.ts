/**
 * vendor-signup-coverage-suggest.ts — turning what a shop's OWN website says
 * it does into real trades it can confirm as coverage (C5, 2026-08-28).
 *
 * ⛔ THIS FILE DOES NOT MATCH ANYTHING ITSELF. `lib/taxonomy-search-rank.ts`
 * (C1) already ranks a typed phrase against a trade's label + its reviewed
 * aliases (C2); this file only decides, for each free-text phrase Deep
 * Search read off a shop's website, which ONE live trade — if any — the
 * SAME ranker would return, and turns that into a suggestion. Writing a
 * second matcher here would be the exact two-hand-typed-things failure this
 * repo keeps paying for.
 *
 * 🔒 NO INVENTED CONFIDENCE FLOOR. `rankTaxonomyOptions` already requires
 * `MIN_QUERY_LEN` characters and only ever returns a match on one of its
 * four tiers (label starts-with / contains / key-snake-contains / squashed
 * spelling, or the identical tiers against a reviewed alias) — the SAME bar
 * the interactive search box in the card maker uses. This is deliberate:
 * "framework, not tuning" (owner, 2026-08-28) — there is no authored history
 * of real supplier wordings to calibrate a stricter floor against yet, and
 * inventing one here would be exactly that invention with nothing to check
 * it against.
 *
 * ⚠ A DETECTED-SERVICES PHRASE IS NOT ALWAYS SHORT. Deep Search's own schema
 * only asks for "service the web says they offer" — sometimes that is a
 * short trade-shaped phrase ("photo booth", "florist"), sometimes a longer
 * descriptive sentence a website actually used. The ranker was built for a
 * TYPED QUERY, so a phrase that never literally starts with / contains /
 * squash-matches a trade's label or alias text simply scores 0 and produces
 * NO suggestion for that phrase — the safe failure direction for something
 * nobody asked to see. This is a known, accepted limitation of a first
 * build, not a bug: a confidently wrong guess is worse than a missed one.
 */
import {
  MAX_SUGGESTIONS,
  rankTaxonomyOptions,
  type RankableOption,
} from './taxonomy-search-rank';

/** One live trade, as this matcher needs it — a strict subset of `TradeMatch`
 *  (kind-search-trades.ts) with no `standing`, because a signup suggestion is
 *  never checking whether the shop is capped; it is proposing a NEW trade the
 *  shop has not declared yet. */
export type SuggestableTrade = RankableOption & {
  /** The branch the trade sits under, e.g. "Food Cart" — carried through so
   *  the suggestion card can tell two similarly-named trades apart. */
  branch: string;
};

export type CoverageSuggestion = {
  /** The `canonical_service` key — this IS what gets written to `services[]`. */
  key: string;
  label: string;
  branch: string;
  /** The exact phrase from the dossier's `detected_services` that matched. */
  sourcePhrase: string;
};

/* How many suggestions a card shows at once is NOT redefined here. Its own
 * comment already said it was "the same cap the card maker's own search band
 * uses" — so it was a COPY of a rule, and two definitions of one rule do not
 * stay equal. `MAX_SUGGESTIONS` is imported from `taxonomy-search-rank`, the
 * module this file already depends on for the matching itself. */

/**
 * Match each detected-services phrase against the live trade catalogue and
 * return, at most, one suggestion per matched trade — first phrase to match
 * a given trade wins; later phrases naming the same trade are dropped rather
 * than shown twice.
 *
 * `alreadyCoveredKeys` removes anything the shop has already declared: a
 * suggestion for a trade a shop already covers is not a suggestion, it is
 * noise.
 */
export function matchDetectedServicesToTrades(
  detectedServices: readonly string[],
  candidates: readonly SuggestableTrade[],
  alreadyCoveredKeys: ReadonlySet<string>,
  limit: number = MAX_SUGGESTIONS,
): CoverageSuggestion[] {
  const eligible = candidates.filter((c) => !alreadyCoveredKeys.has(c.key));
  const seen = new Set<string>();
  const out: CoverageSuggestion[] = [];

  for (const raw of detectedServices) {
    if (out.length >= limit) break;
    const phrase = raw.trim();
    if (!phrase) continue;
    const [top] = rankTaxonomyOptions(eligible, phrase, 1);
    if (!top || seen.has(top.key)) continue;
    seen.add(top.key);
    out.push({ key: top.key, label: top.label, branch: top.branch, sourcePhrase: phrase });
  }

  return out;
}

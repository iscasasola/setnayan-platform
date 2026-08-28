/**
 * taxonomy-search-rank.ts — how a typed query is matched against the service
 * taxonomy in the marketplace search box.
 *
 * WHY THIS IS ITS OWN MODULE. It used to be the inline body of a `useMemo`
 * inside `app/explore/_components/taxonomy-search.tsx` — a `'use client'`
 * component that imports `next/navigation`. That made the matching rules
 * effectively untestable: nothing could import them without pulling React and
 * the Next router in, so no test ever exercised them, and a regression could
 * only ever have surfaced as a customer typing a real word and finding nothing.
 * Pure function, no React, no Next — see `taxonomy-search-rank.test.ts`.
 */

/** The minimum a person must type before we suggest anything. */
export const MIN_QUERY_LEN = 2;

/** Default suggestion cap — what the dropdown can show without scrolling. */
export const MAX_SUGGESTIONS = 8;

/** The shape the ranker needs. Anything richer (folder, counts) rides along. */
export type RankableOption = {
  /** The canonical_service key, e.g. `photo_booth`. */
  key: string;
  /** The human label derived from that key, e.g. `Photo Booth`. */
  label: string;
  /**
   * Other words that mean the same thing — reviewed aliases like
   * "sorbetero" for Sorbetes Cart (C2, 2026-08-28: `lib/service-trade-aliases.ts`).
   * Matched with the SAME letter tiers as the label (start / contains /
   * squashed-spelling), so a phrase that never appears in the label at all
   * can still find the option. Omit or leave empty for an option with no
   * known aliases — ranking is then byte-identical to before this field
   * existed.
   */
  aliases?: readonly string[];
};

/**
 * Rank taxonomy options for a typed query, best first.
 *
 * Four tiers:
 *   4 — the label STARTS with what they typed         ("photo"       → Photo Booth)
 *   3 — the label CONTAINS it                         ("booth"       → Photo Booth)
 *   2 — the canonical key contains its snake form     ("photo booth" → photo_booth)
 *   1 — the label matches ignoring spaces/punctuation ("photobooth"  → Photo Booth)
 *
 * 🔑 TIER 1 IS NOT COSMETIC — it is the whole point of the 2026-08-12 rename
 * work. Measured before it existed: the single word **"photobooth" returned
 * ZERO results**. The service is stored as two words, so the startsWith match,
 * the contains match and the snake match were all blind to it, and somebody
 * typing it the way Filipinos actually write it got an empty panel with no
 * error at all. Nobody should have to spell a thing our way to find it.
 *
 * It ranks LAST so genuine word matches always sort above it, and it requires
 * MIN_QUERY_LEN characters after squashing so punctuation alone matches nothing.
 */
export function rankTaxonomyOptions<T extends RankableOption>(
  options: ReadonlyArray<T>,
  query: string,
  limit: number = MAX_SUGGESTIONS,
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < MIN_QUERY_LEN) return [];

  const snakeQuery = trimmed.replace(/\s+/g, '_');
  const squashedQuery = trimmed.replace(/[^a-z0-9]+/g, '');

  const matches: Array<{ opt: T; score: number }> = [];
  for (const opt of options) {
    const labelLc = opt.label.toLowerCase();
    const keyLc = opt.key.toLowerCase();

    // Tiers 4/3/1 are "does this TEXT start with / contain / squash-match
    // the query" — the label is one such text, and so is every alias. Tier
    // 2 stays label/key-specific (the canonical KEY containing the snake
    // form of the query) since an alias phrase has no key of its own.
    //
    // 🔑 THIS IS A `max`, NOT AN `if/else-if` CHAIN, AND THAT IS DELIBERATE.
    // The four original tiers were mutually exclusive by construction (each
    // condition tests a DIFFERENT text: label-starts, label-contains,
    // key-snake, label-squashed), so taking the highest TRUE tier produces
    // the identical result the old if/else-if chain did — this is a pure
    // refactor, not a behaviour change, which is why every existing test in
    // taxonomy-search-rank.test.ts still holds with `aliases` never set.
    let score = textTierScore(labelLc, trimmed, squashedQuery);
    if (keyLc.includes(snakeQuery)) score = Math.max(score, 2);
    for (const alias of opt.aliases ?? []) {
      score = Math.max(score, textTierScore(alias.toLowerCase(), trimmed, squashedQuery));
    }

    if (score > 0) matches.push({ opt, score });
  }

  matches.sort(
    (a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label),
  );
  return matches.slice(0, limit).map((m) => m.opt);
}

/**
 * Tiers 4 / 3 / 1 against one piece of text, already lowercased — the
 * label-shaped rules, factored out so the label and every alias are scored
 * by the exact same logic (one matcher, tested once).
 */
function textTierScore(textLc: string, trimmedQuery: string, squashedQuery: string): number {
  if (textLc.startsWith(trimmedQuery)) return 4;
  if (textLc.includes(trimmedQuery)) return 3;
  if (
    squashedQuery.length >= MIN_QUERY_LEN &&
    textLc.replace(/[^a-z0-9]+/g, '').includes(squashedQuery)
  )
    return 1;
  return 0;
}

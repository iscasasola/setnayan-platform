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

// ── 🔤 CLOSE MATCHES — A TYPO STILL FINDS ITS TRADE (owner, the 2026-11-06 gate walk) ──
//
// Owner, on /open-shop's service search: *"search that finds the compatible and most likely compatible (to help
// solve space, typo errors…)"*. Spaces were already forgiven (tier 1, "photobooth"); a typo was not — "catring"
// matched nothing and the picker said "Nothing matches", with Catering one letter away.
//
// 🔒 A SEPARATE LIST, NEVER MIXED INTO THE RANKED ONE, AND NEVER AUTO-PICKED. A close match is a GUESS about what
// somebody meant, so it is returned on its own (`close`) and the screen shows it under "Close matches" for the
// person to tap. `matches` is byte-identical to `rankTaxonomyOptions` — every existing caller (Explore, the card
// maker, the admin near-match draft, sign-up coverage) keeps exactly the answers it has today.
//
// THE RULE: every word typed (3+ letters) must sit within a small edit distance of some word of the label or of a
// reviewed alias — 1 edit for a word of up to 5 letters, 2 for a longer one (an edit = a letter added, dropped,
// changed, or two neighbours swapped). Or the whole query, spaces squashed, within that distance of the whole
// label/alias squashed ("fotobooth" → Photo Booth).

/** The edits a typed word of this length may carry and still be a close match. */
export function closeMatchBudget(wordLength: number): number {
  return wordLength <= 5 ? 1 : 2;
}

/** Words shorter than this carry no close match on their own ("dj", "of"): too many neighbours. */
const CLOSE_MIN_WORD = 3;

/** Optimal-string-alignment distance (Levenshtein + adjacent swap), stopping early past `max`. */
export function editDistanceWithin(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push(new Array<number>(b.length + 1).fill(0));
    rows[i]![0] = i;
  }
  for (let j = 0; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
  }
  return rows[a.length]![b.length]!;
}

const wordsOf = (textLc: string) => textLc.split(/[^a-z0-9]+/).filter(Boolean);

/** The smallest number of edits by which the query is a close match for this text, or null when it is not. */
function closeEdits(textLc: string, queryWords: string[], squashedQuery: string): number | null {
  const textWords = wordsOf(textLc);
  if (textWords.length === 0) return null;
  // Whole-phrase, spaces squashed: "fotobooth" ↔ "photobooth".
  const squashedText = textWords.join('');
  if (squashedQuery.length >= CLOSE_MIN_WORD) {
    const d = editDistanceWithin(squashedQuery, squashedText, closeMatchBudget(squashedQuery.length));
    if (d <= closeMatchBudget(squashedQuery.length)) return d;
  }
  // Word by word: every typed word must be near some word of the text.
  const counted = queryWords.filter((w) => w.length >= CLOSE_MIN_WORD);
  if (counted.length === 0 || counted.length !== queryWords.length) return null;
  let total = 0;
  for (const q of counted) {
    const budget = closeMatchBudget(q.length);
    let best = budget + 1;
    for (const t of textWords) {
      const d = editDistanceWithin(q, t, budget);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best > budget) return null;
    total += best;
  }
  return total;
}

/**
 * The ranked matches AND, on their own, the close matches a typo would have missed.
 *
 * `matches` is exactly `rankTaxonomyOptions(options, query, limit)`. `close` holds options that are NOT in
 * `matches` but whose label or a reviewed alias is a close match (see the rule above), fewest edits first, then
 * by label. Shown under "Close matches"; never picked for the person.
 */
export function rankTaxonomyOptionsWithClose<T extends RankableOption>(
  options: ReadonlyArray<T>,
  query: string,
  limit: number = MAX_SUGGESTIONS,
): { matches: T[]; close: T[] } {
  const matches = rankTaxonomyOptions(options, query, limit);
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < MIN_QUERY_LEN) return { matches, close: [] };
  const queryWords = wordsOf(trimmed);
  const squashedQuery = queryWords.join('');
  const taken = new Set(matches.map((m) => m.key));
  // An option that the ranked tiers matched but the limit cut off is not a "close" match — it is a real one.
  const anyRanked = new Set(rankTaxonomyOptions(options, query, Number.MAX_SAFE_INTEGER).map((m) => m.key));
  const close: Array<{ opt: T; edits: number }> = [];
  for (const opt of options) {
    if (taken.has(opt.key) || anyRanked.has(opt.key)) continue;
    let best: number | null = closeEdits(opt.label.toLowerCase(), queryWords, squashedQuery);
    for (const alias of opt.aliases ?? []) {
      const d = closeEdits(alias.toLowerCase(), queryWords, squashedQuery);
      if (d !== null && (best === null || d < best)) best = d;
    }
    if (best !== null) close.push({ opt, edits: best });
  }
  close.sort((a, b) => a.edits - b.edits || a.opt.label.localeCompare(b.opt.label));
  return { matches, close: close.slice(0, limit).map((c) => c.opt) };
}

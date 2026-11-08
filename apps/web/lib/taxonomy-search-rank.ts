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
 * Tiers, highest first (each text = the label, or one reviewed alias):
 *   7 — a text IS what they typed                        ("dj"          → DJ)
 *   6 — a text STARTS with it                            ("photo"       → Photo Booth)
 *   5 — a WORD of a text starts with it                  ("band"        → Live Band · "cake" → Wedding Cake)
 *   4 — a WORD of the canonical key starts with it       ("band"        → `live_band`, whatever its label says)
 *   3 — a text contains it inside a word                 ("cake"        → Crepe Pancake Station)
 *   2 — the canonical key contains its snake form        ("photo booth" → photo_booth)
 *   1 — a text matches ignoring spaces/punctuation, FROM A WORD START ("photobooth" → Photo Booth)
 *
 * 🔑 A WORD OR A PREFIX ALWAYS BEATS A LETTER RUN (controller, A5, 7 Nov: *"band" must never lead to Cake*). Before,
 * "cake" ranked Crepe Pancake Station above Wedding Cake (both "contains", tie broken alphabetically), and tier 1 matched
 * a run of letters ACROSS word boundaries — "mc" found Ice Cream Cart through "icecreamcart", "band" would find any
 * "urBAN Dance". Tier 1 now starts at a word, so "photobooth" still finds Photo Booth and nothing finds a letter run
 * that straddles two words.
 *
 * 🎵 TIER 4 IS WHY A RENAMED TRADE STAYS FINDABLE. Taxonomy v2 (#7355) renames `live_band`'s row to "Music"; the key
 * keeps its words, so "band" still finds it — with no hard-coded synonym anywhere. Aliases come only from the one
 * source (`canonical_service_aliases`, Admin › Categories › search words).
 *
 * Tier 1 is not cosmetic — measured before it existed, the single word **"photobooth" returned ZERO results**: the
 * service is stored as two words. It ranks LAST and requires MIN_QUERY_LEN characters after squashing.
 */
export function rankTaxonomyOptions<T extends RankableOption>(
  options: ReadonlyArray<T>,
  query: string,
  limit: number = MAX_SUGGESTIONS,
): T[] {
  const trimmed = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (trimmed.length < MIN_QUERY_LEN) return [];

  const snakeQuery = trimmed.replace(/\s+/g, '_');
  const squashedQuery = trimmed.replace(/[^a-z0-9]+/g, '');

  const matches: Array<{ opt: T; score: number }> = [];
  for (const opt of options) {
    const keyLc = opt.key.toLowerCase();
    // A `max` over every text (label + each alias) and the key: the best reason this option matches wins.
    let score = textTierScore(opt.label.toLowerCase(), trimmed, squashedQuery);
    for (const alias of opt.aliases ?? []) {
      score = Math.max(score, textTierScore(alias.toLowerCase(), trimmed, squashedQuery));
    }
    if (score < 4 && wordStartsWith(keyLc.replace(/_/g, ' '), trimmed)) score = 4;
    if (score < 2 && keyLc.includes(snakeQuery)) score = 2;

    if (score > 0) matches.push({ opt, score });
  }

  matches.sort(
    (a, b) => b.score - a.score || a.opt.label.localeCompare(b.opt.label),
  );
  return matches.slice(0, limit).map((m) => m.opt);
}

/** Does some WORD of `textLc` (words split on anything not a letter or digit) begin with `q` — `q` may be several words? */
function wordStartsWith(textLc: string, q: string): boolean {
  const words = textLc.split(/[^a-z0-9]+/).filter(Boolean);
  const qWords = q.split(/[^a-z0-9]+/).filter(Boolean);
  if (qWords.length === 0) return false;
  for (let i = 0; i + qWords.length <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < qWords.length; k++) {
      const w = words[i + k]!;
      const qw = qWords[k]!;
      // Every typed word but the last must be a whole word; the last may be a prefix ("live ba" → Live Band).
      if (k < qWords.length - 1 ? w !== qw : !w.startsWith(qw)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Tiers 7 / 6 / 5 / 3 / 1 against one piece of text, already lowercased — the label and every alias are scored by the
 * exact same logic (one matcher, tested once).
 */
function textTierScore(textLc: string, trimmedQuery: string, squashedQuery: string): number {
  const t = textLc.trim().replace(/\s+/g, ' ');
  if (t === trimmedQuery) return 7;
  if (t.startsWith(trimmedQuery)) return 6;
  if (wordStartsWith(t, trimmedQuery)) return 5;
  if (t.includes(trimmedQuery)) return 3;
  if (squashedQuery.length >= MIN_QUERY_LEN) {
    // From a word start only: "photobooth" ↔ "photo booth" — never "mc" inside "ice cream".
    const words = t.split(/[^a-z0-9]+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      if (words.slice(i).join('').startsWith(squashedQuery)) return 1;
    }
  }
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
// THE RULE: every word typed must sit within a small edit distance of some REAL word of the label or of a reviewed
// alias — an edit = a letter added, dropped, changed, or two neighbours swapped:
//   • up to 3 letters: no close match at all ("dj", "mc", "spa" have too many neighbours);
//   • 4–5 letters: 1 edit, AND the same first letter, AND a word of at least 4 letters;
//   • 6–7 letters: 1 edit ("catring" → Catering, never "String" two edits off);
//   • 8+ letters: 2 edits ("fotographer" → Photographer, "fotobooth" → Photo Booth).
// Filler words ("and", "of", "the", "&"…) are never matched. Or the whole query, spaces squashed, within that distance
// of the whole label/alias squashed ("fotobooth" → Photo Booth).
//
// 🎂 WHY THE FIRST-LETTER AND FILLER RULES (controller, A5, 7 Nov: *"band" must never lead to Cake*). Under the old
// 1-edit budget "band" was one dropped letter from "and" — so any "Cakes and Pastries" became a close match for "band",
// a 1-letter overlap dressed as a typo. A real typo of a short word keeps its first letter ("bnad", "cak"); a 4-letter
// word does not become a 3-letter filler word.

/** Words shorter than this carry no close match on their own ("dj", "mc", "of"): too many neighbours. */
const CLOSE_MIN_WORD = 4;

/** The edits a typed word of this length may carry and still be a close match (0 = never fuzzy). */
export function closeMatchBudget(wordLength: number): number {
  if (wordLength < CLOSE_MIN_WORD) return 0;
  return wordLength <= 7 ? 1 : 2;
}

/** Joining words a label carries that never stand for the trade itself. */
const FILLER_WORDS = new Set(['and', 'or', 'of', 'the', 'with', 'for', 'a', 'an', 'to', 'in', 'on', 'at', 'by', 'ng', 'sa', 'mga']);

/** May typed word `q` be a close match for text word `t` at all (before counting edits)? */
function closeCandidate(q: string, t: string): boolean {
  if (FILLER_WORDS.has(t)) return false;
  if (q.length < CLOSE_MIN_WORD) return t === q; // a short typed word must be there exactly
  if (q.length <= 5) return t.length >= CLOSE_MIN_WORD && t[0] === q[0];
  return true;
}

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
  // Whole-phrase, spaces squashed: "fotobooth" ↔ "photobooth" (filler words dropped from both ends of the compare).
  const squashedText = textWords.filter((w) => !FILLER_WORDS.has(w)).join('');
  const phraseBudget = closeMatchBudget(squashedQuery.length);
  if (phraseBudget > 0 && closeCandidate(squashedQuery, squashedText)) {
    const d = editDistanceWithin(squashedQuery, squashedText, phraseBudget);
    if (d <= phraseBudget) return d;
  }
  // Word by word: every typed word must be near some word of the text.
  // Filler words typed are ignored; at least one real word must carry the typo (a short word alone never fuzzes).
  const counted = queryWords.filter((w) => !FILLER_WORDS.has(w));
  if (!counted.some((w) => w.length >= CLOSE_MIN_WORD)) return null;
  let total = 0;
  for (const q of counted) {
    const budget = closeMatchBudget(q.length);
    let best = budget + 1;
    for (const t of textWords) {
      if (!closeCandidate(q, t)) continue;
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

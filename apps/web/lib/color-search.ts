/**
 * Search by colour NAME — the other direction from `color-names.ts`'s
 * `namedColor`/`hexForColorName` (which only ever do an exact fold match).
 *
 * Owner, 2026-09-03: "they can also search for the color name. so it will be
 * easier for them to find it if they know the color." Today the naming
 * library answers "what is this hex called?"; this answers "where is the
 * colour I can already name?" — a couple types a word, gets a swatch.
 *
 * ── THREE LAYERS, SAME PRIORITY AS `resolveColorName` ───────────────────────
 *   1. the curated `WEDDING_NAMES` table (the wedding vocabulary, Filipino
 *      names included) — checked first, so "moss" finds Moss before any CSS
 *      neighbour.
 *   2. `CSS_NAMES`, the 140-name fallback.
 *   3. `COLOUR_ALIASES` — words couples actually type that name neither
 *      table exactly ("moss green", "dusty pink", "champagne") mapped to the
 *      curated entry they mean. Required, not optional: without it the field
 *      looks broken on exactly the words a couple is most likely to try.
 *
 * Matching is prefix-then-substring, diacritic-insensitive (via
 * `foldColorName`, so "pina" finds "Piña Cream"). A query that matches
 * nothing returns `suggestions` instead of an empty result — the closest
 * names by edit distance — so the field can say what it did rather than show
 * an empty box indistinguishable from a broken one.
 *
 * 🛑 COVERAGE IS A DIFFERENT MEASUREMENT FROM NAMING ACCURACY. Naming asks
 * "given a hex, is the name right?"; search asks "given a word people
 * actually use, does it resolve?". `color-search-coverage.test.ts` measures
 * the second against a list of real wedding-vocabulary search terms — read
 * it before assuming this file "just works" because `color-names.test.ts`
 * is green.
 */

import { WEDDING_NAMES, CSS_NAMES, foldColorName, type NamedColor } from './color-names';

export type ColorSearchMatch = NamedColor & { source: 'wedding' | 'css' | 'alias' };

export type ColorSearchResult = {
  query: string;
  /** Ranked matches — curated before CSS, exact-fold before prefix before
   *  substring, deduped by hex. Empty when nothing matched. */
  matches: ColorSearchMatch[];
  /** Populated ONLY when `matches` is empty — the closest names by spelling,
   *  so a miss can say "no colour named that; here are the closest" instead
   *  of showing an empty box. */
  suggestions: ColorSearchMatch[];
};

/**
 * Colloquial words a couple types that name neither table's entry EXACTLY.
 * Each maps to the curated (or CSS) entry that word means on this platform.
 *
 * ⚠ A JUDGEMENT TABLE, NOT A CITATION — same caveat `color-names.ts` carries
 * for `WEDDING_NAMES` (CLAUDE.md rule 9: flagging a guess doesn't make it
 * safe). These don't price anything, which is the only reason they ship
 * ahead of a supplier's own swatch card.
 */
const COLOR_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ['moss green', 'Moss'],
  ['dusty pink', 'Dusty Rose'],
  ['champagne', 'Champagne Gold'],
  ['blush pink', 'Blush'],
  ['powder blue', 'Dusty Blue'],
  ['baby blue', 'Sky Blue'],
  ['baby pink', 'Blush'],
  ['forest', 'Forest Green'],
  ['army green', 'Olive'],
  ['military green', 'Olive'],
  ['wine red', 'Burgundy'],
  ['mustard yellow', 'Mustard'],
  ['off white', 'Ivory'],
  ['eggshell', 'Ivory'],
  ['jade green', 'Emerald'],
  ['bottle green', 'Forest Green'],
  ['baby yellow', 'Light Yellow'],
  ['pastel green', 'Sage'],
  ['pastel pink', 'Blush'],
  ['pastel blue', 'Dusty Blue'],
  ['pastel yellow', 'Light Yellow'],
  ['pastel purple', 'Lavender'],
  ['nude pink', 'Nude'],
  ['rose gold', 'Champagne Gold'],
  ['deep red', 'Burgundy'],
  ['deep green', 'Forest Green'],
  ['deep blue', 'Navy'],
  ['deep purple', 'Plum'],
  ['pearl grey', 'Silver'],
  ['pearl gray', 'Silver'],
];

type Entry = { name: string; hex: string; folded: string; source: 'wedding' | 'css' | 'alias' };

let INDEX: Entry[] | null = null;
function index(): Entry[] {
  if (INDEX) return INDEX;
  const out: Entry[] = [];
  for (const n of WEDDING_NAMES) out.push({ ...n, folded: foldColorName(n.name), source: 'wedding' });
  for (const n of CSS_NAMES) out.push({ ...n, folded: foldColorName(n.name), source: 'css' });
  const byName = new Map<string, Entry>();
  for (const e of out) if (!byName.has(e.folded)) byName.set(e.folded, e);
  for (const [alias, target] of COLOR_ALIASES) {
    const targetEntry = byName.get(foldColorName(target));
    if (!targetEntry) continue; // an alias whose target isn't stocked names nothing
    const folded = foldColorName(alias);
    if (byName.has(folded)) continue; // never shadow a real exact name with an alias
    out.push({ name: targetEntry.name, hex: targetEntry.hex, folded, source: 'alias' });
  }
  INDEX = out;
  return out;
}

/** Classic edit distance — the small vocabulary here (a few hundred
 *  entries) makes an O(n*m) DP table cheap per candidate. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prevDiag = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j]!;
      row[j] = Math.min(
        row[j]! + 1,
        row[j - 1]! + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiag = temp;
    }
  }
  return row[n]!;
}

const SOURCE_RANK: Record<Entry['source'], number> = { wedding: 0, alias: 1, css: 2 };

export function searchColorNames(rawQuery: string, limit = 8): ColorSearchResult {
  const query = rawQuery.trim();
  const folded = foldColorName(query);
  if (!folded) return { query, matches: [], suggestions: [] };

  const all = index();
  const exact: Entry[] = [];
  const prefix: Entry[] = [];
  const substring: Entry[] = [];
  for (const e of all) {
    if (e.folded === folded) exact.push(e);
    else if (e.folded.startsWith(folded)) prefix.push(e);
    else if (e.folded.includes(folded)) substring.push(e);
  }
  const bySourceThenName = (a: Entry, b: Entry): number =>
    SOURCE_RANK[a.source] - SOURCE_RANK[b.source] || a.name.localeCompare(b.name);
  const ranked = [...exact.sort(bySourceThenName), ...prefix.sort(bySourceThenName), ...substring.sort(bySourceThenName)];

  const seen = new Set<string>();
  const matches: ColorSearchMatch[] = [];
  for (const e of ranked) {
    const key = e.hex.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ name: e.name, hex: e.hex, source: e.source });
    if (matches.length >= limit) break;
  }

  if (matches.length > 0) return { query, matches, suggestions: [] };

  // Nothing matched by substring/alias — the closest names by spelling, so
  // the field can say what it did instead of showing an empty box.
  const MAX_SUGGEST_DISTANCE = 4;
  const scored = all
    .map((e) => ({ e, d: levenshtein(folded, e.folded) }))
    .filter(({ d }) => d <= MAX_SUGGEST_DISTANCE)
    .sort((a, b) => a.d - b.d || SOURCE_RANK[a.e.source] - SOURCE_RANK[b.e.source] || a.e.name.localeCompare(b.e.name));
  const suggestSeen = new Set<string>();
  const suggestions: ColorSearchMatch[] = [];
  for (const { e } of scored) {
    const key = e.hex.toUpperCase();
    if (suggestSeen.has(key)) continue;
    suggestSeen.add(key);
    suggestions.push({ name: e.name, hex: e.hex, source: e.source });
    if (suggestions.length >= limit) break;
  }
  return { query, matches: [], suggestions };
}

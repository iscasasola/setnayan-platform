/**
 * rank-by-sentence.ts — let the search box answer a whole sentence, without
 * changing a single answer it already gives.
 *
 * ── THE BUG ─────────────────────────────────────────────────────────────────
 * The admin palette scored a query by treating the ENTIRE typed string as one
 * needle. Measured against the shipped destination list:
 *
 *   "pricing"                                    → Pricing        ✅
 *   "papic prices"                               → NOTHING
 *   "show me the prices of papic"                → NOTHING
 *   "take me to the pricing for papic services"  → NOTHING
 *   "i want to add a new category on the taxonomy" → NOTHING
 *
 * Two words were already enough to break it. The owner asked for a box he can
 * talk to; it answered one word that happened to start a page's name.
 *
 * ── THE RULE, AND WHY IT IS THIS ONE ────────────────────────────────────────
 * Sort by TODAY'S whole-string score FIRST, and use the word evidence only to
 * break ties and to rescue queries that score zero. That ordering is the whole
 * design: it makes the change **additive by construction** — a query that
 * already returns something keeps the same rows in the same order, because the
 * first sort key is unchanged. Sorting by the word average first, or by
 * max(whole, word), re-ranks queries that already work, and re-ranking a box the
 * owner has learned is a regression even when every individual answer is better.
 *
 * ⚠ AN UNKNOWN WORD IS REPORTED, NEVER SILENTLY DROPPED. "prices" (plural)
 * appears in NO admin destination — measured, zero — so "papic prices" resolves
 * on "papic" alone and lands on *Papic storage*, which is not the prices. One
 * confident answer with nothing to correct it is worse than no answer, so the
 * unmatched words come back with the hits and the palette says so on screen.
 * 🔑 That is also the honest name for the real limitation: the Papic PRICES are
 * rows inside a page, and this map indexes pages. Saying "no page has that word"
 * is true; quietly opening the nearest page is not.
 *
 * The per-item scorer is passed IN rather than imported, so the palette's own
 * `score()` — its 100 / 60− / 15 / 8 bands and its `map ? raw / 2` halving —
 * stays byte-identical. The no-regression proof depends on that.
 */

import { searchTokens } from '@/lib/search-stop-words';

/** How a single item scores against a single needle. The caller owns this. */
export type ScoreOne<T> = (item: T, needle: string) => number;

export type SentenceRanking<T> = {
  /** Best first. Ordered by whole-string score, then coverage, then word mean. */
  hits: T[];
  /** Query words that matched NOTHING anywhere. Shown to the person. */
  unknown: string[];
};

/**
 * A word must earn at least this much to count as matched.
 *
 * 15 is the palette's "the word appears in this page's haystack" band. The band
 * BELOW it — 8, letters of the name in order — is deliberately excluded, and
 * that one number was worth measuring: at 8, the word "prices" matched *Profile
 * corrections* (p·r·i·c·e·s appear in that order inside it) and *Price bands*,
 * so a search for "papic prices" answered with two pages that have nothing to do
 * with either word AND suppressed the honest report that no page knows the word
 * "prices" at all.
 *
 * 🔑 SUBSEQUENCE MATCHING IS TYPO TOLERANCE FOR A WHOLE QUERY, AND COINCIDENCE
 * FOR ONE WORD OF A SENTENCE. It still applies to the whole-string score, which
 * is untouched — this floor governs only the per-word evidence.
 */
const WORD_FLOOR = 15;

export function rankBySentence<T>(
  items: readonly T[],
  query: string,
  scoreOne: ScoreOne<T>,
  limit = 30,
): SentenceRanking<T> {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return { hits: items.slice(0, limit), unknown: [] };
  }

  const tokens = searchTokens(needle);
  //
  // 🪤 THERE IS NO "IS THIS A SENTENCE?" SHORTCUT, and an earlier draft had one:
  // it skipped the word evidence when `tokens.length === 1`. That is not the
  // same question. "s pending" tokenises to ONE word — the stray letter is
  // dropped — so the shortcut fired, fell back to scoring the raw string
  // "s pending" against page names, and answered NOTHING. Same for "papic!".
  // The word path is always taken; for a genuine one-word query the token IS
  // the needle, so it collapses to today's answer on its own. Proved over every
  // word the admin knows, not argued.
  const perToken = tokens.map((t) => items.map((it) => scoreOne(it, t)));
  const unknown = tokens.filter((_, i) => perToken[i]!.every((s) => s < WORD_FLOOR));
  const known = tokens.map((_, i) => i).filter((i) => !unknown.includes(tokens[i]!));

  const rows = items.map((d, idx) => {
    const whole = scoreOne(d, needle);
    if (known.length === 0) return { d, whole, coverage: 0, mean: 0 };
    const scores = known.map((i) => perToken[i]![idx]!);
    const matched = scores.filter((s) => s >= WORD_FLOOR);
    return {
      d,
      whole,
      // Coverage is over the words the product actually knows. Counting the
      // unknown ones would drag every candidate down by the same amount and
      // decide nothing, while making a two-word query look like a bad match.
      coverage: matched.length / known.length,
      mean: matched.length ? matched.reduce((a, b) => a + b, 0) / matched.length : 0,
    };
  });

  const hits = rows
    .filter((r) => r.whole > 0 || r.mean >= WORD_FLOOR)
    .sort(
      (a, b) =>
        b.whole - a.whole ||
        b.coverage - a.coverage ||
        b.mean - a.mean ||
        String((a.d as { label?: string }).label ?? '').localeCompare(
          String((b.d as { label?: string }).label ?? ''),
        ),
    )
    .slice(0, limit)
    .map((r) => r.d);

  return { hits, unknown };
}

/**
 * The same sentence rule, for a surface that can only HIDE and SHOW.
 *
 * The phone's "All surfaces" filter toggles `hidden` on server-rendered DOM (its
 * own docblock explains why it cannot re-render), so it has no ranking to do —
 * parity with the laptop means the same SET of cards, not the same order.
 *
 * 🔑 EXPORTED SO THE PARITY GUARD CAN RUN BOTH RULES ON ONE INPUT. The existing
 * parity test compares SOURCE TEXT — it asks whether both files import the
 * shared alias list — which would have waved through a laptop-only sentence fix
 * without executing a single query. A rule living inside a React effect cannot
 * be tested; this one can.
 *
 * Unknown words are dropped rather than allowed to blank the screen: searching
 * "papic prices" where no card knows the word "prices" must still show Papic.
 * If NO word is known, it falls back to today's whole-string test, which is the
 * honest empty answer.
 */
export function keepByTokens(hays: readonly string[], query: string): boolean[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return hays.map(() => true);
  const tokens = searchTokens(needle).filter((t) => hays.some((h) => h.includes(t)));
  return hays.map((h) => (tokens.length > 0 ? tokens.every((t) => h.includes(t)) : h.includes(needle)));
}

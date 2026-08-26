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

/** Everything an item can be matched on, lowercased. Label first, then its bag. */
function hayOf(item: unknown): string {
  const o = item as { label?: unknown; hay?: unknown };
  return `${String(o.label ?? '')} ${String(o.hay ?? '')}`.toLowerCase();
}

/** How many times a word appears — the tie-break that stops the alphabet deciding. */
function occurrences(hay: string, token: string): number {
  if (!token) return 0;
  let n = 0;
  let i = hay.indexOf(token);
  while (i !== -1) {
    n += 1;
    i = hay.indexOf(token, i + token.length);
  }
  return n;
}

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
  /**
   * 🪤 AN APOSTROPHE MADE THE BOX SAY SOMETHING FALSE. The splitter keeps
   * apostrophes, so "vendor's payouts" tokenises to ["vendor's","payouts"] —
   * and no page's words contain "vendor's", so the palette announced
   * *"No page has the word 'vendor's'"* directly above the right answer, about
   * a word 26 destinations contain. Phones type the curly one (U+2019), which
   * is how it reaches a person who cannot see what is wrong.
   *
   * Only the REPORT is corrected, not the matching, and deliberately: the
   * splitter is shared with the public site search, where stripping punctuation
   * would change which guides a stranger finds. A word whose plain form the
   * product does know is simply not called unknown.
   */
  const stripped = (t: string) => t.replace(/['\u2019]/g, '');
  const knownPlain = new Set<string>();
  for (const it of items) {
    for (const w of `${(it as { label?: string }).label ?? ''} ${(it as { hay?: string }).hay ?? ''}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)) {
      if (w) knownPlain.add(w);
    }
  }
  const unknown = tokens.filter(
    (t, i) => perToken[i]!.every((s) => s < WORD_FLOOR) && !knownPlain.has(stripped(t)),
  );
  const known = tokens.map((_, i) => i).filter((i) => !unknown.includes(tokens[i]!));

  const rows = items.map((d, idx) => {
    const whole = scoreOne(d, needle);
    if (known.length === 0) return { d, whole, coverage: 0, mean: 0, weight: 0 };
    const scores = known.map((i) => perToken[i]![idx]!);
    const matched = scores.filter((s) => s >= WORD_FLOOR);
    return {
      d,
      whole,
      // Coverage is over the words the product actually knows. Counting the
      // unknown ones would drag every candidate down by the same amount and
      // decide nothing, while making a two-word query look like a bad match.
      coverage: matched.length / known.length,
      // 🪤 HOW OFTEN, NOT MERELY WHETHER — and the box's own advertised example
      // is why. "add a category" tied App Performance, Taxonomy and Vendors at
      // coverage 1.0 and mean 15, so the ALPHABET decided and a metrics
      // dashboard won: App Performance carries the words once, from the "add
      // expense … category" job. Taxonomy's own words say "category" many times
      // over, because half its jobs are about categories. Counting settles it
      // honestly. It is a TIE-BREAK ONLY, after whole/coverage/mean, so nothing
      // that already ranks can move.
      //
      // ⚠ MULTI-WORD ONLY, AND THE GUARD TAUGHT ME THAT. Applied to every query
      // it re-ordered single-word results — ties on the whole-string score used
      // to fall to the alphabet and would now fall to frequency — which breaks
      // the one guarantee this file is built on: a query that already answers
      // must answer identically. The bug being fixed is a MULTI-WORD tie, so the
      // remedy stays there. `EVERY single word the admin knows returns exactly
      // what it returned before` caught it in one run.
      weight:
        known.length > 1
          ? known.reduce((n, i) => n + occurrences(hayOf(d), tokens[i]!), 0)
          : 0,
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
        b.weight - a.weight ||
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
 *
 * 🪤 ANY, NOT EVERY — AND THE FIRST CUT GOT THIS BACKWARDS, WHICH PUT THE 2026
 * BUG STRAIGHT BACK. It required `tokens.every(…)`, an AND, while the laptop
 * keeps a row on `whole > 0 || mean >= WORD_FLOOR`, an OR. Measured over the
 * real 78-card /admin/more set: *"take me to the pricing for papic services"*
 * showed **0 cards** against the laptop's 10, and *"i want to add a new
 * category on the taxonomy service"* **0 against 16** — both of them the exact
 * sentences this feature exists to answer, blanked on the device the owner
 * reports from. ⚠ And `/admin/more` is `desktopVisible`, so the same blank was
 * reachable on a laptop too.
 *
 * 🔑 THE TWO SURFACES MUST SHARE THE RULE, NOT MERELY THE TOKENISER. That is
 * what "parity" means here, and it is why the guard now feeds one query to both
 * and compares the SETS rather than checking the laptop's top hit is present.
 */
export function keepByTokens(hays: readonly string[], query: string): boolean[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return hays.map(() => true);
  const tokens = searchTokens(needle).filter((t) => hays.some((h) => h.includes(t)));
  return hays.map((h) => (tokens.length > 0 ? tokens.some((t) => h.includes(t)) : h.includes(needle)));
}

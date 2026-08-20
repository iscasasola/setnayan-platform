/**
 * The chronicle — what a chapter IS, when it happened, and what number it
 * carries.
 *
 * ── THE MODEL (owner 2026-08-20) ────────────────────────────────────────────
 * "when they pick an event, this will basically be their editorial for that
 *  event. We will create a chronicle of their life. So a chapter is what? a
 *  year, or a milestone? … They do not decide what chapter they are on. we
 *  automate it, they just complete what should be posted."
 *
 * AMENDED THE SAME DAY, by the owner: *"we want the chapters to make sense.
 * just like in a book. or in an adventure novel of a person. chapters are
 * defined not just per celebration. for tv shows. season is annual and episode
 * is everything that happened for that season."*
 *
 *   • THE YEAR IS THE SEASON — and it is written as its own name, `2026`.
 *     A TV season needs the word "Season" because a show's year has no name of
 *     its own; a person's year does. It also costs nothing to explain, reads
 *     the same in English, Tagalog and Bisaya, and can never be renumbered.
 *   • A CHAPTER IS THE EPISODE — one thing that happened. **Not one per
 *     celebration.** A trip, a move, an ordinary day worth keeping are all
 *     chapters; the celebrations are simply the ones we already know about.
 *   • THE NUMBER IS DERIVED, NEVER TYPED, AND IT RESTARTS EACH YEAR.
 *     `2026 · Chapter 3` is the third thing that happened to them in 2026.
 *
 * 🛑 WHY NOT "SEASON", WHICH IS THE OWNER'S OWN WORD. Measured, not assumed:
 * "season" already means THREE other things a customer meets — the weather on
 * the couple's own date picker (`Cool dry season`, `Peak season · book vendors
 * early`), an `Off-season savings` filter/badge/vendor mechanic in the
 * marketplace, and `Liga season` in the tournament run-of-show. It is also a
 * NOT NULL CHECK-constrained column meaning weather. The same customer meets
 * two meanings in the same week. And "Season 1, Episode 3" has no Filipino: one
 * word, *kabanata*, covers both chapter and episode, and there is no native
 * word for a TV season — while *kabanata* is what every Filipino counted
 * through Noli Me Tangere at school, and *"bagong kabanata"* is already how a
 * new phase of a life is described.
 *
 * 🛑 AND WHY NOT "VOLUME", WHICH IS THE OTHER OBVIOUS WORD AND IS ALSO TAKEN.
 * `Vol. I · No. 7` ships today on the couple's editorial masthead and on every
 * Real Stories card, and there it means SETNAYAN'S publication: the Volume is
 * our awards cycle (Nov 18 → Nov 17) and the No. is that wedding's position
 * among all Setnayan weddings in the cycle (see editorial-content.tsx
 * `editionVolume` + data.ts `editionNo`). Spending the same word on a person's
 * own life would make one masthead word mean two different scopes on two pages
 * a couple reads minutes apart. Measured before it was rejected, not assumed.
 *
 * 🔑 NUMBERED BY WHEN IT HAPPENED, NOT BY WHEN IT WAS WRITTEN. The shipped
 * numbering ranked by `published_at`, which is the order somebody sat down to
 * type — so writing up a 2019 engagement today made it the LAST chapter of
 * their life. A chronicle is ordered by the life, so the day the celebration
 * happened is the key and the publish date is only the fallback for a chapter
 * that is about no celebration at all.
 *
 * Pure + side-effect-free: every function here takes day strings and returns
 * positions, so the composer, the public timeline and the tests agree by
 * construction.
 *
 * 🪤 DAY STRINGS ARE NEVER PARSED INTO A `Date`. `new Date('2026-12-12')` is
 * midnight UTC, i.e. the 11th west of Greenwich — the 2026-08-04 sweep found
 * that exact bug on 41 screens. Comparison here is lexicographic on
 * `YYYY-MM-DD`, which needs no timezone to be right.
 */

/** A `YYYY-MM-DD` day, or null when we do not have one. */
export type ChronicleDay = string | null;

/**
 * The day a chapter is ABOUT.
 *
 * The celebration's own date when one is attached — that is the milestone the
 * chapter records. Otherwise the day it was published, which is the closest
 * honest answer for a chapter about no celebration (a trip, a move, a year).
 * Never `now`: an unpublished standalone chapter has no place in the sequence
 * yet, and guessing one would renumber somebody's life on every draft.
 */
export function chronicleDay(input: {
  /** The day the author told us this happened. Beats everything else. */
  happenedOn?: string | null;
  eventDate?: string | null;
  publishedAt?: string | null;
}): ChronicleDay {
  // 🔑 THE AUTHOR'S OWN ANSWER FIRST. Without it, a chapter about no
  // celebration files under the year it was TYPED — so writing up a 2019
  // engagement today put it in 2026, in a chronicle whose whole job is life
  // order.
  const stated = normalizeDay(input.happenedOn);
  if (stated) return stated;
  const day = normalizeDay(input.eventDate);
  if (day) return day;
  // ⚠ LAST RESORT, AND IT MOVES. `published_at` is re-stamped on republish, so
  // a chapter taken back to draft and posted again jumps to the end of the
  // story — and, once years are headings, into a different year. That is the
  // reason `happened_on` exists, not a reason to drop the fallback: an
  // already-published chapter written before the field existed still needs a
  // place, and its publish day is the only honest one we have.
  return normalizeDay(input.publishedAt);
}

/**
 * Reduce any stored date-ish value to a `YYYY-MM-DD` day, or null.
 *
 * Accepts a DATE column (`2026-12-12`) and a timestamptz (`2026-08-12
 * 15:50:28.405235+00`) alike — both start with the day, which is the only part
 * a chronicle is about. Anything that is not that shape returns null rather
 * than a guess.
 */
function normalizeDay(value: string | null | undefined): ChronicleDay {
  if (typeof value !== 'string') return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export type ChronicleRank = {
  /**
   * 1-based number keyed by the row's index in the input array — **restarting
   * at 1 in each calendar year**, oldest first, exactly as episodes restart in
   * each season. A row with no day is ABSENT: a number is a claim about
   * sequence, and without a day there is no sequence to claim.
   *
   * 🔑 WHY PER YEAR AND NOT ACROSS A WHOLE LIFE. Both are honest orderings; the
   * difference is what happens when somebody writes up an old memory. Numbered
   * across a life, a 2019 chapter added today shifts EVERY chapter after it by
   * one — including ones already read and linked. Numbered inside its year,
   * only 2019 moves, which is correct: something genuinely happened before the
   * rest of that year.
   */
  numberByIndex: Map<number, number>;
  /** `2026` keyed by input index. Absent for an undated row, like the number. */
  yearByIndex: Map<number, string>;
  /** Input indexes, newest day first, undated rows at the TAIL in input order. */
  newestFirst: number[];
};

/**
 * Rank a chapter list into the chronicle: numbers, years, and reading order.
 *
 * Ties (two things on one day — a couple's own write-up and their
 * photographer's, say) keep input order: `Array#sort` is stable, so the
 * caller's own ordering decides and nothing is invented. Callers that can have
 * ties should hand rows in the order they want them tie-broken.
 */
export function rankChronicle(days: ReadonlyArray<ChronicleDay>): ChronicleRank {
  const dated = days
    .map((day, i) => ({ i, day }))
    .filter((x): x is { i: number; day: string } => typeof x.day === 'string');

  const oldestFirst = [...dated].sort((a, b) =>
    a.day < b.day ? -1 : a.day > b.day ? 1 : 0,
  );

  const numberByIndex = new Map<number, number>();
  const yearByIndex = new Map<number, string>();
  const seenInYear = new Map<string, number>();
  for (const x of oldestFirst) {
    const year = x.day.slice(0, 4);
    const n = (seenInYear.get(year) ?? 0) + 1;
    seenInYear.set(year, n);
    numberByIndex.set(x.i, n);
    yearByIndex.set(x.i, year);
  }

  const newestFirst = [...oldestFirst].reverse().map((x) => x.i);
  // Undated rows sit at the tail in the order the caller gave them — they have
  // not been placed in the life yet, and a draft must not jump the queue.
  days.forEach((day, i) => {
    if (day === null) newestFirst.push(i);
  });

  return { numberByIndex, yearByIndex, newestFirst };
}

/**
 * The chronicle grouped for rendering: one block per year, newest year first,
 * and one trailing block for the chapters with no day yet.
 *
 * The undated block carries `year: null` — the caller decides what to call it,
 * because "no date" reads differently on a private composer ("Not placed yet")
 * than on a public page (where it never appears at all).
 */
export function groupChronicleByYear<T>(
  items: readonly T[],
  dayOf: (item: T, index: number) => ChronicleDay,
): Array<{ year: string | null; entries: Array<{ item: T; index: number; number: number | null }> }> {
  const days = items.map((item, i) => dayOf(item, i));
  const { numberByIndex, yearByIndex, newestFirst } = rankChronicle(days);

  const blocks: Array<{
    year: string | null;
    entries: Array<{ item: T; index: number; number: number | null }>;
  }> = [];
  for (const i of newestFirst) {
    const year = yearByIndex.get(i) ?? null;
    const last = blocks[blocks.length - 1];
    const entry = {
      item: items[i] as T,
      index: i,
      number: numberByIndex.get(i) ?? null,
    };
    if (last && last.year === year) last.entries.push(entry);
    else blocks.push({ year, entries: [entry] });
  }
  return blocks;
}

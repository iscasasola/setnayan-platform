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
 *   • A CHAPTER IS A MILESTONE — one celebration, told once. Not a year.
 *     The product already reads it that way: Life-Flash calls a celebration
 *     with no photos yet a "chapter still to fill", and the composer attaches
 *     exactly one celebration to one chapter.
 *   • THE YEAR IS A HEADING, NOT A VOLUME. It groups the chapters that happened
 *     in it and is written on nothing.
 *   • THE NUMBER IS DERIVED, NEVER TYPED. Oldest milestone = Chapter 1.
 *
 * 🛑 WHY NOT "VOLUME", WHICH IS THE OBVIOUS WORD AND IS ALREADY TAKEN.
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
  eventDate?: string | null;
  publishedAt?: string | null;
}): ChronicleDay {
  const day = normalizeDay(input.eventDate);
  if (day) return day;
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
   * 1-based number keyed by the row's index in the input array, oldest = 1.
   * A row with no day is ABSENT — a number is a claim about sequence, and
   * without a day there is no sequence to claim.
   */
  numberByIndex: Map<number, number>;
  /** `2026` keyed by input index. Absent for a dated-less row, like the number. */
  yearByIndex: Map<number, string>;
  /** Input indexes, newest day first, undated rows at the TAIL in input order. */
  newestFirst: number[];
};

/**
 * Rank a chapter list into the chronicle: numbers, years, and reading order.
 *
 * Ties (two celebrations on one day) keep input order — `Array#sort` is stable,
 * so the caller's own ordering decides, and nothing is invented.
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
  oldestFirst.forEach((x, k) => {
    numberByIndex.set(x.i, k + 1);
    yearByIndex.set(x.i, x.day.slice(0, 4));
  });

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

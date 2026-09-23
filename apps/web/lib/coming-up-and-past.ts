/**
 * coming-up-and-past.ts — splitting a public profile's celebrations in two.
 *
 * Owner, looking at his own profile: ***"why do we see the 2 upcoming events as
 * well?"***, then ruling: ***"split coming up from past"***.
 *
 * 🔑 HIS COMPLAINT IS UPSTREAM OF THE LAYOUT. He was not asking for two
 * headings — he was noticing that **an invitation and a memory were drawn
 * identically**. Two identical grids under two headings would satisfy the words
 * and miss the point. Coming up is something a visitor can act on; Past is
 * something they look back at.
 *
 * ── WHAT THIS MODULE DOES NOT DO ────────────────────────────────────────────
 * ⛔ IT DOES NOT COMPARE DATES. `isFinishedEvent` in lib/event-board.ts is
 * already the product's answer to "is this over", and it reasons about three
 * things this module would otherwise have to re-derive:
 *
 *   • `archived` — an archived celebration is finished whatever its date says
 *   • `event_end_date` — a celebration spanning several days is not finished on
 *     its first day; the SAME value the full-res retention floor reads, so
 *     "when did this end" has one answer in the product rather than two
 *   • a NULL date — `!!lastDay` is false, so a dateless celebration is NOT
 *     finished. That is the right home for it and it falls out of the existing
 *     rule rather than being a special case invented here: a celebration with
 *     no date has not happened.
 *
 * Re-deriving any of that is how two mechanisms come to disagree about one fact.
 *
 * ⛔ AND IT DOES NOT DECIDE WHAT "TODAY" IS. `manilaTodayISO()` does, because
 * these are Philippine celebrations and a wedding is upcoming until it is over
 * **in the place it happens** — not in UTC, and not on whatever clock the server
 * runs. `lib/event-board.ts` records a live bug from exactly this: the board's
 * shelf boundary and the countdown on the same card once reduced "now" with two
 * different clocks, and between Manila 00:00 and 08:00 they disagreed.
 */

import { isFinishedEvent } from './event-board';

/** The minimum a celebration must carry to be placed. */
export type SplittableEvent = {
  event_date: string | null;
  event_end_date?: string | null;
  archived: boolean | null;
};

export type ComingUpAndPast<T> = {
  /** Not over yet — including celebrations with no date at all. */
  comingUp: T[];
  /** Finished, newest first: a memory is read most-recent-first. */
  past: T[];
};

/**
 * Split celebrations into what is ahead and what is behind.
 *
 * `todayISO` is passed in rather than read here so the split is pure and a test
 * can drive it across a boundary — the caller hands it `manilaTodayISO()`.
 *
 * ORDER IS PART OF THE ANSWER, not decoration:
 *   • coming up — soonest FIRST, because the next thing is the useful thing;
 *     a celebration with no date sorts last, since it cannot be next.
 *   • past — most recent FIRST, because a memory is read backwards from now.
 */
export function splitComingUpAndPast<T extends SplittableEvent>(
  events: readonly T[],
  todayISO: string,
): ComingUpAndPast<T> {
  const comingUp: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    (isFinishedEvent(e, todayISO) ? past : comingUp).push(e);
  }

  const day = (e: SplittableEvent): string | null => e.event_date?.slice(0, 10) || null;

  comingUp.sort((a, b) => {
    const da = day(a);
    const db = day(b);
    if (da === db) return 0;
    if (!da) return 1; // dateless cannot be "next", so it sits at the end
    if (!db) return -1;
    return da < db ? -1 : 1;
  });
  past.sort((a, b) => {
    const da = day(a);
    const db = day(b);
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da > db ? -1 : 1; // newest first
  });

  return { comingUp, past };
}

/**
 * How many past celebrations a first screenful shows before the rest go behind
 * one control.
 *
 * Six: two full rows at the two-column breakpoint, so the cap lands on a row
 * edge rather than mid-row at either width. A number that cuts a row in half
 * looks like a rendering fault rather than a deliberate stop.
 */
export const PAST_FIRST_SCREENFUL = 6;

export type PastShelf<T> = {
  /** What renders immediately. */
  shown: T[];
  /** How many more exist. `0` means no control — nothing is hidden. */
  hidden: number;
  /** The control's label, or `null` when there is nothing to reveal. */
  moreLabel: string | null;
};

/**
 * Cap the past shelf at a first screenful.
 *
 * ⛔ WHAT THIS DELIBERATELY IS NOT. Not a paginator — no new state, no route,
 * no second query; the split already sorts Past newest-first, so a simple cap
 * always keeps the celebrations that matter most and the rest are one control
 * away. And **the posters do not shrink as the list grows**: making each
 * memory smaller to fit more of them turns a wall of celebrations back into the
 * list of rows this redesign exists to remove.
 *
 * It degrades at both ends without a special case: at 1 there is no control, at
 * 40 there is still exactly one.
 */
export function pastShelf<T>(
  past: readonly T[],
  limit: number = PAST_FIRST_SCREENFUL,
): PastShelf<T> {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : PAST_FIRST_SCREENFUL;
  if (past.length <= cap) {
    return { shown: [...past], hidden: 0, moreLabel: null };
  }
  return {
    shown: past.slice(0, cap),
    hidden: past.length - cap,
    // The total, not the remainder: "Show all 14" is a promise about the shelf,
    // where "Show 8 more" asks the reader to do arithmetic to learn the same thing.
    moreLabel: `Show all ${past.length}`,
  };
}

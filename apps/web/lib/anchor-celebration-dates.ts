/**
 * anchor-celebration-dates.ts — the ANCHOR → CELEBRATION derivation.
 *
 * `events.anchor_date` is what an event COMMEMORATES; `events.event_date` is
 * when it is actually HELD. Both columns ship (PR #3955) and the generic
 * onboarding wizard writes both — but the wizard's date step still asked "When
 * is it?" over a blank `<input type="date">`, which every browser opens on
 * TODAY. Today is the one month the event has nothing to do with.
 *
 * These pure helpers turn a stored anchor into the two or three days a Filipino
 * household actually chooses between:
 *   - ON THE DAY   — the anchor's next annual return (a 2015 union date means
 *                    the 2027 anniversary, never 2015).
 *   - THE SATURDAY AFTER — because a 7th birthday on a Tuesday is very often a
 *                    Saturday party. Null when the anchor already lands on a
 *                    Saturday: there is nothing to move, and offering "the
 *                    Saturday after" for a Saturday would push the party a full
 *                    week away from the day it marks.
 *   - ANOTHER DAY  — the calendar, seeded to the anchor day so it opens there.
 *
 * Pure + dependency-free, same posture as event-anchor.ts: every date arrives as
 * an argument, nothing is stored, and nothing here knows whose date it is.
 */
import { nextOccurrence, parseISO, toISO, addDays } from './event-anchor';

/** Saturday, in `Date.getUTCDay()` terms. */
const SATURDAY = 6;

/**
 * The first Saturday STRICTLY AFTER `iso`, or null when `iso` is itself a
 * Saturday (see the module note — a Saturday anchor needs no weekend hop).
 * Plain UTC day-arithmetic: no library, no local-timezone drift, and month /
 * year / leap-day rollovers are handled by `Date` itself (Feb 27 2027 + 7 =
 * Mar 6 2027; Feb 29 2028 + 4 = Mar 4 2028).
 */
export function saturdayAfterISO(iso: string | null | undefined): string | null {
  const day = parseISO(iso);
  if (!day) return null;
  if (day.getUTCDay() === SATURDAY) return null;
  // 0 → Sun (6 days to Sat) … 5 → Fri (1 day). Never 0 days: the Saturday case
  // returned above, so this is always a forward move onto a real Saturday.
  const delta = SATURDAY - day.getUTCDay();
  return toISO(addDays(day, delta));
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * 'YYYY-MM-DD' → 'Sat 12 Jun 2027'. Deliberately NOT toLocaleDateString: the
 * chips render on the server and again on the client, and a locale/timezone
 * difference between the two is a hydration mismatch. Null on unreadable input.
 */
export function formatCelebrationDay(iso: string | null | undefined): string | null {
  const day = parseISO(iso);
  if (!day) return null;
  return `${WEEKDAY_SHORT[day.getUTCDay()]} ${day.getUTCDate()} ${
    MONTH_SHORT[day.getUTCMonth()]
  } ${day.getUTCFullYear()}`;
}

/** 1 → '1st', 2 → '2nd', 11 → '11th' … the English ordinal, teens included. */
export function ordinal(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(Math.trunc(n));
  const teens = abs % 100;
  if (teens >= 11 && teens <= 13) return `${Math.trunc(n)}th`;
  const last = abs % 10;
  const suffix = last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  return `${Math.trunc(n)}${suffix}`;
}

export type CelebrationOptions = {
  /** The anchor's next annual return on or after `todayISO` (ISO YYYY-MM-DD). */
  onTheDayISO: string;
  /** The Saturday after that return — null when the return IS a Saturday. */
  saturdayAfterISO: string | null;
};

/**
 * The quick-pick days for an anchor. Returns null when the anchor is missing or
 * malformed, which is the signal to render the date step exactly as it is today
 * (no context line, no chips) — an anchor we cannot read must never produce a
 * suggested date.
 */
export function celebrationOptionsFor(
  anchorISO: string | null | undefined,
  todayISO: string,
): CelebrationOptions | null {
  if (!anchorISO) return null;
  const onTheDay = nextOccurrence(anchorISO, todayISO);
  if (!onTheDay) return null;
  return { onTheDayISO: onTheDay, saturdayAfterISO: saturdayAfterISO(onTheDay) };
}

/**
 * Which quick pick does `value` correspond to? The chips are a VIEW of the date
 * field, never a parallel state — so the field is the single source of truth and
 * this is how a chip re-lights itself after the calendar lands somewhere.
 * 'other' = a real date that is neither quick pick; null = the field is empty.
 */
export function activeCelebrationPick(
  options: CelebrationOptions | null,
  value: string | null | undefined,
): 'on_the_day' | 'saturday_after' | 'other' | null {
  if (!value) return null;
  if (!options) return 'other';
  if (value === options.onTheDayISO) return 'on_the_day';
  if (options.saturdayAfterISO && value === options.saturdayAfterISO) return 'saturday_after';
  return 'other';
}

/**
 * ── THE CHIPS OWN THEIR TWO DAYS; THE CALENDAR OWNS EVERYTHING ELSE ────────
 *
 * 🔴 THE DEFECT THIS EXISTS FOR (owner, 2026-08-28, looking at his own birthday
 * screen): *"picking on the day and the saturday after does not change anything
 * on the calendar. is that correct?"* It was not correct.
 *
 * `pickCelebrationDay` set `dateValue` — the single-date field — and nothing
 * else. But the screen commits `dateCandidates` whenever that list is non-empty,
 * and the calendar renders from the same list. So the moment a person touched
 * the calendar once, the chips wrote to a field nobody downstream was reading:
 * the chip lit up, the calendar did not move, and **the day that got saved was
 * the one still sitting in the calendar** — a lit control claiming a day the
 * event was not going to have.
 *
 * 🔑 THE COMMENT ON `activeCelebrationPick` SAYS THE CHIPS ARE "A VIEW OF THE
 * DATE FIELD, NEVER A PARALLEL STATE". That was true of the field and false of
 * the screen — the field itself had become the parallel state. A second source
 * of truth does not announce itself; it just disagrees.
 *
 * The rule this function encodes: tapping a chip puts ITS day in your list and
 * takes the other chip's day out, because the two chips are two answers to one
 * question. Dates you picked yourself on the calendar are never touched.
 *
 * Returns the new list, or **null when it will not fit** — the caller must then
 * disable the chip rather than drop a date the person chose. Silently discarding
 * one would be the same defect wearing the opposite coat.
 */
export function celebrationDatesAfterPick(
  options: CelebrationOptions | null,
  current: readonly string[],
  iso: string,
  max: number,
): string[] | null {
  const owned = new Set(
    [options?.onTheDayISO, options?.saturdayAfterISO].filter((d): d is string => Boolean(d)),
  );
  // Everything the person chose for themselves, in their own right.
  const kept = current.filter((d) => d && d !== iso && !owned.has(d));
  if (kept.length + 1 > max) return null;
  return [...kept, iso].sort();
}

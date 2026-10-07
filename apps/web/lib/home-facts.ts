/**
 * lib/home-facts.ts — THE NUMBERS HOME STATES, WORKED OUT ONCE (pure, no I/O).
 *
 * Root map part 2, "the same fact shown twice on one screen" (owner 2026-10-02;
 * `HOME ON DESKTOP SHOWS EACH THING ONCE`, 2026-10-01). Home's first screen says
 * days to go · coming · no reply · Paid / Still owing, and the dashboard BELOW it
 * had its own copy of the arithmetic for the same numbers — `daysUntil` run in
 * `page.tsx` and again in `event-dashboard.tsx`, `computeGuestStats` run over the
 * same guest list in both, so the two could disagree about one fact.
 *
 * Now `homeFacts` is the one place that works them out. The page calls it once;
 * the first screen DRAWS `days · coming · noReply · money`, and the dashboard is
 * handed `daysOut` and `guestStats` instead of re-deriving them. Nothing here
 * invents a reading: a read that did not happen prints "—" (`glanceCount` /
 * `glanceMoney`), never 0 — the rule of `lib/guests-read-is-honest.test.ts`.
 */
import { eventDateToEpoch } from '@/lib/day-of-mode';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import { daysToGo, type DaysToGo } from '@/lib/countdown-target';
import type { GuestStats } from '@/lib/guests';
import { glanceCount, glanceDays, glanceMoney } from '@/lib/home-first-screen';

/**
 * Whole days from today to the event.
 *
 * ⚠ IT USED TO ANCHOR ON THE RUNTIME'S OWN MIDNIGHT. `new Date(`${d}T00:00:00`)`
 * plus `today.setHours(0,0,0,0)` are both the SERVER's clock — UTC on Vercel —
 * so between 00:00 and 08:00 Manila the day after a wedding this still returned
 * 0 and the hero read "It's your event day". `eventDateToEpoch` exists in
 * lib/day-of-mode.ts precisely because a bare Date parse already broke a
 * countdown once; it is asked here rather than re-derived.
 *
 * (Moved here from `event-dashboard.tsx` so the page and the dashboard share ONE
 * countdown instead of each owning a copy.)
 */
export function daysUntil(
  eventDate: string | null,
  tz?: string,
  now: Date = new Date(),
): number | null {
  if (!eventDate) return null;
  const eventMs = eventDateToEpoch(eventDate, tz);
  if (!Number.isFinite(eventMs)) return null;
  // "Today" collapsed in the SAME zone, so both sides of the subtraction are
  // midnights in one clock rather than midnights in two.
  const todayIso = now.toLocaleDateString('en-CA', tz ? { timeZone: tz } : undefined);
  const todayMs = eventDateToEpoch(todayIso, tz);
  if (!Number.isFinite(todayMs)) return null;
  return Math.round((eventMs - todayMs) / 86_400_000);
}

/** What the money read said: figures, "not measured" (null), or "not shared with this viewer". */
export type HomeMoneyRead = { paid: number; owing: number } | null | 'hidden';

export type HomeFacts = {
  /** Whole CALENDAR days to a FIRM day (0 = the day, negative = past) — what Home's
   *  sentences branch on; null when the date is only a month / a year, or absent.
   *  ⚠ Never PRINT it as "N days to go": print `daysToGo` (the countdown's rule). */
  daysOut: number | null;
  /** 🔢 What Home SAYS — the countdown's own rule (`daysToGo`, lib/countdown-target.ts):
   *  whole days of real time left, "Tomorrow", "Today". Null with no firm day. */
  daysToGo: DaysToGo | null;
  /** The guest head-counts the first screen and the dashboard share. */
  guestStats: GuestStats;
  days: { value: string; label: string };
  coming: string;
  noReply: string;
  /** Somebody has not replied AND the read is real — the first screen highlights it. */
  noReplyWaiting: boolean;
  /** `null` = the viewer may not see the budget (no line at all); "—" figures = not measured. */
  money: { paid: string; owing: string } | null;
  /**
   * 🔢 THE SAME FACTS AS NUMBERS, for `Count` / `Fill` (owner 2026-10-07, BUTTON_RULE
   * rule 2: "all numbers on the app will animate going to that number"). `null` = not
   * a number to count — unread, or a word ("Today"). Money: `'unread'` = the read
   * failed (said so on the tile, never ₱0); `null` = not shared (no tile).
   */
  figures: HomeFigures;
};

export type HomeFigures = {
  days: number | null;
  coming: number | null;
  noReply: number | null;
  money: { paid: number; owing: number } | 'unread' | null;
};

/**
 * The first screen's days tile, from the ONE rule (`daysToGo`): "67 · days to
 * go", then "Tomorrow · is the day", "Today · is the day". Past and unanchored
 * days keep `glanceDays`' own answers.
 */
export function glanceDaysToGo(r: DaysToGo | null): { value: string; label: string } {
  if (r === null) return glanceDays(null);
  if (r.kind === 'today') return { value: 'Today', label: 'is the day' };
  if (r.kind === 'tomorrow') return { value: 'Tomorrow', label: 'is the day' };
  if (r.kind === 'past') return glanceDays(-r.daysAgo);
  return glanceDays(r.days);
}

export function homeFacts(input: {
  eventDate: string | null;
  /** `events.event_date_precision` — only 'day' counts down. */
  precision: string | null | undefined;
  timezone: string | null | undefined;
  guests: { stats: GuestStats; measured: boolean };
  money: HomeMoneyRead;
  now?: Date;
}): HomeFacts {
  const { guests, money } = input;
  const daysOut =
    input.precision === 'month' || input.precision === 'year'
      ? null
      : // 🔢 The event's zone, else Manila — the countdown's own fallback
        // (`countdownTargetMs`), never the server's clock (UTC on Vercel).
        daysUntil(input.eventDate, input.timezone || DEFAULT_EVENT_TZ, input.now);
  const toGo =
    daysOut === null ? null : daysToGo(input.eventDate, input.timezone || DEFAULT_EVENT_TZ, (input.now ?? new Date()).getTime());
  return {
    daysOut,
    daysToGo: toGo,
    guestStats: guests.stats,
    days: glanceDaysToGo(toGo),
    coming: glanceCount(guests.stats.attending, guests.measured),
    noReply: glanceCount(guests.stats.pending, guests.measured),
    noReplyWaiting: guests.measured && guests.stats.pending > 0,
    money:
      money === 'hidden'
        ? null
        : { paid: glanceMoney(money?.paid ?? null), owing: glanceMoney(money?.owing ?? null) },
    figures: {
      days: toGo?.kind === 'days' ? toGo.days : null,
      coming: guests.measured ? guests.stats.attending : null,
      noReply: guests.measured ? guests.stats.pending : null,
      money: money === 'hidden' ? null : money === null ? 'unread' : { paid: money.paid, owing: money.owing },
    },
  };
}

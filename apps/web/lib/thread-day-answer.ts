/**
 * thread-day-answer.ts — THE ANSWER LINE AT THE TOP OF A SUPPLIER'S CONVERSATION (simpler supplier dashboard, step 4;
 * prototype `supplier_easy_dashboard_2026-10-14_fable.html` `SCREENS.thread`: "Sat 12 Dec · Free").
 *
 * A couple writes "are you free on the 12th?" — the first thing the supplier needs is the answer, before they type.
 * The answer is NOT computed here: it is the supplier's own Dates screen (`buildCustomerCalendarMonth`, S-PR3, the ONE
 * shipped derivation of a day) read for the couple's date. This file only turns that day into the line's word.
 *
 *   Free           a schedule exists and nothing holds the day
 *   N more fit     something is booked that day and the schedule still has room ("How many a day" not reached)
 *   Full           every schedule is at its "How many a day"
 *   Not available  the shop closed the day (a Not-available block, or its own hard hold) — the lock refuses it
 *   Not set        the shop has no schedule at all — calendar truth (owner 2026-10-10, P5): NEVER "Free"
 *   Booked         this couple already booked you — the day question is answered
 *   No date yet    the couple has not picked a day
 *
 * ⚖ A READ THAT FAILED SAYS NOTHING (`null`) — never "Free" (the calendar-truth rule: silence beats a wrong yes).
 * Pure; the read is `thread-day-answer.server.ts`.
 */
import type { CustomerCalendarDay } from './vendor-customers';

export type ThreadDayAnswer =
  | { kind: 'no_date' }
  | { kind: 'booked' }
  | { kind: 'not_set' }
  | { kind: 'not_available' }
  | { kind: 'full' }
  | { kind: 'fits'; more: number }
  | { kind: 'free' };

/** The status words' tone — the house rule "status = icon + colour + 1–2 words". */
export type ThreadDayTone = 'ok' | 'warn' | 'danger' | 'neutral';

/**
 * One day of the supplier's month → the line's answer.
 *
 * `day` is that date's row from `buildCustomerCalendarMonth` over the shop's own schedules; `hasSchedule` is whether
 * the shop has any schedule at all. `null` day with a schedule = the read could not place the date → null (silence).
 */
export function threadDayAnswerOf(input: {
  day: Pick<CustomerCalendarDay, 'state' | 'consumed' | 'capacity'> | null;
  hasSchedule: boolean;
}): ThreadDayAnswer | null {
  const { day, hasSchedule } = input;
  if (!day) return null;
  // Closed is a fact even without a schedule (a Not-available block the shop typed) — the calendar-truth order.
  if (day.state === 'blocked' || day.state === 'locked') return { kind: 'not_available' };
  if (!hasSchedule) return { kind: 'not_set' };
  if (day.state === 'full') return { kind: 'full' };
  if (day.consumed > 0) {
    const more = Math.max(0, day.capacity - day.consumed);
    return more > 0 ? { kind: 'fits', more } : { kind: 'full' };
  }
  // `whitelist` (approve each ask first) and `waitlist` both leave the day bookable — with the shop's yes.
  return { kind: 'free' };
}

/** The word and its tone. */
export function threadDayWords(answer: ThreadDayAnswer): { word: string; tone: ThreadDayTone } {
  switch (answer.kind) {
    case 'free':
      return { word: 'Free', tone: 'ok' };
    case 'fits':
      return { word: `${answer.more} more fit`, tone: 'ok' };
    case 'full':
      return { word: 'Full', tone: 'danger' };
    case 'not_available':
      return { word: 'Not available', tone: 'danger' };
    case 'not_set':
      return { word: 'Schedule not set', tone: 'neutral' };
    case 'booked':
      return { word: 'Booked', tone: 'ok' };
    case 'no_date':
      return { word: 'No date yet', tone: 'neutral' };
    default: {
      const never: never = answer;
      return never;
    }
  }
}

/**
 * Whether the day can still take this couple — the one question the quick reply "Yes po, that day is free" may only
 * be offered on. Anything else (full, closed, not set, unknown) withholds that reply: a canned "yes" over a full day
 * is a promise the lock will then refuse.
 */
export function threadDayIsOpen(answer: ThreadDayAnswer | null): boolean {
  return answer?.kind === 'free' || answer?.kind === 'fits';
}

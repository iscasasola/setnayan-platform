/**
 * schedule-shift-notice — the words of the notice every booked supplier gets when the couple shifts the day
 * (owner, tracker 2026-10-23, verbatim shape: "Schedule moved +30 min from 4:00 PM").
 *
 * Pure (no I/O) so the words are tested apart from who is told (`schedule-shift-notify.server.ts`).
 */
import { formatWallClock } from '@/lib/schedule-datetime-local';

/**
 * Where the notice opens. ON THE DAY: the supplier's event Hub (the live console) at the schedule
 * (`id="schedule"`). Any other day the console is closed — it redirects to the Hub list, a dead end — so the
 * notice opens the customer's card, where the day-of timeline is (the same door every schedule answer uses).
 */
export function scheduleShiftHref(eventId: string, onTheDay: boolean): string {
  return onTheDay ? `/vendor-dashboard/on-the-day/live/${eventId}#schedule` : `/vendor-dashboard/clients/${eventId}`;
}

/** Is `todayManila` (YYYY-MM-DD) within the event's day(s)? A missing date is never "on the day". */
export function isOnTheDay(eventDate: string | null, eventEndDate: string | null, todayManila: string): boolean {
  if (!eventDate) return false;
  const start = eventDate.slice(0, 10);
  const end = (eventEndDate ?? eventDate).slice(0, 10);
  return todayManila >= start && todayManila <= end;
}

/** "+30 min" · "−15 min" · "+1 h 15 min" — the amount as the Running-late sheet says it. */
export function shiftAmount(deltaMinutes: number): string {
  const sign = deltaMinutes < 0 ? '−' : '+';
  const abs = Math.abs(Math.round(deltaMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const body = h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
  return `${sign}${body}`;
}

/**
 * "Schedule moved +30 min from 4:00 PM". `fromStartAt` is the first moved moment's start BEFORE the shift — a
 * stored wall clock (the venue's time held in a UTC column), never converted, so 4:00 PM reads 4:00 PM wherever the
 * supplier's phone is.
 */
export function scheduleShiftTitle(deltaMinutes: number, fromStartAt: string | null): string {
  const from = fromStartAt ? formatWallClock(fromStartAt, { hour12: true }) : '';
  return from ? `Schedule moved ${shiftAmount(deltaMinutes)} from ${from}` : `Schedule moved ${shiftAmount(deltaMinutes)}`;
}

/** The line under it: who shifted the day, and from which moment. */
export function scheduleShiftBody(eventName: string, fromLabel: string | null): string {
  return fromLabel
    ? `${eventName} shifted the day from ${fromLabel} on. Open the schedule for the new times.`
    : `${eventName} shifted the day. Open the schedule for the new times.`;
}

/**
 * ⏭ Change the schedule › Skip (owner 2026-11-04) rides the same `schedule_shifted` notice — never a second type — with
 * its own words: "Skipped: Cake cutting" · "Back on: Cake cutting".
 */
export function scheduleSkipTitle(label: string | null, op: 'skip' | 'unskip'): string {
  const name = label?.trim() || 'A part of the day';
  return op === 'skip' ? `Skipped: ${name}` : `Back on: ${name}`;
}

/** The line under it. */
export function scheduleSkipBody(eventName: string, op: 'skip' | 'unskip'): string {
  return op === 'skip'
    ? `${eventName}'s schedule changed — that part won't happen; the rest keeps its times.`
    : `${eventName}'s schedule changed — that part is back at its time.`;
}

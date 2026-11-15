/**
 * 🕕 A SUPPLIER'S OWN TIMES, BEFORE THE HOSTS' PROGRAM EXISTS (owner-approved supplier cut 5, 2026-11-14 —
 * DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html`
 * § 5). The call time, the arrival and the finish, kept as the venue's WALL CLOCK ('HH:MM') on
 * `supplier_own_times` (migration 20271346335702) until the hosts build their program; then the arrival and finish
 * slot in as the same "<shop> arrives" / "<shop> is done" requests My times files.
 *
 * Pure: the words and the rules, no I/O.
 */
import { clockWords, wallIso } from './schedule-chapters';

/** One stored row as the screens read it. */
export type OwnTimes = { call: string | null; arrive: string | null; done: string | null; filedAt: string | null };

/** The three rows, in the prototype's words. */
export const OWN_TIMES_ROWS = [
  { key: 'call', name: 'Call time', line: 'Your crew meets' },
  { key: 'arrive', name: 'Arrive at the venue', line: null },
  { key: 'done', name: 'Done by', line: null },
] as const;

/** The empty state's one line: what happens to the times. */
export const OWN_TIMES_WAITING = 'The hosts haven’t built their program yet. Your times slot in once they do.';

/** A wall clock as stored: 'HH:MM', 00:00 … 23:59. */
export function isOwnClock(v: string): boolean {
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
}

/** "6:00 AM", from a stored 'HH:MM' ('' for none). */
export function ownClockWords(hhmm: string | null | undefined): string {
  if (!hhmm || !isOwnClock(hhmm)) return '';
  return clockWords(wallIso('2000-01-01', hhmm));
}

/** "Call 6:00 AM · arrive 7:30 AM · done 11:00 PM" — only the ones set; '' when none. */
export function ownTimesLine(t: Pick<OwnTimes, 'call' | 'arrive' | 'done'> | null): string {
  if (!t) return '';
  return [
    t.call ? `Call ${ownClockWords(t.call)}` : null,
    t.arrive ? `arrive ${ownClockWords(t.arrive)}` : null,
    t.done ? `done ${ownClockWords(t.done)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Should these times slot into the program now? Only when there is something to file (an arrival or a finish), it
 * has not been filed yet, and a chapter they are linked to exists. Returns that chapter's id, or null.
 */
export function ownTimesSlotInto(t: OwnTimes | null, linkedChapterIds: readonly string[]): string | null {
  if (!t || t.filedAt || (!t.arrive && !t.done)) return null;
  return linkedChapterIds[0] ?? null;
}

/** The chat's call-time pin counts a call time kept here as set — the pin turns Done. */
export function callTimeIsSet(rpcAt: string | null, ownCall: string | null | undefined): boolean {
  return rpcAt != null || Boolean(ownCall && isOwnClock(ownCall));
}

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

/**
 * 🕕 Owner ruling A (2026-11-16): the anchor the chat's "DUE NOW · Set your call time" pin opens — the Your times control
 * on the supplier's Schedule tab, settable before the hosts build their day.
 */
export const CALL_TIME_ANCHOR = 'own-times';

/* ── 🕕 THE SCHEDULE MODEL (owner, DECISION_LOG 16 Nov "SCHEDULE MODEL") ────────────────────────────────────────────
 * The couple sees TWO different times for a supplier, never one "call time" for both:
 *   · Crew call  — the supplier's own `call_clock` (when their crew meets), set on their Schedule tab;
 *   · On site from — the earliest Schedule moment the COUPLE tagged them on (`earliestTaggedBlock`).
 */

/** "Crew call 6:00 AM" — the couple-facing words for the supplier's own call time ('' when none). */
export function crewCallWords(call: string | null | undefined): string {
  const at = ownClockWords(call);
  return at ? `Crew call ${at}` : '';
}

/**
 * The hosts' IN-APP notice when a supplier sets or changes their times, or presses Confirm my times (owner 16 Nov,
 * rule 3: in the app only — never emailed). Null = nothing to tell (the same times saved again).
 */
export function supplierTimesNotice(input:
  | { kind: 'times'; shop: string; before: Pick<OwnTimes, 'call' | 'arrive' | 'done'> | null; after: Pick<OwnTimes, 'call' | 'arrive' | 'done'> }
  | { kind: 'confirmed'; shop: string },
): { title: string; body: string } | null {
  if (input.kind === 'confirmed') {
    return { title: `${input.shop} confirmed their times`.slice(0, 160), body: 'Their part of your Schedule is final from their side.' };
  }
  const b = input.before;
  const a = input.after;
  if (b && b.call === a.call && b.arrive === a.arrive && b.done === a.done) return null;
  const had = Boolean(b && (b.call || b.arrive || b.done));
  const words = [
    a.call ? crewCallWords(a.call) : null,
    a.arrive ? `arrive ${ownClockWords(a.arrive)}` : null,
    a.done ? `done ${ownClockWords(a.done)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (!words) return null;
  return { title: `${input.shop} ${had ? 'changed' : 'set'} their times`.slice(0, 160), body: words.slice(0, 200) };
}

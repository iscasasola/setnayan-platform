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

/* ── 🕕 THE SCHEDULE MODEL (owner, DECISION_LOG 16 Nov "SCHEDULE MODEL"; drawing
 * `prototypes/event_pages_today_doors_2026-11-16/event_pages_today_doors_2026-11-16_fable.html`, "two times, two names") ──
 * The couple sees TWO different times for a supplier, never one "call time" for both:
 *   · Crew call    — the supplier's own `call_clock` (when their crew meets), set on their Schedule tab;
 *   · On site from — the earliest Schedule moment the COUPLE tagged them on (`earliestTaggedBlock`), with the supplier's
 *                    own arrive and done after it: "On site from 1:00 PM · arrives 12:00 PM · done 10:00 PM".
 * A supplier with none of their own: "No times yet" + "On site from 2:30 PM, from the moments you tagged them on".
 */

/** The three clocks as stored ('HH:MM' or null). */
export type OwnClocks = Pick<OwnTimes, 'call' | 'arrive' | 'done'>;

const hasAny = (t: OwnClocks | null | undefined): t is OwnClocks => Boolean(t && (t.call || t.arrive || t.done));

/** "Crew call 6:00 AM" — the couple-facing words for the supplier's own call time ('' when none). */
export function crewCallWords(call: string | null | undefined): string {
  const at = ownClockWords(call);
  return at ? `Crew call ${at}` : '';
}

/** "arrives 12:00 PM · done 10:00 PM" — only the ones set, in that order; '' when neither. */
export function arrivesDoneWords(t: Pick<OwnClocks, 'arrive' | 'done'> | null | undefined): string {
  if (!t) return '';
  return [t.arrive && ownClockWords(t.arrive) ? `arrives ${ownClockWords(t.arrive)}` : null, t.done && ownClockWords(t.done) ? `done ${ownClockWords(t.done)}` : null]
    .filter(Boolean)
    .join(' · ');
}

const capFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The notice body / Today line: "Crew call 11:00 AM · arrives 12:00 PM · done 10:00 PM", or "Arrives 4:00 PM · done 10:30 PM". */
export function ownTimesNoticeWords(t: OwnClocks | null | undefined): string {
  if (!t) return '';
  return capFirst([crewCallWords(t.call), arrivesDoneWords(t)].filter(Boolean).join(' · '));
}

/** One line of the couple's Booked row times: `lead` + bold `clock` + `tail`. */
export type BookedTimesLine = { id: 'crew' | 'none' | 'onsite' | 'unread'; lead: string; clock: string | null; tail: string };

/**
 * THE BOOKED ROW'S TIMES, as the drawing words them. `own` = the supplier's own row (`undefined` = none kept; `'unread'`
 * = the read was refused — said, never "No times yet"); `tagged` = the earliest moment the couple tagged them on
 * ("1:00 PM", `null` = tagged on nothing, `'unread'` = the Schedule read was refused).
 */
export function bookedTimesLines(own: OwnClocks | null | 'unread', tagged: string | null | 'unread'): BookedTimesLine[] {
  const out: BookedTimesLine[] = [];
  const mine = own === 'unread' ? null : hasAny(own) ? own : null;
  if (own === 'unread') out.push({ id: 'unread', lead: 'We couldn’t check their times.', clock: null, tail: '' });
  else if (!mine) out.push({ id: 'none', lead: 'No times yet', clock: null, tail: '' });
  else if (mine.call && ownClockWords(mine.call)) out.push({ id: 'crew', lead: 'Crew call ', clock: ownClockWords(mine.call), tail: '' });
  const ad = arrivesDoneWords(mine);
  if (tagged === 'unread') out.push({ id: 'unread', lead: 'We couldn’t check your Schedule for when they’re on site.', clock: null, tail: '' });
  else if (tagged) out.push({ id: 'onsite', lead: 'On site from ', clock: tagged, tail: mine ? (ad ? ` · ${ad}` : '') : ', from the moments you tagged them on' });
  else if (ad) {
    const first = mine?.arrive && ownClockWords(mine.arrive);
    out.push(first ? { id: 'onsite', lead: 'Arrives ', clock: first, tail: mine?.done ? ` · done ${ownClockWords(mine.done)}` : '' } : { id: 'onsite', lead: 'Done ', clock: ownClockWords(mine?.done), tail: '' });
  }
  return out;
}

/**
 * The hosts' IN-APP notice (owner 16 Nov, rule 3: in the app only — never emailed), as the drawing words it:
 *   "Lumière Studio set their times" · "Crew call 11:00 AM · arrives 12:00 PM · done 10:00 PM"
 *   "Taal Vista Hotel confirmed their times" · "Arrives 4:00 PM · done 10:30 PM"
 * Null = nothing to tell: the before-read was REFUSED (never announced as "set"), the same times saved again, or a
 * Confirm pressed again with nothing changed since the last one. Clearing every time IS a change, and is told.
 */
export function supplierTimesNotice(
  input:
    | { kind: 'times'; shop: string; before: OwnClocks | null | 'unread'; after: OwnClocks }
    | { kind: 'confirmed'; shop: string; times: OwnClocks | null; alreadyConfirmed: boolean; changedSinceConfirm: boolean },
): { title: string; body: string } | null {
  if (input.kind === 'confirmed') {
    if (input.alreadyConfirmed && !input.changedSinceConfirm) return null;
    return { title: `${input.shop} confirmed their times`.slice(0, 160), body: ownTimesNoticeWords(input.times) || 'Their part of your Schedule is final from their side.' };
  }
  if (input.before === 'unread') return null;
  const b = input.before;
  const a = input.after;
  const same = (b?.call ?? null) === (a.call ?? null) && (b?.arrive ?? null) === (a.arrive ?? null) && (b?.done ?? null) === (a.done ?? null);
  if (same) return null;
  if (!hasAny(a)) return { title: `${input.shop} cleared their times`.slice(0, 160), body: 'No times yet' };
  return { title: `${input.shop} ${hasAny(b) ? 'changed' : 'set'} their times`.slice(0, 160), body: ownTimesNoticeWords(a).slice(0, 200) };
}

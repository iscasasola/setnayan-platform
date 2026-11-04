/**
 * day-check.ts — THE DAY, BEFORE YOU ACCEPT (owner 2026-11-04, DECISION_LOG "2026-11-04 DAY CHECK BEFORE ACCEPT").
 *
 * Owner, verbatim: *"show if there are conflicts with their schedule? which should be mostly unlikely since we will
 * not allow them to accept if there is a conflict in their schedule. or maybe also show who are shortlisted on that
 * schedule? so they know if they want to accept?"* → approved prototype → *"Yes, build it"*.
 *
 * Under the booking ask, ONE line: "Dec 19 · 0 of 4 booked · 1 shortlisted", or red "Full on Feb 14 · Lopez & Pineda
 * booked · you take 1 a day" (Accept → "Waiting list"). Tapping it opens the day: each card's limit and bookings, then
 * Booked that day · Also asking for that day · Shortlisted you for that day.
 *
 * 🔑 ONE RULE, NOT TWO. Nothing here decides whether a day is full. The verdict is `vendor_day_check`'s (migration
 * 20271306441834), computed with `vendor_agree_to_lock`'s own predicates and its own `service_card_bookings_on` count;
 * `tests/db/the-day-check-agrees-with-the-yes.db.test.ts` asks both for the same row and fails if they disagree. This
 * file only READS that answer and words it. `full` below is the RPC's `slot_full || daily_full`, never a recount.
 *
 * 🔒 A FAILED READ IS SAID. `readDayCheck` never turns a refused read into "0 booked": it returns `failed`, the line
 * says "Couldn't check this day", and Agree stays exactly as guarded as before (the server still refuses a full day).
 */
import type { LockAnswerNotice } from './lock-answer-notice';
import { formatCount } from './format-number';

/** The statuses `vendor_agree_to_lock` answers from its capacity gates — the verdict names the same ones. */
export const DAY_CHECK_VERDICTS = ['open', 'resolve_others_first', 'slot_full', 'daily_limit_reached'] as const;
export type DayCheckVerdict = (typeof DAY_CHECK_VERDICTS)[number];

export type DayCheckService = {
  serviceId: string;
  name: string;
  mode: 'day' | 'slot';
  /** Whole day: "Bookings per day"; null = no limit. */
  dailyLimit: number | null;
  /** By time slot: active slots, the most one slot takes, and all the places together. */
  slots: number;
  perSlot: number | null;
  slotLimit: number;
  booked: number;
  /** This card is the one the couple asked for. */
  isThisAsk: boolean;
  /** Drawn as "Full" — for the asked card, the RPC's own flag; for others, booked ≥ limit. */
  full: boolean;
};
export type DayCheckBooked = { name: string; eventType: string | null; service: string | null; serviceId: string | null; source: 'setnayan' | 'outside' };
export type DayCheckAsking = { eventId: string; name: string; eventType: string | null; threadId: string | null };
export type DayCheckSaved = { eventId: string; name: string; eventType: string | null };

export type DayCheck = {
  date: string;
  verdict: DayCheckVerdict;
  /** The yes would be refused for capacity: the ask's slot or the asked card's day is full (the RPC's flags). */
  full: boolean;
  competing: number;
  services: DayCheckService[];
  booked: DayCheckBooked[];
  asking: DayCheckAsking[];
  shortlisted: DayCheckSaved[];
};

/** What the screen draws: a checked day, no day to check, or a read that failed (said, never zeroed). */
export type DayCheckRead = { kind: 'ok'; check: DayCheck } | { kind: 'no_date' } | { kind: 'failed' };

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null) : [];

/** A card key → words, when the card has no title of its own ("photo_booth" → "Photo booth"). */
export function cardWords(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) return name;
  const w = name.replace(/_/g, ' ');
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * The RPC's jsonb → the screen's shape. Null when it is not a checked day (the caller decides `no_date` vs `failed`
 * from `status`) or when its verdict is one this file does not know — an unknown verdict is a failed read, never
 * "open".
 */
export function parseDayCheck(raw: unknown): DayCheck | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.status !== 'ok') return null;
  const verdict = r.verdict;
  if (!DAY_CHECK_VERDICTS.includes(verdict as DayCheckVerdict)) return null;
  const date = str(r.date);
  if (!date) return null;
  const slotFull = r.slot_full === true;
  const dailyFull = r.daily_full === true;
  const services = arr(r.services).map((s): DayCheckService => {
    const mode = s.mode === 'slot' ? 'slot' : 'day';
    const dailyLimit = num(s.daily_limit);
    const slotLimit = num(s.slot_limit) ?? 0;
    const booked = num(s.booked) ?? 0;
    const isThisAsk = s.is_this_ask === true;
    const ownFull = mode === 'slot' ? slotLimit > 0 && booked >= slotLimit : dailyLimit !== null && booked >= dailyLimit;
    return {
      serviceId: String(s.service_id ?? ''),
      name: cardWords(str(s.name) ?? 'Your card'),
      mode,
      dailyLimit,
      slots: num(s.slots) ?? 0,
      perSlot: num(s.per_slot),
      slotLimit,
      booked,
      isThisAsk,
      full: isThisAsk ? (mode === 'slot' ? slotFull || ownFull : dailyFull) : ownFull,
    };
  });
  return {
    date,
    verdict: verdict as DayCheckVerdict,
    full: slotFull || dailyFull,
    competing: num(r.competing) ?? 0,
    services,
    booked: arr(r.booked).map((b) => ({
      name: str(b.name) ?? 'A couple',
      eventType: str(b.event_type),
      service: str(b.service) ? cardWords(str(b.service)!) : null,
      serviceId: str(b.service_id),
      source: b.source === 'outside' ? 'outside' : 'setnayan',
    })),
    asking: arr(r.asking).map((a) => ({
      eventId: String(a.event_id ?? ''),
      name: str(a.name) ?? 'A couple',
      eventType: str(a.event_type),
      threadId: str(a.thread_id),
    })),
    shortlisted: arr(r.shortlisted).map((s) => ({
      eventId: String(s.event_id ?? ''),
      name: str(s.name) ?? 'A couple',
      eventType: str(s.event_type),
    })),
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-12-19" → "Dec 19" — the prototype's short date. A civil date, so no time zone is involved. */
export function shortDayWords(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}`;
}

/** "1 of 2 booked" · "3 booked · no limit" · "Full" — one card's day, in the sheet's and the line's words. */
export function cardDayWords(s: DayCheckService): string {
  if (s.full) return 'Full';
  if (s.mode === 'slot') return `${formatCount(s.booked)} of ${formatCount(s.slotLimit)} booked`;
  return s.dailyLimit === null
    ? `${formatCount(s.booked)} booked · no limit`
    : `${formatCount(s.booked)} of ${formatCount(s.dailyLimit)} booked`;
}

/** "Whole day · 2 a day" · "By time slot · 1 per slot · 3 slots" · "Whole day · no limit". */
export function cardLimitWords(s: DayCheckService): string {
  if (s.mode === 'slot') return `By time slot · ${s.perSlot ?? 1} per slot · ${plural(s.slots, 'slot', 'slots')}`;
  return s.dailyLimit === null ? 'Whole day · no limit' : `Whole day · ${s.dailyLimit} a day`;
}

/**
 * THE ONE LINE under the ask (prototype `dayCheck().line`). `day` is the short date the panel already uses ("Dec 19").
 *   full  → "Full on Dec 19 · Lopez & Pineda booked · you take 1 a day"
 *   else  → "Dec 19 · 0 of 4 booked · 1 more asking · 1 shortlisted"
 */
export function dayCheckLine(check: DayCheck, day: string): { tone: 'ok' | 'warn' | 'bad'; text: string; full: boolean } {
  const asked = check.services.find((s) => s.isThisAsk) ?? null;
  if (check.full) {
    const names = check.booked
      .filter((b) => b.source === 'setnayan' && (!asked || b.serviceId === asked.serviceId))
      .map((b) => b.name);
    const who = names.length > 0 ? ` · ${names.join(', ')} booked` : '';
    const take = asked
      ? asked.mode === 'slot'
        ? ` · you take ${asked.perSlot ?? 1} per slot`
        : asked.dailyLimit !== null
          ? ` · you take ${asked.dailyLimit} a day`
          : ''
      : '';
    return { tone: 'bad', text: `Full on ${day}${who}${take}`, full: true };
  }
  const parts = [day];
  const cards = check.services.length > 0 ? check.services : [];
  for (const s of cards) parts.push(cardDayWords(s));
  if (cards.length === 0) parts.push(plural(check.booked.filter((b) => b.source === 'setnayan').length, 'booking', 'bookings'));
  if (check.asking.length > 0) parts.push(`${check.asking.length} more asking`);
  if (check.shortlisted.length > 0) parts.push(`${check.shortlisted.length} shortlisted`);
  return { tone: check.verdict === 'resolve_others_first' ? 'warn' : 'ok', text: parts.join(' · '), full: false };
}

/** The line when the day could not be checked, or has no day to check. Never "0 booked". */
export const DAY_CHECK_FAILED = 'Couldn’t check this day. Agree still checks it for you.';
export const DAY_CHECK_NO_DATE = 'Their date isn’t set to a day yet, so there is no day to check.';

/** The full-day sentence in the sheet (prototype `.lead`). */
export const DAY_CHECK_FULL_LEAD =
  'You can’t accept a full day. Turn it down, or put them on your waiting list — if the day opens, they’re told first. Raise “Bookings per day” on the card if you can take more.';

/** The polite message "Waiting list" sends in their chat (prototype `bandWait`). */
export function waitlistMessage(day: string): string {
  return `We’re fully booked on ${day}, so we can’t take it. You’re on our waiting list — if the day opens, you’re told first.`;
}

/* ── WHAT "WAITING LIST" DID — read back off the redirect, one spelling written and read here ─────────────────────── */

const WAITLIST_ANSWERS: Record<string, LockAnswerNotice> = {
  ok: { tone: 'ok', text: 'They’re on your waiting list, and we told them in your chat. If the day opens, they’re told first.' },
  ok_unsent: {
    tone: 'ok',
    text: 'They’re on your waiting list. Your message didn’t send — tell them in the chat that the day is full.',
  },
  already: { tone: 'noop', text: 'They were already on your waiting list for that day — nothing changed.' },
  not_full: { tone: 'refused', text: 'That day has room again, so there is no waiting list for it. You can agree to this one.' },
  not_pending: { tone: 'refused', text: 'This ask is already closed, so there is nothing to put on the waiting list.' },
  no_date: { tone: 'refused', text: 'Their date isn’t set to a day, so there is no day to wait for.' },
  no_couple: { tone: 'refused', text: 'We couldn’t find who asked, so they weren’t added. Message them instead.' },
  error: { tone: 'refused', text: 'That did not go through. Nothing changed — please try again.' },
};
export const WAITLIST_ANSWER_STATUSES = Object.keys(WAITLIST_ANSWERS);
export function waitlistAnswerNotice(status: unknown): LockAnswerNotice | null {
  if (typeof status !== 'string' || !status) return null;
  return WAITLIST_ANSWERS[status] ?? WAITLIST_ANSWERS.error!;
}

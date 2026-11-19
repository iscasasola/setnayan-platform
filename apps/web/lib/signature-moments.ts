/**
 * signature-moments.ts — 🕯 THE SIX SIGNATURE MOMENTS: when each one plays (motion standard 18 Nov 2026, § 9; owner,
 * verbatim: *"Ghost + all six"*; un-parked 19 Nov: *"animations build the rest"*). The visual contract is prototype
 * `motion_standard_2026-11-18_fable.html` Part I; the look is `app/signature-moments.css`; the parts are
 * `app/_components/signature/*`.
 *
 * Every moment is RARE, so every one of them asks "have I already played?" before it moves. That answer lives on the
 * DEVICE (localStorage / sessionStorage) — never in the database: no moment adds a server write. Storage can be
 * missing or throw (a private window, blocked site data), so every read and write is wrapped, and the answer WITHOUT
 * storage is always "do not play": the screen draws its still state, which is correct by itself.
 *
 * Pure: the storage and the clock come in, so the guard (`lib/the-six-signature-moments.test.ts`) runs each rule
 * directly.
 */

/** The moments, by name — the `data-sig` value each part wears and the CSS's `sn-sig-<name>` prefix. */
export const SIGNATURE_MOMENTS = ['tie', 'foil', 'live', 'reply', 'day', 'capiz'] as const;
export type SignatureMoment = (typeof SIGNATURE_MOMENTS)[number];

/** How often each plays, and what reduced motion shows instead — the prototype's own "How often" / "Reduced" rows. */
export const SIGNATURE_RULES: Record<SignatureMoment, { name: string; once: string; reduced: string }> = {
  tie: { name: 'The Tie', once: 'once per booking', reduced: 'thread and seal shown at once' },
  foil: { name: 'Foil glint', once: 'twice in an event’s life: created, and the morning of the day', reduced: 'no glint; the monogram simply shows' },
  live: { name: 'Go live', once: 'on first publish; a re-publish shows only the chip', reduced: 'the chip appears; no lift, no glow' },
  reply: { name: 'Reply arrives', once: 'once per visit, however many replies came', reduced: 'the count changes at once; the envelope stays shut' },
  day: { name: 'Day turns', once: 'once a day at most', reduced: 'the number changes at once' },
  capiz: { name: 'Capiz light', once: 'once, when the plan unlocks', reduced: 'a still window; no light' },
};

/** The slice of `Storage` a moment needs — `window.localStorage` and `window.sessionStorage` both fit. */
export type MomentStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };

const PREFIX = 'sn:sig:';
export const sigKey = (moment: SignatureMoment, id: string): string => `${PREFIX}${moment}:${id}`;

/** A mark, or null when there is none or the storage cannot be read. */
export function readMark(store: MomentStore | null | undefined, key: string): string | null {
  try {
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
}

/** Writes a mark; false when it could not be kept (then the moment must not play — it could never stop replaying). */
export function writeMark(store: MomentStore | null | undefined, key: string, value: string): boolean {
  try {
    if (!store) return false;
    store.setItem(key, value);
    return store.getItem(key) === value;
  } catch {
    return false;
  }
}

/**
 * ONCE: true exactly the first time `key` is claimed on this device, and never again. No storage, a read that throws
 * or a write that does not stick → false.
 */
export function claimOnce(store: MomentStore | null | undefined, key: string): boolean {
  if (readMark(store, key) !== null) return false;
  return writeMark(store, key, '1');
}

/** The browser's stores, or null on the server / where reaching for them throws. */
export function deviceStore(kind: 'local' | 'session'): MomentStore | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** A calendar day as the device reads it — `2026-11-19`. */
export function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/* ── ① THE TIE — once per booking ─────────────────────────────────────────────────────────────────────────────── */

/** True the first time this device sees `bookingId` booked. */
export function tiePlays(local: MomentStore | null, bookingId: string): boolean {
  return claimOnce(local, sigKey('tie', bookingId));
}

/**
 * The couple's Booked list: the ONE booking to tie now — the first this device has not seen booked — or null. Every
 * booking in the list is marked seen in the same pass, so a list of five plays once, not five visits in a row. The very
 * first look at a list (nothing marked yet, e.g. a new phone) is only remembered: old bookings are not news.
 */
export function tieFromList(local: MomentStore | null, eventId: string, bookingIds: readonly string[]): string | null {
  const listKey = sigKey('tie', `list:${eventId}`);
  const known = readMark(local, listKey) !== null;
  let first: string | null = null;
  for (const id of bookingIds) {
    if (tiePlays(local, id) && first === null) first = id;
  }
  if (!known) {
    writeMark(local, listKey, '1');
    return null;
  }
  return first;
}

/* ── ② FOIL GLINT — event created · the morning of the day ────────────────────────────────────────────────────── */

export type FoilReason = 'created' | 'morning';

/** The session's "an event is being created" mark — set on the create-event screen, spent by the first glint. */
export const FOIL_ARM = `${PREFIX}foil:arm`;

/** The create-event screen was opened in this visit: the next event this device has never seen is the new one. */
export function armFoil(session: MomentStore | null): void {
  writeMark(session, FOIL_ARM, '1');
}

/** Today IS the event's day (the device's calendar) and it is before noon. */
export function isEventMorning(eventDate: string | null, now: Date): boolean {
  return Boolean(eventDate) && eventDate!.slice(0, 10) === localDay(now) && now.getHours() < 12;
}

/**
 * The glint to play now — or null. No server fact is read for "created": it is the first time this DEVICE sees the
 * event, in a visit that passed through the create-event screen (`armFoil`); the mark is spent as it plays. `morning`
 * is claimed once per event. Every event seen is remembered, so an old event opened later is never mistaken for new.
 */
export function foilPlays(local: MomentStore | null, session: MomentStore | null, eventId: string, input: { eventDate: string | null; now: Date }): FoilReason | null {
  const firstSight = claimOnce(local, sigKey('foil', `${eventId}:seen`));
  if (firstSight && readMark(session, FOIL_ARM) === '1' && writeMark(session, FOIL_ARM, '0')) return 'created';
  if (isEventMorning(input.eventDate, input.now) && claimOnce(local, sigKey('foil', `${eventId}:morning`))) return 'morning';
  return null;
}

/* ── ③ GO LIVE — first publish: the whole moment; again: only the chip ───────────────────────────────────────── */

export type GoLiveKind = 'first' | 'chip';

/** `first` the first time this device publishes this Event Hub; `chip` every time after (and with no storage). */
export function goLiveKind(local: MomentStore | null, eventId: string): GoLiveKind {
  return claimOnce(local, sigKey('live', eventId)) ? 'first' : 'chip';
}

/* ── ④ REPLY ARRIVES — once per visit ─────────────────────────────────────────────────────────────────────────── */

/**
 * New "coming" replies since this device last looked → `{ from }` (the count it last saw), once per visit however
 * many came; otherwise null. The count seen is always remembered, so the next visit starts from today's number. A
 * first look (nothing remembered) is not a reply arriving.
 */
export function replyArrives(local: MomentStore | null, session: MomentStore | null, eventId: string, coming: number): { from: number } | null {
  const seenKey = sigKey('reply', eventId);
  const raw = readMark(local, seenKey);
  const kept = writeMark(local, seenKey, String(coming));
  if (raw === null || !kept) return null;
  const from = Number(raw);
  if (!Number.isFinite(from) || from >= coming) return null;
  return claimOnce(session, sigKey('reply', `visit:${eventId}`)) ? { from } : null;
}

/* ── ⑤ DAY TURNS — once a day ─────────────────────────────────────────────────────────────────────────────────── */

/**
 * The first time this device opens the event on a NEW day → `{ from: days + 1 }` (yesterday's page is torn off);
 * otherwise null. A first look ever, the same day again, a countdown that is not a number of days to go → null.
 */
export function dayTurns(local: MomentStore | null, eventId: string, days: number | null, now: Date): { from: number } | null {
  if (days === null || !Number.isFinite(days) || days < 0) return null;
  const key = sigKey('day', eventId);
  const today = localDay(now);
  const last = readMark(local, key);
  if (last === today) return null;
  if (!writeMark(local, key, today)) return null;
  return last === null ? null : { from: days + 1 };
}

/* ── ⑥ CAPIZ LIGHT — once, when a plan unlocks ────────────────────────────────────────────────────────────────── */

/**
 * True once when `plan` is a paid plan this device has not seen on `subject` before. `plan` null = no paid plan (it is
 * remembered, so the unlock that follows is news). A first look with a plan already on is not an unlock — unless
 * `justNow` says the page itself was told so (the supplier's `?applied=1`).
 */
export function capizPlays(local: MomentStore | null, subject: string, plan: string | null, justNow = false): boolean {
  const key = sigKey('capiz', subject);
  const last = readMark(local, key);
  const now = plan ?? '';
  if (last === now) return false;
  if (!writeMark(local, key, now)) return false;
  if (!plan) return false;
  return last !== null || justNow;
}

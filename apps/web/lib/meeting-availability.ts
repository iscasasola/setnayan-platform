/**
 * lib/meeting-availability.ts — BOTH SIDES' AVAILABILITY FOR A MEETING, FOLDED INTO WHAT THE DATE SHEET DRAWS
 * (Build 3 · Lane D; approved prototype v3.1 `Setnayan-specs/prototypes/date_picker_2026-11-09/`, README § "Both sides'
 * availability (meetings)"; DECISION_LOG 📆 2026-11-09).
 *
 * The prototype, verbatim: *"the picker reads the supplier's blocks/bookings/meetings and the included people's own
 * schedule. A busy day or time is greyed with WHO … your own conflict names itself … the ⓘ says who has not added a
 * schedule … Set lights only on a time free for everyone."*
 *
 * The read is `meeting-availability.server.ts`; this file is PURE (client-safe, no DB, no React) so the sheet's two
 * functions — `refuse` (a day that can never be chosen) and `slots.busy` (who is busy at a time) — come from ONE
 * serialisable answer a server component hands down (`MeetingAvailability`).
 *
 * Nothing here is a new rule. Every fact is an existing one, asked the existing way:
 *   · a supplier's NOT-AVAILABLE block — `lib/not-available.ts` (`blockClosesDay` closes a day; a part of a day
 *     refuses only its hours, `DAY_PART_MINUTES`) — the TS twin of `public.calendar_block_on_day`;
 *   · a supplier's BOOKED / FULL day — `lib/calendar-truth.ts` (the lock's own refusal, `service_cards_unbookable_on`),
 *     and its `set` flag is the "Not set" calendar → "hasn't added their schedule";
 *   · a MEETING already held — `event_appointments` (proposed or confirmed), on either side.
 *
 * 🔒 PRIVACY (owner: the other side "only says not available"): the other side's reason is never carried — a block's
 * note, a meeting's type, another couple's name never leave the server. Only YOUR OWN clash names itself.
 *
 * 🔑 A READ THAT FAILED IS NEVER "FREE". A side whose read failed is left out of "Free for …" and named in the ⓘ
 * ("Lumina's schedule could not be read — check with them"); it never renders like a side that is free.
 *
 * 🔑 THERE IS NO PERSONAL SCHEDULE FOR A HOST. The platform holds the event's meetings, not a co-host's or a parent's
 * own day, so anyone else included (`alsoAsked`) is named, honestly, as having not added a schedule. Measured
 * 2026-11-10: no table holds a person's own busy times; adding one is a migration and an owner decision.
 *
 * Held by `lib/meeting-availability.test.ts`.
 */
import type { CalendarDay } from './calendar-grid';
import { DATE_SHEET_YOU, busyWords, missingScheduleWords, type DateSheetBusy, type DateSheetRefusal, type DateSheetSlots, type SheetTime } from '@/lib/date-sheet';
import { DAY_PART_MINUTES, blockClosesDay, blockTakesPartOfDay, minutesOf, type NotAvailableShape } from './not-available';

/** Who is looking: a host of the event (the couple's side) or the supplier. "You" is always the viewer's side. */
export type MeetingViewer = 'host' | 'supplier';

/** A meeting already held, reduced to what the fold needs. `minutes` absent → `MEETING_DEFAULT_MIN`. */
export type HeldMeeting = {
  /** Its Manila civil day and start (`YYYY-MM-DD`, `HH:MM`). */
  day: CalendarDay;
  start: SheetTime;
  minutes: number | null;
  /** How the meeting is said when it is YOURS: "the food tasting with Bloom". Never shown to the other side. */
  label: string;
  /** Is this meeting with the supplier in question (so it is both sides' own)? */
  withThisSupplier: boolean;
};

/** A stored meeting with no length is read as an hour (`event_appointments.duration_min` is optional). */
export const MEETING_DEFAULT_MIN = 60;
/** The longest window one read covers (a meeting falls from today to the day before the event). */
export const MEETING_WINDOW_MAX_DAYS = 400;

/** The raw reads, as the server got them. `null` = that read FAILED (never the same as empty). */
export type MeetingAvailabilityInput = {
  viewer: MeetingViewer;
  /** The supplier's name ("Lumina") and the hosts' name as the supplier knows them ("Ana & Ben"). */
  supplierName: string;
  hostName: string;
  from: CalendarDay;
  to: CalendarDay;
  /** The supplier's not-available blocks (`notAvailableShapeOf`). */
  blocks: readonly NotAvailableShape[] | null;
  /** The supplier's calendar per `calendar-truth`: has one at all, and the days the lock refuses. */
  calendar: { set: boolean; refused: readonly CalendarDay[] } | null;
  /** The supplier's meetings on OTHER events — private to the supplier. */
  supplierMeetings: readonly HeldMeeting[] | null;
  /** This event's meetings (with every supplier). */
  eventMeetings: readonly HeldMeeting[] | null;
  /** Anyone else included (a co-host, a parent): the platform holds no schedule for them. */
  alsoAsked?: readonly string[];
};

/** One busy stretch of a day, minutes after midnight, half-open [from, to). */
export type MeetingBusyRange = { day: CalendarDay; from: number; to: number; busy: DateSheetBusy };

/** THE ANSWER — plain data, so a server component can hand it to the client sheet. */
export type MeetingAvailability = {
  /** Whole days that can never be chosen, and who closes them. */
  closed: Readonly<Record<CalendarDay, DateSheetBusy>>;
  /** Busy stretches inside open days. */
  busy: readonly MeetingBusyRange[];
  /** The people whose schedules were read ("Lumina, You") — the slot list's first line. */
  free: readonly string[];
  /** People with no schedule to read — the ⓘ. */
  missing: readonly string[];
  /** People whose read FAILED — the ⓘ, never "free". */
  unread: readonly string[];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Every civil day in [from, to], at most `MEETING_WINDOW_MAX_DAYS`. */
export function meetingWindowDays(from: CalendarDay, to: CalendarDay): CalendarDay[] {
  const out: CalendarDay[] = [];
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  if (!hit || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return out;
  const at = new Date(Date.UTC(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3])));
  for (let i = 0; i < MEETING_WINDOW_MAX_DAYS; i++) {
    const day = `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
    if (day > to) break;
    out.push(day);
    at.setUTCDate(at.getUTCDate() + 1);
  }
  return out;
}

/** A stored instant → its Manila civil day and `HH:MM` (Manila has no DST: +08:00 exactly). */
export function manilaDayAndTime(iso: string): { day: CalendarDay; start: SheetTime } | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const m = new Date(t + 8 * 3600 * 1000);
  return {
    day: `${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}-${pad(m.getUTCDate())}`,
    start: `${pad(m.getUTCHours())}:${pad(m.getUTCMinutes())}`,
  };
}

/** Fold both sides' raw reads into the one answer the sheet draws. Pure. */
export function foldMeetingAvailability(input: MeetingAvailabilityInput): MeetingAvailability {
  const { viewer, supplierName, hostName } = input;
  /* "You" is the viewer's side; the other side is named and never says why. */
  const supplierSide: DateSheetBusy = { who: viewer === 'supplier' ? DATE_SHEET_YOU : supplierName };
  const hostSide: DateSheetBusy = { who: viewer === 'host' ? DATE_SHEET_YOU : hostName };
  const own = (side: MeetingViewer, label: string): DateSheetBusy => (side === viewer ? { who: DATE_SHEET_YOU, what: label || null } : side === 'supplier' ? supplierSide : hostSide);

  const days = meetingWindowDays(input.from, input.to);
  const inWindow = new Set(days);
  const closed: Record<CalendarDay, DateSheetBusy> = {};
  const busy: MeetingBusyRange[] = [];

  /* The supplier's blocks: an all-day block closes the day; a part of a day refuses only its hours. */
  for (const b of input.blocks ?? []) {
    for (const day of days) {
      if (blockClosesDay(b, day)) closed[day] ??= supplierSide;
      else if (blockTakesPartOfDay(b, day)) {
        const [from, to] = DAY_PART_MINUTES[b.dayPart ?? 'all_day'];
        busy.push({ day, from, to, busy: supplierSide });
      }
    }
  }
  /* The lock's own refusal: booked, full, held — the supplier is not available that day. */
  for (const day of input.calendar?.refused ?? []) if (inWindow.has(day)) closed[day] ??= supplierSide;

  /* Meetings already held. A meeting with THIS supplier on this event is both sides' own — said as yours. */
  const held = (m: HeldMeeting, side: MeetingViewer) => {
    if (!inWindow.has(m.day)) return;
    const from = minutesOf(m.start);
    if (from === null) return;
    const len = m.minutes && m.minutes > 0 ? m.minutes : MEETING_DEFAULT_MIN;
    const whose = m.withThisSupplier ? { who: DATE_SHEET_YOU, what: m.label || null } : own(side, m.label);
    busy.push({ day: m.day, from, to: Math.min(24 * 60, from + len), busy: whose });
  };
  for (const m of input.supplierMeetings ?? []) held(m, 'supplier');
  for (const m of input.eventMeetings ?? []) held(m, 'host');

  /* Who was read, who has nothing to read, whose read failed. */
  const supplierRead = input.blocks !== null && input.calendar !== null && input.supplierMeetings !== null;
  const hostRead = input.eventMeetings !== null;
  const free: string[] = [];
  const missing: string[] = [];
  const unread: string[] = [];
  const supplierWord = supplierSide.who;
  const hostWord = hostSide.who;
  if (!supplierRead) unread.push(supplierWord);
  else if (viewer === 'host' && input.calendar && !input.calendar.set && (input.blocks?.length ?? 0) === 0) missing.push(supplierWord);
  else free.push(supplierWord);
  if (!hostRead) unread.push(hostWord);
  else free.push(hostWord);
  for (const name of input.alsoAsked ?? []) if (name.trim() && !missing.includes(name.trim())) missing.push(name.trim());

  /* "You" reads last in every list ("Free for Lumina, You"). */
  const youLast = (l: string[]) => [...l.filter((w) => w !== DATE_SHEET_YOU), ...l.filter((w) => w === DATE_SHEET_YOU)];
  return { closed, busy, free: youLast(free), missing, unread: youLast(unread) };
}

/** The sheet's `refuse`: a closed day's reason ("Lumina is not available this date"), else null. */
export function meetingRefusal(av: MeetingAvailability): DateSheetRefusal {
  return (day) => {
    const b = av.closed[day];
    return b ? busyWords(b) : null;
  };
}

/** Who is busy for a meeting of `lengthMin` starting at `time` on `day` — your own clash first, then the others. */
export function meetingBusyAt(av: MeetingAvailability, day: CalendarDay, time: SheetTime, lengthMin: number): DateSheetBusy | null {
  const closed = av.closed[day];
  if (closed) return closed;
  const s = minutesOf(time);
  if (s === null) return null;
  const e = s + Math.max(1, lengthMin);
  let other: DateSheetBusy | null = null;
  for (const r of av.busy) {
    if (r.day !== day || !(s < r.to && e > r.from)) continue;
    if (r.busy.who === DATE_SHEET_YOU) return r.busy;
    other ??= r.busy;
  }
  return other;
}

/** The sheet's `slots`: the screen's times, who is busy at each, and who was read. */
export function meetingSlots(av: MeetingAvailability, times: readonly SheetTime[], lengthMin = 30): DateSheetSlots {
  return { times, busy: (day, time) => meetingBusyAt(av, day, time, lengthMin), free: av.free };
}

/** "Lumina's schedule could not be read — check with them" · '' when every read came back. */
export function unreadScheduleWords(names: readonly string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return names[0] === DATE_SHEET_YOU ? 'Your schedule could not be read — check it yourself' : `${names[0]}'s schedule could not be read — check with them`;
  const who = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${who}'s schedules could not be read — check with them`;
}

/** The ⓘ's availability words: who has no schedule, whose could not be read. '' when nothing is missing. */
export function meetingAboutWords(av: MeetingAvailability): string {
  return [missingScheduleWords(av.missing), unreadScheduleWords(av.unread)].filter(Boolean).join('. ');
}

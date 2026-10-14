/**
 * suppliers-fact-sheets.ts — the date sheet and the place sheet ON the Suppliers page (PR5; corpus
 * `SUPPLIERS_HANDOFF_2026-10-07_fable.md` § PR5, prototype `suppliers_date_place_help_tour_2026-10-10.html`, owner
 * rulings 2026-10-10 answers 7–10).
 *
 *   7  a date saved here WAITS for the Event Hub's Apply — it goes into the draft through the one draft door
 *      (`hubDraftAction`), never past it; guests, Home and suppliers read the live date until Apply;
 *   8  Help me choose offers only the days EVERY PRICED pick is free (`lib/help-me-choose.ts`);
 *   9  a venue typed by hand is only its name and its pin, for guests — it is NOT added to the couple's suppliers;
 *  10  a pending date change (J51) shows here too — on the line and in the sheet.
 *
 * Pure: the shapes the one read (`vendors/_actions/fact-sheet.ts`) hands the sheets, and the ladder's words.
 */
import type { DateChangeView } from './date-change';
import type { MatrixDate } from './schedule-matrix';
import type { VenueChoice, VenueSlotKey } from './event-venues';

export type FactSheetKey = 'date' | 'place';

/** One rung of the ladder ("It gets sharper as you book"): lit when it is known. */
export type LadderRung = { key: string; on: boolean; label: string; value: string; note?: string | null };

export type HelpDays = {
  /** The month compared ('YYYY-MM'). */
  month: string;
  /** The days offered, best first — only days every priced pick is free (and every booked supplier can do). */
  days: MatrixDate[];
  /** How many priced picks the days were checked against. */
  pricedCount: number;
  /** Suppliers off Setnayan (their calendars cannot be read). */
  offPlatformCount: number;
};

export type DateSheetData = {
  /** The date as the couple is working on it — the draft over the live row. */
  date: string | null;
  precision: 'day' | 'month' | 'year' | null;
  /** The draft holds a date the guests do not see yet (it waits for Apply). */
  drafted: boolean;
  ceremonyTime: string | null;
  /** Booked suppliers (`CONFIRMED_VENDOR_STATUSES`) — a day they cannot do is asked of them, never moved. */
  bookedNames: string[];
  /**
   * The day those bookings actually hold — the LIVE event date (a draft never books anyone; bookings stay on the
   * live row). Null when nobody is booked or the live date is not a day. "held by …" is said only of THIS day.
   */
  bookedDay: string | null;
  /** The open date-change request (J51), or null. */
  change: DateChangeView | null;
  /** Help me choose's days — null when there is no month to compare yet, or 'unread' when the calendars failed. */
  help: HelpDays | null | 'unread';
};

export type PlaceSlot = {
  slot: VenueSlotKey;
  label: string;
  /** The booked supplier as offered — their name, address and whether their record carries a pin. */
  booked: { name: string; address: string | null; pinned: boolean } | null;
  /** The couple's choice for this card (supplier's details or their own). */
  choice: VenueChoice;
  /** Typed by hand — name, street address, pin. */
  typed: string;
  address: string;
  pin: { lat: number; lng: number } | null;
  columns: { name: string; address: string; lat: string; lng: string };
};

export type PlaceSheetData = {
  /** The reception's City or area — null where the event type has no such line. */
  city: string | null;
  slots: PlaceSlot[];
};

export type FactSheetData =
  | { ok: true; which: 'date'; date: DateSheetData }
  | { ok: true; which: 'place'; place: PlaceSheetData }
  | { ok: false; error: string };

const MONTH: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric', timeZone: 'UTC' };
const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };

function utc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

/** "Fri, Dec 18, 2026" — the line's own day words. */
export function dayWords(iso: string): string {
  const d = utc(iso);
  return d ? d.toLocaleDateString('en-US', DAY) : iso;
}

/** "2:30 PM" from "14:30". */
export function timeWords(hhmm: string | null): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** The date's ladder: Year → Month → Day → Time (a rung is lit when known; the Day names who holds it). */
export function dateLadder(d: Pick<DateSheetData, 'date' | 'precision' | 'ceremonyTime' | 'bookedNames' | 'bookedDay'>): LadderRung[] {
  const at = d.date ? utc(d.date) : null;
  const p = d.precision;
  // Only the day the booking holds is "held by" it — a drafted day nobody booked is not (batch-5 walk W2).
  const heldBy =
    d.bookedNames.length > 0 && p === 'day' && !!d.date && !!d.bookedDay && d.date.slice(0, 10) === d.bookedDay.slice(0, 10)
      ? `held by ${d.bookedNames[0]}’s booking`
      : null;
  const time = timeWords(d.ceremonyTime);
  return [
    { key: 'year', on: !!at, label: 'Year', value: at ? String(at.getUTCFullYear()) : 'not yet' },
    { key: 'month', on: !!at && p !== 'year', label: 'Month', value: at && p !== 'year' ? at.toLocaleDateString('en-US', MONTH) : 'not yet' },
    { key: 'day', on: !!at && p === 'day', label: 'Day', value: at && p === 'day' ? dayWords(d.date!) : 'not yet', note: heldBy },
    { key: 'time', on: !!time, label: 'Time', value: time ? `${time} ceremony` : 'ceremony, after the day' },
  ];
}

/** The place's ladder: City or area → Reception → Ceremony (no Region rung — none is shipped; PR5 "do not invent one"). */
export function placeLadder(p: PlaceSheetData): LadderRung[] {
  const rungs: LadderRung[] = [];
  if (p.city !== null) rungs.push({ key: 'city', on: !!p.city, label: 'City or area', value: p.city || 'not yet' });
  for (const s of p.slots) {
    const own = !s.booked || s.choice.source === 'own';
    const name = own ? s.typed.trim() : s.booked!.name;
    rungs.push({
      key: s.slot,
      on: !!name,
      label: s.label,
      value: name || 'not yet',
      note: name ? (s.booked && !own ? 'booked' : 'typed by you · for guests') : null,
    });
  }
  return rungs;
}

/** The note a saved date leaves (ruling 7: it waits for Apply). */
export function savedDateNote(bookedCount: number): string {
  return bookedCount > 0
    ? 'Saved to your draft — your booked suppliers can do this day. They are told when you Apply.'
    : 'Saved to your draft — guests see it when you Apply your Event Hub.';
}

/** The words on the line next to a date that waits in the draft. */
export const DRAFTED_DATE_WORD = 'in your draft';
/** The words on the line while a date change is asked (ruling 10). */
export const CHANGE_ASKED_WORD = 'change asked';

/** Any part of the page opens a sheet by this event — Build's "Help me choose" / "Set the date" do (`FactLine` listens). */
export const SUPPLIERS_FACT_SHEET_EVENT = 'setnayan:suppliers-fact-sheet';
export function openSuppliersFactSheet(which: FactSheetKey, help = false): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SUPPLIERS_FACT_SHEET_EVENT, { detail: { which, help } }));
}

/**
 * The date the Event Hub DRAFT holds, when it differs from the live row — what the Suppliers page plans on until Apply
 * (answer 7). Null when the draft holds no date of its own, or the same one guests already see.
 */
export function draftedEventDate(
  live: { event_date?: string | null; event_date_precision?: string | null } | null,
  draft: { events: Record<string, unknown> } | null,
): { date: string | null; precision: 'day' | 'month' | 'year' } | null {
  if (!live || !draft) return null;
  const ev = draft.events;
  if (!('event_date' in ev) && !('event_date_precision' in ev)) return null;
  const date = 'event_date' in ev ? (typeof ev.event_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(ev.event_date) ? ev.event_date.slice(0, 10) : null) : (live.event_date ?? null);
  const rawP = 'event_date_precision' in ev ? ev.event_date_precision : live.event_date_precision;
  const precision = rawP === 'month' || rawP === 'year' ? rawP : 'day';
  const liveP = live.event_date_precision === 'month' || live.event_date_precision === 'year' ? live.event_date_precision : 'day';
  if (date === (live.event_date?.slice(0, 10) ?? null) && precision === liveP) return null;
  return { date, precision };
}

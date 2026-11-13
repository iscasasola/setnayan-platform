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
import { daysBetweenIso, optionEnd, optionWords, shortDayWords } from './event-date-options';

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
  /** The event's date — saved at once, never drafted (owner 2026-11-05). */
  date: string | null;
  precision: 'day' | 'month' | 'year' | null;
  ceremonyTime: string | null;
  /** Booked suppliers (`CONFIRMED_VENDOR_STATUSES`) — a day they cannot do is asked of them, never moved. */
  bookedNames: string[];
  /**
   * The day those bookings actually hold — the event's date. Null when nobody is booked or the date is not a day.
   * "held by …" is said only of THIS day.
   */
  bookedDay: string | null;
  /** The open date-change request (J51), or null. */
  change: DateChangeView | null;
  /** Help me choose's days — null when there is no month to compare yet, or 'unread' when the calendars failed. */
  help: HelpDays | null | 'unread';
  /** 📅 The main span's last day (`event_end_date`) — null = a one-day event (owner 2026-11-13). */
  endDate?: string | null;
  /** How many days the event runs (`event_days`, 1 = one day). */
  days?: number;
  /** The type's cap (`event_type_profiles.max_days`) — 1 = no "How many days?" step and no Last day. */
  maxDays?: number;
  /** The options being considered (A few dates) — the event's own columns. */
  options?: {
    mode: 'specific' | 'window';
    candidates: string[];
    windowStart: string | null;
    windowEnd: string | null;
  };
  /** 💍 The founders' account: days start today, not on the first event day. */
  dateExempt?: boolean;
};

export type PlaceSlot = {
  slot: VenueSlotKey;
  label: string;
  /** The booked supplier as offered — their name, address and whether their record carries a pin. */
  booked: {
    name: string;
    address: string | null;
    pinned: boolean;
    /** 📍 Whose pin it is (`lib/venue-pin-door.ts`, owner 2026-10-22) — a shop's is the shop's; a manual supplier's is set on its card. */
    pinFrom?: 'shop' | 'manual' | 'directory' | null;
    /** The booking (`event_vendors.vendor_id`) a manual card's pin is saved through. */
    vendorId?: string | null;
    /** The pin on the record — what a manual card's field opens on. */
    pin?: { lat: number; lng: number } | null;
  } | null;
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
  /**
   * 📍 A NON-WEDDING'S CITY OR AREA = ITS REGION (owner 2026-11-13, DECISION_LOG "DATE EDIT PROTOTYPE APPROVED … ONE
   * CITY OR AREA"): where the type has no reception city line (`city` null), the sheet's City or area writes ONE value —
   * `events.region`, the Region in ⚙ Event settings — through `updateEventMatchCriteria`. `value` is the stored slug,
   * `label` its name. Absent/null where the reception city line is shown instead.
   */
  region?: { value: string | null; label: string | null } | null;
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
export function dateLadder(
  d: Pick<DateSheetData, 'date' | 'precision' | 'ceremonyTime' | 'bookedNames' | 'bookedDay'> &
    Partial<Pick<DateSheetData, 'endDate' | 'days' | 'options'>>,
): LadderRung[] {
  const at = d.date ? utc(d.date) : null;
  const p = d.precision;
  /* 📅 No date yet, but OPTIONS (owner 2026-11-13): Year and Month light from the options; Day says what is considered. */
  if (!at && d.options) {
    const n = Math.max(1, d.days ?? 1);
    const o = d.options;
    const starts = o.mode === 'specific' ? [...o.candidates].sort() : o.windowStart && o.windowEnd ? [o.windowStart, o.windowEnd] : [];
    const edges = o.mode === 'specific' ? [...starts, ...starts.map((x) => optionEnd(x, n))] : starts;
    const dates = edges.map(utc).filter((x): x is Date => !!x).sort((x, y) => x.getTime() - y.getTime());
    if (dates.length) {
      const uniq = (xs: string[]) => [...new Set(xs)];
      const years = uniq(dates.map((x) => String(x.getUTCFullYear())));
      const months = uniq(dates.map((x) => x.toLocaleDateString('en-US', MONTH)));
      const span = (xs: string[]) => (xs.length > 1 ? `${xs[0]} – ${xs[xs.length - 1]}` : xs[0]!);
      const considering =
        o.mode === 'specific'
          ? `considering ${starts.length} ${n > 1 ? `${starts.length === 1 ? 'option' : 'options'} of ${n} days` : starts.length === 1 ? 'date' : 'dates'}: ${starts.map((x) => optionWords(x, n)).join(' · ')}`
          : `considering ${shortDayWords(starts[0]!)} – ${shortDayWords(starts[1]!)}${n > 1 ? `, for a ${n}-day block` : ''}`;
      const time = timeWords(d.ceremonyTime);
      return [
        { key: 'year', on: true, label: 'Year', value: span(years) },
        { key: 'month', on: true, label: 'Month', value: span(months) },
        { key: 'day', on: false, label: n > 1 ? 'Days' : 'Day', value: 'not yet', note: considering },
        { key: 'time', on: !!time, label: 'Time', value: time ? `${time} ceremony` : 'ceremony, after the day' },
      ];
    }
  }
  // Only the day the booking holds is "held by" it — a drafted day nobody booked is not (batch-5 walk W2).
  const heldBy =
    d.bookedNames.length > 0 && p === 'day' && !!d.date && !!d.bookedDay && d.date.slice(0, 10) === d.bookedDay.slice(0, 10)
      ? `held by ${d.bookedNames[0]}’s booking`
      : null;
  const time = timeWords(d.ceremonyTime);
  return [
    { key: 'year', on: !!at, label: 'Year', value: at ? String(at.getUTCFullYear()) : 'not yet' },
    { key: 'month', on: !!at && p !== 'year', label: 'Month', value: at && p !== 'year' ? at.toLocaleDateString('en-US', MONTH) : 'not yet' },
    spanRung(d, at, p, heldBy),
    { key: 'time', on: !!time, label: 'Time', value: time ? `${time} ceremony` : 'ceremony, after the day' },
  ];
}

/** The Day rung — one day, or the main span "Sat, Dec 19, 2026 – Sun, Dec 20, 2026 · 2 days" (owner 2026-11-13). */
function spanRung(
  d: { date: string | null; endDate?: string | null },
  at: Date | null,
  p: DateSheetData['precision'],
  heldBy: string | null,
): LadderRung {
  if (!at || p !== 'day') return { key: 'day', on: false, label: 'Day', value: 'not yet', note: heldBy };
  const end = d.endDate && d.endDate.slice(0, 10) > d.date!.slice(0, 10) ? d.endDate.slice(0, 10) : null;
  if (!end) return { key: 'day', on: true, label: 'Day', value: dayWords(d.date!), note: heldBy };
  const n = daysBetweenIso(d.date!.slice(0, 10), end) + 1;
  return { key: 'day', on: true, label: 'Days', value: `${dayWords(d.date!)} – ${dayWords(end)} · ${n} days`, note: heldBy };
}

/** The place's ladder: City or area → Reception → Ceremony (no Region rung — none is shipped; PR5 "do not invent one"). */
export function placeLadder(p: PlaceSheetData): LadderRung[] {
  const rungs: LadderRung[] = [];
  if (p.city !== null) rungs.push({ key: 'city', on: !!p.city, label: 'City or area', value: p.city || 'not yet' });
  else if (p.region) rungs.push({ key: 'city', on: !!p.region.value, label: 'City or area', value: p.region.label || p.region.value || 'not yet' });
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

/** The note a saved date leaves — it is the event's date at once (owner 2026-11-05, "it shouldn't rely on the hub"). */
export function savedDateNote(bookedCount: number): string {
  return bookedCount > 0
    ? 'Saved — your booked suppliers can do this day, and each of them is told it moved.'
    : 'Saved — this is your date now, everywhere: Home, your suppliers and your Event Hub.';
}

/** The words on the line while a date change is asked (ruling 10). */
export const CHANGE_ASKED_WORD = 'change asked';

/** Any part of the page opens a sheet by this event — Build's "Help me choose" / "Set the date" do (`FactLine` listens). */
export const SUPPLIERS_FACT_SHEET_EVENT = 'setnayan:suppliers-fact-sheet';
export function openSuppliersFactSheet(which: FactSheetKey, help = false): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SUPPLIERS_FACT_SHEET_EVENT, { detail: { which, help } }));
}


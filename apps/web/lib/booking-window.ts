/**
 * booking-window.ts — HOW FAR AWAY A SHOP TAKES BOOKINGS, DECIDED PURELY (owner 2026-11-19, DECISION_LOG "HOW FAR AWAY
 * A SHOP TAKES BOOKINGS: AT LEAST AND AT MOST, EMPTY AT MOST = 3 YEARS"; approved drawing
 * `prototypes/schedule_questions_placement_2026-11-19.html` §5 + the units answer, "OK all").
 *
 * Owner, verbatim: *"how far away min max: from 7 days - 2 years."* · *"at least and at most"* · *"if at most is not
 * set. you can book up to 3 years from now"*.
 *
 * ONE shop setting, every card (Clients ⚙ › Teams and days):
 *   · At least — days of notice before the event (`vendor_profiles.booking_min_days`). Empty = the same day (gap D).
 *     Picks: Same day · 3 · 7 · 14 · 30 days.
 *   · At most  — how far ahead, in months (`vendor_profiles.booking_max_months`). Empty = 3 years. Picks: 6 months ·
 *     1 · 2 · 3 years. It replaces the fixed `CHECK_DATE_MONTHS_AHEAD = 37`.
 *
 * Who reads it: the couple's date checks — Check a date (`lib/check-a-date.server.ts`) and Find
 * (`lib/bench-bookable-days.server.ts`) — and the ask (`finalizeVendor`), where a card's own "Order at least N days
 * before" (`orderIsTooSoon`) can only make its card STRICTER than the shop's At least, never looser.
 */

/** Empty At most = 3 years (owner: "if at most is not set. you can book up to 3 years from now"). */
export const BOOKING_MAX_MONTHS_DEFAULT = 36;

/** The At least picks, in days (drawing §"At least / At most: in what units?"). 0 = the same day. */
export const AT_LEAST_DAY_PICKS = [0, 3, 7, 14, 30] as const;
/** The At most picks, in months. */
export const AT_MOST_MONTH_PICKS = [6, 12, 24, 36] as const;

/** The shop's window, read. `minDays` 0 = the same day; `maxMonths` is never empty (36 when unset). */
export type BookingWindow = { minDays: number; maxMonths: number };

/** The window a shop with no setting has: the same day, up to 3 years. */
export const OPEN_BOOKING_WINDOW: BookingWindow = { minDays: 0, maxMonths: BOOKING_MAX_MONTHS_DEFAULT };

/** The two columns as stored, and the window they mean. Anything out of range reads as unset. */
export function bookingWindowOf(row: { booking_min_days?: number | null; booking_max_months?: number | null } | null | undefined): BookingWindow {
  const min = row?.booking_min_days;
  const max = row?.booking_max_months;
  return {
    minDays: typeof min === 'number' && Number.isInteger(min) && min >= 0 && min <= 30 ? min : 0,
    maxMonths: typeof max === 'number' && Number.isInteger(max) && max >= 1 && max <= 36 ? max : BOOKING_MAX_MONTHS_DEFAULT,
  };
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** `day` + `n` civil days. */
export function addCivilDays(day: string, n: number): string {
  const hit = DAY_RE.exec(day);
  if (!hit) return day;
  return iso(new Date(Date.UTC(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3]) + n)));
}

/** `day` + `n` months, the day of the month kept — or the month's last day when it has fewer (31 Jan + 1 = 28/29 Feb). */
export function addCivilMonths(day: string, n: number): string {
  const hit = DAY_RE.exec(day);
  if (!hit) return day;
  const at = Number(hit[1]) * 12 + (Number(hit[2]) - 1) + n;
  const y = Math.floor(at / 12);
  const m = at % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(Number(hit[3]), last))));
}

/** The first and the last day a couple can book, from `today`. */
export function bookingWindowSpan(today: string, w: BookingWindow): { first: string; last: string } {
  return { first: addCivilDays(today, w.minDays), last: addCivilMonths(today, w.maxMonths) };
}

/** Is `day` outside the shop's window? `too_soon` · `too_far` · null (inside, or not a civil day). */
export function outsideBookingWindow(day: string, today: string, w: BookingWindow): 'too_soon' | 'too_far' | null {
  if (!DAY_RE.test(day)) return null;
  const span = bookingWindowSpan(today, w);
  if (day < span.first) return 'too_soon';
  if (day > span.last) return 'too_far';
  return null;
}

/** The days from `today` up to the day before At least allows — read as Not bookable by Check a date. */
export function tooSoonDays(today: string, w: BookingWindow): string[] {
  const out: string[] = [];
  for (let i = 0; i < w.minDays; i++) out.push(addCivilDays(today, i));
  return out;
}

/** How many calendar months, counting today's, reach `last` (Check a date's month list). */
export function monthsToReach(today: string, last: string): number {
  const a = DAY_RE.exec(today);
  const b = DAY_RE.exec(last);
  if (!a || !b) return 1;
  return Math.max(1, (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) + 1);
}

/** "Same day" · "7 days" — an At least pick in the supplier's words. */
export function atLeastWords(days: number): string {
  return days <= 0 ? 'Same day' : `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** "6 months" · "1 year" · "3 years" — an At most pick in the supplier's words. */
export function atMostWords(months: number): string {
  if (months % 12 === 0) {
    const y = months / 12;
    return `${y} ${y === 1 ? 'year' : 'years'}`;
  }
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

/** What the couple reads when the date is outside the shop's window (the ask's refusal). */
export function bookingWindowMessage(kind: 'too_soon' | 'too_far', w: BookingWindow): string {
  return kind === 'too_soon'
    ? `This supplier takes bookings at least ${atLeastWords(w.minDays)} before the date. Pick a later date, or ask another supplier.`
    : `This supplier takes bookings up to ${atMostWords(w.maxMonths)} ahead. Ask again closer to the date, or ask another supplier.`;
}

/**
 * The two picks as posted by the Teams and days row → the columns to store, or null when either is not a pick.
 * The empty answers are stored empty: Same day → NULL, 3 years → NULL ("empty At most = 3 years").
 */
export function bookingWindowFromForm(minRaw: string, maxRaw: string): { booking_min_days: number | null; booking_max_months: number | null } | null {
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!(AT_LEAST_DAY_PICKS as readonly number[]).includes(min)) return null;
  if (!(AT_MOST_MONTH_PICKS as readonly number[]).includes(max)) return null;
  return {
    booking_min_days: min === 0 ? null : min,
    booking_max_months: max === BOOKING_MAX_MONTHS_DEFAULT ? null : max,
  };
}

/**
 * Find's half: for each shop's cards, the (card, day) pairs the shop's window refuses — so a card is never shown free
 * on a day its shop does not take (`lib/bench-bookable-days.server.ts`). A shop with no window read is not refused here.
 */
export function windowRefusals(
  cardsBySupplier: ReadonlyMap<string, readonly string[]>,
  windows: ReadonlyMap<string, BookingWindow>,
  days: readonly string[],
  today: string,
): { card: string; day: string }[] {
  const out: { card: string; day: string }[] = [];
  for (const [supplier, cards] of cardsBySupplier) {
    const w = windows.get(supplier);
    if (!w) continue;
    for (const day of days) {
      if (day < today || !outsideBookingWindow(day, today, w)) continue;
      for (const card of cards) out.push({ card, day });
    }
  }
  return out;
}

/** Today in the Philippines, midnight to midnight — the day the window counts from (the same as `checkDateToday`). */
export function windowToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

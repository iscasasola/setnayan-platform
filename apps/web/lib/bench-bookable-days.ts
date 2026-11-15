/**
 * bench-bookable-days — which suppliers leave the couple's bench SEARCH because
 * they have no booking left on the couple's date. Register session H6.
 *
 * Owner, 2026-09-11: *"if there are no more available booking for that day for
 * that service card, it should not show"* · with only a month chosen, *"Hide
 * only if full all month"*.
 *
 * PURE. The refusals themselves come from `service_cards_unbookable_on()`
 * (migration 20271221805341), which restates what the booking path refuses;
 * this module decides only WHICH days to ask about and WHO leaves the list.
 *
 *   • A day-precise date      → ask about the main span, event_date →
 *                               event_end_date (one day when single-day).
 *   • No date yet, candidates → ask about each candidate (2026-11-13: a
 *                               supplier free on ANY ONE candidate stays).
 *   • No date yet, a window   → ask about every day of the window (≤31).
 *   • A month-precise date    → ask about every day of that month; a supplier
 *                               leaves only when EVERY day is refused.
 *   • A year, or no date      → ask nothing, hide nobody.
 *   • Accommodation           → every night of the span ±1 day must be free
 *                               (one full night hides); before booking, some
 *                               candidate/window day ±1 must be wholly free.
 *
 * A supplier leaves only when EVERY one of their in-scope cards is refused on
 * EVERY day in scope — one open card on one open day keeps them. A supplier the
 * couple already knows (on their list, in conversation, booked) never leaves
 * the search here: those are the H5 surfaces, which say "not available" rather
 * than disappear, and it keeps the couple's OWN booking from hiding its supplier.
 */

import { expandRange, resolveProbeWindow } from './build-date-window';

/** The function's input caps (raises above them — see the migration). */
export const UNBOOKABLE_MAX_CARDS = 100;
export const UNBOOKABLE_MAX_DAYS = 31;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * WHAT THE FIT CHECK READS OFF THE EVENT (owner 2026-11-13, DECISION_LOG "ONE MAIN DATE SPAN PER EVENT" and
 * "FIND KEEPS A SUPPLIER FREE ON ANY ONE CANDIDATE DATE"). Every field is the event row's own column:
 *   eventDate / precision   events.event_date · event_date_precision
 *   endDate                 events.event_end_date — the main span's last day (multi-day events)
 *   candidates              events.date_candidates — the 1–4 options before a venue is booked
 *   windowStart / windowEnd events.date_window_start / _end — a ≤30-day range, the other "before" shape
 */
export type EventFitDates = {
  eventDate: string | null | undefined;
  precision: string | null | undefined;
  endDate?: string | null;
  candidates?: unknown;
  windowStart?: string | null;
  windowEnd?: string | null;
};

/** The category whose supplier must be free EVERY night of the span widened by one day each side. */
export const ACCOMMODATION_CATEGORY = 'accommodation';

/**
 * The event's days the hide judged on, and what shape they came in:
 *   day    one day-precise date                   any card free that day keeps the supplier
 *   span   event_date → event_end_date            free on ANY day of the span keeps (quoted per day)
 *   dates  the candidate dates (before booking)   free on ANY ONE candidate keeps
 *   range  the date window (before booking)       free on ANY day of the window keeps
 *   month  a month-precise date                   free on ANY day of the month keeps ("hide only if full all month")
 * Accommodation reads the same days through `fitOptions` (every night ±1).
 */
export type UnbookableScope = { kind: 'day' | 'span' | 'dates' | 'range' | 'month'; days: string[] };

/**
 * The days to judge, or null when the event's date is too loose to judge (a year, nothing at all). Order:
 *   1  a day-precise `event_date` — the ONE main span, `event_date → COALESCE(event_end_date, event_date)`;
 *   2  else the candidate dates (parsed by `resolveProbeWindow`, the "Help me choose" layer's own parser);
 *   3  else the date window, `date_window_start → date_window_end` (judged only when ≤ 31 days);
 *   4  else a month-precise date — every day of that month.
 * Calendar arithmetic only — no clock, no time zone: the dates are the event's own DATE columns.
 */
export function fitDateScope(ev: EventFitDates): UnbookableScope | null {
  const { eventDate, precision } = ev;
  if (eventDate && ISO_DAY.test(eventDate) && precision === 'day') {
    const end = ev.endDate && ISO_DAY.test(ev.endDate) && ev.endDate > eventDate ? ev.endDate : eventDate;
    const days = expandRange(eventDate, end).slice(0, UNBOOKABLE_MAX_DAYS);
    return { kind: days.length > 1 ? 'span' : 'day', days };
  }

  const candidates = Array.isArray(ev.candidates) ? (ev.candidates as string[]) : null;
  const probe = candidates ? resolveProbeWindow({ eventDate: null, precision: null, candidates }) : null;
  if (probe && probe.dayKeys.length > 0) return { kind: 'dates', days: probe.dayKeys.slice(0, UNBOOKABLE_MAX_DAYS) };

  const ws = ev.windowStart;
  if (ws && ISO_DAY.test(ws)) {
    const we = ev.windowEnd && ISO_DAY.test(ev.windowEnd) && ev.windowEnd >= ws ? ev.windowEnd : ws;
    const days = expandRange(ws, we);
    if (days.length > 0 && days.length <= UNBOOKABLE_MAX_DAYS) return { kind: 'range', days };
  }

  if (!eventDate || precision !== 'month') return null;
  const m = ISO_DAY.exec(eventDate);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!(month >= 1 && month <= 12)) return null;
  // Day 0 of the next month is the last day of this one.
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { kind: 'month', days: Array.from({ length }, (_, i) => `${m[1]}-${mm}-${String(i + 1).padStart(2, '0')}`) };
}

/**
 * The days to ask about, or null when the couple's date is too loose to judge — `fitDateScope` read off the date
 * alone (no span, no candidates, no window). Kept for the callers that only hold the date.
 */
export function unbookableDateScope(
  eventDate: string | null | undefined,
  precision: string | null | undefined,
): string[] | null {
  return fitDateScope({ eventDate, precision })?.days ?? null;
}

/**
 * The date(s) a hide judged on, said the way a sentence needs them (owner 2026-11-13, "we only show what fits" —
 * an empty list says WHICH date nobody is free on, `lib/supplier-find-empty.ts`). Null exactly when
 * `unbookableDateScope` is null: the two can never disagree because both are `fitDateScope`.
 */
export function describeUnbookableScope(
  eventDate: string | null | undefined,
  precision: string | null | undefined,
): UnbookableScope | null {
  return fitDateScope({ eventDate, precision });
}

/** A YYYY-MM-DD key moved by `n` calendar days (UTC arithmetic on a date, never a clock). */
export function shiftDay(day: string, n: number): string {
  const m = ISO_DAY.exec(day);
  if (!m) return day;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * THE OPTIONS A CARD IS JUDGED AGAINST — each option is a BLOCK of days (owner 2026-11-13: "each candidate option
 * becomes a block of N consecutive days" — the day count is not stored yet, so today every candidate / window / month
 * day is a block of one, and a set date's main span is ONE block):
 *   • every category but accommodation: the span as one block; each candidate / window / month day its own block.
 *     A card fits when it is free on SOME day of SOME block (quoted per day) — `optionFit` says how many;
 *   • accommodation, date set: ONE block — every night of the span widened by a day each side (check-in the day
 *     before, check-out the day after). It fits only when free on ALL of them, so ONE full night hides it;
 *   • accommodation, before booking: one block per candidate / window / month day, that day ±1 — ALL free.
 */
export function fitOptions(scope: UnbookableScope, category: string | null | undefined): string[][] {
  if (scope.days.length === 0) return [];
  const accommodation = category === ACCOMMODATION_CATEGORY;
  if (scope.kind === 'day' || scope.kind === 'span') {
    if (!accommodation) return [[...scope.days]];
    const first = scope.days[0]!;
    const last = scope.days[scope.days.length - 1]!;
    return [expandRange(shiftDay(first, -1), shiftDay(last, 1))];
  }
  return accommodation ? scope.days.map((d) => [shiftDay(d, -1), d, shiftDay(d, 1)]) : scope.days.map((d) => [d]);
}

/** Does a category need EVERY day of a block free (accommodation's nights), or only SOME (a per-day quote)? */
export function needsEveryDay(category: string | null | undefined): boolean {
  return category === ACCOMMODATION_CATEGORY;
}

/** Every day the refusal read must cover: the judged days, plus the ±1 nights when an accommodation card is in play. */
export function fitDaysToAsk(scope: UnbookableScope, withAccommodation: boolean): string[] {
  if (!withAccommodation) return [...scope.days];
  const all = new Set(scope.days);
  for (const option of fitOptions(scope, ACCOMMODATION_CATEGORY)) for (const d of option) all.add(d);
  return [...all].sort();
}

/**
 * HOW WELL ONE BLOCK FITS — free on ALL (`freeDays === totalDays`), SOME, or NONE of its days. The shape the
 * "Free N of your M days" line will read (not drawn yet); free on all ranks ahead of free on some.
 */
export type DayFit = { freeDays: number; totalDays: number };

export function optionFit(card: string, refused: ReadonlySet<string>, option: readonly string[]): DayFit {
  let freeDays = 0;
  for (const day of option) if (!refused.has(refusalKey(card, day))) freeDays += 1;
  return { freeDays, totalDays: option.length };
}

/** Better of two fits: ALL beats SOME; then more free days; then the larger share. */
export function betterFit(a: DayFit | null, b: DayFit): DayFit {
  if (!a) return b;
  const allA = a.freeDays === a.totalDays;
  const allB = b.freeDays === b.totalDays;
  if (allA !== allB) return allA ? a : b;
  if (a.freeDays !== b.freeDays) return a.freeDays > b.freeDays ? a : b;
  return a.totalDays <= b.totalDays ? a : b;
}

/** Does a block's fit keep the card? Accommodation: ALL nights free. Everything else: SOME day free. */
export function fitKeeps(fit: DayFit, everyDay: boolean): boolean {
  return everyDay ? fit.totalDays > 0 && fit.freeDays === fit.totalDays : fit.freeDays > 0;
}

/**
 * A card's best fit across its options, or null when it fits none (no option keeps it). No options (nothing to
 * judge) → a full fit of zero days, which keeps it.
 */
export function cardDayFit(
  card: string,
  refused: ReadonlySet<string>,
  options: readonly (readonly string[])[],
  everyDay = false,
): DayFit | null {
  if (options.length === 0) return { freeDays: 0, totalDays: 0 };
  let best: DayFit | null = null;
  for (const option of options) {
    const fit = optionFit(card, refused, option);
    if (fitKeeps(fit, everyDay)) best = betterFit(best, fit);
  }
  return best;
}

/** Does this card fit? Accommodation-style (`everyDay`) needs a wholly free block; otherwise some free day. */
export function cardFits(
  card: string,
  refused: ReadonlySet<string>,
  options: readonly (readonly string[])[],
  everyDay = false,
): boolean {
  return cardDayFit(card, refused, options, everyDay) !== null;
}

/** The key the refusal set is stored under. */
export function refusalKey(serviceId: string, day: string): string {
  return `${serviceId}@${day}`;
}

/** Per card: its blocks, and whether it needs every day of one (accommodation). */
export type CardOptions = { options: readonly (readonly string[])[]; everyDay: boolean };

/**
 * EACH SUPPLIER'S BEST FIT — the per-option answer (owner 2026-11-13): for every supplier with cards in scope, the
 * best `DayFit` any of their cards reaches, or `null` when none fits. A supplier with no cards in scope is absent
 * (never judged). `scope` is a plain day list (each day a block of one) or a per-card option reader.
 */
export function supplierDayFits(
  cardsBySupplier: ReadonlyMap<string, readonly string[]>,
  refused: ReadonlySet<string>,
  scope: readonly string[] | ((card: string) => CardOptions),
): Map<string, DayFit | null> {
  const out = new Map<string, DayFit | null>();
  const singles: CardOptions | null = typeof scope === 'function' ? null : { options: scope.map((d) => [d]), everyDay: false };
  const optionsOf = typeof scope === 'function' ? scope : () => singles!;
  for (const [supplierId, cards] of cardsBySupplier) {
    if (cards.length === 0) continue;
    let best: DayFit | null = null;
    for (const card of cards) {
      const { options, everyDay } = optionsOf(card);
      const fit = cardDayFit(card, refused, options, everyDay);
      if (fit) best = betterFit(best, fit);
    }
    out.set(supplierId, best);
  }
  return out;
}

/**
 * Suppliers with no booking left: no card fits (`supplierDayFits` → null). A supplier with no cards in scope is
 * never judged (they matched by profile, not by a card the booking path could refuse), and an empty scope hides
 * nobody.
 */
export function suppliersWithNoBookingLeft(
  cardsBySupplier: ReadonlyMap<string, readonly string[]>,
  refused: ReadonlySet<string>,
  scope: readonly string[] | ((card: string) => CardOptions),
): Set<string> {
  const out = new Set<string>();
  if (typeof scope !== 'function' && scope.length === 0) return out;
  for (const [supplierId, fit] of supplierDayFits(cardsBySupplier, refused, scope)) {
    if (fit === null) out.add(supplierId);
  }
  return out;
}

/** Does this search row leave the list? Only strangers with no booking left. */
export function leavesBenchSearch(
  row: { vendorProfileId: string; alreadyAdded: boolean; relationshipDepth: number },
  noBookingLeft: ReadonlySet<string>,
): boolean {
  if (row.alreadyAdded || row.relationshipDepth > 0) return false;
  return noBookingLeft.has(row.vendorProfileId);
}

/** Split into batches of at most `size`. */
export function inBatches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

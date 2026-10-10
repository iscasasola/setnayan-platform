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
 *   • A day-precise date      → ask about that one day.
 *   • Several candidate dates → ask about each of them; a supplier leaves only
 *                               when EVERY candidate is refused (see below).
 *   • A flexible date window  → ask about every day from its start to its
 *                               end; a supplier leaves only when EVERY day of
 *                               the window is refused (see below).
 *   • A month-precise date    → ask about every day of that month; a supplier
 *                               leaves only when EVERY day is refused.
 *   • A year, or no date      → ask nothing, hide nobody.
 *
 * CANDIDATE DATES (2026-10-10). The owner's words are "not available to that
 * date/s". An event that has not settled its day keeps `event_date` NULL and
 * holds its shortlist in `events.date_candidates` (lib/create-event-capture),
 * so reading `event_date` alone asked nothing and hid nobody for those events.
 * ⚠ THE RULE FOR SEVERAL DATES IS THE CONTROLLER'S READING, NOT THE OWNER'S
 * WORDS: a card leaves only when it can be booked on NONE of the candidates —
 * the same shape as his month ruling ("Hide only if full all month"). The
 * order of precedence is copied from `resolveProbeWindow`
 * (lib/build-date-window), which the bench already reads its free days from:
 * a settled day wins, then the candidates, then a month.
 *
 * A FLEXIBLE WINDOW (2026-10-11). The other way an event holds "date/s":
 * `events.date_window_start` … `date_window_end` (`date_mode = 'window'`), with
 * `event_date` NULL. ⚠ THIS READING IS THE CONTROLLER'S, NOT THE OWNER'S WORDS:
 * the same rule as his month ruling — "Hide only if full all month" — so a card
 * leaves only when it cannot be booked on ANY day of the window. It sits in the
 * order after the candidates and before a month (`resolveProbeWindow` itself
 * does not read a window; an explicit start-to-end range is finer than a month).
 * THE CAP IS THE MONTH'S: `UNBOOKABLE_MAX_DAYS` — 31 days in one ask, the limit
 * `service_cards_unbookable_on` itself enforces. The create flow caps a window
 * at 30 days, so a real one fits; a longer one (nothing in the database stops
 * it) is too loose to judge and hides nobody, exactly like too many candidates.
 * A window that is malformed or ends before it starts is ignored.
 *
 * A supplier leaves only when EVERY one of their in-scope cards is refused on
 * EVERY day in scope — one open card on one open day keeps them. A supplier the
 * couple already knows (on their list, in conversation, booked) never leaves
 * the search here: those are the H5 surfaces, which say "not available" rather
 * than disappear, and it keeps the couple's OWN booking from hiding its supplier.
 */

/** The function's input caps (raises above them — see the migration). */
export const UNBOOKABLE_MAX_CARDS = 100;
export const UNBOOKABLE_MAX_DAYS = 31;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The days to ask about, or null when the couple's date is too loose to judge.
 * Calendar arithmetic only — no clock, no time zone: the dates are the event's
 * own DATE column, already a Manila calendar day.
 */
export function unbookableDateScope(
  eventDate: string | null | undefined,
  precision: string | null | undefined,
  /** `events.date_candidates` — the days the couple is still choosing between. */
  candidates?: readonly unknown[] | null,
  /** `events.date_window_start` / `date_window_end` — a flexible range. */
  window?: { start: unknown; end: unknown } | null,
): string[] | null {
  return describeUnbookableScope(eventDate, precision, candidates, window)?.days ?? null;
}

/**
 * The same answer, with WHAT KIND of date it was — so a screen that has to say
 * "nobody is free on …" can name the date the way the couple gave it: one day,
 * the days they are choosing between, a window from one day to another, or a
 * month. `days` is exactly what `unbookableDateScope` returns.
 */
export type UnbookableScope = {
  kind: 'day' | 'days' | 'window' | 'month';
  days: string[];
};

export function describeUnbookableScope(
  eventDate: string | null | undefined,
  precision: string | null | undefined,
  candidates?: readonly unknown[] | null,
  window?: { start: unknown; end: unknown } | null,
): UnbookableScope | null {
  const m = eventDate ? ISO_DAY.exec(eventDate) : null;
  // A settled day is the answer, whatever else the row still carries.
  if (eventDate && m && precision === 'day') return { kind: 'day', days: [eventDate] };

  const picked = [
    ...new Set((candidates ?? []).filter((c): c is string => typeof c === 'string' && ISO_DAY.test(c))),
  ].sort();
  if (picked.length > 0) {
    // More than the function accepts in one ask → too loose to judge. Hide
    // nobody rather than judge a supplier on some of the days.
    if (picked.length > UNBOOKABLE_MAX_DAYS) return null;
    return { kind: picked.length === 1 ? 'day' : 'days', days: picked };
  }

  const span = windowDays(window);
  // `null` = no usable window (fall through to the month); `[]` = a real window
  // longer than one ask accepts (too loose to judge — hide nobody).
  if (span) return span.length > 0 ? { kind: span.length === 1 ? 'day' : 'window', days: span } : null;

  if (!eventDate || !m) return null;
  if (precision !== 'month') return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!(month >= 1 && month <= 12)) return null;
  // Day 0 of the next month is the last day of this one.
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { kind: 'month', days: Array.from({ length }, (_, i) => `${m[1]}-${mm}-${String(i + 1).padStart(2, '0')}`) };
}

/**
 * Every day of a flexible window, start and end included. `null` when there is
 * no usable window; `[]` when it is real but longer than `UNBOOKABLE_MAX_DAYS`.
 * UTC arithmetic on calendar days — no clock, no time zone.
 */
function windowDays(window: { start: unknown; end: unknown } | null | undefined): string[] | null {
  const start = typeof window?.start === 'string' ? ISO_DAY.exec(window.start) : null;
  const end = typeof window?.end === 'string' ? ISO_DAY.exec(window.end) : null;
  if (!start || !end) return null;
  const from = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const to = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  // A date the calendar does not have (2027-02-31) is not a window.
  if (new Date(from).toISOString().slice(0, 10) !== start[0] || new Date(to).toISOString().slice(0, 10) !== end[0]) return null;
  if (to < from) return null;
  const count = Math.round((to - from) / 86_400_000) + 1;
  if (count > UNBOOKABLE_MAX_DAYS) return [];
  return Array.from({ length: count }, (_, i) => new Date(from + i * 86_400_000).toISOString().slice(0, 10));
}

/** The key the refusal set is stored under. */
export function refusalKey(serviceId: string, day: string): string {
  return `${serviceId}@${day}`;
}

/**
 * Suppliers with no booking left: every card refused on every day. A supplier
 * with no cards in scope is never judged (they matched by profile, not by a
 * card the booking path could refuse), and an empty scope hides nobody.
 */
export function suppliersWithNoBookingLeft(
  cardsBySupplier: ReadonlyMap<string, readonly string[]>,
  refused: ReadonlySet<string>,
  days: readonly string[],
): Set<string> {
  const out = new Set<string>();
  if (days.length === 0) return out;
  for (const [supplierId, cards] of cardsBySupplier) {
    if (cards.length === 0) continue;
    const full = cards.every((card) => days.every((day) => refused.has(refusalKey(card, day))));
    if (full) out.add(supplierId);
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

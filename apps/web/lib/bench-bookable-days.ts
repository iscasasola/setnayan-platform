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
 *   • A month-precise date    → ask about every day of that month; a supplier
 *                               leaves only when EVERY day is refused.
 *   • A year, or no date      → ask nothing, hide nobody.
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
): string[] | null {
  if (!eventDate) return null;
  const m = ISO_DAY.exec(eventDate);
  if (!m) return null;
  if (precision === 'day') return [eventDate];
  if (precision !== 'month') return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!(month >= 1 && month <= 12)) return null;
  // Day 0 of the next month is the last day of this one.
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return Array.from({ length }, (_, i) => `${m[1]}-${mm}-${String(i + 1).padStart(2, '0')}`);
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

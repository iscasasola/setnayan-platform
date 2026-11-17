/**
 * 📊 "BOOKED · EVENTS THIS MONTH" — ONE DEFINITION, READ BY TODAY AND BY CLIENTS.
 *
 * Today's stat counts the shop's Setnayan bookings DATED in this Manila month (owner Q2 default, THE ONE BUILD A4;
 * RW-84 says so on the stat). Owner, 16 Nov 2026 (DECISION_LOG 75a46e3c, item 9): pressing it opens Clients
 * **filtered to this month**, so the list shows the SAME number, with "All months" one tap away (EB-219: Today said
 * "0 booked this month" and the door it opened said "6 booked").
 *
 * Both screens take the set from here, over the same read (`fetchVendorRoomEventsDetailed`), so they cannot drift.
 * 🔒 `app/vendor-dashboard/customers/booked-this-month-is-one-number.test.ts`.
 */
export type DatedBooking = { eventId: string; bookedDate: string };

/** Clients' `?within=` value that narrows Booked to this month. */
export const BOOKED_WITHIN_MONTH = 'month';

/** Where Today's "Booked · events this month" leads. */
export const BOOKED_THIS_MONTH_HREF = `/vendor-dashboard/customers?door=booked&within=${BOOKED_WITHIN_MONTH}`;

/** "All months" — Booked with no month. */
export const BOOKED_ALL_MONTHS_HREF = '/vendor-dashboard/customers?door=booked';

/** The distinct events booked on a day in `month` (`YYYY-MM`) — past days of the month included. */
export function bookedEventIdsInMonth(bookings: readonly DatedBooking[], month: string): Set<string> {
  return new Set(bookings.filter((b) => b.bookedDate.slice(0, 7) === month).map((b) => b.eventId));
}

/**
 * THE number — Today's stat and Clients' "booked this month" both print this. A read that could not prove it reached
 * every booking is null ("couldn't load"), never a smaller count and never 0.
 */
export function bookedThisMonthCount(read: { events: readonly DatedBooking[]; complete: boolean } | null, month: string): number | null {
  if (!read || !read.complete) return null;
  return bookedEventIdsInMonth(read.events, month).size;
}

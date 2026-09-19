/**
 * Where a folded route lands on the My Customers hub (S43 · 3).
 *
 * `/vendor-dashboard/bookings` and `/vendor-dashboard/calendar` are redirect
 * stubs into this one page. Without a fragment they reloaded it at the top, so
 * a link that named Bookings or the calendar showed the roster instead. Each
 * fragment here must match an `id` rendered by `customers/page.tsx` —
 * `anchors-land.test.ts` holds the two together.
 */
export const BOOKINGS_ANCHOR = '#bookings';
export const CALENDAR_ANCHOR = '#calendar';

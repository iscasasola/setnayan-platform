/**
 * BOOKINGS ARE CLOSED AT LAUNCH — the words and the pure reading of the switch.
 *
 * OWNER (2026-11-02, supplier gate): *"for now, they cannot add bookings. just
 * create their websites and cater our event if they are part of the event"*.
 *
 * ONE switch: `platform_settings.bookings_open` (migration
 * 20271302310560_bookings_closed_switch.sql). NULL / FALSE = closed (the launch
 * default), TRUE = open — today's behaviour exactly. The admin flips it on
 * /admin/booking-fees. The server read is `areBookingsOpen()` in
 * `bookings-open.server.ts`; the database's own backstop is the trigger
 * `event_vendors_require_bookings_open` (raises `bookings_closed`).
 *
 * ── THE EIGHT DOORS (supplier gate audit 2026-11-02, section B) ─────────────
 *   1 · lock a package            `lockPackage`              (couple)
 *   2 · lock a single service     `finalizeVendor`           (couple)
 *   3 · the wizard's lock         `completeVendorPickFromMarketplace` (couple)
 *   4 · chat "Book"               `lockBookingFromChat`      (couple)
 *   5 · reuse a booking           `reuseBookingForEvent`     (couple)
 *   6 · the supplier's yes        `vendorAgreeToLock`        (supplier)
 *   7 · a Locked QR               `issueLockedQr` → `claimLockedQr`
 *   8 · a payment acknowledgement → the `deposit_acknowledged` fee door
 * `bookings-closed-doors.test.ts` holds each one to this switch.
 *
 * What stays open while closed: a couple's claim approval of a supplier they
 * added themselves (the founders' event — "cater our event"), the couple's own
 * hand-added tracker rows, and every shop page, package and price (shown, with
 * "Bookings open soon" where the Book button was).
 */

/** The one reading of the column: only an explicit TRUE opens bookings. */
export function bookingsOpenFromSetting(value: unknown): boolean {
  return value === true;
}

/** Where a Book / Lock button was. Quiet on purpose — nothing is broken. */
export const BOOKINGS_OPEN_SOON = 'Bookings open soon';

/** A couple who reached a booking door anyway (an old tab, a shared link). */
export const BOOKINGS_CLOSED_COUPLE_MESSAGE =
  'Bookings open soon. You can see every package and price now, save this supplier, and message them — booking opens shortly.';

/** A supplier who reached a booking door (their yes, a Locked QR). */
export const BOOKINGS_CLOSED_SUPPLIER_MESSAGE =
  'Bookings are not open on Setnayan yet, so nothing can be booked or billed. Keep building your page and services — couples can already see them. We will tell you the day bookings open.';

/** The database's refusal, as the trigger words it. */
export function isBookingsClosedError(error: { message?: string | null } | null | undefined): boolean {
  return /bookings_closed/.test(error?.message ?? '');
}

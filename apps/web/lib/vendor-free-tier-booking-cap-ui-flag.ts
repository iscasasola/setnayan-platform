/**
 * vendor-free-tier-booking-cap-ui-flag.ts — the NEXT_PUBLIC flag that switches
 * the couple-facing "Fully booked" LAYER on.
 *
 * ONE flag, on purpose. It decides only whether the couple-facing layer exists
 * at all (the friendly pre-check + the error translation). It does NOT decide
 * whether a booking is refused — that is
 * `platform_settings.free_tier_booking_cap_enabled`, the same row the DB
 * trigger reads, and the pre-check reads THAT ROW directly (see
 * `vendor-free-tier-booking-cap.server.ts`). The pre-check and the trigger
 * therefore agree BY CONSTRUCTION: neither can refuse a booking the other would
 * accept.
 *
 * (An earlier revision carried a SECOND env flag —
 * `isVendorFullyBookedPreCheckEnabled`, gated on
 * `NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP` — standing in for the DB switch. It was
 * DELETED 2026-07-26: an env flag cannot track a DB column, so every mismatch
 * was a real defect. Env off + DB switch on → the couple was asked for a
 * downpayment, paid out-of-band, and the lock was refused at the write with no
 * ledger row. Env on + DB switch off → every free vendor holding 3 rows was
 * refused while the trigger sat inert.)
 *
 * Default OFF → every lock path behaves byte-identically to today: no extra
 * read, no new result branch, no copy change.
 */
export function isVendorFullyBookedUiEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_FULLY_BOOKED_UI;
  return v === '1' || v === 'true';
}

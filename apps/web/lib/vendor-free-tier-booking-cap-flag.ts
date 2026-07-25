/**
 * vendor-free-tier-booking-cap-flag.ts — the NEXT_PUBLIC flag that switches the
 * live lock/book path onto the free-tier concurrent-booking cap
 * (`vendor-free-tier-booking-cap.ts`).
 *
 * NEXT_PUBLIC so the couple-facing "Fully booked" state and the server-side lock
 * guard agree. Default OFF → the cap is inert and locking behaves exactly as
 * today; nothing changes until the owner flips it. Kept in its own file so the
 * cap logic module stays I/O-free and `tsx --test`-friendly.
 */
export function isVendorFreeTierBookingCapEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_FREE_BOOKING_CAP;
  return v === '1' || v === 'true';
}

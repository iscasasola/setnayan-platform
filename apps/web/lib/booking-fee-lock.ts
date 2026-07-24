/**
 * Booking-Fee LOCK path — pure helpers + the free-5 decision. NO database, NO
 * `server-only`, so the safety-critical rules are unit-testable and the
 * service_key parser is importable by the (server) settle hook AND the tests.
 *
 * The owner moved the fee TRIGGER from proposal SEND to the vendor LOCK
 * (event_vendors → contracted). Fee base = the COUPLE-CONFIRMED agreed total
 * (event_vendors.total_cost_php). Rate = flat 5% / no cap (lib/booking-fee.ts).
 * A verified vendor's first 5 booked customers pay NOTHING (free-5); booking 6+
 * pays 5%, collected on the manual GCash/BDO QR `orders` rail.
 *
 * The DB-touching wrapper (open the charge + issue the vendor order + notify)
 * lives in lib/booking-fee-lock.server.ts and composes these.
 */

import { bookingFeePhp } from '@/lib/booking-fee';

/**
 * The vendor-payer order service_key for a lock booking fee. The charge_id is
 * embedded so the admin-approval settle bridge (sku-activation PREFIX_HOOK) can
 * recover it and settle the exact ledger charge. `vendor_`-prefixed → the order
 * amount is treated as VAT-INCLUSIVE gross (isVatInclusiveServiceKey).
 */
export const BOOKING_FEE_LOCK_SERVICE_PREFIX = 'vendor_booking_fee__';

/** A verified vendor's first FREE_BOOKING_LIMIT booked customers pay no fee. */
export const FREE_BOOKING_LIMIT = 5;

/** Build the order service_key for a lock booking-fee charge. */
export function bookingFeeLockServiceKey(chargeId: string): string {
  return `${BOOKING_FEE_LOCK_SERVICE_PREFIX}${chargeId}`;
}

/**
 * Recover the charge_id from a lock booking-fee service_key, or null when the
 * key is not a lock booking-fee key. Mirrors branchIdFromServiceKey.
 */
export function chargeIdFromBookingFeeLockServiceKey(
  serviceKey: string | null | undefined,
): string | null {
  if (typeof serviceKey !== 'string') return null;
  if (!serviceKey.startsWith(BOOKING_FEE_LOCK_SERVICE_PREFIX)) return null;
  const id = serviceKey.slice(BOOKING_FEE_LOCK_SERVICE_PREFIX.length);
  return id.length > 0 ? id : null;
}

/**
 * Free-5: a booking is FREE iff its 1-based ordinal among the vendor's lock
 * bookings is at or below the limit. Booking 5 = free (the 5th), booking 6 =
 * charged. Pure mirror of the SQL rule (booking_ordinal <= 5).
 */
export function isFreeBooking(bookingOrdinal: number): boolean {
  return Number.isFinite(bookingOrdinal) && bookingOrdinal >= 1 && bookingOrdinal <= FREE_BOOKING_LIMIT;
}

export type LockFeeDecision = {
  /** Whether a charge row should exist at all (false = flag off / off-platform). */
  charge: boolean;
  /** Whether this booking is inside the free-5 (no money, but a waived charge). */
  free: boolean;
  /** The fee owed in PHP (0 when free / ₱0 booking). */
  feePhp: number;
  /** Whether a vendor-payer QR order should be issued (fee > 0 and not free). */
  createOrder: boolean;
};

/**
 * The pure LOCK-fee decision — the single source of truth mirrored by the SQL
 * RPC. Deterministic, no I/O. Kept a strict predicate so a mutation to any arm
 * (flag gate, verified gate, free-5 boundary, fee base) is caught by tests.
 *
 *   • flag OFF or NOT verified  → no charge, no order (byte-identical to today)
 *   • free-5 (ordinal ≤ 5)      → a waived charge, NO money, NO order
 *   • 6th+ with fee > 0         → a pending charge + a vendor QR order
 *   • 6th+ but ₱0/barter total  → a cleared charge, NO order
 */
export function decideLockFee(args: {
  flagEnabled: boolean;
  verified: boolean;
  bookingOrdinal: number;
  agreedTotalPhp: number | null | undefined;
}): LockFeeDecision {
  if (!args.flagEnabled || !args.verified) {
    return { charge: false, free: false, feePhp: 0, createOrder: false };
  }
  if (isFreeBooking(args.bookingOrdinal)) {
    return { charge: true, free: true, feePhp: 0, createOrder: false };
  }
  const feePhp = bookingFeePhp(Number(args.agreedTotalPhp ?? 0));
  return { charge: true, free: false, feePhp, createOrder: feePhp > 0 };
}

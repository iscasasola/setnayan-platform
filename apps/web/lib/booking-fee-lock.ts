/**
 * Booking-Fee LOCK path — pure helpers + the free-first-booking decision. NO database, NO
 * `server-only`, so the safety-critical rules are unit-testable and the
 * service_key parser is importable by the (server) settle hook AND the tests.
 *
 * The owner moved the fee TRIGGER from proposal SEND to the vendor LOCK
 * (event_vendors → contracted). Fee base = the COUPLE-CONFIRMED agreed total
 * (event_vendors.total_cost_php). Rate = 5%, then 1% beyond ₱100,000 · ₱50 floor
 * · no cap (lib/booking-fee.ts — owner-ruled 2026-07-27; there is no flat rate).
 * A verified vendor's FIRST Setnayan-sourced booking pays NOTHING; booking 2+
 * pays that schedule, collected on the manual GCash/BDO QR `orders` rail.
 * (Owner 2026-10-23: "Your first booking is on us. Not 5." — it was five.)
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

/**
 * How many of a verified vendor's Setnayan-sourced bookings pay no fee.
 *
 * ⚖ OWNER, 2026-10-23: *"Your first booking is on us. Not 5."* It was 5.
 *
 * 🔑 THE NUMBER LIVES IN THE DATABASE — `public.booking_fee_free_booking_limit()`
 * (migration 20271284624593), which is what the charging RPC actually reads.
 * This constant is its twin for copy and projections, and
 * `tests/db/the-first-booking-is-on-us.db.test.ts` fails the moment they
 * disagree. Change the SQL function first, then this.
 *
 * ⚠ The copy is written for ONE ("Your first booking from Setnayan is on us"),
 * so `the-first-booking-is-on-us.test.ts` pins this to 1 as well: a change here
 * is a change of every sentence below, not of a number.
 */
export const FREE_BOOKING_LIMIT = 1;

/**
 * THE SENTENCE (owner 2026-10-23). Every supplier surface that names the free
 * booking says this, or a lower-cased clause of it — never a count of free
 * bookings, which is how "your first 5" outlived the rule on twelve pages.
 */
export const FIRST_BOOKING_ON_US = 'Your first booking from Setnayan is on us.';

/** The same sentence as a mid-sentence clause, without the full stop. */
export const FIRST_BOOKING_ON_US_CLAUSE = 'your first booking from Setnayan is on us';

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
 * A booking is FREE iff its 1-based ordinal among the vendor's sourced lock
 * bookings is at or below the limit. Booking 1 = free, booking 2 = charged.
 * Pure mirror of the SQL rule (booking_ordinal <= booking_fee_free_booking_limit()).
 *
 * ⚠ FOR A BOOKING THAT TAKES ITS PLACE NOW. A FROZEN ledger row answers with its
 * own `is_free_booking` — bookings 2…5 waived under the earlier five-booking
 * rule stay waived, and asking this function about them would say "billable".
 */
export function isFreeBooking(bookingOrdinal: number): boolean {
  return Number.isFinite(bookingOrdinal) && bookingOrdinal >= 1 && bookingOrdinal <= FREE_BOOKING_LIMIT;
}

/**
 * 🛡 ONE FREE FIRST BOOKING PER BUSINESS, NOT PER ACCOUNT (owner 2026-11-06,
 * DECISION_LOG "…THE NEW-ACCOUNT LOOPHOLE IS CLOSED AT THE VERIFICATION DESK").
 *
 * The answer of `public.booking_fee_business_free_standing(shop)` (migration
 * 20271319712279): may this shop still take its business's free booking?
 *   · `available`        — no other shop of the business (same registration
 *                          number, phone or payout account) holds a free place;
 *   · `used_by_business` — one does, so this shop is billed;
 *   · `unreadable`       — the match could not run.
 *
 * 🔒 FAIL CLOSED: ONLY `available` permits a free booking. Anything this
 * reader does not recognise — an error, a null, a new word — is `unreadable`.
 */
export type BusinessFreeStanding = 'available' | 'used_by_business' | 'unreadable';

export function readBusinessFreeStanding(raw: unknown): BusinessFreeStanding {
  if (raw === 'available' || raw === 'used_by_business') return raw;
  return 'unreadable';
}

/** True only for `available` — the strict predicate every caller must use. */
export function businessMayTakeFreeBooking(raw: unknown): boolean {
  return raw === 'available';
}

/**
 * Why a booking inside the shop's own free place was billed anyway —
 * `booking_fee_ledger.free_booking_withheld_reason`, frozen with the ordinal.
 */
export type FreeHeldBack = 'business_already_used' | 'business_check_unreadable';

export function readFreeHeldBack(raw: unknown): FreeHeldBack | null {
  return raw === 'business_already_used' || raw === 'business_check_unreadable' ? raw : null;
}

/**
 * The supplier's sentence for a held-back free booking. Names no other shop:
 * the match may be a number somebody else typed, and the reviewer — not this
 * line — is where the other shop is shown.
 *
 * `'promo'` = a free-fee promotion waives this booking anyway, so the sentence
 * must not say it "carries the fee".
 */
export function freeHeldBackSentence(reason: FreeHeldBack, when: 'is' | 'would' | 'promo'): string {
  if (reason === 'business_already_used') {
    const used = 'Your business already used its free first booking from Setnayan under another account';
    if (when === 'promo') return `${used}.`;
    return when === 'is' ? `${used}, so this one carries the fee.` : `${used}, so this one would carry the fee.`;
  }
  if (when === 'promo') return 'We could not confirm this is your business’s first booking from Setnayan.';
  return 'We could not confirm this is your business’s first booking from Setnayan, so the fee applies. If it is, message Setnayan and we will check.';
}

export type LockFeeDecision = {
  /** Whether a charge row should exist at all (false = flag off / off-platform). */
  charge: boolean;
  /** Whether this booking is the free first one (no money, but a waived charge). */
  free: boolean;
  /** The fee owed in PHP (0 when free / ₱0 booking). */
  feePhp: number;
  /** Whether a vendor-payer QR order should be issued (fee > 0 and not free). */
  createOrder: boolean;
};

/**
 * The pure LOCK-fee decision — the single source of truth mirrored by the SQL
 * RPC. Deterministic, no I/O. Kept a strict predicate so a mutation to any arm
 * (flag gate, verified gate, free-booking boundary, fee base) is caught by tests.
 *
 *   • flag OFF or NOT verified  → no charge, no order (byte-identical to today)
 *   • the first (ordinal ≤ 1)   → a waived charge, NO money, NO order —
 *     ONLY when the business has not spent it on another shop (`businessFree`
 *     is `available`); otherwise it is billed like a 2nd (fail closed)
 *   • 2nd+ with fee > 0         → a pending charge + a vendor QR order
 *   • 2nd+ but ₱0/barter total  → a cleared charge, NO order
 */
export function decideLockFee(args: {
  flagEnabled: boolean;
  verified: boolean;
  bookingOrdinal: number;
  agreedTotalPhp: number | null | undefined;
  /** `booking_fee_business_free_standing` for this shop. REQUIRED — no default, so no caller can forget it. */
  businessFree: BusinessFreeStanding;
}): LockFeeDecision {
  if (!args.flagEnabled || !args.verified) {
    return { charge: false, free: false, feePhp: 0, createOrder: false };
  }
  if (isFreeBooking(args.bookingOrdinal) && businessMayTakeFreeBooking(args.businessFree)) {
    return { charge: true, free: true, feePhp: 0, createOrder: false };
  }
  const feePhp = bookingFeePhp(Number(args.agreedTotalPhp ?? 0));
  return { charge: true, free: false, feePhp, createOrder: feePhp > 0 };
}

/**
 * Booking-Fee LOCK path — pure helpers + the free-first-booking decision. NO database, NO
 * `server-only`, so the safety-critical rules are unit-testable and the
 * service_key parser is importable by the (server) settle hook AND the tests.
 *
 * The owner moved the fee TRIGGER from proposal SEND to the vendor LOCK
 * (event_vendors → contracted). Fee base = the COUPLE-CONFIRMED agreed total
 * (event_vendors.total_cost_php). The schedule is lib/booking-fee.ts (owner
 * 2026-11-20: 5% of the first ₱100,000, 3% after, locked at ₱100,000; an
 * unverified shop pays the head rate on the whole booking, locked too). Collected on the manual
 * GCash/BDO QR `orders` rail.
 *
 * ⚖ 20 NOV — THERE IS NO FREE FIRST BOOKING ANY MORE (specs DECISION_LOG
 * "BILLING MUST FOLLOW THE RETIRED COPY"). The only bookings with no fee are the
 * ones `booking_fee_attribution_for` calls 'import' (the 16 Nov rule), a ledger
 * row frozen free before the change (never taken back), the launch offer, a
 * free-fee window, Setnayan's every-Nth booking fee, and a free booking fee
 * ticket (auto-claimed — never redeemed at will).
 *
 * The DB-touching wrapper (open the charge + issue the vendor order + notify)
 * lives in lib/booking-fee-lock.server.ts and composes these.
 */

import { bookingFeePhpFor, type BookingFeeSchedule } from '@/lib/booking-fee';

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
 * `the-first-booking-is-on-us.test.ts` pins this to 0 (20 Nov): there is no
 * free first booking, and no sentence may promise one.
 */
export const FREE_BOOKING_LIMIT = 0;

/*
 * 20 Nov: the three "first booking free" sentences (FIRST_BOOKING_ON_US, _CLAUSE, FIRST_BOOKING_FREE) are DELETED, not
 * kept — billing gives no free first booking. The free rule is said in lib/booking-fee-who-words.ts.
 * `the-20-nov-fee-rulings.test.ts` fails if a shipped file says the old sentence or names the old constants again.
 */

/**
 * 💳 WHEN THE FEE IS CHARGED — the lock's rule in one sentence (the fee TRIGGER is the lock: a couple Setnayan brought
 * agrees to book). Said by the fee bill and the Money tour alike, never retyped (walk RW-20, 13 Nov 2026: the tour said
 * "due after the day", which no code does).
 */
export const BOOKING_FEE_CHARGED_WHEN = 'Setnayan charges this once a couple we brought you agrees to book.';

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

/**
 * 🎁 SETNAYAN'S EVERY-NTH BOOKING FEE (owner 2026-11-20: "every 100,000th booking fee", counted across "All of
 * Setnayan"). True when a booking's place in the platform-wide count of fee bookings is a multiple of N
 * (`platform_settings.booking_fee_free_every_nth`). Twin of `public.booking_fee_platform_number_is_free`. A count of
 * bookings, never pesos. N is passed in — read from settings, never typed here.
 */
export function isPlatformFreeNumber(platformFeeNumber: number | null | undefined, freeEveryNth: number): boolean {
  if (typeof platformFeeNumber !== 'number' || !Number.isInteger(platformFeeNumber) || platformFeeNumber <= 0) return false;
  if (!Number.isInteger(freeEveryNth) || freeEveryNth <= 0) return false;
  return platformFeeNumber % freeEveryNth === 0;
}

/**
 * THE NEW-CLIENT FREE WINDOW (owner 2026-11-16, specs DECISION_LOG "IMPORTED CLIENTS: A NEW ACCOUNT IS FREE FOR ONE
 * YEAR WITH THAT SUPPLIER"): an import that CREATED the client's Setnayan account frees every booking that client makes
 * with that shop while the import is less than `months` before the booking. At exactly `months`, and after, the fee
 * applies. Twin of `public.booking_fee_new_client_window_covers` (migration 20271356623783), which
 * `booking_fee_attribution_for` calls with NOW() — so this window is part of the ATTRIBUTION `decideLockFee` receives,
 * not an arm of its own. `months` is `platform_settings.booking_fee_new_client_free_months`, passed in — never typed.
 *
 * Calendar months, in UTC, as Postgres `timestamptz - make_interval(months => n)`: the day clamps to the month's last
 * day (31 Mar − 1 month = 28/29 Feb). Anything missing or nonsense → false (the fee), as the SQL's COALESCE(…, false).
 */
export function newClientWindowCovers(
  importAt: string | Date | null | undefined,
  at: string | Date | null | undefined,
  months: number | null | undefined,
): boolean {
  if (importAt == null || at == null) return false;
  if (typeof months !== 'number' || !Number.isInteger(months) || months <= 0) return false;
  const imp = new Date(importAt).getTime();
  const now = new Date(at);
  if (!Number.isFinite(imp) || !Number.isFinite(now.getTime())) return false;
  const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - months;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const start = Date.UTC(
    y,
    m,
    Math.min(now.getUTCDate(), lastDay),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds(),
  );
  return imp > start;
}

/** Why a lock decision came out the way it did — one word per arm of `booking_fee_open_lock_charge`. */
export type LockFeeReason =
  | 'off'          // flag off, or no marketplace shop — no charge row at all
  | 'not_sourced'  // attribution 'import' — the 16 Nov rule: no fee, ever, on this booking
  | 'launch_offer' // one of the launch offer's bookings
  | 'frozen_free'  // a ledger place frozen free before 20 Nov — a waiver already granted stays granted
  | 'zero'         // a ₱0 / barter total
  | 'promo'        // a free-fee window is running
  | 'every_nth'    // Setnayan's every-Nth booking fee
  | 'ticket'       // the shop's oldest free booking fee ticket paid it (auto-claimed)
  | 'billed';      // billed: a pending charge + an order

export type LockFeeDecision = {
  /** Whether a charge row should exist at all (false = flag off / off-platform). */
  charge: boolean;
  /** Whether the shop is billed nothing on this booking. */
  free: boolean;
  /** The fee BILLED in PHP (0 when free). */
  feePhp: number;
  /** What the fee is on this total for this shop — recorded even when it is waived (`computed_fee_centavos`). */
  computedFeePhp: number;
  /** Whether a vendor-payer QR order should be issued (billed and fee > 0). */
  createOrder: boolean;
  /** Whether this booking takes a place in Setnayan's count of fee bookings. */
  takesPlatformNumber: boolean;
  reason: LockFeeReason;
};

/**
 * The pure LOCK-fee decision — the mirror of `booking_fee_open_lock_charge` (migration 20271356196197), arm for arm
 * and in the same order. Deterministic, no I/O. Every number arrives as an argument (the schedule and N come from
 * `platform_settings`); nothing here types a rate, a band, a lock or a count.
 *
 *   1 · flag OFF or no marketplace shop      → no charge
 *   2 · attribution 'import'                 → waived, no fee recorded (the 16 Nov import rule)
 *   3 · launch offer                         → waived, fee recorded
 *   4 · a place frozen free (pre-20 Nov)     → waived, fee recorded (never taken back)
 *   5 · fee ₱0                               → a cleared charge
 *   6 · free-fee window                      → waived, fee recorded
 *   7 · the booking carries a fee → takes its number in Setnayan's count:
 *         every Nth                          → waived; a ticket the shop holds is NOT used
 *         else a ticket waiting              → the ticket pays it (auto-claimed, oldest first)
 *         else                               → billed, with an order
 *
 * The fee is the verified taper or, for an unverified shop, the flat rate — both locked (`bookingFeePhpFor`).
 */
export function decideLockFee(args: {
  flagEnabled: boolean;
  /** The booking row names a marketplace shop (`event_vendors.marketplace_vendor_id`). */
  onPlatform: boolean;
  /** `booking_fee_attribution_for` for this (shop, event). */
  attribution: 'sourced' | 'import';
  /** `booking_fee_shop_verified_since(shop) IS NOT NULL` — picks the taper over the flat rate. */
  shopVerified: boolean;
  /** `booking_fee_ledger.is_free_booking` on a row frozen before 20 Nov. */
  frozenFree: boolean;
  launchOffer: boolean;
  promoWindow: boolean;
  agreedTotalPhp: number | null | undefined;
  schedule: BookingFeeSchedule;
  /** The place this booking takes in Setnayan's count if it carries a fee (the counter's next number). */
  nextPlatformNumber: number;
  /** `platform_settings.booking_fee_free_every_nth`. */
  freeEveryNth: number;
  /** The shop holds an unused free booking fee ticket (`shop_badge_rewards`, reward_kind 'fee_waiver'). */
  ticketWaiting: boolean;
}): LockFeeDecision {
  const none = (reason: LockFeeReason, computedFeePhp = 0): LockFeeDecision => ({
    charge: reason !== 'off',
    free: true,
    feePhp: 0,
    computedFeePhp,
    createOrder: false,
    takesPlatformNumber: false,
    reason,
  });
  if (!args.flagEnabled || !args.onPlatform) return none('off');
  if (args.attribution === 'import') return none('not_sourced');
  const fee = bookingFeePhpFor(Number(args.agreedTotalPhp ?? 0), args.schedule, { verified: args.shopVerified });
  if (args.launchOffer) return none('launch_offer', fee);
  if (args.frozenFree) return none('frozen_free', fee);
  if (fee <= 0) return none('zero', 0);
  if (args.promoWindow) return none('promo', fee);
  if (isPlatformFreeNumber(args.nextPlatformNumber, args.freeEveryNth)) {
    return { ...none('every_nth', fee), takesPlatformNumber: true };
  }
  if (args.ticketWaiting) return { ...none('ticket', fee), takesPlatformNumber: true };
  return {
    charge: true,
    free: false,
    feePhp: fee,
    computedFeePhp: fee,
    createOrder: true,
    takesPlatformNumber: true,
    reason: 'billed',
  };
}

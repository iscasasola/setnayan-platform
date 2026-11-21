/**
 * Setnayan vendor BOOKING FEE — the pure, deterministic fee schedule.
 *
 * THE SCHEDULE (owner-ruled 2026-11-20 — CURRENT). Specs DECISION_LOG row
 * "BOOKING FEE: 5% OF THE FIRST ₱100,000, 3% AFTER, LOCKED AT ₱100,000":
 *
 *   • 5% on the FIRST ₱100,000 of the booking
 *   • 3% on the amount ABOVE ₱100,000
 *   • floor ₱50 (survives the taper)
 *   • LOCKED at ₱100,000 — the fee never goes above it (reached at a booking of
 *     about ₱3.27M; after that the share keeps falling: ₱5M = 2%, ₱10M = 1%)
 *   • an UNVERIFIED shop pays the flat 5% of the WHOLE booking, locked too
 *     (`unverifiedBookingFeePhp`).
 *
 * Every number but the ₱50 floor lives on `platform_settings` (admin-editable at
 * /admin/pricing) and reaches this file as a `BookingFeeSchedule` read by
 * `getBookingFeeSchedule()`. `BOOKING_FEE` below is only the fallback when that
 * row is unreadable, and equals the ruled values.
 *
 * Worked (asserted in booking-fee.test.ts, at the ruled settings):
 *   ₱50,000 → ₱2,500 · ₱100,000 → ₱5,000 · ₱250,000 → ₱9,500 ·
 *   ₱1M → ₱32,000 · ₱5M → ₱100,000 (locked) · ₱10M → ₱100,000 (locked)
 *
 * ⚠ The taper is a DISCOUNT, never a surcharge: continuous at the band edge and
 * monotonic (non-decreasing; flat once locked), so under-declaring never pays.
 *
 * SCOPE, unchanged by the reprice: the fee applies to bookings attributed
 * 'sourced' (`booking_fee_attribution_for`, the 16 Nov import rule decides who a
 * supplier brought). There is NO free first booking any more (20 Nov); a ledger
 * row frozen free stays free. Charges carry the `schedule_version` they were
 * priced under, so nothing is re-priced retroactively.
 *
 * The SQL twin is `public.booking_fee_centavos` (verified) and
 * `public.booking_fee_flat_centavos` (unverified); tests/db/
 * the-20-nov-booking-fee-rulings.db.test.ts asserts they agree with this file.
 *
 * A non-positive amount returns 0 (no consideration → no fee).
 */

/**
 * The locked fee constants (PHP). Admin-dialable later without touching callers.
 *
 * SCHEDULE (owner 2026-11-20): **5% on the first ₱100,000, then 3% on the
 * amount above, locked at ₱100,000.** Floor ₱50 survives. Supersedes the
 * 2026-07-25 taper (5% then 1%, no cap).
 */
import { MAX_PAYMENT_PHP_DEFAULT, maxPaymentPhpOrDefault } from '@/lib/max-payment';

/**
 * The three numbers the OWNER may set, plus the two he may not.
 *
 * ⚖ OWNER RULING 2026-08-28: the head rate, the band ceiling and the tail rate
 * are his to change from /admin/pricing → "Vendor booking fee". They live on
 * `platform_settings` and are read by `getBookingFeeSchedule()`
 * (lib/booking-fee-settings.server.ts) and by the SQL mirror
 * `public.booking_fee_centavos`.
 *
 * 🔒 `minPhp` (the ₱50 floor) and the absence of a cap are NOT owner-editable.
 * He ruled on the taper and did not rule on these; they stay fixed in code
 * rather than being quietly widened along with the rest.
 */
export type BookingFeeSchedule = {
  /** Rate on the first `tier1LimitPhp` of the booking (0.05 = 5%). */
  rate: number;
  /** Rate on everything above `tier1LimitPhp` — the taper that softens big deals. */
  tailRate: number;
  /** Where the head band ends and the tail begins. */
  tier1LimitPhp: number;
  /** Minimum fee (and floor) for any positive proposal. FIXED, not editable. */
  minPhp: number;
  /**
   * THE LOCK (owner 2026-11-20): the most one booking's fee can be. From
   * `platform_settings.booking_fee_cap_php`. Optional only so schedules built
   * by hand before the lock existed still type-check; ABSENT MEANS THE RULED
   * DEFAULT (`BOOKING_FEE.capPhp`), never "no lock".
   */
  capPhp?: number;
  /**
   * ⚖ THE CEILING (owner 2026-11-17): the booking fee can never exceed ₱100,000.
   * It is the admin setting `platform_settings.max_payment_php` — the same number
   * that bounds every payment to Setnayan — read by `getBookingFeeSchedule`.
   * Optional so a schedule built anywhere else still caps: absent ⇒
   * `MAX_PAYMENT_PHP_DEFAULT`. Mirrored in SQL by `public.booking_fee_centavos`.
   */
  maxPhp?: number;
};

/**
 * The DEFAULT schedule — the owner-locked 2026-07-25 taper, and the fallback
 * used whenever the settings row is unreadable. Every function below takes a
 * schedule and defaults to this one, so no existing caller changed behaviour.
 */
export const BOOKING_FEE: BookingFeeSchedule = {
  /** Rate on the first `tier1LimitPhp` of the booking. */
  rate: 0.05,
  /** Rate on everything above `tier1LimitPhp` (owner 2026-11-20: 3%). */
  tailRate: 0.03,
  /** Where the 5% band ends and the 3% tail begins. */
  tier1LimitPhp: 100_000,
  /** Minimum fee (and floor) for any positive proposal. */
  minPhp: 50,
  /** The lock (owner 2026-11-20): the fee never goes above ₱100,000. */
  capPhp: 100_000,
  /** The payment ceiling (owner 2026-11-17) — the ruled default of `max_payment_php`. */
  maxPhp: MAX_PAYMENT_PHP_DEFAULT,
};

/** The FIRST-BAND rate (5%). Exposed for display copy / callers. */
export const BOOKING_FEE_RATE = BOOKING_FEE.rate;

/** The tail rate (fallback) applied above the band. */
export const BOOKING_FEE_TAIL_RATE = BOOKING_FEE.tailRate;

/** Where the 5% band ends (₱100,000). */
export const BOOKING_FEE_TIER1_LIMIT_PHP = BOOKING_FEE.tier1LimitPhp;

/**
 * The booking fee (PHP, to the centavo) for a finalized proposal amount in PHP.
 *
 * PURE + deterministic. **5% on the first ₱100,000, then 3% above**, floored at
 * ₱50, LOCKED at the schedule's cap (₱100,000). The ₱50 floor binds below
 * ₱1,000. A non-positive / non-finite amount → 0.
 *
 * Worked (owner 2026-11-20 schedule, asserted in the test suite):
 *   ₱50,000 → ₱2,500 · ₱100,000 → ₱5,000 · ₱250,000 → ₱9,500 · ₱10M → ₱100,000
 *
 * ⚠ The taper is a DISCOUNT on large bookings, never a surcharge: it is
 * continuous at ₱100,000 (₱5,000 either way) and monotonic, so no vendor is
 * ever better off declaring less.
 */
export function bookingFeePhp(
  proposalPhp: number,
  schedule: BookingFeeSchedule = BOOKING_FEE,
): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  const amount = centavos(proposalPhp);
  const band = centavos(schedule.tier1LimitPhp);
  const head = (amount < band ? amount : band) * pctHundredths(schedule.rate);
  const tail = (amount > band ? amount - band : 0n) * pctHundredths(schedule.tailRate);
  // ONE round of the sum, then the ₱50 floor, then the lock — exactly `public.booking_fee_centavos`.
  return floorAndLock(roundHalfUp(head + tail), schedule);
}

/*
 * ⚖ THE SHOWN FEE IS THE BILLED FEE (ship review 21 Nov: ₱100,003.50 showed ₱5,000.10 while SQL billed ₱5,000.11).
 * Floats cannot hold 5,000.105, so the fee is computed the way Postgres NUMERIC does it: whole centavos × the rate in
 * hundredths of a percent (5% = 500, as `head_pct / 100.0` on a NUMERIC(5,2) is exact), in BigInt, rounded ONCE,
 * half away from zero (`round()` on NUMERIC), then floored and locked in whole centavos.
 */
function centavos(php: number): bigint {
  return BigInt(Math.round(php * 100)); // `(x * 100)::BIGINT` rounds half away from zero too (positive inputs)
}
function pctHundredths(rate: number): bigint {
  return BigInt(Math.round(rate * 10_000)); // 0.05 → 500 (= 5.00%)
}
function roundHalfUp(units: bigint): bigint {
  // `units` is centavos × 10,000; every input is non-negative, so half-up IS half-away-from-zero.
  return (units + 5_000n) / 10_000n;
}
function floorAndLock(feeCentavos: bigint, schedule: BookingFeeSchedule): number {
  const floored = feeCentavos > centavos(schedule.minPhp) ? feeCentavos : centavos(schedule.minPhp);
  const lock = centavos(bookingFeeCapPhp(schedule));
  return Number(floored < lock ? floored : lock) / 100;
}

/**
 * The most one booking's fee can be: the fee LOCK (`booking_fee_cap_php`, owner 2026-11-20) or the PAYMENT CEILING
 * (`max_payment_php`, owner 2026-11-17: "We do not allow transactions above 100,000"), whichever is lower — a fee is
 * one payment, so it can never be more than any payment may be. Absent either ⇒ its ruled default, never "no lock".
 * Twin of `LEAST(cap_php, max_php)` in `public.booking_fee_centavos`.
 */
export function bookingFeeCapPhp(schedule: BookingFeeSchedule = BOOKING_FEE): number {
  const cap = schedule.capPhp;
  const lock = typeof cap === 'number' && Number.isFinite(cap) && cap > 0 ? cap : (BOOKING_FEE.capPhp as number);
  return Math.min(lock, maxPaymentPhpOrDefault(schedule.maxPhp));
}

/**
 * The smallest whole-peso booking price whose fee reaches the lock (₱3,266,667 on 5% · ₱100,000 · 3% · ₱100,000) — the
 * stop the For Suppliers ruler draws its lock at. PURE, from the schedule; null when no booking ever reaches it (a 0% tail).
 */
export function bookingFeeLockPointPhp(schedule: BookingFeeSchedule = BOOKING_FEE): number | null {
  const cap = bookingFeeCapPhp(schedule);
  const head = schedule.rate * schedule.tier1LimitPhp;
  if (cap <= head) return schedule.rate > 0 ? Math.ceil(cap / schedule.rate) : null;
  if (!(schedule.tailRate > 0)) return null;
  const at = Math.ceil(schedule.tier1LimitPhp + (cap - head) / schedule.tailRate);
  // Centavo rounding can land a peso early; step back while the peso before still reaches the lock.
  return bookingFeePhp(at - 1, schedule) >= cap ? at - 1 : at;
}

/**
 * The fee an UNVERIFIED shop pays (owner 2026-11-20: "Unverified shops keep the
 * flat 5% of the whole booking, and it ALSO locks at ₱100,000"). The head rate
 * on the whole amount — no taper — the same ₱50 floor and the same lock. Twin
 * of `public.booking_fee_flat_centavos`.
 */
export function unverifiedBookingFeePhp(
  proposalPhp: number,
  schedule: BookingFeeSchedule = BOOKING_FEE,
): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  // `public.booking_fee_flat_centavos`: round(amount × head rate), then the floor, then the lock.
  return floorAndLock(roundHalfUp(centavos(proposalPhp) * pctHundredths(schedule.rate)), schedule);
}

/** The fee a shop pays on an amount: the taper when verified, the flat rate when not (`booking_fee_centavos_for`). */
export function bookingFeePhpFor(
  proposalPhp: number,
  schedule: BookingFeeSchedule,
  shop: { verified: boolean },
): number {
  return shop.verified ? bookingFeePhp(proposalPhp, schedule) : unverifiedBookingFeePhp(proposalPhp, schedule);
}

/**
 * The effective rate (fee ÷ proposal) as a fraction, for display copy
 * ("you keep 95%"). Returns 0 for a non-positive proposal. Equals the flat 5%
 * at and above the floor; higher below ₱1,000.
 */
export function bookingFeeEffectiveRate(
  proposalPhp: number,
  schedule: BookingFeeSchedule = BOOKING_FEE,
): number {
  if (!Number.isFinite(proposalPhp) || proposalPhp <= 0) return 0;
  return bookingFeePhp(proposalPhp, schedule) / proposalPhp;
}

/** A rate (0.05) as display copy ("5%", "2.5%") — never "2.5000000000000004%". */
function formatRatePct(rate: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'percent',
    maximumFractionDigits: 3,
  }).format(rate);
}

/** A PHP amount as display copy — ₱ sign + thousands separators ("₱100,000"). */
function formatPhpAmount(amountPhp: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: Number.isInteger(amountPhp) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountPhp);
}

/**
 * The fee schedule as ONE short line of vendor-facing copy, rendered ENTIRELY
 * from `BOOKING_FEE` — today: `5% of the first ₱100,000, then 3%, minimum ₱50, never more than ₱100,000`.
 *
 * ⚠ WHY THIS EXISTS. The vendor's booking-fee `orders.description` — a money
 * document they read in /vendor-dashboard/booking-fees and that ops read in
 * /admin/payments — used to hard-code the parenthetical "(5%)". That was only
 * true at or below ₱100,000: a ₱1,000,000 booking is billed ₱14,000 = 1.40%, so
 * the document overstated its own rate, hid the taper DISCOUNT, and made
 * Setnayan look like it had taken 5% of a ₱1M deal. Re-hardcoding "5% then 1%"
 * would simply reproduce the bug at the next reprice, so the copy is DERIVED:
 * move a constant and every document that quotes the schedule follows.
 *
 * The MINIMUM is part of the claim, not a footnote — below ₱1,000 the ₱50 floor
 * dominates and the effective rate EXCEEDS the headline rate (a ₱200 booking
 * pays ₱50 = 25%). A summary that names only the bands is wrong at the small end
 * exactly the way "(5%)" was wrong at the large end.
 *
 * Every claim this string makes is pinned against `bookingFeePhp` in
 * booking-fee-schedule-summary.test.ts.
 */
export function bookingFeeScheduleSummary(
  schedule: BookingFeeSchedule = BOOKING_FEE,
): string {
  const head = formatRatePct(schedule.rate);
  const tail = formatRatePct(schedule.tailRate);
  const band = formatPhpAmount(schedule.tier1LimitPhp);
  const floor = formatPhpAmount(schedule.minPhp);
  const cap = formatPhpAmount(bookingFeeCapPhp(schedule));
  return `${head} of the first ${band}, then ${tail}, minimum ${floor}, never more than ${cap}`;
}

/**
 * The UNVERIFIED shop's schedule as one line — today `5% of the whole booking,
 * minimum ₱50, never more than ₱100,000` (owner 2026-11-20). Same rule as the
 * line above: every figure comes from the schedule, so a reprice moves it.
 */
export function unverifiedBookingFeeScheduleSummary(
  schedule: BookingFeeSchedule = BOOKING_FEE,
): string {
  const head = formatRatePct(schedule.rate);
  const floor = formatPhpAmount(schedule.minPhp);
  const cap = formatPhpAmount(bookingFeeCapPhp(schedule));
  return `${head} of the whole booking, minimum ${floor}, never more than ${cap}`;
}

/**
 * The two bands as the short public line — today `5% up to ₱100,000, 3% above`.
 *
 * Owner, 2026-11-04, rewording the /for-suppliers fee line: the visible
 * sentence names the bands, and the ₱50 minimum moves behind the ⓘ beside it
 * (`bookingFeeMinimumAmount`). The minimum is still said — one tap away, never
 * dropped — so the claim stays whole (see `bookingFeeScheduleSummary` on why
 * the floor is part of the claim).
 *
 * NO DEFAULT SCHEDULE, on purpose: a page must hand in the live schedule it
 * read (`getLiveBookingFeeSchedule`), so it cannot print the code default by
 * forgetting an argument (`fee-copy-reads-the-live-rate.test.ts`).
 */
export function bookingFeeBandsLine(schedule: BookingFeeSchedule): string {
  const head = formatRatePct(schedule.rate);
  const tail = formatRatePct(schedule.tailRate);
  const band = formatPhpAmount(schedule.tier1LimitPhp);
  return `${head} up to ${band}, ${tail} above`;
}

/**
 * The schedule's three public figures as display copy — today `{ head: '5%', tail: '3%', band: '₱100,000' }` — for a
 * sentence that places them itself (the /for-suppliers hero ⓘ: "5% on the first ₱100,000 of a booking and 1%
 * after"). Same rule as the line above: no default schedule, so a page cannot print the code default by forgetting.
 */
export function bookingFeeFigures(schedule: BookingFeeSchedule): { head: string; tail: string; band: string } {
  return {
    head: formatRatePct(schedule.rate),
    tail: formatRatePct(schedule.tailRate),
    band: formatPhpAmount(schedule.tier1LimitPhp),
  };
}

/** The fee's lock as display copy — today `₱100,000` (owner 2026-11-20). Same rule: no default schedule. */
export function bookingFeeCapAmount(schedule: BookingFeeSchedule): string {
  return formatPhpAmount(bookingFeeCapPhp(schedule));
}

/** The fee's floor as display copy — today `₱50`. Same rule: no default schedule. */
export function bookingFeeMinimumAmount(schedule: BookingFeeSchedule): string {
  return formatPhpAmount(schedule.minPhp);
}

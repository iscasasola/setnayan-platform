/**
 * Booking-Fee send-gate RULES — pure + env-driven, NO database, NO `server-only`.
 * Split out of lib/booking-fee-charge.ts so the safety-critical logic (attribution,
 * the two-key fail-safe, the send decision) is unit-testable. The DB-touching
 * wrappers + the async gate live in booking-fee-charge.ts and compose these.
 */

/**
 * The fee is off until this flag is set (default off — same value client +
 * server, mirroring isPaymentGatedLockEnabled). While off, no fee is computed,
 * charged, or gated: the proposal send behaves exactly as it does today.
 */
export function isBookingFeeEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_BOOKING_FEE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}

/**
 * Whether a payment rail is live enough to actually collect a fee. The chosen
 * rail is PayMongo (owner 2026-07-23, superseding Maya). Rail-AGNOSTIC by design:
 * the owner flips this one flag once the rail is KYC-approved AND the checkout
 * (PR-4) is wired — the gate doesn't care which gateway settles the charge.
 */
function isBookingFeeRailLive(): boolean {
  const v = process.env.NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE;
  return v === 'true' || v === '1' || v === 'TRUE';
}

/**
 * TWO-KEY enforcement. The gate only ever blocks a send when BOTH the feature
 * flag is on AND a live payment rail exists. Without a rail there is no way to pay
 * a computed fee, so a hard gate would trap a sourced vendor's proposal
 * unsendable — the exact harm the model exists to remove. So the flag alone is
 * inert; enforcement wakes only once the owner has done PayMongo KYC and shipped
 * the checkout (PR-4), then flipped NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE.
 */
export function isBookingFeeEnforced(): boolean {
  return isBookingFeeEnabled() && isBookingFeeRailLive();
}

/**
 * The fee schedule in force. Stamped on every charge (the app always passes this
 * value explicitly to the ledger RPC — see booking-fee-charge.ts) so a future
 * reprice cannot silently rewrite history. Bumped 2026-07-25 for the owner-locked
 * TAPER (5% on the first ₱100,000, then 1% above; floor ₱50; no cap —
 * `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 3), which supersedes the
 * 2026-07-24 flat-5%/no-cap reprice. Charges written under an older string stay
 * readable as such; nothing is re-priced retroactively. The ledger migration's
 * SQL DEFAULT ('2026-07-23-flat2') is the historical fallback and is never used
 * on the app path.
 */
export const BOOKING_FEE_SCHEDULE_VERSION = '2026-07-25-taper5-1-over-100k';

export type BookingFeeAttribution = 'sourced' | 'import';

export type BookingFeeChargeStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'waived_import';

export type OpenChargeResult = {
  charge_id: string;
  status: BookingFeeChargeStatus;
  amount_charged_centavos: number;
  computed_fee_centavos: number;
  attribution: BookingFeeAttribution;
  reused: boolean;
};

export type FeeGateResult =
  | { cleared: true }
  | { cleared: false; chargeId: string; amountCentavos: number };

/**
 * inquiry_source values that make a (vendor, event) relationship Setnayan-SOURCED
 * (billable) — i.e. the couple discovered the vendor THROUGH the marketplace.
 *
 * Anything else is an IMPORT and free forever: NULL, no thread at all,
 * host_manual, invite_claim, degree, and **website**.
 *
 * ⚠ 'website' was REMOVED 2026-07-26. The 2026-07-21 build plan listed it as
 * billable with the sign-off flagged open (#3d-iv); the owner closed it — a
 * couple arriving through the vendor's OWN link is a client the vendor brought
 * ("bringing in clients will give them free access"), so it is an import.
 * Charging it would bill vendors for their own audience and push them
 * off-platform, which is the opposite of "monetize ACCESS, not the deal".
 *
 * ⚠ EXPORTED so `booking-fee-gate.test.ts` can assert it against the SQL mirror
 * `public.booking_fee_is_sourced_surface`. The two must never drift: SQL decides
 * what is actually charged, this decides what the app believes.
 */
export const SOURCED_INQUIRY_SOURCES: ReadonlySet<string> = new Set([
  'explore',
  'search',
  'shortlist',
  'first_pick',
  'favorites',
  'auto_build',
  'editorial',
  'influencer',
]);

/** Map a thread's inquiry_source to the fee attribution axis (sourced | import). */
export function bookingFeeAttribution(
  inquirySource: string | null | undefined,
): BookingFeeAttribution {
  return inquirySource && SOURCED_INQUIRY_SOURCES.has(inquirySource)
    ? 'sourced'
    : 'import';
}

/**
 * The pure send decision, given the charge that was opened (or null on an RPC
 * error). FAIL-OPEN on null — a transient error must never trap a live proposal
 * send (the missed fee is recoverable, a blocked vendor is a lost deal). A
 * paid/waived_import charge clears; a pending charge blocks (routes to checkout).
 */
export function decideFeeGate(charge: OpenChargeResult | null): FeeGateResult {
  if (!charge) return { cleared: true };
  if (charge.status === 'paid' || charge.status === 'waived_import') {
    return { cleared: true };
  }
  return {
    cleared: false,
    chargeId: charge.charge_id,
    amountCentavos: charge.amount_charged_centavos,
  };
}

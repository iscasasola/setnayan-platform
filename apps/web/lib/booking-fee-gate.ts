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

/**
 * WHO SHOWED THE COUPLE THIS SHOP — THE THREE RECORDED FACTS (owner "APPROVE
 * ALL", DECISION_LOG 2026-10-12, answer 8; booking-fee audit build list items 9
 * and 10; "Add your own" = rule B, 2026-10-10).
 *
 * "Setnayan showed them first" = only facts recorded BEFORE the booking (for a
 * couple's hand-typed record: before the record was made):
 *   · a chat started from Setnayan — a thread whose `inquiry_source` is a
 *     sourced surface (the rule every booking always had);
 *   · a save from Find — an `event_vendors` row for this shop on this event
 *     stamped `host_marketplace_search` / `auto_cascade_from_finalize` (the row
 *     itself, or an earlier one when the booking is a hand-typed record);
 *   · a profile view for this event — a `vendor_profile_views(event_id, shop)`
 *     row before that moment.
 * Never sourced, whatever else is true: a row the SUPPLIER brought (their
 * invite, their Locked QR, a reused booking) — they brought the couple.
 * A hand-typed record counts only when it is tied to THIS shop: the shop
 * claimed the couple's link, or the server stamped a match
 * (`event_manual_vendors.leak_match_vendor_profile_id`). "Not them?" cancels
 * only the NAME match (answer 8) — it is never stamped; the facts above stand.
 *
 * ⚠ THE APP'S BELIEF, NOT THE BILL. SQL decides what is charged:
 * `public.booking_fee_attribution_for` carries the same arms, and
 * `tests/db/add-your-own-fee-rule.db.test.ts` runs every case of
 * `lib/fee-rule-b-cases.ts` through both and requires the same answer.
 * Fails SAFE to import.
 */
export const SETNAYAN_SAVE_SOURCES: ReadonlySet<string> = new Set(['host_marketplace_search', 'auto_cascade_from_finalize']);
export const SUPPLIER_BROUGHT_SOURCES: ReadonlySet<string> = new Set(['vendor_invite', 'vendor_locked_qr', 'reuse_accept']);

export type BookingAttributionFacts = {
  /** `inquiry_source` of every thread this event has with the shop. */
  threadSources: ReadonlyArray<string | null>;
  /** `event_vendors.source` of the booking row. */
  rowSource: string | null;
  /** The booking row is a couple's hand-typed record (`manual_vendor_id` set). */
  rowIsManualRecord: boolean;
  /** A hand-typed record: claimed by this shop, or matched to it. A marketplace row: always true. */
  recordTiedToShop: boolean;
  /** `source` of every OTHER marketplace row for this shop on this event made before the booking moment. */
  savesBefore: ReadonlyArray<string | null>;
  /** How many profile views of this shop for this event came before the booking moment. */
  viewsBefore: number;
};

export function bookingFeeAttributionFromFacts(f: BookingAttributionFacts): BookingFeeAttribution {
  if (f.threadSources.some((s) => bookingFeeAttribution(s) === 'sourced')) return 'sourced';
  if (f.rowSource && SUPPLIER_BROUGHT_SOURCES.has(f.rowSource)) return 'import';
  if (!f.recordTiedToShop) return 'import';
  // Judged by the row's SOURCE: a Find save that a claimed record merged onto (it now carries the record's
  // manual_vendor_id too) is still a save from Find.
  if (f.rowSource && SETNAYAN_SAVE_SOURCES.has(f.rowSource)) return 'sourced';
  if (f.savesBefore.some((s) => s != null && SETNAYAN_SAVE_SOURCES.has(s))) return 'sourced';
  if (f.viewsBefore > 0) return 'sourced';
  return 'import';
}

/**
 * THE OWNER'S PRICE CHECK (2026-10-10, answer 2): "10% allowance +-. so if
 * 100,000 that is between 90-110k". `tolerance` is the FRACTION stored in
 * `platform_settings.fee_leak_price_tolerance` (0.10). Inclusive at both ends:
 * ₱90,000 and ₱110,000 are both "the same price" as a ₱100,000 quote. A missing
 * or non-positive figure on either side is never a match.
 */
export function priceWithinTolerance(typedPhp: number | null, quotePhp: number | null, tolerance: number): boolean {
  if (typedPhp == null || quotePhp == null) return false;
  if (!Number.isFinite(typedPhp) || !Number.isFinite(quotePhp) || typedPhp <= 0 || quotePhp <= 0) return false;
  if (!Number.isFinite(tolerance) || tolerance < 0) return false;
  // Compared in centavos so 0.1 × 100,000 is exactly 10,000 (no float edge at the boundary).
  const typed = Math.round(typedPhp * 100);
  const quote = Math.round(quotePhp * 100);
  const allowance = Math.round(quote * tolerance);
  return Math.abs(typed - quote) <= allowance;
}

/** The default the migration writes — used only when the setting cannot be read (fail to the owner's number). */
export const FEE_LEAK_PRICE_TOLERANCE_DEFAULT = 0.1;

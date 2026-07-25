import type { SupabaseClient } from '@supabase/supabase-js';
import { FREE_BOOKING_LIMIT } from './booking-fee-lock';
import type { VendorAddonSku } from './vendor-addon-tier-pricing';

/**
 * vendor-addon-first5-free.ts — "free until your 6th booking" for the two
 * COUPLE-VISIBILITY add-ons (owner-locked 2026-07-25).
 *
 * THE RULE: while a vendor is still inside their first 5 bookings — the exact
 * same window in which Setnayan charges them **no booking fee** — the 3D Plan Ads
 * and Papic Challenge add-ons cost **₱0**. The moment their 6th booking locks and
 * Setnayan starts earning from them, those add-ons start charging the normal
 * banded price (`resolveVendorAddonPricePhp`). One sentence to a vendor: *you
 * don't pay us anything until you've won 5 clients here.*
 *
 * SCOPE (owner 2026-07-25): the two add-ons that make a vendor VISIBLE to
 * couples. The AI Chatbot and Deep Search charge from day one — Deep Search in
 * particular costs real money per run (~₱10–30 of web search + synthesis), so
 * giving it away would be a per-use loss rather than a marketing spend.
 *
 * REPLACES the 3D booth's one-time free 28-day cycle
 * (`vendor_profiles.booth_addon_trial_used_at`). When this policy is live the
 * trial is bypassed entirely: "free" is decided ONLY by the first-5 window, and
 * it repeats for as long as the vendor is inside it. With the flag off, the trial
 * behaves exactly as it does today.
 *
 * PURE decision + a DB reader that takes its client as an argument (no
 * server-only import), so this module stays unit-testable under `tsx --test` —
 * same shape as `vendor-3d-booth-pricing.ts`. The env flag lives in
 * `vendor-addon-first5-free-flag.ts` to keep the decision I/O-free.
 */

/**
 * The `event_vendors.status` values that count as a COMMITTED booking.
 *
 * ⚠ This list must equal the one the booking-fee RPC uses. `booking_fee_open_lock_charge`
 * (migration `20270927120000_booking_fee_lock_collection.sql`) bails with
 * `not_contracted` unless the row is in exactly these four states, and then ranks
 * it into the free-5 by counting the vendor's ledger rows. Mirroring the status
 * set is what makes "inside the first 5" here mean the same thing as "fee waived"
 * there. A drift test pins it against the sibling booked-status constant.
 */
export const COMMITTED_BOOKING_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

/**
 * The add-ons the owner made free during the first-5 window (2026-07-25). Kept as
 * data, not an `if`, so the set is one edit away and is asserted by tests.
 */
export const ADDONS_FREE_DURING_FIRST5: readonly VendorAddonSku[] = [
  'ads_3d_plan',
  'papic_challenge',
];

/** Is `sku` one of the add-ons covered by the first-5-free perk? PURE. */
export function isAddonFreeDuringFirst5(sku: VendorAddonSku): boolean {
  return ADDONS_FREE_DURING_FIRST5.includes(sku);
}

/**
 * Is a vendor with `committedBookingCount` committed bookings still inside their
 * first-5 window? PURE.
 *
 * ⚠ THE BOUNDARY: free through a count of {@link FREE_BOOKING_LIMIT} (5), paying
 * from 6. This is deliberately "free until their 6th booking", not "free until
 * they have used up 5" — a vendor sitting at exactly 5 has had 5 fee-free
 * bookings and no 6th has locked yet, so the perk still applies. That matches the
 * fee engine, where `isFreeBooking(5)` is true and only ordinal 6 pays.
 *
 * A non-finite or negative count fails CLOSED (not free): the count is read from
 * the DB, and a read that went wrong must never mint a free entitlement.
 */
export function vendorInFirst5Window(committedBookingCount: number): boolean {
  if (!Number.isFinite(committedBookingCount) || committedBookingCount < 0) return false;
  return committedBookingCount <= FREE_BOOKING_LIMIT;
}

export type First5FreeInput = {
  /** The add-on being priced. */
  sku: VendorAddonSku;
  /** The vendor's committed booking count (see {@link fetchVendorCommittedBookingCount}). */
  committedBookingCount: number;
  /**
   * `isVendorAddonFirst5FreeEnabled()` — the policy switch. Default false → this
   * whole module is inert and pricing is unchanged. Passed in so the decision
   * stays pure.
   */
  enabled?: boolean;
};

/**
 * THE decision: should this add-on be granted at ₱0 right now? PURE — the buy
 * action and the card read this same function, so the price shown and the price
 * charged can never disagree.
 */
export function addonIsFreeUnderFirst5(input: First5FreeInput): boolean {
  if (input.enabled !== true) return false;
  if (!isAddonFreeDuringFirst5(input.sku)) return false;
  return vendorInFirst5Window(input.committedBookingCount);
}

/**
 * How many bookings remain before the perk lapses (0 once they are out of the
 * window). Powers honest UI copy — "free for your next 2 bookings" beats a bare
 * ₱0. PURE.
 */
export function first5BookingsRemaining(committedBookingCount: number): number {
  if (!Number.isFinite(committedBookingCount) || committedBookingCount < 0) return 0;
  return Math.max(0, FREE_BOOKING_LIMIT - Math.floor(committedBookingCount));
}

/**
 * The entitlement window for a REPEATABLE free cycle: top up to one full cycle
 * from now, and **never beyond**. PURE.
 *
 * ⚠ WHY THIS EXISTS: the one-time trial was abuse-proof by construction — an
 * atomic `WHERE trial_used_at IS NULL` claim meant a double-click could not grant
 * two cycles. A first-5 grant is deliberately REPEATABLE, so that protection is
 * gone: without a cap, a vendor inside the window could click ten times and stack
 * 280 free days that keep running long after their 6th booking. Clamping to one
 * cycle ahead makes repeated clicks idempotent — every press lands on the same
 * ~28-days-from-now, and the perk lapses on schedule once they leave the window.
 *
 * `oneCycleFromNowIso` is supplied by the caller (e.g. `nextVendor3dBoothExpiry(null, now)`)
 * so each add-on keeps its own cycle length and this stays clock-free.
 */
export function nonStackingFreeExpiry(
  currentExpiresAt: string | null | undefined,
  oneCycleFromNowIso: string,
): string {
  const target = Date.parse(oneCycleFromNowIso);
  // A malformed target must never shorten a live window.
  if (!Number.isFinite(target)) return currentExpiresAt ?? oneCycleFromNowIso;
  const cur = currentExpiresAt ? Date.parse(currentExpiresAt) : Number.NaN;
  return Number.isFinite(cur) && cur > target
    ? (currentExpiresAt as string)
    : oneCycleFromNowIso;
}

// ── DB reader (client passed in — no server-only import) ─────────────────────

/**
 * Count a vendor's COMMITTED bookings — the flag-independent mirror of the
 * booking fee's `booking_ordinal`.
 *
 * ⚠ WHY NOT read `booking_fee_ledger` (where the real ordinal lives):
 * `collectBookingFeeAtLock` returns `{status:'disabled'}` and touches NO DB
 * before the RPC whenever `NEXT_PUBLIC_BOOKING_FEE_ENABLED` is off
 * (`lib/booking-fee-lock.server.ts`). That flag is off today, so the ledger is
 * EMPTY for every vendor — counting it would read 0 for everyone and make these
 * add-ons free forever. Counting `event_vendors` directly gives the same number
 * the fee would compute, and keeps working whichever way the fee flag is set.
 *
 * Only marketplace-linked vendors are counted (`marketplace_vendor_id`), matching
 * the RPC's `not_verified_vendor` bail — an off-platform/manual vendor row carries
 * no `vendor_profiles` identity and is never billable.
 *
 * Fails CLOSED: any error returns a count ABOVE the limit, so a broken read makes
 * the add-on chargeable rather than silently free. Never invert this.
 */
export async function fetchVendorCommittedBookingCount(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<number> {
  /** Fail-closed sentinel — outside the window, so nothing is granted free. */
  const FAIL_CLOSED = FREE_BOOKING_LIMIT + 1;
  try {
    const { count, error } = await supabase
      .from('event_vendors')
      .select('vendor_id', { count: 'exact', head: true })
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('status', COMMITTED_BOOKING_STATUSES as unknown as string[]);
    if (error) return FAIL_CLOSED;
    return typeof count === 'number' && Number.isFinite(count) && count >= 0
      ? count
      : FAIL_CLOSED;
  } catch {
    return FAIL_CLOSED;
  }
}

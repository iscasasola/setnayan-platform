/**
 * Vendor on-the-day Papic capture — the DB derivation layer over the pure model
 * in lib/vendor-papic-tier.ts. Owner-locked 2026-07-18 (DECISION_LOG).
 *
 * Reads three sources to answer "what tier is this vendor for this booked event,
 * and how many capture points have they spent?":
 *   1. vendor_event_unlocks.comp_reason → the derived BASE tier (founder-comp).
 *   2. vendor_papic_capture_grants (tier='unli') → a PAID Unli upgrade override.
 *   3. vendor_papic_captures → capture points already spent.
 *
 * 🚫 TOKENS RETIRED (owner 2026-07-21): the old lead_token_holds / tokens_burned
 * signals that used to earn Ltd are dead and are no longer read — only the
 * non-token founder-comp remains. (The fee-scaled allowance in vendor-papic-tier
 * supersedes this Lite/Ltd ladder once the booking-fee input is built.)
 *
 * ALL reads FAIL-CLOSED: the base tier degrades to 'lite' (the floor) and a paid
 * upgrade degrades to false. This perk is free, so a hiccup can only ever
 * UNDER-grant, never hand out a capability that wasn't earned/paid — and the
 * Unli check is money logic, so it must never open on error.
 *
 * Run on the SERVICE-ROLE admin client: vendor_event_unlocks is RLS-scoped to the
 * vendor owner/admin only, and the live console can run as a per-event grantee
 * (not the owner), so an RLS read would see nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  captureAllowance,
  pointsSpent,
  resolveVendorPapicTier,
  type CaptureAllowance,
  type VendorAcceptProvenance,
  type VendorPapicMedia,
  type VendorPapicTier,
} from '@/lib/vendor-papic-tier';

const EMPTY_PROVENANCE: VendorAcceptProvenance = {
  hasUnlock: false,
  founderComp: false,
};

/**
 * Read accept provenance for (vendor, event) from vendor_event_unlocks. No unlock
 * row → the vendor never accepted → floor (Lite). Only the founder-comp signal is
 * read now (tokens retired 2026-07-21 — see the module header).
 */
export async function fetchVendorAcceptProvenance(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<VendorAcceptProvenance> {
  try {
    const { data: unlock, error } = await admin
      .from('vendor_event_unlocks')
      .select('comp_reason')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !unlock) return EMPTY_PROVENANCE;

    const row = unlock as { comp_reason: string | null };
    return { hasUnlock: true, founderComp: row.comp_reason === 'founder' };
  } catch {
    return EMPTY_PROVENANCE;
  }
}

/**
 * Is there a PAID Unli upgrade for (vendor, event)? TRUE only when a
 * vendor_papic_capture_grants row has tier='unli' AND its upgrade_order_id order
 * is paid/fulfilled. Fail-CLOSED — this frees an unlimited paid tier, so any read
 * error or unpaid/unknown order returns false. An admin-granted row with no order
 * (upgrade_order_id NULL) is trusted (comp path).
 */
export async function hasPaidUnliUpgrade(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<boolean> {
  try {
    const { data: grant } = await admin
      .from('vendor_papic_capture_grants')
      .select('tier, upgrade_order_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (!grant) return false;
    const row = grant as { tier: string; upgrade_order_id: string | null };
    if (row.tier !== 'unli') return false;
    if (!row.upgrade_order_id) return true; // admin comp — no order to verify
    const { data: order } = await admin
      .from('orders')
      .select('status')
      .eq('order_id', row.upgrade_order_id)
      .maybeSingle();
    const status = (order as { status?: string } | null)?.status ?? '';
    return status === 'paid' || status === 'fulfilled';
  } catch {
    return false;
  }
}

/** The vendor's derived Papic tier for a booked event (base tier + any paid upgrade). */
export async function deriveVendorPapicTier(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<VendorPapicTier> {
  const [provenance, paidUnli] = await Promise.all([
    fetchVendorAcceptProvenance(admin, vendorProfileId, eventId),
    hasPaidUnliUpgrade(admin, vendorProfileId, eventId),
  ]);
  return resolveVendorPapicTier(provenance, paidUnli);
}

/** Capture points already spent by this vendor on this event (non-hidden rows). */
/**
 * WHAT THIS SUPPLIER ACTUALLY PAID IN BOOKING FEES FOR THIS EVENT, in pesos.
 *
 * Feeds `allowancePointsFor` — the owner's 2026-07-22 rule that a supplier's
 * free Papic shots scale with the fee they paid (50 at ₱0 → 200 at ₱4,000).
 *
 * 🔑 ONLY `status = 'paid'` COUNTS, and that is the whole point of the rule.
 * The other statuses are real and none of them is money we received:
 * `pending` (not yet), `failed`, `expired`, `waived_import`, and
 * `waived_free5` — the owner's own first-5-sourced-bookings-free rule, which
 * by construction means they paid ₱0 and get the 50-point floor. Reading a
 * waived charge as paid would hand the free five a 200-point allowance.
 *
 * ⚠ RETURNS null ON A READ ERROR, NEVER 0 — and null is NOT "they paid
 * nothing". `allowancePointsFor` treats null as "unproven" and falls back to
 * the tier's own number, so a transient failure can never MINT points. That is
 * the mirror of `fetchVendorPapicPointsSpent` above, which fails closed in the
 * other direction by assuming the budget is exhausted. Both refuse to invent
 * generosity out of an outage.
 *
 * ⚠ Supabase does not throw on a failed read — it resolves with `{ error }` —
 * so the explicit error check below is the only one that exists.
 */
export async function fetchVendorBookingFeePaidPhp(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number | null> {
  if (!vendorProfileId || !eventId) return null;
  try {
    const { data, error } = await client
      .from('booking_fee_charges')
      .select('amount_charged_centavos')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .eq('status', 'paid');
    if (error) return null; // unproven — never an uplift
    const centavos = (data ?? []).reduce(
      (sum, r) => sum + Math.max(0, Number((r as { amount_charged_centavos?: number }).amount_charged_centavos) || 0),
      0,
    );
    return Math.floor(centavos / 100);
  } catch {
    return null;
  }
}

export async function fetchVendorPapicPointsSpent(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number> {
  // Money logic (see module header): a read failure must FAIL-CLOSED. Reporting
  // 0 spent would hand the vendor a full fresh budget on any transient error.
  // Return an assume-exhausted sentinel so captureAllowance clamps pointsLeft to
  // 0 (blocked) — a metering outage stops capture, never silently un-meters it.
  const ASSUME_EXHAUSTED = Number.MAX_SAFE_INTEGER;
  try {
    const { data, error } = await client
      .from('vendor_papic_captures')
      .select('media_type')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .is('hidden_at', null);
    if (error) return ASSUME_EXHAUSTED;
    return pointsSpent((data ?? []) as { media_type: VendorPapicMedia }[]);
  } catch {
    return ASSUME_EXHAUSTED;
  }
}

/**
 * Tier + live allowance (points spent, remaining, video-allowed) for a booked event.
 *
 * ⚠ IT MUST READ THE SAME THREE THINGS THE CAPTURE ROUTE READS. This is what a
 * supplier SEES; the route is what a supplier GETS. When this was wired to the
 * booking fee, missing it here would have shown a supplier "50 credits" on their
 * own screen while the route happily accepted their 125th — a screen
 * contradicting the screen beside it, with no error anywhere. Pinned by
 * `the-fee-reaches-the-allowance.test.ts`.
 */
export async function fetchVendorPapicAllowance(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<CaptureAllowance> {
  const [tier, spent, feePaidPhp] = await Promise.all([
    deriveVendorPapicTier(admin, vendorProfileId, eventId),
    fetchVendorPapicPointsSpent(admin, vendorProfileId, eventId),
    fetchVendorBookingFeePaidPhp(admin, vendorProfileId, eventId),
  ]);
  return captureAllowance(tier, spent, feePaidPhp);
}

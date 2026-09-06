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
  VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
  VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
  offerPack,
  type VendorPapicPortfolioCredits,
} from '@/lib/vendor-papic-credits';
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

/**
 * THE CREDITS THIS SUPPLIER HOLDS FOR THIS EVENT — the sum of their ledger,
 * `vendor_papic_portfolio_credit_grants` (owner 2026-09-05: 5% of the booking
 * fee paid, cap 1,000, no floor; plus ₱500 packs (100 credits since
 * 2026-09-06); written only on admin
 * payment approval by lib/sku-activation.ts).
 *
 * 🔁 This replaced `fetchVendorBookingFeePaidPhp` on 2026-09-05 (owner:
 * *"replace it"*). That reader derived the allowance LIVE from
 * `booking_fee_charges` at ₱5/point; the rate is retired and the credits are
 * now a written ledger, so the allowance reads what was granted rather than
 * re-deriving it. Two of its rules survive unchanged, because they were never
 * about the rate:
 *
 * ⚠ RETURNS null ON A READ ERROR, NEVER 0 — and null is NOT "they hold
 * nothing". `allowancePointsFor` treats null as "unproven" and falls back to
 * the tier's own number, so a transient failure can never MINT points. That is
 * the mirror of `fetchVendorPapicPointsSpent` below, which fails closed in the
 * other direction by assuming the budget is exhausted. Both refuse to invent
 * generosity out of an outage.
 *
 * 🔑 `waived_free5` / `waived_import` STILL MEAN THEY PAID NOTHING — enforced
 * one step earlier now: the activation hook grants only from a charge whose
 * status is `paid`, so a waived charge never produces a ledger row to sum.
 *
 * ⚠ Supabase does not throw on a failed read — it resolves with `{ error }` —
 * so the explicit error check below is the only one that exists.
 */
export async function fetchVendorPapicCreditsGranted(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number | null> {
  if (!vendorProfileId || !eventId) return null;
  try {
    const { data, error } = await client
      .from('vendor_papic_portfolio_credit_grants')
      .select('credits')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId);
    if (error) return null; // unproven — never an uplift
    return (data ?? []).reduce(
      (sum, r) => sum + Math.max(0, Math.floor(Number((r as { credits?: number }).credits) || 0)),
      0,
    );
  } catch {
    return null;
  }
}

/**
 * The ₱ price of the credit pack, read from `vendor_billing_catalog` — the only
 * place a vendor price is allowed to live (admin-managed at /admin/pricing).
 * `null` when the row is missing, inactive or unreadable: render "unavailable",
 * never a remembered number.
 */
export async function fetchVendorPapicPackPricePhp(
  client: SupabaseClient,
): Promise<number | null> {
  try {
    const { data, error } = await client
      .from('vendor_billing_catalog')
      .select('price_php, is_active')
      .eq('sku_code', VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { price_php?: number | string | null; is_active?: boolean | null };
    if (row.is_active !== true) return null;
    const price = Number(row.price_php);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/**
 * WHAT G3 CALLS — the supplier's credits, spend and pack, in ONE read.
 *
 * Owner 2026-09-05: a grant under a pack's worth still lands and the ₱500 pack is the
 * CTA beside it. This returns everything that surface needs so it re-derives
 * nothing: the ledger total, what the same meter has already spent, the
 * allowance's own "left" (tier floor included — the SAME number the capture
 * screen shows), and the pack's SKU, live price and credit count.
 *
 * Run on the SERVICE-ROLE admin client, like every reader in this module.
 */
export async function fetchVendorPapicPortfolioCredits(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<VendorPapicPortfolioCredits> {
  const [allowance, credits, packPricePhp] = await Promise.all([
    fetchVendorPapicAllowance(admin, vendorProfileId, eventId),
    fetchVendorPapicCreditsGranted(admin, vendorProfileId, eventId),
    fetchVendorPapicPackPricePhp(admin),
  ]);
  return {
    credits,
    spent: allowance.pointsSpent,
    left: allowance.pointsLeft,
    packSkuCode: VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
    packPricePhp,
    packCredits: VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
    offerPack: offerPack(credits ?? 0),
  };
}

/** Capture points already spent by this vendor on this event (non-hidden rows). */
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
 * credit ledger, missing it here would have shown a supplier "50 credits" on
 * their own screen while the route happily accepted their 125th — a screen
 * contradicting the screen beside it, with no error anywhere. Pinned by
 * `the-fee-reaches-the-allowance.test.ts`.
 */
export async function fetchVendorPapicAllowance(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<CaptureAllowance> {
  const [tier, spent, creditsGranted] = await Promise.all([
    deriveVendorPapicTier(admin, vendorProfileId, eventId),
    fetchVendorPapicPointsSpent(admin, vendorProfileId, eventId),
    fetchVendorPapicCreditsGranted(admin, vendorProfileId, eventId),
  ]);
  return captureAllowance(tier, spent, creditsGranted);
}

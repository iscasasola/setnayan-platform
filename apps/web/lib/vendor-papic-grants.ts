/**
 * Vendor on-the-day Papic capture — the DB derivation layer over the pure model
 * in lib/vendor-papic-tier.ts. Owner-locked 2026-07-18 (DECISION_LOG).
 *
 * Reads three sources to answer "what tier is this vendor for this booked event,
 * and how many capture points have they spent?":
 *   1. vendor_event_unlocks (+ lead_token_holds) → the derived BASE tier.
 *   2. vendor_papic_capture_grants (tier='unli') → a PAID Unli upgrade override.
 *   3. vendor_papic_captures → capture points already spent.
 *
 * ALL reads FAIL-CLOSED: the base tier degrades to 'lite' (the floor) and a paid
 * upgrade degrades to false. This perk is free, so a hiccup can only ever
 * UNDER-grant, never hand out a capability that wasn't earned/paid — and the
 * Unli check is money logic, so it must never open on error.
 *
 * Run on the SERVICE-ROLE admin client: vendor_event_unlocks / lead_token_holds
 * are RLS-scoped to the vendor owner/admin only, and the live console can run as
 * a per-event grantee (not the owner), so an RLS read would see nothing.
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
  tokensBurned: 0,
  hasActiveHold: false,
};

/**
 * Read accept provenance for (vendor, event) from vendor_event_unlocks
 * (+ lead_token_holds). No unlock row → the vendor never accepted → floor (Lite).
 */
export async function fetchVendorAcceptProvenance(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<VendorAcceptProvenance> {
  try {
    const { data: unlock, error } = await admin
      .from('vendor_event_unlocks')
      .select('comp_reason, tokens_burned')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !unlock) return EMPTY_PROVENANCE;

    const row = unlock as { comp_reason: string | null; tokens_burned: number | null };
    const founderComp = row.comp_reason === 'founder';
    const tokensBurned = Number(row.tokens_burned) || 0;

    // Only need the hold lookup when neither founder-comp nor a burn is recorded:
    // a still-'held' token (hold path, pre-reply) reads tokens_burned=0 but IS a
    // token the vendor committed — it counts as spent for the tier.
    let hasActiveHold = false;
    if (!founderComp && tokensBurned <= 0) {
      const { data: hold } = await admin
        .from('lead_token_holds')
        .select('status')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('event_id', eventId)
        .in('status', ['held', 'consumed'])
        .gt('tokens', 0)
        .maybeSingle();
      hasActiveHold = Boolean(hold);
    }

    return { hasUnlock: true, founderComp, tokensBurned, hasActiveHold };
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
export async function fetchVendorPapicPointsSpent(
  client: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<number> {
  try {
    const { data } = await client
      .from('vendor_papic_captures')
      .select('media_type')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('event_id', eventId)
      .is('hidden_at', null);
    return pointsSpent((data ?? []) as { media_type: VendorPapicMedia }[]);
  } catch {
    return 0;
  }
}

/** Tier + live allowance (points spent, remaining, video-allowed) for a booked event. */
export async function fetchVendorPapicAllowance(
  admin: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<CaptureAllowance> {
  const [tier, spent] = await Promise.all([
    deriveVendorPapicTier(admin, vendorProfileId, eventId),
    fetchVendorPapicPointsSpent(admin, vendorProfileId, eventId),
  ]);
  return captureAllowance(tier, spent);
}

import 'server-only';
import { createAdminClient } from './supabase/admin';
import { isVendorFeatureGateEnabled, resolveVendorTier } from './vendor-feature-gate';
import { canUseCalls } from './vendor-tier-caps';

/**
 * Is in-thread voice/video calling unlocked for the thread whose vendor is
 * `vendorProfileId`?
 *
 * Calls became a PAID-vendor capability on 2026-07-13 (owner: "a service for
 * the paid") — any paid plan (Solo+), NOT Free/Verified. The gate rides the
 * shared vendor tier-gate switch (VENDOR_TIER_FEATURE_GATE), FLAG-DARK by
 * default so the free P2P transport stays open (unchanged behaviour) until the
 * owner enables paid gating in prod.
 *
 *   • gate OFF  → always true (calling open to everyone, today's behaviour).
 *   • gate ON   → true only when the vendor's tier can use calls (Solo+).
 *
 * The vendor tier is read with the ADMIN client — a read-only capability probe
 * on the thread's OWN vendor, so a couple-initiated call resolves it reliably
 * regardless of vendor_profiles read policies. It is NOT an authorization
 * bypass: the actual call insert (thread-call-actions.ts) still rides the
 * caller's RLS-scoped session.
 *
 * The single source of truth for this gate, shared by the authoritative server
 * action AND the four thread surfaces that render the call launcher (so the UI
 * lock and the server refusal can never disagree).
 */
export async function resolveThreadCallsEnabled(vendorProfileId: string): Promise<boolean> {
  if (!isVendorFeatureGateEnabled()) return true;
  const tier = await resolveVendorTier(createAdminClient(), vendorProfileId);
  return canUseCalls(tier);
}

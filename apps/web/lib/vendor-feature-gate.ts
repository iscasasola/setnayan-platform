/**
 * HYBRID tier feature gate — FLAG-DARK (owner 2026-07-01).
 *
 * The full-catalog audit found most Solo/Pro benefits were BUILT but ungated,
 * so a free vendor already got them. The owner chose HYBRID: gate the premium
 * few (Demand Radar + Theft Watch → Pro · funnel time-series → Solo) and keep
 * the ops spine free. The caps live in `vendor-tier-caps.ts`
 * (marketIntel / theftWatch / performanceTrends) with `canSee*` helpers.
 *
 * WHY DARK BY DEFAULT: exactly the `vendor-search-gate.ts` situation — today the
 * one real founder vendor + every demo/test vendor are `tier_state='free'`, so
 * activating the gates now would lock them out of surfaces they use. The gates
 * ship fully wired but dark; the owner flips `VENDOR_TIER_FEATURE_GATE=true`
 * the day paid vendors exist in prod. Default OFF → behaviour is unchanged.
 *
 * The `canSee*` cap helpers stay pure and always correct; ONLY the page-level
 * enforcement is flag-guarded, so any surface can adopt the gate by combining
 * `isVendorFeatureGateEnabled()` with the relevant `canSee*` helper.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { asVendorTier, type VendorTier } from './vendor-tier-caps';

export function isVendorFeatureGateEnabled(): boolean {
  return process.env.VENDOR_TIER_FEATURE_GATE === 'true';
}

/**
 * Resolve a vendor's `tier_state`. It is deliberately NOT part of the shared
 * `FULL_VENDOR_PROFILE_SELECT` (this keeps the gate additive), so read it with
 * a targeted single-column query keyed on the primary-key `vendor_profile_id`.
 * Defaults to `free` when absent/unknown.
 */
export async function resolveVendorTier(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorTier> {
  const { data } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  return asVendorTier((data as { tier_state?: string | null } | null)?.tier_state);
}

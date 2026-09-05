/**
 * Vendor tier-comp reader — the vendor half of `/admin/gifts`.
 *
 * ⚠ THERE IS NO DEDICATED GRANTS LEDGER FOR THIS, UNLIKE `comp_grants`. A
 * vendor's tier comp lives only as the live `vendor_profiles.tier_state` +
 * `tier_expires_at` columns, set by `setVendorTier`
 * (apps/web/app/admin/vendors/actions.ts). History beyond "what it is right
 * now" exists only in `admin_audit_log` (action='vendor_tier_set').
 *
 * 🔑 EVERY NON-FREE VENDOR TODAY IS, BY CONSTRUCTION, A COMP. Self-serve
 * vendor subscription checkout does not exist yet — `setVendorTier` is
 * documented as "the ONLY way to reach Pro/Enterprise" until it ships. So
 * reading `tier_state <> 'free'` as "comped" is exactly true right now.
 * IT WILL STOP BEING TRUE the moment self-serve checkout lands — a real
 * paying vendor will look identical to a comped one under this query. There
 * is no `source`/`is_comp` flag to tell them apart. Whoever builds self-serve
 * checkout MUST add that distinction before this reader is trusted again;
 * this comment is the trip-wire, not a promise it will be remembered.
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import type { VendorTier } from './vendor-tier-caps';

export type CompedVendorRow = {
  vendor_profile_id: string;
  public_id: string;
  business_name: string;
  tier_state: VendorTier;
  tier_expires_at: string | null;
};

/**
 * Fetch every vendor currently holding a non-free tier. See the module
 * docblock's trip-wire before trusting this once self-serve billing ships.
 */
export async function fetchCompedVendors(
  admin: SupabaseClient,
  limit = 200,
): Promise<CompedVendorRow[]> {
  const { data, error } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, public_id, business_name, tier_state, tier_expires_at')
    .neq('tier_state', 'free')
    .order('tier_expires_at', { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`fetchCompedVendors failed: ${error.message}`);
  return (data ?? []) as CompedVendorRow[];
}

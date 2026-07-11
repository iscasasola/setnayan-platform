import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';

type VendorTierRow = { tier_state: string | null; tier_expires_at: string | null };

/**
 * True if `userId` OWNS a vendor profile at Enterprise tier or above (Custom
 * counts) whose tier has NOT lapsed. The /api/v1 SDK is an enterprise-vendor
 * feature (owner 2026-07-11: "api is for enterprise vendor accounts"), so this
 * gates BOTH API-key minting (dashboard/api-keys) and every bearer request
 * (lib/api-auth.ts — downgrade defense).
 *
 * Owner-scoped (vendor_profiles.user_id) — a shop OWNER sets up integrations,
 * not every team member. Tier lapse is login-driven (expire_vendor_tiers runs on
 * login), so an API-only caller never triggers the sweep — hence we check
 * `tier_expires_at` explicitly. Robust to the future multi-shop model: any owned
 * profile that is active-enterprise-or-above passes.
 */
export async function userOwnsActiveEnterpriseVendor(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('vendor_profiles')
    .select('tier_state, tier_expires_at')
    .eq('user_id', userId);
  if (!data || data.length === 0) return false;
  const now = Date.now();
  return (data as VendorTierRow[]).some((r) => {
    if (!isTierAtLeast(r.tier_state, 'enterprise')) return false;
    return !r.tier_expires_at || new Date(r.tier_expires_at).getTime() > now;
  });
}

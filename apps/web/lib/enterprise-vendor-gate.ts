import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';

type VendorTierRow = { tier_state: string | null; tier_expires_at: string | null };

/**
 * True if `userId` OWNS a vendor profile at Enterprise (Ultra) tier whose tier
 * has NOT lapsed. The /api/v1 SDK is an enterprise-vendor
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

/**
 * Resolves `userId` → the vendor profile that has been GRANTED API access, or null.
 *
 * ⛔ ALWAYS NULL SINCE 2026-11-06, AND THAT IS DELIBERATE. API access was an explicit per-Custom-plan entitlement
 * (owner 2026-07-11: "available if custom plan of enterprise requests allowing api") — `composition.api_access` on an
 * ACTIVE `vendor_custom_plans` row was the ONLY way to hold it. The Custom supplier plan was retired from the app on
 * 2026-11-06 (owner: *"from the app"*), so no grant can exist and this fails CLOSED: no key can be minted and every
 * bearer request is refused `no_api_access`. Whether Ultra (or anything) should carry API access instead is an OWNER
 * decision — it is NOT made here. Do not re-open it by reading `vendor_custom_plans` again.
 *
 * The signature is kept so `lib/api-auth.ts` and the api-keys page stay one call each when the owner decides.
 */
export async function resolveApiVendor(
  _admin: SupabaseClient,
  _userId: string,
): Promise<{ vendorProfileId: string } | null> {
  return null;
}

/**
 * True if `userId` has been granted API access. Thin boolean wrapper over
 * {@link resolveApiVendor} for the mint-gate + copy (dashboard/api-keys). Always
 * false while no plan carries API access (see resolveApiVendor).
 */
export async function userHasApiAccessGrant(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await resolveApiVendor(admin, userId)) !== null;
}

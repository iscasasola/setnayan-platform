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

type OwnedVendorRow = {
  vendor_profile_id: string;
  tier_state: string | null;
  tier_expires_at: string | null;
};

/**
 * Resolves `userId` → the vendor profile that has been GRANTED API access, or
 * null. API access is an EXPLICIT per-Custom-plan entitlement (owner 2026-07-11:
 * "available if custom plan of enterprise requests allowing api"), NOT a side
 * effect of buying Enterprise. Two conditions, both required:
 *   1. the user OWNS a vendor profile at Enterprise-or-above (Custom counts)
 *      whose tier has not lapsed, AND
 *   2. that profile has an ACTIVE vendor_custom_plans row whose
 *      composition.api_access === true.
 *
 * The returned vendor_profile_id is the single shop every /api/v1/vendor/* route
 * scopes to — resolved ONCE here (at auth time) so routes never re-derive it.
 *
 * Fail-closed: any read failure, missing plan, or absent flag → null. Owner-path
 * only (vendor_profiles.user_id) — a shop OWNER sets up integrations, matching
 * userOwnsActiveEnterpriseVendor. Uses the admin client (no auth.uid() session on
 * an API request), applying the user_id filter explicitly.
 */
export async function resolveApiVendor(
  admin: SupabaseClient,
  userId: string,
): Promise<{ vendorProfileId: string } | null> {
  const { data: profiles } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, tier_state, tier_expires_at')
    .eq('user_id', userId);
  if (!profiles || profiles.length === 0) return null;

  const now = Date.now();
  const activeIds = (profiles as OwnedVendorRow[])
    .filter(
      (p) =>
        isTierAtLeast(p.tier_state, 'enterprise') &&
        (!p.tier_expires_at || new Date(p.tier_expires_at).getTime() > now),
    )
    .map((p) => p.vendor_profile_id);
  if (activeIds.length === 0) return null;

  const { data: plans } = await admin
    .from('vendor_custom_plans')
    .select('vendor_profile_id, composition')
    .in('vendor_profile_id', activeIds)
    .eq('status', 'active')
    // Deterministic pick: if a (future multi-shop) owner holds more than one
    // granted plan, always resolve to the same shop across requests. Today
    // vendor_profiles.user_id is UNIQUE so activeIds has at most one entry.
    .order('created_at', { ascending: true });

  const blessed = (plans ?? []).find((p) => {
    const comp = (p as { composition?: { api_access?: boolean } | null }).composition;
    return comp?.api_access === true;
  }) as { vendor_profile_id: string } | undefined;

  return blessed ? { vendorProfileId: blessed.vendor_profile_id } : null;
}

/**
 * True if `userId` has been granted API access via an active Custom plan. Thin
 * boolean wrapper over {@link resolveApiVendor} for the mint-gate + upsell copy
 * (dashboard/api-keys), which only need yes/no. Every bearer request re-checks
 * this via resolveApiVendor, so an admin un-ticking api_access (then
 * re-activating), replacing the plan, or demoting the tier cuts access on the
 * next call. A PAID custom plan also auto-lapses on non-renewal via the stamped
 * tier_expires_at + sweep_vendor_tier_expiry (see the note in lib/api-auth.ts);
 * only comp/off-platform custom deals (NULL expiry) are admin-revocation-only.
 */
export async function userHasApiAccessGrant(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return (await resolveApiVendor(admin, userId)) !== null;
}

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
import {
  VENDOR_DEAL_AUDIENCES,
  type PromotedVendorTier,
  type VendorDealAudience,
} from './promo-free-windows';

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

/**
 * A vendor COHORT deal — one `promo_free_windows` row with a vendor audience.
 * The other half of the vendor list on `/admin/gifts` (2026-09-05): the rows
 * above are one vendor each; these are one WINDOW each, granting every vendor
 * who qualifies. Read side only — the writer is `createFreeWindow` in
 * app/admin/pricing/_surfaces/free-windows-actions.ts, and the per-vendor
 * resolution lives in lib/promo-free-windows.ts.
 */
export type VendorDealRow = {
  promo_window_id: string;
  title: string;
  audience_type: VendorDealAudience;
  promoted_vendor_tier: PromotedVendorTier;
  covered_service_keys: string[];
  starts_at: string;
  ends_at: string;
  deal_length_days: number | null;
  is_active: boolean;
  show_banner: boolean;
};

/**
 * Every vendor-audience window that is live or still to come — active, and
 * not yet past the last moment anyone could hold its deal (ends_at plus the
 * deal length, when set). Ended and deactivated windows stay on the Catalog
 * Studio tab; this page promises "everything currently comped". THROWS on a
 * refused read so ConsoleTable says "couldn't read", never "no deals".
 */
export async function fetchVendorDealWindows(
  admin: SupabaseClient,
  limit = 200,
): Promise<VendorDealRow[]> {
  const { data, error } = await admin
    .from('promo_free_windows')
    .select(
      'promo_window_id, title, audience_type, promoted_vendor_tier, covered_service_keys, starts_at, ends_at, deal_length_days, is_active, show_banner',
    )
    .eq('is_active', true)
    .in('audience_type', [...VENDOR_DEAL_AUDIENCES])
    .order('starts_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`fetchVendorDealWindows failed: ${error.message}`);
  const now = Date.now();
  return ((data ?? []) as VendorDealRow[]).filter((w) => {
    const end = new Date(w.ends_at).getTime();
    const horizon = w.deal_length_days ? end + w.deal_length_days * 86_400_000 : end;
    return horizon > now;
  });
}

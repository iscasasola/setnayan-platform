import type { SupabaseClient } from '@supabase/supabase-js';
import { findSku, formatCentavosPhp, priceCentavosToPeso } from './sku-catalog';

/**
 * Boosted Ads + Sponsored Boost ladder (Iteration 0022 § 5b, locked 2026-05-16).
 *
 * SKUs already seeded in service_catalog by
 * `20260516000000_v1_sku_lock_service_catalog.sql`. The per-vendor subscription
 * ledger lives in `vendor_ad_subscriptions`
 * (`20260516220000_vendor_ad_subscriptions.sql`).
 *
 * Pricing is stored in PHP centavos everywhere. UI converts via
 * `formatCentavosPhp()` from `./sku-catalog`.
 */

export type AdTier = 'boosted' | 'sponsored';

export type AdSkuCode =
  | 'boosted_ads_5km'
  | 'boosted_ads_10km'
  | 'boosted_ads_20km'
  | 'sponsored_boost_quarterly_30km'
  | 'sponsored_boost_annual_30km';

export type AdTierOption = {
  skuCode: AdSkuCode;
  tier: AdTier;
  /** Marketing-facing label. */
  label: string;
  /** Radius (km) the listing surfaces within. */
  radiusKm: 5 | 10 | 20 | 30;
  /** Term length surface label (e.g. "1 week", "3 months", "12 months"). */
  termLabel: string;
  /** Term length in days; drives `expires_at = started_at + termDays`. */
  termDays: number;
  /** Centavos snapshot from service_catalog. */
  priceCentavos: number;
  /** Per-spec one-liner that explains the use case. */
  useCase: string;
  /** If TRUE, gated to `public_visibility = 'verified'` vendors. */
  verifiedOnly: boolean;
  /** Auto-renew default at checkout. */
  autoRenewDefault: boolean;
};

export const AD_TIER_OPTIONS: ReadonlyArray<AdTierOption> = [
  {
    skuCode: 'boosted_ads_5km',
    tier: 'boosted',
    label: 'Boosted Ads · 5km',
    radiusKm: 5,
    termLabel: '1 week',
    termDays: 7,
    priceCentavos: 500000,
    useCase: 'Try-this-week local push',
    // Boosted Ads tier is open to any verified vendor (verified-only badge
    // is a prerequisite for ads per § 3 Pro Weekly perks).
    verifiedOnly: true,
    autoRenewDefault: true,
  },
  {
    skuCode: 'boosted_ads_10km',
    tier: 'boosted',
    label: 'Boosted Ads · 10km',
    radiusKm: 10,
    termLabel: '1 week',
    termDays: 7,
    priceCentavos: 800000,
    useCase: 'Citywide reach',
    verifiedOnly: true,
    autoRenewDefault: true,
  },
  {
    skuCode: 'boosted_ads_20km',
    tier: 'boosted',
    label: 'Boosted Ads · 20km',
    radiusKm: 20,
    termLabel: '1 week',
    termDays: 7,
    priceCentavos: 1500000,
    useCase: 'Regional reach',
    verifiedOnly: true,
    autoRenewDefault: true,
  },
  {
    skuCode: 'sponsored_boost_quarterly_30km',
    tier: 'sponsored',
    label: 'Sponsored Boost · Quarterly',
    radiusKm: 30,
    termLabel: '3 months',
    termDays: 90,
    priceCentavos: 25000000,
    useCase: 'Marquee premium presence — quarterly commit',
    verifiedOnly: true,
    autoRenewDefault: false,
  },
  {
    skuCode: 'sponsored_boost_annual_30km',
    tier: 'sponsored',
    label: 'Sponsored Boost · Annual',
    radiusKm: 30,
    termLabel: '12 months',
    termDays: 365,
    priceCentavos: 80000000,
    useCase: 'Marquee premium presence — annual commit (~20% saving vs Quarterly × 4)',
    verifiedOnly: true,
    autoRenewDefault: true,
  },
];

/** Lookup by SKU code; returns `undefined` for unknown codes. */
export function findAdOption(skuCode: string): AdTierOption | undefined {
  return AD_TIER_OPTIONS.find((opt) => opt.skuCode === skuCode);
}

/** Boosted-tier options (5/10/20km weekly). */
export const BOOSTED_OPTIONS = AD_TIER_OPTIONS.filter((o) => o.tier === 'boosted');

/** Sponsored-tier options (Quarterly + Annual at 30km). */
export const SPONSORED_OPTIONS = AD_TIER_OPTIONS.filter((o) => o.tier === 'sponsored');

export type VendorAdSubscriptionRow = {
  ad_subscription_id: string;
  vendor_profile_id: string;
  sku_code: AdSkuCode;
  radius_km: number;
  gross_centavos: number;
  payment_method_key: string | null;
  order_id: string | null;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  cancelled_at: string | null;
  cancel_reason: string | null;
  refund_centavos: number | null;
  cancelled_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const SUBSCRIPTION_SELECT =
  'ad_subscription_id,vendor_profile_id,sku_code,radius_km,gross_centavos,payment_method_key,order_id,started_at,expires_at,auto_renew,cancelled_at,cancel_reason,refund_centavos,cancelled_by_user_id,notes,created_at,updated_at';

/**
 * Pull every ad subscription row for a vendor — active and cancelled.
 * Sorted newest-first by `created_at`.
 */
export async function fetchVendorAdSubscriptions(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorAdSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('vendor_ad_subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    // Migration may not be applied yet on this environment; degrade gracefully.
    if (error.code === '42P01') return [];
    throw new Error(`fetchVendorAdSubscriptions failed: ${error.message}`);
  }
  return (data ?? []) as VendorAdSubscriptionRow[];
}

/**
 * Pull every ad subscription across all vendors — admin-only surface.
 * `statusFilter` narrows to active / cancelled / expired. Newest-first.
 */
export async function fetchAllAdSubscriptionsForAdmin(
  admin: SupabaseClient,
  statusFilter: 'active' | 'cancelled' | 'expired' | 'all' = 'active',
): Promise<VendorAdSubscriptionRow[]> {
  let query = admin
    .from('vendor_ad_subscriptions')
    .select(SUBSCRIPTION_SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  const nowIso = new Date().toISOString();
  if (statusFilter === 'active') {
    query = query.is('cancelled_at', null).gt('expires_at', nowIso);
  } else if (statusFilter === 'cancelled') {
    query = query.not('cancelled_at', 'is', null);
  } else if (statusFilter === 'expired') {
    query = query.is('cancelled_at', null).lt('expires_at', nowIso);
  }
  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return [];
    throw new Error(`fetchAllAdSubscriptionsForAdmin failed: ${error.message}`);
  }
  return (data ?? []) as VendorAdSubscriptionRow[];
}

/**
 * Active subscription = `cancelled_at IS NULL AND expires_at > now()`. The
 * V1 marketing surface limits a vendor to a single active row per tier; if
 * the vendor has both a Boosted Ads and a Sponsored Boost the latter wins
 * for marketplace-radius purposes.
 */
export function isActiveAdSubscription(row: VendorAdSubscriptionRow): boolean {
  if (row.cancelled_at) return false;
  return new Date(row.expires_at).getTime() > Date.now();
}

/**
 * Days remaining until expiry, rounded up to the nearest whole day. Returns 0
 * for already-expired or cancelled rows.
 */
export function daysRemaining(row: VendorAdSubscriptionRow): number {
  if (row.cancelled_at) return 0;
  const ms = new Date(row.expires_at).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/**
 * Pull active ad subscriptions for many vendor profile IDs in one round trip
 * (used by the public `/vendors` marketplace to surface Boosted/Sponsored
 * badges + extend each card's visibility radius). Reads the
 * `vendor_active_ads` view so we get the single most-permissive row per
 * vendor (Sponsored > Boosted; larger radius wins).
 */
export type ActiveAdLookup = {
  vendor_profile_id: string;
  tier: AdTier;
  radius_km: number;
  sku_code: AdSkuCode;
  expires_at: string;
};

export async function fetchActiveAdLookups(
  supabase: SupabaseClient,
  vendorProfileIds: string[],
): Promise<Map<string, ActiveAdLookup>> {
  if (vendorProfileIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('vendor_active_ads')
    .select('vendor_profile_id,sku_code,tier,radius_km,expires_at')
    .in('vendor_profile_id', vendorProfileIds);
  if (error) {
    // View may not exist yet (pre-migration env) — degrade silently.
    if (error.code === '42P01') return new Map();
    throw new Error(`fetchActiveAdLookups failed: ${error.message}`);
  }
  const out = new Map<string, ActiveAdLookup>();
  for (const row of (data ?? []) as ActiveAdLookup[]) {
    out.set(row.vendor_profile_id, row);
  }
  return out;
}

/** Format the SKU price for marketing copy: e.g. "₱5,000". */
export function adPriceDisplay(option: AdTierOption): string {
  return formatCentavosPhp(option.priceCentavos);
}

/**
 * Effective monthly rate for a given term — useful for the Sponsored Boost
 * sticker copy. Returns rounded pesos.
 */
export function effectiveMonthlyPesos(option: AdTierOption): number {
  const months = option.termDays / 30;
  if (months <= 0) return 0;
  return Math.round(priceCentavosToPeso(option.priceCentavos) / months);
}

/**
 * Sanity helper — the new SKUs should match service_catalog's price snapshot.
 * Used by the marketing surface to assert nothing has drifted. Returns the
 * mismatch list if any. Empty list = clean.
 */
export function detectAdPriceDrift(): string[] {
  const drift: string[] = [];
  for (const opt of AD_TIER_OPTIONS) {
    const sku = findSku(opt.skuCode);
    if (!sku) {
      drift.push(`${opt.skuCode}: not in SKU_CATALOG`);
      continue;
    }
    if (sku.priceCentavos !== opt.priceCentavos) {
      drift.push(
        `${opt.skuCode}: catalog=${sku.priceCentavos} vs option=${opt.priceCentavos}`,
      );
    }
  }
  return drift;
}

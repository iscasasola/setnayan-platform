/**
 * apps/web/lib/promo-free-windows.ts
 *
 * Reader for admin-scheduled "free this weekend" promo windows
 * (public.promo_free_windows · migration 20270908268882).
 *
 * MODEL — entitlement-OR, not a ₱0 order. A live window (is_active AND now within
 * [starts_at, ends_at)) makes its covered SKUs resolve as OWNED for the audience,
 * ORed into eventSkuActive / eventActiveSkus in lib/entitlements.ts exactly like
 * comp_grants and founder_seats. No order, no checkout, no BIR receipt. The unlock
 * is EPHEMERAL — it reverts when the window closes unless the couple separately
 * bought the SKU. (Claim-to-keep — mint a real comp grant on first use during a
 * window — is a deliberate follow-up, not V1.)
 *
 * GATE — env PROMO_FREE_WINDOWS_ENABLED (default OFF). While off, every reader
 * short-circuits BEFORE touching the DB, so entitlements + banner are byte-
 * identical to today. The owner flips the flag the day a promo should go live
 * (belt-and-suspenders over is_active + the date window).
 *
 * AUDIENCE — V1 resolves the 'all_couples' audience only. The window is global
 * (same free SKU set for every couple), so there is no per-event scoping and no
 * cross-account leak to guard — this is a public promo, unlike comp_grants.
 *
 * Reads through the service-role admin client (promo_free_windows is admin-only
 * RLS); graceful-degrades to empty on any error / missing env, so a promo read
 * NEVER blocks a render or a gate. Mirrors the v2-catalog reader contract.
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { tierRank, type VendorTier } from '@/lib/vendor-tier-caps';

/** The paid tiers a vendor free window can promote every vendor to. */
export type PromotedVendorTier = 'solo' | 'pro' | 'enterprise';

export type PromoFreeWindow = {
  promo_window_id: string;
  title: string;
  blurb: string | null;
  covered_service_keys: string[];
  audience_type: 'all_couples' | 'all_vendors' | 'segment';
  promoted_vendor_tier: PromotedVendorTier | null;
  starts_at: string;
  ends_at: string;
  show_banner: boolean;
};

const SELECT_COLS =
  'promo_window_id, title, blurb, covered_service_keys, audience_type, promoted_vendor_tier, starts_at, ends_at, show_banner';

function mapWindow(row: Record<string, unknown>): PromoFreeWindow {
  return {
    promo_window_id: row.promo_window_id as string,
    title: row.title as string,
    blurb: (row.blurb as string | null) ?? null,
    covered_service_keys: Array.isArray(row.covered_service_keys)
      ? (row.covered_service_keys as string[])
      : [],
    audience_type: row.audience_type as PromoFreeWindow['audience_type'],
    promoted_vendor_tier: (row.promoted_vendor_tier as PromotedVendorTier | null) ?? null,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    show_banner: Boolean(row.show_banner),
  };
}

/**
 * Master kill-switch. Server-only env (the gate + banner are server-side), so no
 * NEXT_PUBLIC_ needed. Default OFF — the feature is fully inert until flipped.
 */
export function isPromoFreeWindowsEnabled(): boolean {
  return process.env.PROMO_FREE_WINDOWS_ENABLED === 'true';
}

/**
 * The couple-audience windows that are LIVE right now (is_active, within their
 * date range, audience_type='all_couples'). cache()d per request. Returns [] when
 * the flag is off, the admin client is unavailable (CI build), or on any DB error.
 */
export const getLiveCoupleFreeWindows = cache(
  async (): Promise<PromoFreeWindow[]> => {
    if (!isPromoFreeWindowsEnabled()) return [];
    return fetchLiveWindows('all_couples');
  },
);

/**
 * Shared live-window fetch for one audience. Admin-client read; graceful-degrade
 * to [] on any error. Callers are cache()d, so this runs at most once per
 * (audience) per request. NOT flag-guarded itself — the cached callers are.
 */
async function fetchLiveWindows(
  audienceType: PromoFreeWindow['audience_type'],
): Promise<PromoFreeWindow[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from('promo_free_windows')
    .select(SELECT_COLS)
    .eq('is_active', true)
    .eq('audience_type', audienceType)
    .lte('starts_at', nowIso)
    .gt('ends_at', nowIso)
    .order('ends_at', { ascending: true });

  if (error || !data) return [];
  return data.map((row) => mapWindow(row as Record<string, unknown>));
}

/**
 * The flattened set of couple service_codes that are FREE right now via any live
 * promo window. The entitlement-OR consults this in eventSkuActive /
 * eventActiveSkus. Empty set when the flag is off or nothing is live.
 */
export const promoFreeSkusForCouples = cache(async (): Promise<Set<string>> => {
  const windows = await getLiveCoupleFreeWindows();
  const set = new Set<string>();
  for (const w of windows) {
    for (const code of w.covered_service_keys) set.add(code);
  }
  return set;
});

/**
 * Convenience predicate for a single SKU — is it free right now via a live promo?
 */
export async function isSkuFreeForCouplesNow(
  serviceCode: string,
): Promise<boolean> {
  return (await promoFreeSkusForCouples()).has(serviceCode);
}

/**
 * The banner windows to surface to couples — live AND show_banner=true. The
 * banner component renders the first (soonest-ending) one.
 */
export async function getCoupleFreeWindowBanners(): Promise<PromoFreeWindow[]> {
  return (await getLiveCoupleFreeWindows()).filter((w) => w.show_banner);
}

// ─────────────────────────────────────────────────────────────────────────
// Vendor audience — a live all_vendors window PROMOTES every vendor to a paid
// tier for free (resolveVendorTier ORs it in). Vendor "free" can't be a ₱0
// subscription (DB CHECK price_php > 0), so it's a tier promotion, not a comp.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The vendor-audience windows LIVE right now. cache()d; [] when flag off / error.
 */
export const getLiveVendorFreeWindows = cache(
  async (): Promise<PromoFreeWindow[]> => {
    if (!isPromoFreeWindowsEnabled()) return [];
    return fetchLiveWindows('all_vendors');
  },
);

/**
 * The HIGHEST paid tier any live vendor window promotes to right now (by tier
 * rank), or null when the flag is off / nothing is live. resolveVendorTier reads
 * this and upgrades a vendor to it (never a downgrade). Two overlapping windows
 * (e.g. Solo + Pro) → the vendor gets the better one.
 */
export const getPromotedVendorTierNow = cache(
  async (): Promise<PromotedVendorTier | null> => {
    const windows = await getLiveVendorFreeWindows();
    let best: PromotedVendorTier | null = null;
    for (const w of windows) {
      const t = w.promoted_vendor_tier;
      if (t && (best === null || tierRank(t) > tierRank(best))) best = t;
    }
    return best;
  },
);

/**
 * Promote a vendor's real tier by any live vendor free window (never a
 * downgrade). Pure over the resolved promo tier so resolveVendorTier stays a
 * one-liner. Returns realTier unchanged when no promo outranks it.
 */
export function applyVendorTierPromotion(
  realTier: VendorTier,
  promoted: PromotedVendorTier | null,
): VendorTier {
  if (promoted && tierRank(promoted) > tierRank(realTier)) return promoted;
  return realTier;
}

/**
 * Banner windows for vendors — live AND show_banner=true.
 */
export async function getVendorFreeWindowBanners(): Promise<PromoFreeWindow[]> {
  return (await getLiveVendorFreeWindows()).filter((w) => w.show_banner);
}

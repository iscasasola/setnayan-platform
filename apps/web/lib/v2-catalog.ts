/**
 * V2 catalog reader · single source of truth for the live pricing surfaces.
 *
 * Reads from the 3 V2 catalog tables in setnayan-prod and exposes typed
 * shapes to server components. Replaces the V1 sku-catalog.ts TypeScript
 * mirror (which carries retired SKUs and 5% Setnayan Pay language).
 *
 * Tables:
 *   platform_retail_catalog_v2  · 19 customer SKUs
 *   platform_package_catalog    · 2 bundles (Guided Pack + Media Pack)
 *   vendor_billing_catalog      · 7 vendor SKUs (2 subs + 5 token packs)
 *
 * Build status is hardcoded here (not in DB) so we can be honest about
 * what works vs what's coming. Items marked NOT_BUILT render with a
 * "Coming soon" badge instead of a buy button. Aligned to the audit
 * shared with owner 2026-05-28.
 *
 * Per owner directive: Setnayan takes ZERO commission · vendor bookings
 * are transacted off-platform · customers buy software SKUs at 100%
 * retail directly from Setnayan as publisher.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export type V2CustomerSku = {
  service_code: string;
  title: string;
  retail_price_php: number;     // in pesos (NUMERIC from DB · already in PHP)
  saas_overhead_cost_php: number;
  is_token_able: boolean;
  description: string | null;
  build_status: BuildStatus;
};

export type V2BundleSku = {
  package_code: string;
  title: string;
  retail_price_php: number;
};

export type V2VendorSku = {
  sku_code: string;
  title: string;
  price_php: number;
  // `subscription_annual` added 2026-05-29 alongside the eleventh 2026-05-28
  // amendment: Pro Vendor ₱19,999/yr + Enterprise Vendor ₱54,999/yr ·
  // ~17% off vs monthly × 12 · charm-priced -1 endings · same per-tier
  // capability shape as monthly equivalents (max_categories + max_sub_seats
  // identical) · only price + billing cadence differ.
  offering_type: 'subscription_monthly' | 'subscription_annual' | 'token_pack';
  token_grant_count: number | null;
  max_categories: number | null;
  max_sub_seats: number | null;
  display_order: number;
};

export type BuildStatus = 'live' | 'partial' | 'not_built';

/**
 * Hardcoded build status per SKU. Honest about what's actually wired
 * end-to-end vs catalog-only-with-no-fulfillment. Update as features
 * ship.
 *
 * Source: feature audit shared with owner 2026-05-28.
 */
const BUILD_STATUS: Record<string, BuildStatus> = {
  // Live and working today
  TODAYS_FOCUS:        'live',     // 65-card wizard live at /today
  PRO_WEBSITE:         'partial',  // free baseline live · Pro gating not built
  CUSTOM_QR_GUEST:     'live',     // branded per-guest QR (monogram + palette + print) · PR #727 · 2026-06-01
  INDOOR_BLUEPRINT:    'partial',  // seating chart live · entrance-to-table nav not built

  // Partially working
  ANIMATED_MONOGRAM:   'live',     // drawn-live monogram bound to the SKU · PR #729 · 2026-06-01
  PANOOD_SYSTEM:       'partial',  // OAuth + UI shipped · pending YouTube verified-app
  PATIKTOK_COMPILER:   'partial',  // booth scaffold · TikTok app review pending
  PAPIC_GUEST:         'partial',  // web capture exists · quota enforcement not wired
  PAPIC_SEATS:         'partial',  // web capture exists · seat provisioning not wired
  HIGH_RES_ARCHIVE:    'partial',  // 0009 photo delivery partial
  LIVE_BACKGROUND:     'partial',  // 0005 Pailaw engineering brief · code not verified

  // Not built · catalog-only · no fulfillment yet
  PABATI:                'not_built',
  PAKANTA:               'not_built',
  PAPIC_ADDON_STORIES:   'not_built',
  PAPIC_ADDON_THANK_YOU: 'not_built',
  SDE:                   'not_built',  // AI edit pipeline not built
  CAMERA_BRIDGE:         'not_built',  // needs native iOS/Android + DSLR SDK
  LIVE_WALL:             'not_built',  // WebSocket display surface not built
  CALL_TIME_ESCALATOR:   'not_built',  // no SMS infrastructure
};

/**
 * Server-side fetch of all customer SKUs from the V2 catalog.
 * Sorted by display priority · token-worthy items first.
 */
export async function fetchV2CustomerCatalog(): Promise<V2CustomerSku[]> {
  // createAdminClient throws when SUPABASE_SERVICE_ROLE_KEY is unset (CI
  // builds run `next build` with placeholder NEXT_PUBLIC_* env only · no
  // service-role key). Match the documented "return [] on error" semantic
  // below so callers degrade gracefully — the page renders an empty
  // catalog instead of failing the prerender. Defense-in-depth alongside
  // `export const dynamic = 'force-dynamic'` in /pricing/page.tsx.
  // CLAUDE.md 2026-05-28 row "fix endless loop error on vercel".
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, saas_overhead_cost_php, is_token_able, description')
    .order('service_code', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    service_code: row.service_code as string,
    title: row.title as string,
    retail_price_php: Number(row.retail_price_php),
    saas_overhead_cost_php: Number(row.saas_overhead_cost_php),
    is_token_able: Boolean(row.is_token_able),
    description: (row.description as string | null) ?? null,
    build_status: BUILD_STATUS[row.service_code as string] ?? 'not_built',
  }));
}

export async function fetchV2BundleCatalog(): Promise<V2BundleSku[]> {
  // Same build-time tolerance as fetchV2CustomerCatalog above — see WHY there.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('platform_package_catalog')
    .select('package_code, title, retail_price_php')
    .order('retail_price_php', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    package_code: row.package_code as string,
    title: row.title as string,
    retail_price_php: Number(row.retail_price_php),
  }));
}

export async function fetchV2VendorCatalog(): Promise<V2VendorSku[]> {
  // Same build-time tolerance as fetchV2CustomerCatalog above — see WHY there.
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('vendor_billing_catalog')
    .select('sku_code, title, price_php, offering_type, token_grant_count, max_categories, max_sub_seats, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    sku_code: row.sku_code as string,
    title: row.title as string,
    price_php: Number(row.price_php),
    offering_type: row.offering_type as 'subscription_monthly' | 'subscription_annual' | 'token_pack',
    token_grant_count: (row.token_grant_count as number | null) ?? null,
    max_categories: (row.max_categories as number | null) ?? null,
    max_sub_seats: (row.max_sub_seats as number | null) ?? null,
    display_order: Number(row.display_order ?? 0),
  }));
}

/**
 * Format a peso amount with thousand separators · no decimals if whole.
 */
export function formatPeso(amount: number): string {
  if (Number.isInteger(amount)) {
    return amount.toLocaleString('en-PH');
  }
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const BUILD_STATUS_LABEL: Record<BuildStatus, string> = {
  live: 'Live',
  partial: 'Partial · in active build',
  not_built: 'Coming soon',
};

/**
 * V1 SKU catalog constants — LEGACY. Do not add rows.
 *
 * Source of truth: `public.service_catalog` in Supabase (seeded by
 * supabase/migrations/20260516000000_v1_sku_lock_service_catalog.sql).
 * This file is a TypeScript mirror so server components can render
 * pricing without an extra round-trip. Keep in sync with the migration
 * whenever a SKU price changes.
 *
 * ⚠ The v1 catalog is superseded by `platform_retail_catalog_v2` (read it via
 * `lib/v2-catalog.ts`). Anything CURRENTLY sellable lives there; this mirror is
 * kept only for the handful of legacy reads that still resolve v1 `sku_code`s.
 *
 * ⚠ `isActive` here must mirror `service_catalog.is_active` in prod, where
 * exactly ONE row is active (`vendor_verification_initial`). It had drifted to
 * 19 — 18 rows retired in the DB on 2026-05-16/05-28 were still flagged active
 * here, so `findSku()` handed callers live-looking prices for SKUs nobody can
 * buy. Corrected 2026-07-21 (admin-pricing council audit). If you retire a SKU,
 * flip it in BOTH places or this mirror starts lying again.
 *
 * Pricing is stored in centavos (1 peso = 100 centavos) to match the DB
 * schema. `priceCentavosToPeso` converts for display.
 *
 * Spec corpus: 2026-05-16 commit a0fa3c7.
 */

export type SkuUnit =
  | 'event'
  | 'render'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'each'
  | 'verification'
  | 'contract';

export type SkuPurchaserRole = 'couple' | 'vendor' | 'either';

export type SkuCategory =
  | 'couple_addon'
  | 'panood'
  | 'papic'
  | 'vendor_verification'
  | 'vendor_tools'
  | 'vendor_subscription'
  | 'retired';

export type SkuRecord = {
  skuCode: string;
  displayName: string;
  category: SkuCategory;
  priceCentavos: number;
  unit: SkuUnit;
  multiPurchase: boolean;
  subscription: boolean;
  refundable: boolean;
  purchaserRole: SkuPurchaserRole;
  softCap?: number;
  isActive: boolean;
};

/**
 * ── FREE PRICING DOES NOT LIVE IN THIS FILE (retired 2026-07-27) ───────────
 *
 * `LAUNCH_PROMO_UNTIL` / `LAUNCH_PROMO_SKU_CODES` (16 "free through
 * 2027-01-30" SKUs) and the pilot-mode helpers were REMOVED here. They had
 * zero callers and had silently stopped meaning anything:
 *
 *   · They keyed on the LEGACY lowercase codes below (`vendor_pro_weekly`,
 *     `panood_daily_broadcast`). The live catalog is
 *     `platform_retail_catalog_v2`, keyed on UPPERCASE service_codes
 *     (`SEATING_3D`, `COUPLE_WEBSITE_PRO`). The two sets never intersected,
 *     so nothing was ever discounted by them.
 *   · The live charge path — `lib/order-charge-math.ts` +
 *     `resolveRetailChargeCentavos` in `lib/v2-catalog.ts` — never read them.
 *
 * The one thing they DID still drive was a site-wide banner promising
 * "every add-on and subscription is free", which checkout then ignored and
 * charged in full. That banner is deleted.
 *
 * THE SINGLE FREE-PRICING MECHANISM IS NOW `public.promo_free_windows`:
 * admin CRUD at /admin/pricing?tab=free-windows, read by
 * `lib/promo-free-windows.ts`, ORed into the real entitlement gate at
 * `lib/entitlements.ts` (`eventSkuActive`) alongside comp_grants and
 * founder_seats, and surfaced by `promo-free-window-banner.tsx`. One source,
 * and the banner and the gate read it together — so they cannot disagree.
 *
 * Do NOT reintroduce a pricing override here. This module is a legacy
 * reference catalog; it is not on the money path.
 */

export const SKU_CATALOG: ReadonlyArray<SkuRecord> = [
  // ---- Couple add-ons ----
  {
    skuCode: 'save_the_date_video',
    displayName: 'Save-the-Date Video Render',
    category: 'couple_addon',
    // Repriced 2026-05-17 (CLAUDE.md row 406): was 9900 (₱99), now 19900 (₱199).
    // Cost Watch math — highest observed render ~₱45; ₱199 lands cost-to-price
    // at 23% (green) vs 45% (yellow) at ₱99.
    priceCentavos: 19900,
    unit: 'render',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    // RETIRED 2026-06-16 (already is_active=FALSE in prod since 2026-05-28).
    // The /studio/save-the-date surface is now the FREE page-opening reveal;
    // the paid video render is dropped. Record kept for historical-order typing.
    isActive: false,
  },
  {
    skuCode: 'monogram_hero_upgrade',
    displayName: 'Monogram Hero — animated SVG trace + custom hero background',
    category: 'couple_addon',
    priceCentavos: 199900,
    unit: 'event',
    multiPurchase: false,
    subscription: false,
    refundable: false,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'pro_widget_schedule',
    displayName: 'Live Schedule "happening now" highlight',
    category: 'couple_addon',
    priceCentavos: 99900,
    unit: 'event',
    multiPurchase: false,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },

  // ---- Panood (live streaming) ----
  // Always-multicam pivot 2026-05-17 (CLAUDE.md row 406): max 6 cams via SFU
  // baked into Daily Broadcast and Annual Streaming. Camera Sync + Annual
  // Streaming Plus retired (collapsed into the always-multicam SKUs).
  {
    skuCode: 'panood_daily_broadcast',
    displayName: 'Panood Daily Broadcast (always multi-cam, up to 6)',
    category: 'panood',
    // Repriced 2026-05-17: was 49900 (₱499 single-cam), now 249900 (₱2,499
    // always-multicam baked in).
    priceCentavos: 249900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'panood_camera_sync',
    displayName: 'Panood Camera Sync (multi-cam)',
    category: 'panood',
    priceCentavos: 9900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    // Retired 2026-05-17 — collapsed into panood_daily_broadcast always-multicam.
    isActive: false,
  },
  {
    skuCode: 'panood_annual_streaming',
    displayName: 'Panood Annual Streaming (always multi-cam, all events)',
    category: 'panood',
    // Repriced 2026-05-17: was 299900 (₱2,999), now 1999900 (₱19,999).
    // Vendor / competition-organizer subscription positioning at year +
    // all_events scope.
    priceCentavos: 1999900,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'panood_annual_streaming_plus',
    displayName: 'Panood Annual Streaming Plus (multi-cam unlimited)',
    category: 'panood',
    priceCentavos: 399900,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'couple',
    // Retired 2026-05-17 — collapsed into panood_annual_streaming always-multicam.
    isActive: false,
  },

  // ---- Papic (candid-capture · seat packs locked 2026-05-17 reactivation) ----
  {
    skuCode: 'paparazzi_3_seats',
    displayName: '3-Paparazzi Pack',
    category: 'papic',
    priceCentavos: 149900,
    unit: 'event',
    multiPurchase: false,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'paparazzi_5_seats',
    displayName: '5-Paparazzi Pack',
    category: 'papic',
    priceCentavos: 249900,
    unit: 'event',
    multiPurchase: false,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'paparazzi_camera_addon',
    displayName: 'Camera Add-on (+1 seat)',
    category: 'papic',
    priceCentavos: 99900,
    unit: 'event',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  // Cam Bridge (DSLR pairing) — cataloged but isActive=false. Requires native
  // Papic-binary app + DSLR WiFi SDK access, both gated by the DTI chain
  // (deferred until pilot wraps per 2026-05-18 lock).
  {
    skuCode: 'papic_cam_bridge_slot_day',
    displayName: 'Cam Bridge (per slot · per day)',
    category: 'papic',
    priceCentavos: 9900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'papic_cam_bridge_all_slots_day',
    displayName: 'Cam Bridge (all slots · per day)',
    category: 'papic',
    priceCentavos: 24900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'papic_cam_bridge_all_slots_annual',
    displayName: 'Cam Bridge (all slots · annual)',
    category: 'papic',
    priceCentavos: 249900,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'either',
    isActive: false,
  },

  // ---- AI Highlights ----
  {
    skuCode: 'ai_video_highlight_60s',
    displayName: 'AI Video Highlight 60s',
    category: 'panood',
    priceCentavos: 99900,
    unit: 'render',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },
  {
    skuCode: 'ai_edited_highlight_3min',
    displayName: 'AI Edited Highlight 3-min',
    category: 'panood',
    // Repriced 2026-05-16: was 499900 (₱4,999), now 349900 (₱3,499).
    priceCentavos: 349900,
    unit: 'render',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: false,
  },

  // ---- Vendor verification ----
  {
    skuCode: 'vendor_verification_initial',
    displayName: 'Vendor Verification — Initial (FREE)',
    category: 'vendor_verification',
    priceCentavos: 0,
    unit: 'verification',
    multiPurchase: false,
    subscription: false,
    refundable: false,
    purchaserRole: 'vendor',
    isActive: true,
  },
  {
    skuCode: 'vendor_verification_annual_renewal',
    displayName: 'Vendor Annual Re-verification',
    category: 'vendor_verification',
    priceCentavos: 150000,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: false,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    skuCode: 'vendor_verification_redemption',
    displayName: 'Vendor Re-verification after demotion',
    category: 'vendor_verification',
    priceCentavos: 250000,
    unit: 'verification',
    multiPurchase: false,
    subscription: false,
    refundable: false,
    purchaserRole: 'vendor',
    isActive: false,
  },

  // ---- All Tools Unlock bundle + individual tools ----
  {
    skuCode: 'all_tools_unlock_annual',
    displayName:
      'All Tools Unlock — annual bundle (Mood Board, Palette, Seating, QR Reader, Advanced Pricing)',
    category: 'vendor_tools',
    priceCentavos: 999900,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    skuCode: 'tool_mood_board_weekly',
    displayName: 'Mood Board Integration',
    category: 'vendor_tools',
    priceCentavos: 9900,
    unit: 'week',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    skuCode: 'tool_seat_arrangement_weekly',
    displayName: 'Seat Arrangement Integration',
    category: 'vendor_tools',
    priceCentavos: 9900,
    unit: 'week',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    skuCode: 'tool_palette_weekly',
    displayName: 'Palette Integration',
    category: 'vendor_tools',
    priceCentavos: 9900,
    unit: 'week',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    skuCode: 'tool_qr_reader_weekly',
    displayName: 'QR Reader Integration',
    category: 'vendor_tools',
    priceCentavos: 9900,
    unit: 'week',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    skuCode: 'tool_advanced_pricing_weekly',
    displayName: 'Advanced Pricing Tier',
    category: 'vendor_tools',
    priceCentavos: 9900,
    unit: 'week',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },

  // ---- Vendor Pro + Contract Intelligence ----
  {
    skuCode: 'vendor_pro_weekly',
    displayName: 'Vendor Pro Weekly subscription',
    category: 'vendor_subscription',
    priceCentavos: 49900,
    unit: 'week',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
  {
    // Retired 2026-05-18 — Contract Intelligence (iteration 0032) replaced by
    // free built-in dual e-signature on every vendor contract. Kept in the
    // catalog (isActive=false) so audit references don't break.
    skuCode: 'contract_intelligence_per_contract',
    displayName: 'Contract Intelligence per contract (retired)',
    category: 'retired',
    priceCentavos: 19900,
    unit: 'contract',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: false,
  },
];

/** Lookup by SKU code. Returns `undefined` for unknown / retired-only codes. */
export function findSku(skuCode: string): SkuRecord | undefined {
  return SKU_CATALOG.find((s) => s.skuCode === skuCode && s.isActive);
}

/** Convert centavos to whole pesos (rounds for display). */
function priceCentavosToPeso(centavos: number): number {
  return Math.round(centavos / 100);
}

/** Format centavos as a ₱-prefixed display string with PH locale grouping. */
export function formatCentavosPhp(centavos: number): string {
  const pesos = priceCentavosToPeso(centavos);
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// ---------------------------------------------------------------------------
// Retired SKUs — kept here so a stale UI reference doesn't break type checks.
// Mark `isActive: false` if you need to reference one. The migration also
// flips these to is_active=FALSE in the DB.
// ---------------------------------------------------------------------------

export const RETIRED_SKU_CODES = [
  'save_the_date_render',            // -> save_the_date_video
  'save_the_date_video',             // retired 2026-06-16 → Save-the-Date is now the free page-opening reveal
  'daily_co_video_meeting',          // Daily.co retired 2026-05-16
  'video_meeting_addon',             // Daily.co retired 2026-05-16
  // Patiktok — the PRODUCT was un-retired 2026-07-01 as the single live SKU
  // PATIKTOK_COMPILER (admin-managed). The 6 codes below are only the DEAD
  // 2026-05-16 dual-tier / per-day / overage codes — kept here so legacy order
  // rows still resolve. PATIKTOK_COMPILER is intentionally NOT in this list.
  'patiktok_booth_5hr',
  'patiktok_setnayan_tiktok',
  'patiktok_personal_tiktok',
  'patiktok_setnayan_daily',
  'patiktok_personal_daily',
  'patiktok_video_overage',
  'sponsored_boost_weekly',          // -> sponsored_boost_quarterly_30km + _annual_30km
  'pro_widget_bundle',
  'pro_widget_story',
  'pro_widget_hero',                 // -> monogram_hero_upgrade
  'contract_intelligence_upgrade',   // 0032 retired 2026-05-18 (couple-side)
  'contract_intelligence_per_contract', // 0032 retired 2026-05-18 (vendor-side)
  // V1 boost retired 2026-05-28 per owner directive ("remove the current
  // boosting · we add it later"). V2 replacement is the token-cost-per-bid
  // sink in the bid marketplace (blueprint Part 2 § 2 · high-valuation
  // destination briefs cost 5-8 tokens per submission).
  'boosted_ads_5km',
  'boosted_ads_10km',
  'boosted_ads_20km',
  'sponsored_boost_quarterly_30km',
  'sponsored_boost_annual_30km',
] as const;

/** BIR marketplace withholding rate. 0.5% of gross booking. */
export const BIR_MARKETPLACE_WITHHOLDING_PCT = 0.5;

/**
 * V1 SKU catalog constants.
 *
 * Source of truth: `public.service_catalog` in Supabase (seeded by
 * supabase/migrations/20260516000000_v1_sku_lock_service_catalog.sql).
 * This file is a TypeScript mirror so server components can render
 * pricing without an extra round-trip. Keep in sync with the migration
 * whenever a SKU price changes.
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
  | 'patiktok'
  | 'vendor_verification'
  | 'vendor_tools'
  | 'vendor_ads'
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
 * Launch promo end date — 2027-03-31 23:59:59 +08:00 (PH local time).
 * Mirrors `service_catalog.launch_promo_until` (migration
 * 20260518100000_launch_promo_until_mar_2027.sql).
 */
export const LAUNCH_PROMO_UNTIL = new Date('2027-03-31T23:59:59+08:00');

/**
 * SKUs that are FREE during the launch promo (2026-05-18 owner lock).
 * 16 zero-marginal-cost SKUs across couple- and vendor-side. Vendor ads
 * (Boosted + Sponsored Boost) are EXCLUDED — they're competitive marketing
 * slots and free-for-all would defeat their purpose. Concierge, AI
 * Highlights, Custom Monogram, Contract Intelligence, and Vendor
 * Verification are also EXCLUDED — those have real labor/API cost.
 */
export const LAUNCH_PROMO_SKU_CODES: ReadonlySet<string> = new Set([
  // Couple-side (9)
  'pro_widget_schedule',
  'save_the_date_video',
  'panood_daily_broadcast',
  'panood_camera_sync',
  'panood_annual_streaming',
  'panood_annual_streaming_plus',
  'patiktok_setnayan_tiktok',
  'patiktok_personal_tiktok',
  'patiktok_video_overage',

  // Vendor-side (7)
  'vendor_pro_weekly',
  'all_tools_unlock_annual',
  'tool_mood_board_weekly',
  'tool_seat_arrangement_weekly',
  'tool_palette_weekly',
  'tool_qr_reader_weekly',
  'tool_advanced_pricing_weekly',
]);

export const SKU_CATALOG: ReadonlyArray<SkuRecord> = [
  // ---- Couple add-ons ----
  {
    skuCode: 'save_the_date_video',
    displayName: 'Save-the-Date Video Render',
    category: 'couple_addon',
    priceCentavos: 9900,
    unit: 'render',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: true,
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
    isActive: true,
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
    isActive: true,
  },

  // ---- Panood (live streaming) ----
  {
    skuCode: 'panood_daily_broadcast',
    displayName: 'Panood Daily Broadcast',
    category: 'panood',
    priceCentavos: 49900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: true,
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
    isActive: true,
  },
  {
    skuCode: 'panood_annual_streaming',
    displayName: 'Panood Annual Streaming (single-cam unlimited)',
    category: 'panood',
    priceCentavos: 299900,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'couple',
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
  },
  {
    skuCode: 'same_day_edit',
    displayName: 'Same-Day Edit',
    category: 'panood',
    priceCentavos: 999900,
    unit: 'render',
    multiPurchase: false,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: true,
  },

  // ---- Patiktok dual-tier ----
  {
    skuCode: 'patiktok_setnayan_tiktok',
    displayName: 'Patiktok — Setnayan TikTok',
    category: 'patiktok',
    priceCentavos: 99900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    softCap: 40,
    isActive: true,
  },
  {
    skuCode: 'patiktok_personal_tiktok',
    displayName: 'Patiktok — Personal TikTok (BYO)',
    category: 'patiktok',
    priceCentavos: 199900,
    unit: 'day',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    softCap: 40,
    isActive: true,
  },
  {
    skuCode: 'patiktok_video_overage',
    displayName: 'Patiktok +10 videos overage',
    category: 'patiktok',
    priceCentavos: 4900,
    unit: 'each',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'couple',
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
  },

  // ---- Boosted Ads (vendor self-serve) ----
  {
    skuCode: 'boosted_ads_5km',
    displayName: 'Boosted Ads — Local 5km',
    category: 'vendor_ads',
    priceCentavos: 500000,
    unit: 'week',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: true,
  },
  {
    skuCode: 'boosted_ads_10km',
    displayName: 'Boosted Ads — City 10km',
    category: 'vendor_ads',
    priceCentavos: 800000,
    unit: 'week',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: true,
  },
  {
    skuCode: 'boosted_ads_20km',
    displayName: 'Boosted Ads — Metro 20km',
    category: 'vendor_ads',
    priceCentavos: 1500000,
    unit: 'week',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: true,
  },

  // ---- Sponsored Boost (verified vendors only) ----
  {
    skuCode: 'sponsored_boost_quarterly_30km',
    displayName: 'Sponsored Boost Quarterly 30km',
    category: 'vendor_ads',
    priceCentavos: 25000000,
    unit: 'quarter',
    multiPurchase: false,
    subscription: false,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: true,
  },
  {
    skuCode: 'sponsored_boost_annual_30km',
    displayName: 'Sponsored Boost Annual 30km',
    category: 'vendor_ads',
    priceCentavos: 80000000,
    unit: 'year',
    multiPurchase: false,
    subscription: true,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: true,
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
    isActive: true,
  },
  {
    skuCode: 'contract_intelligence_per_contract',
    displayName: 'Contract Intelligence per contract',
    category: 'vendor_tools',
    priceCentavos: 19900,
    unit: 'contract',
    multiPurchase: true,
    subscription: false,
    refundable: true,
    purchaserRole: 'vendor',
    isActive: true,
  },
];

/** Lookup by SKU code. Returns `undefined` for unknown / retired-only codes. */
export function findSku(skuCode: string): SkuRecord | undefined {
  return SKU_CATALOG.find((s) => s.skuCode === skuCode && s.isActive);
}

/**
 * True if this SKU is currently FREE under the launch promo window.
 * Once `LAUNCH_PROMO_UNTIL` passes, the SKU reverts to `priceCentavos`.
 * Pass an explicit `now` for deterministic tests.
 */
export function isFreeNow(sku: SkuRecord | string, now: Date = new Date()): boolean {
  const code = typeof sku === 'string' ? sku : sku.skuCode;
  if (!LAUNCH_PROMO_SKU_CODES.has(code)) return false;
  return now < LAUNCH_PROMO_UNTIL;
}

/**
 * The price a checkout flow should charge today. Returns 0 if the SKU is
 * in the launch promo window, otherwise the canonical `priceCentavos`.
 */
export function getEffectivePriceCentavos(
  sku: SkuRecord,
  now: Date = new Date(),
): number {
  return isFreeNow(sku, now) ? 0 : sku.priceCentavos;
}

/**
 * Promo end date for a SKU, or null if the SKU is not in the launch promo.
 * Useful for surfacing "Free until {date}" copy.
 */
export function getPromoEndDate(sku: SkuRecord | string): Date | null {
  const code = typeof sku === 'string' ? sku : sku.skuCode;
  return LAUNCH_PROMO_SKU_CODES.has(code) ? LAUNCH_PROMO_UNTIL : null;
}

/** Format a Date as "Mar 31, 2027" (en-PH short month + numeric day + year). */
export function formatPromoEndDateShort(d: Date = LAUNCH_PROMO_UNTIL): string {
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

/** Convert centavos to whole pesos (rounds for display). */
export function priceCentavosToPeso(centavos: number): number {
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
  'daily_co_video_meeting',          // Daily.co retired 2026-05-16
  'video_meeting_addon',             // Daily.co retired 2026-05-16
  'patiktok_booth_5hr',              // -> patiktok_setnayan_tiktok + _personal_tiktok
  'sponsored_boost_weekly',          // -> sponsored_boost_quarterly_30km + _annual_30km
  'pro_widget_bundle',
  'pro_widget_story',
  'pro_widget_hero',                 // -> monogram_hero_upgrade
] as const;

/** BIR marketplace withholding rate. 0.5% of gross booking. */
export const BIR_MARKETPLACE_WITHHOLDING_PCT = 0.5;

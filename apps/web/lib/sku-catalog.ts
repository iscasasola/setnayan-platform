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
  | 'papic'
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
  // Couple-side (7 active — panood_camera_sync + panood_annual_streaming_plus
  // were retired 2026-05-17 when Panood pivoted to always-multicam baseline).
  'pro_widget_schedule',
  'save_the_date_video',
  'panood_daily_broadcast',
  'panood_annual_streaming',
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
    // Repriced 2026-05-17 (CLAUDE.md row 406): was 9900 (₱99), now 19900 (₱199).
    // Cost Watch math — highest observed render ~₱45; ₱199 lands cost-to-price
    // at 23% (green) vs 45% (yellow) at ₱99.
    priceCentavos: 19900,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
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

/**
 * Optional pilot-mode override.
 *
 * Setting `NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL` (ISO 8601 timestamp, e.g.
 * `"2026-08-31T23:59:59+08:00"`) makes EVERY paid SKU resolve to ₱0 until
 * that timestamp passes. Used for closed pilot testing — couples and
 * vendors can exercise the full checkout → activation → expiry → cancel
 * cycle without money actually moving. Unsets itself automatically after
 * the cutoff. Empty/missing/invalid env value = pilot mode OFF.
 *
 * Orthogonal to the launch promo: launch promo applies to a fixed list
 * of 16 zero-marginal-cost SKUs through 2027-03-31 regardless of pilot
 * mode. Pilot mode is a wider "everything is free during testing"
 * override that supplements (not replaces) the launch promo.
 */
export function getPilotFreeUntil(): Date | null {
  const raw = process.env.NEXT_PUBLIC_PILOT_MODE_FREE_UNTIL;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function isPilotFreeMode(now: Date = new Date()): boolean {
  const until = getPilotFreeUntil();
  return until !== null && now < until;
}

/**
 * True if this SKU is currently FREE — either because it's in the launch
 * promo window, or because pilot mode is active and it's a paid SKU.
 * Pass an explicit `now` for deterministic tests.
 */
export function isFreeNow(sku: SkuRecord | string, now: Date = new Date()): boolean {
  const code = typeof sku === 'string' ? sku : sku.skuCode;
  if (LAUNCH_PROMO_SKU_CODES.has(code) && now < LAUNCH_PROMO_UNTIL) return true;
  if (isPilotFreeMode(now)) {
    const record = typeof sku === 'string' ? findSku(sku) : sku;
    if (record && record.priceCentavos > 0) return true;
  }
  return false;
}

/**
 * The price a checkout flow should charge today. Returns 0 if the SKU is
 * in the launch promo window OR pilot mode is active for a paid SKU.
 */
export function getEffectivePriceCentavos(
  sku: SkuRecord,
  now: Date = new Date(),
): number {
  return isFreeNow(sku, now) ? 0 : sku.priceCentavos;
}

/**
 * End date of whichever promo is currently making this SKU free, or null
 * if the SKU is not currently free. Launch promo takes precedence when a
 * SKU is in both (already-fixed end date vs admin-controlled pilot
 * window).
 */
export function getPromoEndDate(
  sku: SkuRecord | string,
  now: Date = new Date(),
): Date | null {
  const code = typeof sku === 'string' ? sku : sku.skuCode;
  if (LAUNCH_PROMO_SKU_CODES.has(code)) return LAUNCH_PROMO_UNTIL;
  if (isPilotFreeMode(now)) {
    const record = typeof sku === 'string' ? findSku(sku) : sku;
    if (record && record.priceCentavos > 0) return getPilotFreeUntil();
  }
  return null;
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
  'contract_intelligence_upgrade',   // 0032 retired 2026-05-18 (couple-side)
  'contract_intelligence_per_contract', // 0032 retired 2026-05-18 (vendor-side)
] as const;

/** BIR marketplace withholding rate. 0.5% of gross booking. */
export const BIR_MARKETPLACE_WITHHOLDING_PCT = 0.5;

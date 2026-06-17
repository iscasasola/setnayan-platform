/**
 * V2 SKU catalog · transitional adapter.
 *
 * Source of truth: `public.platform_retail_catalog_v2` in Supabase (seeded
 * by Phase A migration 20260628000000 + alignment passes 20260631000000 +
 * 20260701000000 + 20260701010000 + Phase H 20260704032000_phase_h_apply_now).
 * This file is a typed TypeScript mirror so server components can render
 * V2 pricing + reason about V1→V2 SKU code transitions without a DB round
 * trip per access.
 *
 * The live `lib/v2-catalog.ts` reader still handles dynamic /pricing
 * rendering with build-status badges. This file is the narrow runtime
 * helper for the Setnayan AI 65-card wizard rebind plus any other
 * surface that needs to map a V1 sku code to its V2 equivalent during
 * the transition window.
 *
 * Pricing convention · V2 stores pesos as NUMERIC(10,2) (NOT centavos).
 * `priceCentavos` helpers convert at the boundary for code paths that
 * still expect the V1 centavos shape.
 *
 * Per CLAUDE.md tenth + eleventh 2026-05-28 rows · v2.1 brief § 5 canonical
 * (per project_setnayan_v2_1_canonical memory).
 *
 * Spec corpus · 2026-05-29.
 */

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Every active V2 retail SKU code in `platform_retail_catalog_v2`.
 * Sync with migrations above + Phase H. Subset used by the wizard +
 * checkout + admin tooling; the live /pricing surface reads from DB.
 */
export const V2_SKU_CODES = [
  // 9 direct Setnayan-delivered (is_token_able=FALSE)
  'ANIMATED_MONOGRAM',
  'CUSTOM_QR_GUEST',
  'TODAYS_FOCUS',
  'INDOOR_BLUEPRINT',
  'CALL_TIME_ESCALATOR',
  'HIGH_RES_ARCHIVE',
  'PAKULAY',
  'PABATI',
  'PAPIC_ADDON_STORIES',
  // Save-the-Date premium openings — the ₱799 cinematic-openings "template
  // unlock" (0024 PR4 P5; owner-set price, admin-editable at /admin/pricing).
  // is_token_able=FALSE (couple-paid). Seeded by migration 20270113942330.
  'STD_PREMIUM_OPENINGS',
  // 10 crew-delivered token-worthy (is_token_able=TRUE)
  'LIVE_BACKGROUND',
  'LIVE_WALL',
  'PAKANTA',
  'PANOOD_SYSTEM',
  'PAPIC_ADDON_THANK_YOU',
  'PAPIC_GUEST',
  'PAPIC_SEATS',
  'PATIKTOK_COMPILER',
  'PRO_WEBSITE',
  'SDE',
  // Website lifecycle + planner · seeded by migration 20260915000000 but were
  // MISSING from this allowlist, so formatV2Sku() returned null for them even
  // though the live catalog rows exist (silently price-null'd every surface that
  // reads them through formatV2Sku, incl. the Setnayan AI buy surface).
  'SETNAYAN_AI',
  'PRO_RSVP',
  'EVENT_WEBSITE',
  // Couple Website PRO — the single ₱3,999 premium unlock that collapses the
  // overlapping website/RSVP SKUs (PRO_RSVP/EVENT_WEBSITE/PRO_WEBSITE/RSVP_*),
  // owner ruling 2026-06-14, seeded by migration 20270103020000. The collapsed
  // codes stay listed here for historical order rows but go is_active=false in
  // the catalog (hidden from /pricing).
  'COUPLE_WEBSITE_PRO',
  // 2 bundles (platform_package_catalog, not retail)
  'GUIDED_PACK',
  'MEDIA_PACK',
] as const;

export type V2SkuCode = (typeof V2_SKU_CODES)[number];

/**
 * V1 → V2 SKU code mapping table.
 *
 * Returns the V2 service_code when the V1 sku has a live successor in
 * the V2 catalog. Returns null when the V1 sku was RETIRED (no V2
 * equivalent · do not surface in V2 wizard surfaces).
 *
 * Why `null` instead of throwing · V1 sku codes still appear in
 * historical order rows (CLAUDE.md V2 cutover plan preserves V1 audit
 * trail). Returning null lets callers surface "Service no longer
 * available" copy gracefully rather than crashing on legacy data.
 *
 * Pakanta · the V1 3-tier model (basic/premium/wedding_suite) collapses
 * to a single ₱2,499 V2 SKU per CLAUDE.md fourth 2026-05-28 row owner
 * interpretation. All 3 V1 codes map to the same `PAKANTA` V2 code.
 *
 * Paparazzi · the V1 3-seat + 5-seat distinction merges into a single
 * `PAPIC_SEATS` V2 SKU per v2.1 brief § 5 (one Papic seats pass at
 * ₱2,999). The 3-seat tier was dropped.
 *
 * Source: task spec mapping table + 10th + 11th 2026-05-28 decision-log
 * row retirements.
 */
const V1_TO_V2_SKU_MAP: ReadonlyMap<string, V2SkuCode | null> = new Map([
  // Live mappings · V1 sku → V2 sku
  ['today_focus', 'TODAYS_FOCUS'],
  ['todays_focus', 'TODAYS_FOCUS'],
  ['animated_monogram_upgrade', 'ANIMATED_MONOGRAM'],
  ['paparazzi_3_seats', 'PAPIC_SEATS'],
  ['paparazzi_5_seats', 'PAPIC_SEATS'],
  ['panood_daily_broadcast', 'PANOOD_SYSTEM'],
  ['patiktok_setnayan_daily', 'PATIKTOK_COMPILER'],
  ['pakanta_basic', 'PAKANTA'],
  ['pakanta_premium', 'PAKANTA'],
  ['pakanta_wedding_suite', 'PAKANTA'],

  // Retired · no V2 equivalent (return null · do not surface)
  ['monogram_hero_upgrade', null],
  ['pro_widget_schedule', null],
  ['save_the_date_video_render', null],
  ['concierge_complete', null],
  ['bespoke_monogram', null],
  ['ai_edited_highlight', null],
  ['ai_video_highlight', null],
]);

/**
 * Map a V1 SKU code to its V2 equivalent.
 *
 * @param v1Code · the V1 sku code (e.g. 'today_focus', 'paparazzi_5_seats')
 * @returns the V2 service_code OR null if the V1 SKU was retired with no
 *          V2 successor. Returns null also for unknown codes (caller should
 *          treat unknown as legacy / unmappable).
 */
export function mapV1SkuToV2(v1Code: string): V2SkuCode | null {
  if (!V1_TO_V2_SKU_MAP.has(v1Code)) {
    // Not in the explicit map. Could be a V2 code arriving with wrong
    // case · normalize + check.
    const upper = v1Code.toUpperCase();
    if ((V2_SKU_CODES as readonly string[]).includes(upper)) {
      return upper as V2SkuCode;
    }
    return null;
  }
  return V1_TO_V2_SKU_MAP.get(v1Code) ?? null;
}

export type V2SkuRecord = {
  service_code: V2SkuCode;
  display_name: string;
  price_php: number;     // retail_price_php from DB (pesos · NUMERIC)
  price_centavos: number; // convenience · price_php * 100
  is_token_able: boolean;
  description: string | null;
};

/**
 * Read a single V2 SKU from the live catalog.
 *
 * Server-component friendly · uses the admin client (RLS on
 * platform_retail_catalog_v2 is public-read so this could use anon but
 * admin is safer for server-rendered checkout / wizard surfaces that
 * need to bypass any future RLS narrowing).
 *
 * Returns null if the SKU is missing from the catalog · callers should
 * render "Service unavailable" copy in that branch.
 */
export async function formatV2Sku(
  sku: V2SkuCode | string,
): Promise<V2SkuRecord | null> {
  // Permit raw strings for the wizard surface (which may pass V1 codes
  // upstream of mapV1SkuToV2) · validate against V2_SKU_CODES.
  if (!(V2_SKU_CODES as readonly string[]).includes(sku)) {
    return null;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('platform_retail_catalog_v2')
    .select('service_code, title, retail_price_php, is_token_able, description')
    .eq('service_code', sku)
    .maybeSingle();
  if (error || !data) return null;
  return {
    service_code: data.service_code as V2SkuCode,
    display_name: data.title,
    price_php: Number(data.retail_price_php),
    price_centavos: Math.round(Number(data.retail_price_php) * 100),
    is_token_able: data.is_token_able,
    description: data.description ?? null,
  };
}

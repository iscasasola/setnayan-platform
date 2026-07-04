import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomUnitPrices } from '@/lib/vendor-custom-pricing';
import { BRANCH_SKU_CODE } from '@/lib/vendor-branches';

/**
 * apps/web/lib/vendor-custom-catalog.ts
 *
 * Reads the admin-managed per-unit prices the Custom-tier quote math consumes
 * (VENDOR_TIERS_AND_BENEFITS.md §11) from `vendor_billing_catalog`, and owns the
 * `vendor_custom_plan__{vendor_profile_id}` order service-key convention that
 * lets the sku-activation hook map a paid Custom-plan order back to the vendor
 * org to provision. Structural sibling of lib/vendor-seats + lib/vendor-branches.
 *
 * The pricing lib (`computeCustomQuote`) takes the unit prices as an ARGUMENT and
 * never hardcodes a literal — a price edit at /admin/pricing flows through with
 * no code change. This module resolves those prices; the {@link CUSTOM_UNIT_FALLBACK}
 * literals mirror the seed migration (20270512705572) and only kick in when a row
 * is missing / RLS hides it, so the flow degrades gracefully rather than throwing.
 *
 * NOTE: the "additional branch" unit REUSES the existing `vendor_additional_branch`
 * SKU (₱999) — there is no dedicated `vendor_custom_branch` row. The base is the
 * `vendor_custom_base` row; the rest map 1:1 to the composition knobs.
 */

/** Catalog sku_codes for the 9 unit prices (branch reuses the existing SKU). */
export const CUSTOM_SKU_CODES = Object.freeze({
  base: 'vendor_custom_base',
  branch: BRANCH_SKU_CODE, // reuses vendor_additional_branch
  reachStep: 'vendor_custom_reach_step',
  reachNationwide: 'vendor_custom_reach_nationwide',
  seat: 'vendor_extra_seat', // reuses the extra-seat add-on
  slot: 'vendor_custom_event_slot',
  photoPack: 'vendor_custom_photo_pack',
  includedToken: 'vendor_custom_included_token',
  domain: 'vendor_custom_domain',
});

/**
 * Fallback unit prices (PHP) mirroring the seed migration values. Only used when
 * a catalog row is missing/unreadable — the live admin-managed prices win.
 */
export const CUSTOM_UNIT_FALLBACK: Readonly<CustomUnitPrices> = Object.freeze({
  base: 8999,
  branch: 999,
  reachStep: 499,
  reachNationwide: 2499,
  seat: 250,
  slot: 499,
  photoPack: 99,
  includedToken: 100,
  domain: 499,
});

/**
 * Resolve the full Custom rate card (the 9 unit prices) from the admin-managed
 * catalog. Soft: any missing / unreadable row falls back to
 * {@link CUSTOM_UNIT_FALLBACK} for that axis so the composer + quote never break
 * on a partial catalog. One round-trip (all codes in an `in` filter).
 */
export async function fetchCustomUnitPrices(
  supabase: SupabaseClient,
): Promise<CustomUnitPrices> {
  const codes = Object.values(CUSTOM_SKU_CODES);
  const prices: Record<string, number> = {};
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('sku_code, price_php')
      .in('sku_code', codes);
    if (!error && data) {
      for (const row of data as Array<{ sku_code: string; price_php: number | string }>) {
        const n = Number(row.price_php);
        if (Number.isFinite(n) && n >= 0) prices[row.sku_code] = n;
      }
    }
  } catch {
    // fall through to fallbacks
  }

  const pick = (
    code: string,
    fallback: number,
  ): number => (prices[code] != null ? prices[code] : fallback);

  return {
    base: pick(CUSTOM_SKU_CODES.base, CUSTOM_UNIT_FALLBACK.base),
    branch: pick(CUSTOM_SKU_CODES.branch, CUSTOM_UNIT_FALLBACK.branch),
    reachStep: pick(CUSTOM_SKU_CODES.reachStep, CUSTOM_UNIT_FALLBACK.reachStep),
    reachNationwide: pick(CUSTOM_SKU_CODES.reachNationwide, CUSTOM_UNIT_FALLBACK.reachNationwide),
    seat: pick(CUSTOM_SKU_CODES.seat, CUSTOM_UNIT_FALLBACK.seat),
    slot: pick(CUSTOM_SKU_CODES.slot, CUSTOM_UNIT_FALLBACK.slot),
    photoPack: pick(CUSTOM_SKU_CODES.photoPack, CUSTOM_UNIT_FALLBACK.photoPack),
    includedToken: pick(CUSTOM_SKU_CODES.includedToken, CUSTOM_UNIT_FALLBACK.includedToken),
    domain: pick(CUSTOM_SKU_CODES.domain, CUSTOM_UNIT_FALLBACK.domain),
  };
}

/**
 * Order service_key convention: `vendor_custom_plan__{vendor_profile_id}`. The
 * suffix lets the sku-activation hook map a paid Custom-plan order back to the
 * exact vendor org to provision (mirrors `vendor_extra_seat__{id}` /
 * `vendor_additional_branch__{id}`).
 */
export const CUSTOM_PLAN_SERVICE_KEY_PREFIX = 'vendor_custom_plan__';

export function customPlanServiceKey(vendorProfileId: string): string {
  return `${CUSTOM_PLAN_SERVICE_KEY_PREFIX}${vendorProfileId}`;
}

export function vendorProfileIdFromCustomPlanServiceKey(
  serviceKey: string,
): string | null {
  if (!serviceKey.startsWith(CUSTOM_PLAN_SERVICE_KEY_PREFIX)) return null;
  const id = serviceKey.slice(CUSTOM_PLAN_SERVICE_KEY_PREFIX.length);
  return id.length > 0 ? id : null;
}

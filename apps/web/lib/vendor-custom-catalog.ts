import type { SupabaseClient } from '@supabase/supabase-js';
import type { CustomUnitPrices } from './vendor-custom-pricing';
import { SEAT_SKU_CODE, SEAT_FEE_PHP } from './vendor-seats';

/**
 * Custom-tier catalog reader — assembles the 9 per-unit prices the composer +
 * the pricing lib (lib/vendor-custom-pricing.ts) quote from, ALL read from the
 * admin-managed `vendor_billing_catalog` so an edit at /admin/pricing flows
 * through without a code change (owner rule · VENDOR_TIERS_AND_BENEFITS.md §11).
 *
 * The 7 `custom_addon` SKUs are seeded by migration 20270512705572; the branch
 * unit reuses the existing `vendor_additional_branch` (₱999 · 20270128654206)
 * and the seat unit reuses `vendor_extra_seat` (₱250 · 20270511762904, exported
 * from lib/vendor-seats.ts). Each fallback below matches the seed so the flow
 * still works at the signed rate card if a row is missing / RLS-hidden / the
 * seeding migration hasn't been applied — mirrors fetchSeatFeePhp /
 * fetchBranchFeePhp.
 */

/** SKU codes the 9 unit prices are read from (seeded by the migrations above). */
export const CUSTOM_SKU_CODES = Object.freeze({
  base: 'vendor_custom_base',
  branch: 'vendor_additional_branch',
  reachStep: 'vendor_custom_reach_step',
  reachNationwide: 'vendor_custom_reach_nationwide',
  seat: SEAT_SKU_CODE, // vendor_extra_seat
  slot: 'vendor_custom_event_slot',
  photoPack: 'vendor_custom_photo_pack',
  includedToken: 'vendor_custom_included_token',
  domain: 'vendor_custom_domain',
});

/**
 * Fallback unit prices — matches the seed rate card exactly (owner-signed
 * 2026-07-04). Only ever used per-axis when its catalog row is missing /
 * unreadable, so a partial catalog still quotes at the signed price.
 */
export const CUSTOM_UNIT_PRICE_FALLBACK: CustomUnitPrices = Object.freeze({
  base: 8999,
  branch: 999,
  reachStep: 499,
  reachNationwide: 2499,
  seat: SEAT_FEE_PHP, // 250
  slot: 499,
  photoPack: 99,
  includedToken: 100,
  domain: 499,
});

function positivePrice(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read the 9 Custom-tier unit prices from the admin-managed catalog. One query
 * for every needed sku_code; any row missing / unreadable falls back to the
 * signed rate-card literal for that axis only. Soft — never throws.
 */
export async function fetchCustomUnitPrices(
  supabase: SupabaseClient,
): Promise<CustomUnitPrices> {
  const wanted = Object.values(CUSTOM_SKU_CODES);
  let priceBySku = new Map<string, number>();
  try {
    const { data, error } = await supabase
      .from('vendor_billing_catalog')
      .select('sku_code, price_php')
      .in('sku_code', wanted)
      .eq('is_active', true);
    if (!error && data) {
      priceBySku = new Map(
        (data as { sku_code: string; price_php: number | string }[]).map((r) => [
          r.sku_code,
          Number(r.price_php),
        ]),
      );
    }
  } catch {
    // fall through to all-fallback
  }

  const read = (sku: string, fallback: number) =>
    positivePrice(priceBySku.get(sku), fallback);

  const c = CUSTOM_SKU_CODES;
  const f = CUSTOM_UNIT_PRICE_FALLBACK;
  return {
    base: read(c.base, f.base),
    branch: read(c.branch, f.branch),
    reachStep: read(c.reachStep, f.reachStep),
    reachNationwide: read(c.reachNationwide, f.reachNationwide),
    seat: read(c.seat, f.seat),
    slot: read(c.slot, f.slot),
    photoPack: read(c.photoPack, f.photoPack),
    includedToken: read(c.includedToken, f.includedToken),
    domain: read(c.domain, f.domain),
  };
}

/**
 * Order service_key convention: `vendor_custom_plan__{vendor_profile_id}`. The
 * suffix maps the paid order back to the vendor whose Custom plan to activate —
 * mirrors `vendor_extra_seat__{id}` / `vendor_additional_branch__{id}`.
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

/** A candidate plan row for activation selection (only the fields we bind on). */
export type CustomPlanCandidate = {
  custom_plan_id: string;
  status: string;
  quoted_28d_php: number | string | null;
  updated_at?: string | null;
};

/**
 * Pick the Custom plan a freshly-PAID order activates.
 *
 * The order carries NO custom_plan_id FK (orders.service_key only encodes the
 * vendor), and the plan row's `composition` is mutated in place by every new
 * request — so binding to "the most-recently-updated plan" (the old behaviour)
 * lets a vendor pay a CHEAP quote and receive whatever composition the row was
 * last edited to, or bind to a stale already-active plan. This binds on the one
 * invariant the order DOES pin: the price it was quoted at. A plan is
 * activatable by this order only when:
 *   • it is in a PAYABLE, not-yet-live state ('quoted' | 'pending_payment') —
 *     never 'active' (already provisioned), 'draft' (unpriced), 'rejected' or
 *     'lapsed'; and
 *   • its CURRENT `quoted_28d_php` equals the order's paid amount (within half a
 *     peso) — so a composition edited after this order was quoted no longer
 *     matches, closing the pay-cheap / get-expensive swap.
 * Among matches, the most-recently-updated wins (there is normally exactly one,
 * because both request paths reuse a single non-active row per vendor). Returns
 * `null` when nothing matches — the caller must then REFUSE to activate (leaving
 * the paid order recoverable) rather than provision the wrong plan.
 *
 * PURE (no I/O) so the binding rule is unit-testable.
 */
export function selectActivatableCustomPlan(
  candidates: ReadonlyArray<CustomPlanCandidate>,
  orderAmountPhp: number,
): string | null {
  const amount = Number(orderAmountPhp);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const PAYABLE = new Set(['quoted', 'pending_payment']);
  const matches = candidates.filter((c) => {
    if (!PAYABLE.has(c.status)) return false;
    const quoted = Number(c.quoted_28d_php);
    return Number.isFinite(quoted) && Math.abs(quoted - amount) < 0.5;
  });
  matches.sort((a, b) => {
    const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
    const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
    return tb - ta; // most-recent first
  });
  return matches[0]?.custom_plan_id ?? null;
}

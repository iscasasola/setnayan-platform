import type { SupabaseClient } from '@supabase/supabase-js';
import { priceForTerm, type CustomPlanTerm, type CustomUnitPrices } from './vendor-custom-pricing';
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
  reachNationwide: 'vendor_custom_reach_nationwide',
  seat: SEAT_SKU_CODE, // vendor_extra_seat
  slot: 'vendor_custom_event_slot',
  domain: 'vendor_custom_domain',
  pipelineUnlimited: 'vendor_custom_pipeline_unlimited',
});

/*
 * TWO AXES WERE DROPPED HERE ON 2026-08-27 (owner), AND DELETING THESE ENTRIES
 * IS THE PART THAT MAKES IT REAL:
 *
 *   reachStep  'vendor_custom_reach_step'   +100 km, was ₱499
 *   photoPack  'vendor_custom_photo_pack'   +100 portfolio photos, was ₱99
 *
 * Nationwide is now the ONLY reach upgrade. The catalog rows are deactivated in
 * migration 20271171000513 as well — but that flag alone would have changed
 * NOTHING, because `read()` below substitutes a literal for any row that goes
 * missing and the axis would have kept quoting at the same price forever. That
 * is the worked example this file's own docblock has carried since the token
 * retirement of 2026-08-07, and it is why the removal is a deletion here first
 * and a migration second.
 */

/**
 * Fallback unit prices — matches the seed rate card exactly (owner-signed
 * 2026-07-04). Only ever used per-axis when its catalog row is missing /
 * unreadable, so a partial catalog still quotes at the signed price.
 *
 * ⚠ THIS FALLBACK IS WHY DEACTIVATING A CATALOG ROW IS NOT A RETIREMENT.
 * `fetchCustomUnitPrices` filters on `is_active`, so a deactivated row simply
 * goes missing — and `read()` then substitutes the literal below. The axis
 * keeps quoting, at the same price, with the catalog saying it is off.
 * The `includedToken` axis (₱100/token per cycle) was retired 2026-08-07 by
 * deleting it from the SKU map, this fallback, `CustomUnitPrices`, the quote
 * math and both configurators — NOT by flipping `is_active`, which would have
 * changed nothing while looking like it had.
 * To retire any other axis: delete it here too, or it survives.
 * DONE AGAIN 2026-08-27 for `reachStep` and `photoPack`, following exactly that
 * precedent — deleted from the SKU map, this fallback, `CustomUnitPrices`, the
 * quote math and BOTH configurators, and only then deactivated in the catalog.
 *
 * 🚨 AND IT IS ALSO A BACK DOOR UNDER THE LADDER — 2026-08-27, the day this was
 * nearly proved the hard way. `base` sat at 8999 while the owner raised
 * Enterprise to ₱10,000 and Custom's catalog row to ₱11,000 to stay above it.
 * A missing / inactive / unreadable Custom base row would have made the quote
 * fall back to ₱8,999 and put the "tier above Enterprise" ₱1,001 BELOW it again
 * — through a door no catalog-only check can see. Both drifted literals were
 * corrected in the same change (`base` 8999 → 11000, `branch` 999 → 1000).
 *
 * ⛔ SO EVERY NUMBER BELOW IS A SECOND COPY OF A CATALOG PRICE AND MUST MOVE
 * WITH IT. `custom-sits-above-enterprise.db.test.ts` now enforces exactly that:
 * it asserts this object agrees with the live catalog axis-by-axis, AND that
 * this `base` — not just the catalog's — is above Enterprise's 28-day price. A
 * reprice that edits only the migration fails the build.
 */
export const CUSTOM_UNIT_PRICE_FALLBACK: CustomUnitPrices = Object.freeze({
  base: 11000,
  branch: 1000,
  // Rounded off their -1 charm endings 2026-08-27 (owner: "make the whole
  // number 500, 2500") — the third such rounding that day, after Live Studio
  // ₱2,999 -> ₱3,000 and Thank You ₱2,499 -> ₱2,500. These move WITH their
  // catalog rows in the same change; `fallback-prices-match-the-catalog` fails
  // the build if they ever disagree.
  reachNationwide: 2500,
  seat: SEAT_FEE_PHP, // 250
  slot: 500,
  domain: 500,
  // Owner 2026-08-29, asked what going past the 10-customers-per-date ceiling
  // should cost: "2500 for no limit." A whole number, like the two he rounded
  // on 2026-08-27.
  pipelineUnlimited: 2500,
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
    reachNationwide: read(c.reachNationwide, f.reachNationwide),
    seat: read(c.seat, f.seat),
    slot: read(c.slot, f.slot),
    domain: read(c.domain, f.domain),
    pipelineUnlimited: read(c.pipelineUnlimited, f.pipelineUnlimited),
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

/**
 * The ANNUAL twin of the key above.
 *
 * 🔑 THE TERM RIDES ON THE ORDER, NOT ON THE PLAN — and that is the whole design.
 * A `vendor_custom_plans` row is a COMPOSITION (what the shop gets); an order is
 * a PURCHASE (what they paid, for how long). Two shops' worth of evidence for
 * putting it here rather than in a new column: the plan row is mutated in place
 * across quotes, so a term stored on it could drift away from the order that
 * paid for it — exactly the bug `selectActivatableCustomPlan` already exists to
 * stop. The service_key is server-generated, immutable once minted, and already
 * carries "which vendor".
 *
 * ⚠ THE TWO PREFIXES ARE DISJOINT AND THAT IS LOAD-BEARING.
 * `vendor_custom_plan_annual__` does NOT start with `vendor_custom_plan__`
 * (position 19 is `a` against `_`), so the 28-day parser can never mistake an
 * annual key for a 28-day one and silently charge a year's money into a 28-day
 * activation. Pinned by a test.
 */
export const CUSTOM_PLAN_ANNUAL_SERVICE_KEY_PREFIX = 'vendor_custom_plan_annual__';

export function customPlanAnnualServiceKey(vendorProfileId: string): string {
  return `${CUSTOM_PLAN_ANNUAL_SERVICE_KEY_PREFIX}${vendorProfileId}`;
}

/** The key for a term. One switch, so no caller builds a key by hand. */
export function customPlanServiceKeyForTerm(
  vendorProfileId: string,
  term: CustomPlanTerm,
): string {
  return term === 'annual'
    ? customPlanAnnualServiceKey(vendorProfileId)
    : customPlanServiceKey(vendorProfileId);
}

/**
 * The vendor id on EITHER key shape, with the term it was bought for.
 * `null` when the key is not a Custom-plan key at all.
 */
export function customPlanTargetFromServiceKey(
  serviceKey: string,
): { vendorProfileId: string; term: CustomPlanTerm } | null {
  if (serviceKey.startsWith(CUSTOM_PLAN_ANNUAL_SERVICE_KEY_PREFIX)) {
    const id = serviceKey.slice(CUSTOM_PLAN_ANNUAL_SERVICE_KEY_PREFIX.length);
    return id.length > 0 ? { vendorProfileId: id, term: 'annual' } : null;
  }
  const id = vendorProfileIdFromCustomPlanServiceKey(serviceKey);
  return id ? { vendorProfileId: id, term: '28d' } : null;
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
 *   • the price THIS TERM implies equals the order's paid amount (within half a
 *     peso) — so a composition edited after this order was quoted no longer
 *     matches, closing the pay-cheap / get-expensive swap.
 * Among matches, the most-recently-updated wins (there is normally exactly one,
 * because both request paths reuse a single non-active row per vendor). Returns
 * `null` when nothing matches — the caller must then REFUSE to activate (leaving
 * the paid order recoverable) rather than provision the wrong plan.
 *
 * ── THE ANNUAL CASE (added 2026-08-27) ─────────────────────────────────────
 * `term` decides what "the price it was quoted at" MEANS, and the check stays
 * exact either way:
 *   • '28d'    → expected = quoted_28d_php
 *   • 'annual' → expected = quoted_28d_php × 10.4, via `priceForTerm`
 *
 * The term comes from the ORDER's service_key (`vendor_custom_plan_annual__…`),
 * which is server-generated and immutable, so a browser cannot ask for a year
 * at the 28-day price — the amount simply would not match and activation
 * refuses. Nothing annual is stored on the plan row: a second stored price is
 * the drift this file's own fallback docblock warns about, one level up.
 *
 * ⚠ WHY NOT DIVIDE THE PAID AMOUNT BACK DOWN. Comparing `paid ÷ 10.4` against
 * `quoted_28d_php` would work arithmetically and put float slop inside a
 * SECURITY check. Multiplying up keeps the comparison in the same shape it has
 * always had, and the half-peso tolerance keeps its original meaning.
 *
 * PURE (no I/O) so the binding rule is unit-testable.
 */
export function selectActivatableCustomPlan(
  candidates: ReadonlyArray<CustomPlanCandidate>,
  orderAmountPhp: number,
  term: CustomPlanTerm = '28d',
): string | null {
  const amount = Number(orderAmountPhp);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const PAYABLE = new Set(['quoted', 'pending_payment']);
  const matches = candidates.filter((c) => {
    if (!PAYABLE.has(c.status)) return false;
    const quoted = Number(c.quoted_28d_php);
    if (!Number.isFinite(quoted)) return false;
    // 🔑 THE EXPECTED AMOUNT IS DERIVED PER CANDIDATE, NEVER STORED, and the
    // exact-match property is preserved rather than loosened: an annual order
    // must equal ×10.4 of THIS plan's 28-day quote, to the peso. A stored
    // annual column would have been a second copy to drift; dividing the paid
    // amount back down would have introduced float slop into a security check.
    const expected = priceForTerm(quoted, term);
    return Math.abs(expected - amount) < 0.5;
  });
  matches.sort((a, b) => {
    const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
    const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
    return tb - ta; // most-recent first
  });
  return matches[0]?.custom_plan_id ?? null;
}

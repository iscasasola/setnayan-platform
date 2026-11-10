/**
 * _prices.server.ts — the plan and add-on prices /for-coordinators shows, read from the catalogue that
 * charges them (`vendor_billing_catalog`, through `fetchV2VendorCatalog`), once per request.
 *
 * 🔑 NO PRICE IS TYPED HERE OR ON THE PAGE, AND THERE IS NO PESO FALLBACK. A price that cannot be read
 * comes back `null` and the page leaves the figure out — a missing price is recoverable, a confidently
 * stale one is not (same rule as `getVendorPrices` in lib/v2-catalog.ts).
 *
 *   Solo / Pro / Ultra per 4 weeks and per year ... `solo|pro|enterprise_vendor_monthly|annual`
 *   +1 branch .................................... `BRANCH_SKU_CODE` (the row a branch order is charged by)
 *   +1 team seat ................................. `SEAT_SKU_CODE`   (the row a seat order is charged by)
 */

import { fetchV2VendorCatalog } from '@/lib/v2-catalog';
import { BRANCH_SKU_CODE } from '@/lib/vendor-branches';
import { SEAT_SKU_CODE } from '@/lib/vendor-seats';

import { pesoWords, type GrowTier } from './_facts';

export type PlanPrice = { month: string | null; year: string | null };
export type CoordinatorPrices = {
  plans: Readonly<Record<GrowTier, PlanPrice>>;
  branch: string | null;
  seat: string | null;
  /** Every active row by sku_code, formatted — the shared plan table and Ultra's full add-on list (Build 6 Lane J). */
  bySku: Readonly<Record<string, string | null>>;
};

const SKU: Readonly<Record<GrowTier, string>> = { solo: 'solo', pro: 'pro', enterprise: 'enterprise' };

export async function readCoordinatorPrices(): Promise<CoordinatorPrices> {
  const rows = await fetchV2VendorCatalog().catch(() => []);
  const price = (code: string): string | null => {
    const n = rows.find((r) => r.sku_code === code)?.price_php;
    return n != null && Number.isFinite(n) && n > 0 ? pesoWords(n) : null;
  };
  const plan = (t: GrowTier): PlanPrice => ({
    month: price(`${SKU[t]}_vendor_monthly`),
    year: price(`${SKU[t]}_vendor_annual`),
  });
  return {
    plans: { solo: plan('solo'), pro: plan('pro'), enterprise: plan('enterprise') },
    branch: price(BRANCH_SKU_CODE),
    seat: price(SEAT_SKU_CODE),
    bySku: Object.fromEntries(rows.map((r) => [r.sku_code, price(r.sku_code)])),
  };
}

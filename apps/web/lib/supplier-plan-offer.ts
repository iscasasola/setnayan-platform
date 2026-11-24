/**
 * 🧭 THE PLAN A SUPPLIER PICKED ON /for-suppliers, CARRIED TO THE SHOP (W1-B21, supplier walk 16 Nov 2026).
 *
 * "Start on Plus / Pro / Ultra" used to be a bare `/open-shop` — the plan the supplier tapped was dropped on the floor,
 * and after the shop opened nothing offered it. Now each button carries `?plan=<plus|pro|ultra>` (the words a person
 * reads, never the internal tier keys), and after the shop opens the supplier lands on the EXISTING plan sheet
 * (`/vendor-dashboard/subscription`, `PlanSheet`) with that plan's row open — its own "Upgrade to <plan>" button (or the
 * shared 🔒 Get verified, for a shop that is not verified yet). No new screen; nothing here holds a price.
 *
 * Whitelisted: anything other than plus · pro · ultra reads as "no plan picked" (null), so a hand-typed `?plan=` can
 * never reach a redirect or a row key it was not meant to.
 *
 * 🔒 lib/supplier-plan-offer.test.ts
 */
import { routes } from './routes';
import type { VendorTier } from './vendor-tier-caps';

/**
 * The words on the public page, in its order. `verified` is the Free plan's "Get verified" (supplier re-walk of
 * /for-suppliers, 24 Nov 2026: it was a bare `/open-shop`, so the choice was dropped). It is NOT a paid tier row:
 * `supplierPlanTier` stays null for it, and a shop that opens with it lands on the shop's EXISTING verification
 * page (the papers fold), never the plan sheet. No price rides with it.
 */
export const SUPPLIER_PLAN_QUERY_KEYS = ['verified', 'plus', 'pro', 'ultra'] as const;
export type SupplierPlanQuery = (typeof SUPPLIER_PLAN_QUERY_KEYS)[number];
type PaidTier = Extract<VendorTier, 'solo' | 'pro' | 'enterprise'>;

/** Public word → the tier key the plan sheet and the SKUs use (`TIER_LABEL`: solo = Plus, enterprise = Ultra). Paid only. */
const TIER_OF: Readonly<Partial<Record<SupplierPlanQuery, PaidTier>>> = { plus: 'solo', pro: 'pro', ultra: 'enterprise' };
const QUERY_OF: Readonly<Record<PaidTier, SupplierPlanQuery>> = { solo: 'plus', pro: 'pro', enterprise: 'ultra' };

/** `?plan=` → verified | plus | pro | ultra, or null for anything else (absent, empty, an array, a tier key, a typo). */
export function parseSupplierPlan(v: unknown): SupplierPlanQuery | null {
  const one = Array.isArray(v) ? undefined : v;
  if (typeof one !== 'string') return null;
  const k = one.trim().toLowerCase();
  return (SUPPLIER_PLAN_QUERY_KEYS as readonly string[]).includes(k) ? (k as SupplierPlanQuery) : null;
}

/** `?plan=` → the plan sheet's row key (`solo` · `pro` · `enterprise`), or null — `verified` has no paid row. */
export function supplierPlanTier(v: unknown): PaidTier | null {
  const p = parseSupplierPlan(v);
  return p ? (TIER_OF[p] ?? null) : null;
}

/** A Grow tier (`solo` · `pro` · `enterprise`) → its public word, for the /for-suppliers buttons. */
export function supplierPlanQueryOf(tier: PaidTier): SupplierPlanQuery {
  return QUERY_OF[tier];
}

/** The /for-suppliers button for a paid plan: open a shop, carrying the plan. */
export function openShopWithPlanHref(tier: PaidTier): string {
  return `/open-shop?plan=${QUERY_OF[tier]}`;
}

/** The /for-suppliers "Get verified" button: open a shop, carrying the choice to verify. */
export const OPEN_SHOP_VERIFIED_HREF = '/open-shop?plan=verified';

/**
 * The shop's existing verification page: Your details › Your documents (the papers fold). The same place as
 * `VERIFY_DOCS_HREF` (`get-verified-line.tsx`, a client file, so not imported here); straight at the papers, never via
 * the retired `/vendor-dashboard/verify` redirect. 🔒 lib/get-verified-carries-the-choice.test.ts pins the two equal.
 */
export const VERIFY_PAPERS_PATH = `${routes.vendorDashboard.profile()}#docs`;

/**
 * Where a shop just opened with this plan picked lands: a paid plan → the plan sheet, that plan's row open;
 * `verified` → the shop's existing verification page (`VERIFY_PAPERS_PATH`, the papers fold).
 */
export const PLAN_SHEET_PATH = '/vendor-dashboard/subscription';
export function planOfferPath(v: unknown): string | null {
  const p = parseSupplierPlan(v);
  if (!p) return null;
  const tier = TIER_OF[p];
  if (!tier) return VERIFY_PAPERS_PATH;
  return `${PLAN_SHEET_PATH}?plan=${p}#plan-sheet-${tier}`;
}

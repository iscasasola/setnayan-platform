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
import type { VendorTier } from './vendor-tier-caps';

/** The words on the public page, in its order. */
export const SUPPLIER_PLAN_QUERY_KEYS = ['plus', 'pro', 'ultra'] as const;
export type SupplierPlanQuery = (typeof SUPPLIER_PLAN_QUERY_KEYS)[number];
type PaidTier = Extract<VendorTier, 'solo' | 'pro' | 'enterprise'>;

/** Public word → the tier key the plan sheet and the SKUs use (`TIER_LABEL`: solo = Plus, enterprise = Ultra). */
const TIER_OF: Readonly<Record<SupplierPlanQuery, PaidTier>> = { plus: 'solo', pro: 'pro', ultra: 'enterprise' };
const QUERY_OF: Readonly<Record<PaidTier, SupplierPlanQuery>> = { solo: 'plus', pro: 'pro', enterprise: 'ultra' };

/** `?plan=` → plus | pro | ultra, or null for anything else (absent, empty, an array, a tier key, a typo). */
export function parseSupplierPlan(v: unknown): SupplierPlanQuery | null {
  const one = Array.isArray(v) ? undefined : v;
  if (typeof one !== 'string') return null;
  const k = one.trim().toLowerCase();
  return (SUPPLIER_PLAN_QUERY_KEYS as readonly string[]).includes(k) ? (k as SupplierPlanQuery) : null;
}

/** `?plan=` → the plan sheet's row key (`solo` · `pro` · `enterprise`), or null. */
export function supplierPlanTier(v: unknown): PaidTier | null {
  const p = parseSupplierPlan(v);
  return p ? TIER_OF[p] : null;
}

/** A Grow tier (`solo` · `pro` · `enterprise`) → its public word, for the /for-suppliers buttons. */
export function supplierPlanQueryOf(tier: PaidTier): SupplierPlanQuery {
  return QUERY_OF[tier];
}

/** The /for-suppliers button for a paid plan: open a shop, carrying the plan. */
export function openShopWithPlanHref(tier: PaidTier): string {
  return `/open-shop?plan=${QUERY_OF[tier]}`;
}

/** Where a shop just opened with this plan picked lands: the plan sheet, that plan's row open. */
export const PLAN_SHEET_PATH = '/vendor-dashboard/subscription';
export function planOfferPath(v: unknown): string | null {
  const p = parseSupplierPlan(v);
  if (!p) return null;
  return `${PLAN_SHEET_PATH}?plan=${p}#plan-sheet-${TIER_OF[p]}`;
}

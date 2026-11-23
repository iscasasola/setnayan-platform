/**
 * 🏪 THE SUPPLIER PLANS APPLE SELLS — the App Store "Supplier plans" subscription group (owner-locked 22 Nov 2026,
 * corpus SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md §3 + items D/E). Pure and client-safe: the app's plan door reads
 * it for StoreKit, the server reads it to turn a signed transaction into a plan.
 *
 * Kept OUT of lib/iap/products.ts on purpose: everything there is a CONSUMABLE bought for an event (or a shop's gift),
 * and its purchase path is the intent minter. These are AUTO-RENEWABLE subscriptions bought for a SHOP, whose
 * appAccountToken is the shop itself and whose truth is App Store Server Notifications (lib/iap/supplier-subscription.server.ts).
 *
 * Monthly only (no yearly anywhere, owner 22 Nov). Same price as the web: the owner sets each product's Philippine
 * price point equal to its `vendor_billing_catalog` row — NO PRICE LIVES HERE; the app shows StoreKit's own
 * `displayPrice` and nothing else. Group levels are Apple's ranking (1 = highest): Ultra 1 · Pro 2 · Plus 3, so moving
 * up is immediate and moving down waits for the renewal — Apple's rule, and ours (item E).
 *
 * ⚠ PRODUCT IDS ARE FOREVER (App Store Connect never lets one be reused).
 */

/** The code tiers a supplier plan maps to (`lib/vendor-tier-caps.ts`): solo = Plus · pro = Pro · enterprise = Ultra. */
export type SupplierPlanTier = 'solo' | 'pro' | 'enterprise';

export type SupplierPlanProduct = {
  productId: string;
  tier: SupplierPlanTier;
  /** The plan's name, exactly as people read it (Free · Verified · Plus · Pro · Ultra). */
  name: 'Plus' | 'Pro' | 'Ultra';
  /** Apple's level inside "Supplier plans" (1 = highest). */
  groupLevel: 1 | 2 | 3;
};

export const SUPPLIER_PLAN_GROUP = 'Supplier plans';

export const SUPPLIER_PLAN_PRODUCTS: readonly SupplierPlanProduct[] = Object.freeze([
  { productId: 'com.setnayan.app.supplier_plus_monthly', tier: 'solo', name: 'Plus', groupLevel: 3 },
  { productId: 'com.setnayan.app.supplier_pro_monthly', tier: 'pro', name: 'Pro', groupLevel: 2 },
  { productId: 'com.setnayan.app.supplier_ultra_monthly', tier: 'enterprise', name: 'Ultra', groupLevel: 1 },
]);

export const SUPPLIER_PLAN_PRODUCT_IDS: readonly string[] = SUPPLIER_PLAN_PRODUCTS.map((p) => p.productId);

export function supplierPlanProductById(productId: string | null | undefined): SupplierPlanProduct | null {
  if (!productId) return null;
  return SUPPLIER_PLAN_PRODUCTS.find((p) => p.productId === productId) ?? null;
}

export function supplierPlanProductForTier(tier: string | null | undefined): SupplierPlanProduct | null {
  return SUPPLIER_PLAN_PRODUCTS.find((p) => p.tier === tier) ?? null;
}

/**
 * The catalogue code a paid period is recorded under — the monthly row the web sells for the same plan (the same
 * spelling as `skuFor` on the Plan page), so admin and receipts read one plan, whichever channel billed it.
 */
export function supplierPlanSkuCode(tier: SupplierPlanTier): string {
  return `${tier}_vendor_monthly`;
}

/**
 * ✦ E · WHICH WAY A CHANGE GOES, AND WHEN IT LANDS — one rule for both channels (owner 22 Nov):
 *   · UP   — takes effect NOW; the shop pays the pro-rated difference (web: the unused value of the old plan is credited
 *            against the new charge, `vendor_unused_plan_value_php`; Apple: Apple refunds the unused part and charges the
 *            new plan from today — the same arithmetic);
 *   · DOWN — at the END of the paid month; nothing changes today and no cash comes back;
 *   · SAME — a renewal.
 * Direction is by plan rank, never by price (the ladder `vendor_tier_rank`).
 */
const RANK: Record<string, number> = { free: 1, verified: 2, solo: 3, pro: 4, enterprise: 5 };

export type SupplierPlanMove = { direction: 'up' | 'down' | 'same'; lands: 'now' | 'end_of_paid_month' };

export function supplierPlanMove(currentTier: string | null | undefined, targetTier: SupplierPlanTier): SupplierPlanMove {
  const from = RANK[currentTier ?? 'free'] ?? 0;
  const to = RANK[targetTier]!;
  if (to > from) return { direction: 'up', lands: 'now' };
  if (to < from) return { direction: 'down', lands: 'end_of_paid_month' };
  return { direction: 'same', lands: 'end_of_paid_month' };
}

/**
 * A supplier-plan purchase Apple confirmed that we could not put on THIS shop — said plainly, with the next step
 * (never Apple's raw text, never a web price or link).
 */
export function supplierPlanRefusedLine(reason: string): string {
  switch (reason) {
    case 'other_shop':
      return 'This Apple ID already pays for another shop’s plan, so it stays with that shop. Each shop needs its own subscription.';
    case 'not_yours':
      return 'This plan was bought for a different shop. Switch to that shop to use it.';
    case 'web_billed':
      return 'This shop already has a paid plan running, so nothing was added. Apple can refund it from your Apple account’s purchase history.';
    case 'other_subscription':
      return 'This shop already has a plan from another Apple ID, so nothing was added. Apple can refund it from your Apple account’s purchase history.';
    case 'family_shared':
      return 'A plan shared through Family Sharing can’t be used for a shop. Each shop needs its own subscription.';
    case 'plan_ended':
      return 'That plan has already ended, so nothing changed.';
    default:
      return 'We couldn’t match this plan to your shop. You will not be charged again — message us from Help.';
  }
}

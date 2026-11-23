/**
 * retail-price-change.ts — which edits to a catalogue row change what a CUSTOMER PAYS.
 *
 * ── ⚖ THE RULE, 23 NOV 2026: ONE ADMIN, LIVE ON SAVE ───────────────────────
 * Owner, of his Live Watch price that sat in /admin/approvals waiting on a second admin: *"no need for a second
 * admin. auto approve"*. `saveRetailRow` now applies a price change at once, through the one executor
 * (`executeRetailPriceChange`), with an audit row (before → after, who, when, `applied_directly`).
 *
 * ── What this rule was (2026-09-23 → 23 Nov 2026) ──────────────────────────
 * Vendor Agreement § 9.1 lists *"Mid-quarter price change on any in-app SKU | Pricing governance (per § 8)"* as a
 * two-admin decision, and § 9 says mid-quarter changes *"require two-admin approval"*. Because the corpus never
 * bounds the quarter's review window, the gate held EVERY price change for a second admin. That gate is gone by the
 * owner's ruling. ⚠ The agreement's text still names the row: `lib/two-admin-promise.ts` keeps it (the page quotes
 * the contract) and records it as NOT ENFORCED. Amending § 9 / § 9.1 is the owner's step, not code's.
 *
 * ── 🔑 NOT EVERY FIELD ON THE FORM IS A PRICE ───────────────────────────────
 * The row card submits the title, the customer-facing description, the active flag and `saas_overhead_cost_php`
 * alongside the money. Those are copy and OUR cost, not anyone's bill. The split still matters: the executor writes
 * ONLY the price fields, and the audit row names exactly which ones moved.
 */

import type { RetailRowPrior, RetailRowNext } from './admin/pricing-row-diff';

/**
 * The fields that decide what a CUSTOMER PAYS — the only columns `executeRetailPriceChange` may write.
 *
 * `billing_period` and `is_pax_priced` are here deliberately: they do not hold
 * an amount, they change *how the amount is computed* — flipping a one-time SKU
 * to monthly, or a flat price to per-head, changes the bill without touching a
 * single peso figure. A gate that watched only the numbers would miss both.
 */
export const CUSTOMER_PRICE_FIELDS = [
  'retail_price_php',
  'onboarding_price_php',
  'billing_period',
  'is_pax_priced',
  'pax_floor_price_php',
  'pax_increment_price_php',
] as const;

export type CustomerPriceField = (typeof CUSTOMER_PRICE_FIELDS)[number];

/**
 * Fields on the same form that are NOT prices — listed so the exclusion is a
 * decision on the record rather than an omission someone later "fixes".
 */
export const NON_PRICE_FIELDS = [
  'title',
  'description',
  'is_active',
  'saas_overhead_cost_php',
  'pax_floor',
  'pax_increment_size',
] as const;

/** `null`, `undefined` and numeric strings all have to compare as one value. */
function norm(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(Number(v));
  const s = String(v).trim();
  if (s.length === 0) return null;
  const n = Number(s);
  return Number.isFinite(n) && s !== '' ? String(n) : s;
}

/** Which customer-price fields this save would change. */
export function changedPriceFields(
  prior: Partial<RetailRowPrior>,
  next: Partial<RetailRowNext>,
): CustomerPriceField[] {
  return CUSTOMER_PRICE_FIELDS.filter((f) => {
    const a = norm((prior as Record<string, unknown>)[f]);
    const b = norm((next as Record<string, unknown>)[f]);
    return a !== b;
  });
}

/** True when this save changes what a customer is charged. */
export function changesWhatACustomerPays(
  prior: Partial<RetailRowPrior>,
  next: Partial<RetailRowNext>,
): boolean {
  return changedPriceFields(prior, next).length > 0;
}

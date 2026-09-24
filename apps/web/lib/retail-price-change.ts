/**
 * retail-price-change.ts — which edits to a catalogue row change what a
 * CUSTOMER PAYS, and therefore need a second admin.
 *
 * ── The clause ──────────────────────────────────────────────────────────────
 * Vendor Agreement § 9.1: *"Mid-quarter price change on any in-app SKU |
 * Pricing governance (per § 8)"*, and § 9 itself:
 *
 *     "Setnayan's in-app service prices … remain constant with reviews
 *      scheduled at the start of each calendar quarter. Mid-quarter changes
 *      are rare and require two-admin approval."
 *
 * `platform_retail_catalog_v2` is admin-managed and is **the only price a
 * customer is charged**. One admin could change it alone.
 *
 * ── ⛔ WHY THIS GATES EVERY PRICE CHANGE, NOT ONLY MID-QUARTER ONES ─────────
 * The clause turns on "mid-quarter", and **the corpus never defines where a
 * quarter's review window ends.** "At the start of each calendar quarter" has
 * no duration — a day? a week? a fortnight? Grepped the whole corpus: § 3.8,
 * § 9, § 9.1 and the 0034 cart fixture all use the term and none bound it.
 *
 * Picking one would decide whether a given money change needs two admins.
 * Owner ruling 2026-08-31, on a different invented default: **"don't guess."**
 *
 * So this gates **every** customer-price change. That is STRICTER than the
 * contract, never looser, so it cannot breach it — the clause makes mid-quarter
 * changes require two admins and is silent on quarterly ones; requiring two for
 * both is a self-imposed control on Setnayan's own admins and takes nothing
 * from a vendor. § 9.1's own note agrees with the direction: these happen
 * *"once a week or less, where the two-admin friction is a feature not a bug."*
 *
 * ⚖ **Narrowing it to mid-quarter-only is a one-line change** — add the window
 * test to `priceChangeNeedsTwoAdmins`. It needs the owner to state where the
 * review window ends, and nothing else.
 *
 * ⚠ VERIFIED BEFORE SHIPPING: production has **2 admins**, so
 * `decided_by <> initiated_by` is satisfiable. With one admin every gate in
 * this family would make its operation impossible rather than careful. Two is
 * also the minimum — there is no slack if one person is away.
 *
 * ── 🔑 NOT EVERY FIELD ON THE FORM IS A PRICE ───────────────────────────────
 * The row card submits the title, the customer-facing description, the active
 * flag and `saas_overhead_cost_php` alongside the money. Renaming a SKU or
 * fixing its blurb is copy, not pricing governance, and gating it would make
 * an admin wait on a colleague to fix a typo. `saas_overhead_cost_php` is OUR
 * cost, not what anyone is charged — it moves our margin, not their bill.
 *
 * Same shape as `payment-destination.ts`: one form, two kinds of field, and
 * only one kind is what the clause is about.
 */

import type { RetailRowPrior, RetailRowNext } from './admin/pricing-row-diff';

/**
 * The fields that decide what a CUSTOMER PAYS. Changing any is a § 9.1 action.
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
export function priceChangeNeedsTwoAdmins(
  prior: Partial<RetailRowPrior>,
  next: Partial<RetailRowNext>,
): boolean {
  return changedPriceFields(prior, next).length > 0;
}

/** Human-readable, for the approval rationale the second admin reads. */
export function describePriceChange(
  prior: Partial<RetailRowPrior>,
  next: Partial<RetailRowNext>,
): string {
  return changedPriceFields(prior, next)
    .map((f) => {
      const a = norm((prior as Record<string, unknown>)[f]) ?? '(unset)';
      const b = norm((next as Record<string, unknown>)[f]) ?? '(unset)';
      return `${f}: ${a} → ${b}`;
    })
    .join(' · ');
}

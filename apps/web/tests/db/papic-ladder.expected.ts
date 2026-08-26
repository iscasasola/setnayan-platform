/**
 * THE PAPIC LADDER, WRITTEN DOWN ONCE.
 *
 * 🪤 IT WAS WRITTEN DOWN TWICE, AND THAT IS WHY THIS FILE EXISTS.
 * `papic-rungs-are-fundable.db.test.ts` and `papic-one-product-hand-out.db.test.ts`
 * each pinned the four-rung ladder of 2026-08-11 independently. Repricing to the
 * sixteen-rung one updated the first and left the second asserting prices that
 * no longer existed — the same "two copies of a rule always drift" shape this
 * codebase keeps paying for, this time inside the guards meant to prevent it.
 *
 * ⚠ THIS IS NOT A BILLING SOURCE. Price always comes from
 * `platform_retail_catalog_v2`; this is the EXPECTATION a test compares it
 * against, and changing it is a pricing decision, never a code change.
 *
 * Owner 2026-08-26, given as a table and then as the rule behind it: a
 * SCROLLABLE list priced against ₱1 = 1 credit, with a bundle discount that
 * deepens from 50% at the bottom to 80% at the top.
 *
 * ⚖ 40,000 is deliberately ABSENT. His first table had it at ₱10,000 — the same
 * price as 50,000 — so nobody could rationally choose it. It was surfaced rather
 * than silently corrected, and he removed it. Do not re-add it without a price
 * of its own.
 */

/** `[shots, pesos]`, cheapest first. */
export const PAPIC_LADDER_EXPECTED: readonly (readonly [number, number])[] = [
  [100, 50],
  [200, 100],
  [300, 150],
  [400, 200],
  [500, 250],
  [1_000, 500],
  [2_000, 1_000],
  [3_000, 1_200],
  [4_000, 1_600],
  [5_000, 2_000],
  [6_000, 2_400],
  [7_000, 2_800],
  [10_000, 3_200],
  [20_000, 5_000],
  [30_000, 7_500],
  [50_000, 10_000],
] as const;

/** The regular rate the whole ladder is discounted against: ₱1 buys one shot. */
export const PAPIC_PESO_PER_CREDIT_EXPECTED = 1;

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
  // ⚖ OWNER 2026-11-03 (DECISION_LOG "PAPIC IS THREE PACKS"): *"we want 3000
  // credits at 990"* · *"490 @ 1000 credits / 90 @ 150 credits"* · *"lets just
  // have those prices"*. Seeded by migration
  // `*_papic_is_three_packs_and_no_signup_price.sql`; every other rung is off
  // sale (deactivated, never deleted). Was seventeen rungs, ₱95 → ₱31,625.
  // ⚖ OWNER 2026-11-04 (DECISION_LOG "FINAL PRICE SHEET — ONE PRICE, APPLE AND WEBSITE"): Papic 150 ₱99 ·
  // Papic 1000 ₱499 · Papic 3000 ₱999 (migration *_the_final_price_sheet.sql). Was ₱90 / ₱490 / ₱990.
  [150, 99],
  [1_000, 499],
  [3_000, 999],
] as const;

/** The regular rate the whole ladder is discounted against: ₱1 buys one shot. */
export const PAPIC_PESO_PER_CREDIT_EXPECTED = 1;

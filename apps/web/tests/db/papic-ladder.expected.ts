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
  // ⚠ THESE ARE PRODUCTION'S PRICES, AND THEY DID NOT GET HERE BY MIGRATION.
  // The admin pricing screen writes STRAIGHT to the catalog, so prod was
  // repriced repeatedly with nothing in `supabase/migrations` behind it and the
  // seed drifted into an older, internally-consistent ladder (100 → ₱50,
  // 50,000 → ₱11,200). Invisible until something new was added: migration
  // 20271182141904 adds a 100,000 rung at ₱24,000, which is ₱0.24 a credit —
  // correct against prod's ₱0.30 at 50,000, and a RISE against the stale seed's
  // ₱0.224. The guard below would have failed on a price that is right.
  //
  // ⇒ That migration realigns all sixteen to what production already holds (a
  //   no-op there, a repair here) and this fixture follows it. Do not "correct"
  //   these back: they are a snapshot of a table the screen can move again
  //   tomorrow, and the catalog is the source of truth, never this file.
  // 💲 2026-10-28 ("THE ONE PRICE — APP STORE = WEBSITE"): the five App Store packs moved to the owner's App
  // Store prices (100 · 500 · 1,000 · 5,000 · 10,000), and every other rung moved ×~1.3177 (owner "Yes, ×1.32"),
  // rounded so the price per credit never rises.
  [100, 95],
  [200, 189],
  [300, 282],
  [400, 373],
  [500, 465],
  [1_000, 929],
  [2_000, 1_845],
  [3_000, 2_214],
  [4_000, 2_952],
  [5_000, 3_690],
  [6_000, 4_428],
  [7_000, 5_166],
  [10_000, 5_950],
  [20_000, 9_488],
  [30_000, 14_232],
  [50_000, 19_766],
  // ⚖ 100,000 — owner 2026-08-29: *"place an editable row like 50,000 and make
  // the value 24000 php."* An ANCHOR, not a computed rung: computed it would
  // have inherited 50,000's rate and cost ₱30,000, exactly two lots of 50,000,
  // which is the trap that got 40,000 removed. At ₱0.24 a credit it is a real
  // saving and the ladder's never-rises rule still holds.
  [100_000, 31_625],
] as const;

/** The regular rate the whole ladder is discounted against: ₱1 buys one shot. */
export const PAPIC_PESO_PER_CREDIT_EXPECTED = 1;

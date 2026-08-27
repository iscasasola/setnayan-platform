/**
 * Custom-tier quote math (owner-signed rate card · VENDOR_TIERS_AND_BENEFITS.md
 * §11). Golden cases from the signed rate card + the charm-rounding edges.
 * Run with `pnpm test:unit` (tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  charmRoundUp,
  computeCustomQuote,
  type CustomComposition,
  type CustomUnitPrices,
} from './vendor-custom-pricing';

// The seeded rate-card unit prices (migration 20270512705572). The lib never
// hardcodes these — the caller reads them from vendor_billing_catalog — so the
// tests pin the math against the signed prices explicitly.
const PRICES: CustomUnitPrices = {
  base: 11000,
  branch: 1000,
  reachNationwide: 2500,
  seat: 250,
  slot: 500,
  domain: 500,
};

/** Base composition = exactly the included tier (no add-ons). */
const BASE: CustomComposition = {
  branches: 1,
  reachKm: 100,
  nationwide: false,
  seats: 10,
  slotsPerCategory: 8,
  photos: 300,
  domain: false,
};

test('charmRoundUp: signed edges (16997→16999 · 16999→16999 · 17000→17099)', () => {
  assert.equal(charmRoundUp(16997), 16999);
  assert.equal(charmRoundUp(16999), 16999);
  assert.equal(charmRoundUp(17000), 17099);
});

test('charmRoundUp: non-positive / non-finite → 0', () => {
  assert.equal(charmRoundUp(0), 0);
  assert.equal(charmRoundUp(-5), 0);
  assert.equal(charmRoundUp(Number.NaN), 0);
  assert.equal(charmRoundUp(Infinity), 0);
});

test('THE SENTENCE ON THE PAGE: a base-only Custom plan quotes EXACTLY the base', () => {
  /*
    🔑 "Starts at ₱11,000" has to be true of the quote, not just of the
    catalog row. This is that sentence, pinned.

    It was false for one afternoon and the failure is worth remembering: the
    quote used to charm-round every total up to a ‑99 ending, so a base-only
    plan quoted ₱11,099 against an ₱11,000 base. Nobody had noticed in the
    months before, because the OLD base ₱8,999 already ended in ‑99 and was a
    FIXED POINT of the rounding — raising the base to a round number is what
    made a long-standing behaviour visible for the first time.

    ⚖ A ROUNDING RULE IS INVISIBLE UNTIL A VALUE STOPS SATISFYING IT. That is
    the generalisable half, and it is why this assertion is written as an
    equality against `PRICES.base` rather than against a literal: it stays true
    through the next reprice, and it fails the moment anything is added on top.
  */
  const q = computeCustomQuote(BASE, PRICES);
  assert.equal(q.list28, PRICES.base);
  assert.equal(q.final28, PRICES.base);
  assert.equal(q.final28, 11000);
  assert.equal(q.discountValue, 0);
  assert.equal(q.annual, 114400); // 11,000 × 10.4 — a 20% saving, nothing added on top
});

test('floor: below-base raw never quotes under the base fee', () => {
  // A degenerate composition (fewer than the included baselines) still floors at
  // base — excess() clamps negatives to 0, so raw == base here.
  const q = computeCustomQuote(
    { ...BASE, seats: 2, photos: 50, slotsPerCategory: 1 },
    PRICES,
  );
  // raw == base (excess clamps every under-baseline axis to 0).
  assert.equal(q.final28, 11000);
  // The property that actually matters, stated independently of the number:
  assert.ok(q.final28 >= PRICES.base, 'a quote may never land under the base fee');
});

test('5-branch = 15,000 — exactly what the dials add up to', () => {
  const q = computeCustomQuote({ ...BASE, branches: 5 }, PRICES);
  assert.equal(q.raw, 15000); // 11,000 + 4 × 1,000
  assert.equal(q.final28, 15000); // no bump: the quote IS the sum
});

test('5-branch nationwide = 17,500', () => {
  const q = computeCustomQuote({ ...BASE, branches: 5, nationwide: true }, PRICES);
  assert.equal(q.raw, 17500); // 11,000 + 4 × 1,000 + 2,500
  assert.equal(q.final28, 17500);
});

// LINEAGE OF THIS ONE CASE, because it keeps moving and each move was a ruling:
//   ₱25,999  original, with the 100-token axis
//   ₱15,999  2026-08-07, tokens retired
//   ₱18,099  2026-08-27 morning, base ₱8,999→₱11,000 · branch ₱999→₱1,000 ·
//            nationwide ₱2,499→₱2,500 · domain ₱499→₱500
//   ₱18,000  2026-08-27, the charm bump turned OFF for Custom totals — the
//            round dials were being un-rounded by it before anyone saw them
// The arithmetic below is re-derived from the rate card, never adjusted to make
// the test pass.
test('full-service (5-branch nationwide + domain) = 18,000', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true, domain: true },
    PRICES,
  );
  assert.equal(q.raw, 18000); // 11,000 + 4,000 + 2,500 + 500
  assert.equal(q.final28, 18000);
  assert.equal(q.annual, 187200); // 18,000 × 10.4
});

test('reachKm costs NOTHING now — nationwide is the only reach upgrade', () => {
  /*
    These two cases used to assert the +₱499-per-100km ladder and its 500 km
    cap. The owner dropped that axis on 2026-08-27, so the assertion is
    INVERTED rather than deleted: `reachKm` must now be free at every value,
    which is the property that would catch the axis being quietly revived.
  */
  for (const reachKm of [100, 500, 900, 99999]) {
    const q = computeCustomQuote({ ...BASE, reachKm }, PRICES);
    assert.equal(q.raw, PRICES.base, `reachKm=${reachKm} added to the total — that axis was dropped`);
  }
  // Nationwide is still charged, once.
  const nation = computeCustomQuote({ ...BASE, reachKm: 500, nationwide: true }, PRICES);
  assert.equal(nation.raw, PRICES.base + PRICES.reachNationwide);
});

test('photos cost NOTHING now — the +100 pack was dropped', () => {
  for (const photos of [300, 1000, 5000]) {
    const q = computeCustomQuote({ ...BASE, photos }, PRICES);
    assert.equal(q.raw, PRICES.base, `photos=${photos} added to the total — that axis was dropped`);
  }
});

test('amount discount: applied to list, re-charm-rounded, floored at base', () => {
  // list = 17,500 (5-branch nationwide) − ₱2,000 = 15,500. No re-rounding.
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true },
    PRICES,
    { type: 'amount', value: 2000 },
  );
  assert.equal(q.list28, 17500);
  assert.equal(q.final28, 15500);
  assert.equal(q.discountValue, 2000);
  assert.equal(q.annual, 161200); // 15,500 × 10.4
});

test('percent discount: applied to the list, rounded to whole pesos, floored', () => {
  // list = 15,000 (5-branch) × (1 − 0.10) = 13,500 exactly. No bump.
  const q = computeCustomQuote(
    { ...BASE, branches: 5 },
    PRICES,
    { type: 'percent', value: 10 },
  );
  assert.equal(q.list28, 15000);
  assert.equal(q.final28, 13500);
  assert.equal(q.discountValue, 1500);
});

test('discount never pushes below the base fee (floored)', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5 },
    PRICES,
    { type: 'percent', value: 90 },
  );
  // 🔒 THE FLOOR SURVIVED THE ROUNDING REMOVAL. `Math.max(charmRoundUp(x), base)`
  // was doing two jobs; only the rounding left. A 90% discount on ₱15,000 is
  // ₱1,500, and a Custom plan must still never quote below its base fee.
  assert.equal(q.final28, PRICES.base);
  assert.equal(q.final28, 11000);
});

test('INVERTED: nothing is added on top of a total, at 28 days or annually', () => {
  /*
    ⚠ THIS CASE IS INVERTED, NOT RENUMBERED. Its entire purpose used to be
    proving that the charm bump HAPPENS — that a ‑99 28-day price times ten
    re-charmed by exactly 9. The owner turned that bump off for Custom quotes on
    2026-08-27, so a test asserting it fires is not a test that needs new
    numbers; it is a test asserting the opposite of the rule. Renumbering it to
    fresh ‑99 figures would have quietly re-encoded the behaviour he removed.

    So it now asserts the rule that replaced it, across the same spread of
    compositions: a quote is EXACTLY the sum of its dials, and the annual is
    EXACTLY ten times the 28-day figure. Nothing is added anywhere.
  */
  const compositions = [
    { ...BASE, branches: 5 },
    { ...BASE, branches: 5, nationwide: true },
    { ...BASE, branches: 5, nationwide: true, slotsPerCategory: 11 },
    { ...BASE, branches: 2, seats: 13, domain: true },
  ];

  for (const c of compositions) {
    const q = computeCustomQuote(c, PRICES);
    // The 28-day figure is the raw sum (floored at base) — no bump.
    assert.equal(q.final28, Math.max(q.raw, PRICES.base), `final28 drifted from raw for ${JSON.stringify(c)}`);
    // The annual is a clean ×10.4 — no bump on the way out either.
    assert.equal(
      q.annual,
      Math.round(q.final28 * 10.4),
      `annual is not exactly ×10.4 (got ${q.annual} from ${q.final28})`,
    );
    // And it lands on a whole peso — ×10.4 can leave a fraction on a
    // discounted total, which is the one place rounding is legitimate.
    assert.equal(q.annual % 1, 0, `annual ${q.annual} is not a whole peso`);
    // And nothing ends in the old charm signature.
    assert.notEqual(q.final28 % 100, 99, `final28 ${q.final28} still carries a ‑99 charm ending`);
  }

  // One worked example spelled out, so the property has a concrete anchor:
  // 5-branch = 11,000 + 4 × 1,000 = 15,000 → annual 15,000 × 10.4 = 156,000.
  const five = computeCustomQuote({ ...BASE, branches: 5 }, PRICES);
  assert.equal(five.final28, 15000);
  assert.equal(five.annual, 156000);
});

test('discountValue is exactly list28 − final28', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true },
    PRICES,
    { type: 'amount', value: 1500 },
  );
  assert.equal(q.discountValue, q.list28 - q.final28);
});

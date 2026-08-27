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

test('base only quotes the CHARM-ROUNDED base, which is no longer the base itself', () => {
  /*
    🚨 READ THIS BEFORE "FIXING" THE NUMBER. This case used to assert
    `final28 === 8999`, and it was exactly true: the old base ₱8,999 already
    ended in ‑99, so it was a FIXED POINT of `charmRoundUp` and a base-only plan
    quoted the base fee unchanged.

    The owner set the base to ₱11,000 on 2026-08-27. ₱11,000 is NOT a fixed
    point — charmRoundUp(11000) = 11099 — so a base-only Custom plan now quotes
    **₱11,099** against a ₱11,000 base. Nothing is broken and no rule changed;
    the two owner decisions simply interact.

    ⚖ The charm rule is DELIBERATELY NOT touched here. He declined to retire
    charm pricing repo-wide the same day ("we will adjust them manually on the
    app"), and rounding the TOTAL is a different decision from rounding the
    DIALS. Whether a Custom quote should end in ‑99 at all is flagged for him.
  */
  const q = computeCustomQuote(BASE, PRICES);
  assert.equal(q.list28, 11099); // charm(11000) = 11099
  assert.equal(q.final28, 11099);
  assert.equal(q.discountValue, 0);
  assert.equal(q.annual, charmRoundUp(11099 * 10)); // 110990 → 110999
  assert.equal(q.annual, 110999);
});

test('floor: below-base raw never quotes under the base fee', () => {
  // A degenerate composition (fewer than the included baselines) still floors at
  // base — excess() clamps negatives to 0, so raw == base here.
  const q = computeCustomQuote(
    { ...BASE, seats: 2, photos: 50, slotsPerCategory: 1 },
    PRICES,
  );
  // raw == base (excess clamps every under-baseline axis to 0), then charm.
  assert.equal(q.final28, 11099);
  // The property that actually matters, stated independently of the number:
  assert.ok(q.final28 >= PRICES.base, 'a quote may never land under the base fee');
});

test('5-branch = 15,099', () => {
  const q = computeCustomQuote({ ...BASE, branches: 5 }, PRICES);
  assert.equal(q.raw, 15000); // 11,000 + 4 × 1,000
  assert.equal(q.final28, 15099); // charm(15000)
});

test('5-branch nationwide = 17,599', () => {
  const q = computeCustomQuote({ ...BASE, branches: 5, nationwide: true }, PRICES);
  assert.equal(q.raw, 17500); // 11,000 + 4 × 1,000 + 2,500
  assert.equal(q.final28, 17599); // charm(17500)
});

// LINEAGE OF THIS ONE CASE, because it keeps moving and each move was a ruling:
//   ₱25,999  original, with the 100-token axis
//   ₱15,999  2026-08-07, tokens retired
//   ₱18,099  2026-08-27, base ₱8,999→₱11,000 · branch ₱999→₱1,000 ·
//            nationwide ₱2,499→₱2,500 · domain ₱499→₱500
// The arithmetic below is re-derived from the rate card, never adjusted to make
// the test pass.
test('full-service (5-branch nationwide + domain) = 18,099', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true, domain: true },
    PRICES,
  );
  assert.equal(q.raw, 18000); // 11,000 + 4,000 + 2,500 + 500
  assert.equal(q.final28, 18099); // charm(18000)
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
  // list = 17,599 (5-branch nationwide) − ₱2,000 = 15,599 → already ‑99 → 15,599
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true },
    PRICES,
    { type: 'amount', value: 2000 },
  );
  assert.equal(q.list28, 17599);
  assert.equal(q.final28, 15599);
  assert.equal(q.discountValue, 2000);
  assert.equal(q.annual, charmRoundUp(15599 * 10)); // 155990 → 155999
});

test('percent discount: applied to list, re-charm-rounded UP to next ‑99', () => {
  // list = 15,099 (5-branch) × (1 − 0.10) = 13,589.1 → charm rounds UP → 13,599.
  const q = computeCustomQuote(
    { ...BASE, branches: 5 },
    PRICES,
    { type: 'percent', value: 10 },
  );
  assert.equal(q.list28, 15099);
  assert.equal(q.final28, 13599);
  assert.equal(q.discountValue, 1500);
});

test('discount never pushes below the base fee (floored)', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5 },
    PRICES,
    { type: 'percent', value: 90 },
  );
  // Floored at the base EXACTLY — the floor is applied after the charm, so this
  // is one of the few quotes that does not end in ‑99.
  assert.equal(q.final28, 11000);
  assert.equal(q.final28, PRICES.base);
});

test('annual re-charms whenever final28 × 10 lands on a round hundred', () => {
  /*
    ⚠ THIS CASE WAS REBUILT 2026-08-27 RATHER THAN RENUMBERED, because its old
    target became UNREACHABLE and quietly renumbering it would have left a test
    that proved nothing.

    It used to hunt a composition worth exactly ₱16,999 so that ×10 = 169,990
    would re-charm to 169,999. Under the rounded rate card every unit is a
    multiple of 250 (base 11,000 · branch 1,000 · nationwide 2,500 · slot 500 ·
    seat 250 · domain 500), so `raw` is always a multiple of 250 and no
    composition can land in the 16,900–16,999 window that charms to 16,999.

    So it now asserts the PROPERTY instead of one arithmetic coincidence: a
    charm-rounded 28-day price always ends in ‑99, therefore ×10 always ends in
    ‑990, therefore the annual always re-charms by exactly 9. That is true for
    every composition, which is strictly more than the old single case proved.
  */
  const compositions = [
    { ...BASE, branches: 5 },
    { ...BASE, branches: 5, nationwide: true },
    { ...BASE, branches: 5, nationwide: true, slotsPerCategory: 11 },
    { ...BASE, branches: 2, seats: 13, domain: true },
  ];

  for (const c of compositions) {
    const q = computeCustomQuote(c, PRICES);
    assert.equal(q.final28 % 100, 99, `final28 ${q.final28} should charm to a ‑99 ending`);
    assert.equal(
      q.annual,
      q.final28 * 10 + 9,
      `annual should be final28 × 10 re-charmed by 9 (got ${q.annual} from ${q.final28})`,
    );
    assert.equal(q.annual, charmRoundUp(q.final28 * 10));
  }

  // And one worked example spelled out, so the property has a concrete anchor:
  // 5-branch = 15,099 → ×10 = 150,990 → charm → 150,999.
  const five = computeCustomQuote({ ...BASE, branches: 5 }, PRICES);
  assert.equal(five.final28, 15099);
  assert.equal(five.annual, 150999);
});

test('discountValue is exactly list28 − final28', () => {
  const q = computeCustomQuote(
    { ...BASE, branches: 5, nationwide: true },
    PRICES,
    { type: 'amount', value: 1500 },
  );
  assert.equal(q.discountValue, q.list28 - q.final28);
});

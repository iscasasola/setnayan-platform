import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  paxAdjustedStartsAtPhp,
  cheapestStartsAt,
  priceFitScore,
  isBudgetFiltered,
  isAvailabilityFiltered,
  budgetPressure,
  PRICE_FIT_NEUTRAL,
} from '@/lib/smart-sort';

// ── paxAdjustedStartsAtPhp ────────────────────────────────────────────────

test('per_pax straight: per-head × live pax', () => {
  const svc = { pricing_basis: 'per_pax', per_pax_price_php: 800, min_pax: 50 };
  assert.deepEqual(paxAdjustedStartsAtPhp(svc, 150), { startsAtPhp: 120000, paxDriven: true });
});

test('per_pax straight: bills the min_pax floor when live pax is below it', () => {
  const svc = { pricing_basis: 'per_pax', per_pax_price_php: 800, min_pax: 100 };
  assert.equal(paxAdjustedStartsAtPhp(svc, 40).startsAtPhp, 80000); // 800 × 100 floor
});

test('per_pax: no live pax → uses the vendor floor, paxDriven=false', () => {
  const svc = { pricing_basis: 'per_pax', per_pax_price_php: 800, min_pax: 100 };
  const r = paxAdjustedStartsAtPhp(svc, null);
  assert.equal(r.startsAtPhp, 80000);
  assert.equal(r.paxDriven, false);
});

test('per_pax tiered: base covers base_pax, added blocks beyond', () => {
  // ₱50k for 100 pax, +₱10k per 50 over. 175 pax → +2 blocks → 70k.
  const svc = {
    pricing_basis: 'per_pax', starting_price_php: 50000,
    base_pax: 100, added_pax_block: 50, added_pax_price_php: 10000,
  };
  assert.equal(paxAdjustedStartsAtPhp(svc, 175).startsAtPhp, 70000);
});

test('per_pax tiered: at/below base_pax → just the base', () => {
  const svc = {
    pricing_basis: 'per_pax', starting_price_php: 50000,
    base_pax: 100, added_pax_block: 50, added_pax_price_php: 10000,
  };
  assert.equal(paxAdjustedStartsAtPhp(svc, 80).startsAtPhp, 50000);
});

test('fixed: flat starting price, not pax-driven', () => {
  const svc = { pricing_basis: 'fixed', starting_price_php: 25000 };
  assert.deepEqual(paxAdjustedStartsAtPhp(svc, 500), { startsAtPhp: 25000, paxDriven: false });
});

test('per_hour: hourly base is the floor', () => {
  const svc = { pricing_basis: 'per_hour', hour_base_php: 12000, extra_hour_php: 3000 };
  assert.equal(paxAdjustedStartsAtPhp(svc, 200).startsAtPhp, 12000);
});

test('no price / null service → null startsAt', () => {
  assert.equal(paxAdjustedStartsAtPhp(null, 100).startsAtPhp, null);
  assert.equal(paxAdjustedStartsAtPhp({ pricing_basis: 'fixed' }, 100).startsAtPhp, null);
});

test('cheapestStartsAt picks the lowest usable floor', () => {
  const r = cheapestStartsAt(
    [
      { pricing_basis: 'fixed', starting_price_php: 40000 },
      { pricing_basis: 'per_pax', per_pax_price_php: 500, min_pax: 50 }, // 500×100=50000 @150? no: 500×150=75000
      { pricing_basis: 'fixed', starting_price_php: 30000 },
      null,
    ],
    150,
  );
  assert.equal(r.startsAtPhp, 30000);
});

// ── priceFitScore ─────────────────────────────────────────────────────────

test('priceFit: within budget → 1', () => {
  assert.equal(priceFitScore(50000, 100000), 1);
});

test('priceFit: exactly at budget → 1', () => {
  assert.equal(priceFitScore(100000, 100000), 1);
});

test('priceFit: 1× over budget → 0.5 (half-life)', () => {
  assert.equal(priceFitScore(200000, 100000), 0.5);
});

test('priceFit: 2× over → 0.25', () => {
  assert.ok(Math.abs(priceFitScore(300000, 100000) - 0.25) < 1e-9);
});

test('priceFit: unknown budget or price → neutral, never a penalty', () => {
  assert.equal(priceFitScore(50000, null), PRICE_FIT_NEUTRAL);
  assert.equal(priceFitScore(null, 100000), PRICE_FIT_NEUTRAL);
});

test('priceFit: budget exhausted → priced vendor scores low but > 0', () => {
  assert.equal(priceFitScore(50000, 0), 0.15);
  assert.equal(priceFitScore(0, 0), 1);
});

// ── strict filters (opt-in only) ──────────────────────────────────────────

test('isBudgetFiltered: soft never filters; strict filters only real over-budget', () => {
  assert.equal(isBudgetFiltered('soft', 200000, 100000), false);
  assert.equal(isBudgetFiltered('strict', 200000, 100000), true);
  assert.equal(isBudgetFiltered('strict', 90000, 100000), false);
  assert.equal(isBudgetFiltered('strict', 200000, null), false); // unknown budget → never filter
});

test('isAvailabilityFiltered: strict hides only known-unavailable', () => {
  assert.equal(isAvailabilityFiltered('soft', false), false);
  assert.equal(isAvailabilityFiltered('strict', false), true);
  assert.equal(isAvailabilityFiltered('strict', true), false);
});

// ── budgetPressure (raise-your-budget nudge) ──────────────────────────────

test('budgetPressure: all priced options above remaining → true', () => {
  assert.equal(budgetPressure([120000, 200000, 150000], 100000), true);
});

test('budgetPressure: one affordable option clears it', () => {
  assert.equal(budgetPressure([120000, 90000, 150000], 100000), false);
});

test('budgetPressure: no budget / no priced options → false', () => {
  assert.equal(budgetPressure([120000], null), false);
  assert.equal(budgetPressure([null, null], 100000), false);
  assert.equal(budgetPressure([], 100000), false);
});

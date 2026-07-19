import assert from 'node:assert/strict';
import { test } from 'node:test';

import { vendorBudgetFitRatio } from './vendor-budget-fit';
import { canonicalServiceToPlanGroupId } from './wedding-plan-groups';

// A real category that maps to a plan group; derive its group id via the same
// function the helper uses so the fixture can't drift from the taxonomy.
const CATERING = 'catering';
const cateringGroup = canonicalServiceToPlanGroupId(CATERING);
assert.ok(cateringGroup, 'test fixture: catering must map to a plan group');
const budget = new Map<string, number>([[cateringGroup, 100_000]]);

test('vendorBudgetFitRatio: under-budget vendor scores a perfect fit (1)', () => {
  const r = vendorBudgetFitRatio({
    vendorCategory: CATERING,
    startingPricePhp: 60_000,
    budgetByPlanGroup: budget,
  });
  assert.equal(r, 1);
});

test('vendorBudgetFitRatio: at-budget vendor still fits (1)', () => {
  const r = vendorBudgetFitRatio({
    vendorCategory: CATERING,
    startingPricePhp: 100_000,
    budgetByPlanGroup: budget,
  });
  assert.equal(r, 1);
});

test('vendorBudgetFitRatio: over-budget vendor decays below neutral', () => {
  // 200k vs 100k allocation → 1× over → half-life 0.5.
  const r = vendorBudgetFitRatio({
    vendorCategory: CATERING,
    startingPricePhp: 200_000,
    budgetByPlanGroup: budget,
  });
  assert.ok(r != null && r > 0 && r < 0.6, `expected a sub-neutral decay, got ${r}`);
});

test('vendorBudgetFitRatio: unmappable category → null (neutral)', () => {
  const r = vendorBudgetFitRatio({
    vendorCategory: 'not_a_real_category',
    startingPricePhp: 50_000,
    budgetByPlanGroup: budget,
  });
  assert.equal(r, null);
});

test('vendorBudgetFitRatio: mapped category but no allocation for it → null', () => {
  const r = vendorBudgetFitRatio({
    vendorCategory: CATERING,
    startingPricePhp: 50_000,
    budgetByPlanGroup: new Map(), // empty allocation
  });
  assert.equal(r, null);
});

test('vendorBudgetFitRatio: missing / non-positive / null price → null', () => {
  for (const price of [null, undefined, 0, -5, Number.NaN] as const) {
    const r = vendorBudgetFitRatio({
      vendorCategory: CATERING,
      startingPricePhp: price,
      budgetByPlanGroup: budget,
    });
    assert.equal(r, null, `price ${String(price)} should be null`);
  }
});

test('vendorBudgetFitRatio: null category → null', () => {
  const r = vendorBudgetFitRatio({
    vendorCategory: null,
    startingPricePhp: 50_000,
    budgetByPlanGroup: budget,
  });
  assert.equal(r, null);
});

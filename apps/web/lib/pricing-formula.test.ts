/**
 * pricing-formula.test.ts — the owner's 2026-11-21 formula, pinned:
 *   price = base cost × 10 × 4.5 ÷ 0.73, rounded UP to the step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRICING_FORMULA_DEFAULTS,
  formulaCandidates,
  formulaDifferenceLabel,
  formulaPrice,
  formulaSentence,
  readPricingFormulaSettings,
  validatePricingFormulaFields,
  type PricingFormulaSettings,
} from './pricing-formula';

const at = (step: 1 | 5 | 10): PricingFormulaSettings => ({ ...PRICING_FORMULA_DEFAULTS, roundStepPhp: step });

test('cost 2 → ₱124 at step 1, ₱125 at step 5, ₱130 at step 10', () => {
  assert.equal(formulaPrice(2, at(1)), 124);
  assert.equal(formulaPrice(2, at(5)), 125);
  assert.equal(formulaPrice(2, at(10)), 130);
});

test('a row with no cost suggests nothing — never ₱0', () => {
  assert.equal(formulaPrice(0, at(1)), null);
  assert.equal(formulaPrice(-5, at(1)), null);
  assert.equal(formulaPrice(Number.NaN, at(1)), null);
});

test('the suggestion is never below the raw value, at every step', () => {
  for (const step of [1, 5, 10] as const) {
    for (let cost = 0.01; cost < 200; cost += 0.37) {
      const raw = (cost * 10 * 4.5) / 0.73;
      const p = formulaPrice(cost, at(step));
      assert.ok(p != null && p >= raw - 1e-6, `cost ${cost} step ${step}: ${p} < ${raw}`);
      assert.ok(p! - raw < step, `cost ${cost} step ${step}: ${p} is more than one step above ${raw}`);
      assert.equal(p! % step, 0, `cost ${cost}: ${p} is not a multiple of ₱${step}`);
    }
  }
});

test('an exact multiple is not pushed up a step by float noise', () => {
  const s: PricingFormulaSettings = { opexFactor: 1, marginFactor: 1, feeTaxCover: 0.1, roundStepPhp: 1 };
  assert.equal(formulaPrice(0.3, s), 3); // 0.3 / 0.1 = 2.9999999999999996 in floats
  assert.equal(formulaPrice(12.5, { ...s, feeTaxCover: 1 }), 13);
});

test('the sentence the card reads', () => {
  assert.equal(formulaSentence(PRICING_FORMULA_DEFAULTS), 'Price = base cost × 10 × 4.5 ÷ 0.73, rounded up to ₱1');
});

test('the difference beside a row', () => {
  assert.equal(formulaDifferenceLabel(124, 100), '+₱24');
  assert.equal(formulaDifferenceLabel(2700, 3000), '−₱300');
  assert.equal(formulaDifferenceLabel(124, 124), 'same');
});

test('settings: a failed or out-of-range read is null, not the defaults', () => {
  assert.equal(readPricingFormulaSettings(null), null);
  assert.equal(
    readPricingFormulaSettings({ pricing_opex_factor: 10, pricing_margin_factor: 4.5, pricing_fee_tax_cover: 1.2, pricing_round_step_php: 1 }),
    null,
  );
  assert.equal(
    readPricingFormulaSettings({ pricing_opex_factor: 10, pricing_margin_factor: 4.5, pricing_fee_tax_cover: 0.73, pricing_round_step_php: 3 }),
    null,
  );
  assert.deepEqual(
    readPricingFormulaSettings({ pricing_opex_factor: '10.000', pricing_margin_factor: '4.500', pricing_fee_tax_cover: '0.7300', pricing_round_step_php: 5 }),
    { opexFactor: 10, marginFactor: 4.5, feeTaxCover: 0.73, roundStepPhp: 5 },
  );
});

test('settings card: a blank box is refused, never read as 0', () => {
  const ok = { opexFactor: '10', marginFactor: '4.5', feeTaxCover: '0.73', roundStepPhp: '1' };
  assert.equal(validatePricingFormulaFields(ok).ok, true);
  assert.equal(validatePricingFormulaFields({ ...ok, opexFactor: '' }).ok, false);
  assert.equal(validatePricingFormulaFields({ ...ok, feeTaxCover: '0' }).ok, false);
  assert.equal(validatePricingFormulaFields({ ...ok, feeTaxCover: '1.01' }).ok, false);
  assert.equal(validatePricingFormulaFields({ ...ok, feeTaxCover: '1' }).ok, true);
  assert.equal(validatePricingFormulaFields({ ...ok, roundStepPhp: '2' }).ok, false);
});

test('apply-to-all touches only on-sale, non-bundle, non-yearly rows with a cost whose price would move', () => {
  const rows = [
    { code: 'A', title: 'A', price: 100, cost: 2, isActive: true, isGiftBundle: false, billingPeriod: 'one_time' }, // → 124
    { code: 'B', title: 'B', price: 124, cost: 2, isActive: true, isGiftBundle: false, billingPeriod: 'one_time' }, // already there
    { code: 'C', title: 'C', price: 100, cost: 0, isActive: true, isGiftBundle: false, billingPeriod: 'one_time' }, // no cost
    { code: 'D', title: 'D', price: 100, cost: 2, isActive: false, isGiftBundle: false, billingPeriod: 'one_time' }, // switched off
    { code: 'E', title: 'E', price: 100, cost: 2, isActive: true, isGiftBundle: true, billingPeriod: 'one_time' }, // gift bundle
    { code: 'F', title: 'F', price: 100, cost: 2, isActive: true, isGiftBundle: false, billingPeriod: 'per_year' }, // yearly ×10
    { code: 'G', title: 'G', price: 100, cost: 2, isActive: true, isGiftBundle: false, billingPeriod: 'per_28d' }, // → 124
  ];
  assert.deepEqual(formulaCandidates(rows, at(1)), [
    { code: 'A', title: 'A', oldPrice: 100, newPrice: 124 },
    { code: 'G', title: 'G', oldPrice: 100, newPrice: 124 },
  ]);
});

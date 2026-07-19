/**
 * Unit suite for the pure package-line pricing resolver
 * (Vendor Proposal Maker · PR 2). Covers the three pricing bases, the crew-meal
 * credit/charge + transport helpers, and the credit-cascade against a schedule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePackageLine,
  crewCreditCentavos,
  crewChargeCentavos,
  transportChargeCentavos,
  applyCreditToFinalInstallment,
  type PackageLinePricingRow,
} from './package-line-pricing';

test('fixed basis returns the flat replacement value, ignoring pax/hours', () => {
  const row: PackageLinePricingRow = {
    pricing_basis: 'fixed',
    replacement_value_centavos: 150000,
  };
  assert.equal(resolvePackageLine(row, { pax: 200, hours: 8 }), 150000);
});

test('a row with no pricing_basis defaults to fixed', () => {
  const row: PackageLinePricingRow = { replacement_value_centavos: 4200 };
  assert.equal(resolvePackageLine(row, { pax: 50, hours: 3 }), 4200);
});

test('per_pax basis bills the actual pax when above the floor', () => {
  const row: PackageLinePricingRow = {
    pricing_basis: 'per_pax',
    per_pax_price_centavos: 80000, // ₱800/head
    min_pax: 100,
  };
  // 150 pax × ₱800 = ₱120,000
  assert.equal(resolvePackageLine(row, { pax: 150, hours: 0 }), 12000000);
});

test('per_pax basis floors at min_pax when pax is below it', () => {
  const row: PackageLinePricingRow = {
    pricing_basis: 'per_pax',
    per_pax_price_centavos: 80000,
    min_pax: 100,
  };
  // 40 pax billed as 100 × ₱800 = ₱80,000
  assert.equal(resolvePackageLine(row, { pax: 40, hours: 0 }), 8000000);
});

test('per_pax basis with null min_pax uses raw pax (floor 0)', () => {
  const row: PackageLinePricingRow = {
    pricing_basis: 'per_pax',
    per_pax_price_centavos: 50000,
    min_pax: null,
  };
  assert.equal(resolvePackageLine(row, { pax: 3, hours: 0 }), 150000);
});

test('per_hour basis adds extra-hour charge above the base block', () => {
  const row: PackageLinePricingRow = {
    pricing_basis: 'per_hour',
    hour_base_centavos: 1000000, // ₱10,000 covers min_hours
    min_hours: 4,
    extra_hour_centavos: 200000, // ₱2,000/extra hour
  };
  // 4 base + 3 extra × ₱2,000 = ₱10,000 + ₱6,000 = ₱16,000
  assert.equal(resolvePackageLine(row, { pax: 0, hours: 7 }), 1600000);
});

test('per_hour basis charges only the base when hours are within min_hours', () => {
  const row: PackageLinePricingRow = {
    pricing_basis: 'per_hour',
    hour_base_centavos: 1000000,
    min_hours: 4,
    extra_hour_centavos: 200000,
  };
  assert.equal(resolvePackageLine(row, { pax: 0, hours: 2 }), 1000000);
});

test('resolvePackageLine is total — never throws on empty/garbage input', () => {
  assert.equal(resolvePackageLine({}, { pax: NaN, hours: NaN }), 0);
  assert.equal(
    resolvePackageLine(
      { pricing_basis: 'per_pax', per_pax_price_centavos: null, min_pax: null },
      { pax: 10, hours: 0 },
    ),
    0,
  );
});

test('crew credit only applies in offset mode', () => {
  const base = { crew_size: 5, crew_per_head_centavos: 30000 }; // 5 × ₱300 = ₱1,500
  assert.equal(crewCreditCentavos({ ...base, crew_meal_mode: 'offset' }), 150000);
  assert.equal(crewCreditCentavos({ ...base, crew_meal_mode: 'included' }), 0);
  assert.equal(crewCreditCentavos({ ...base, crew_meal_mode: 'charge' }), 0);
});

test('crew charge only applies in charge mode', () => {
  const base = { crew_size: 5, crew_per_head_centavos: 30000 };
  assert.equal(crewChargeCentavos({ ...base, crew_meal_mode: 'charge' }), 150000);
  assert.equal(crewChargeCentavos({ ...base, crew_meal_mode: 'offset' }), 0);
  assert.equal(crewChargeCentavos({ ...base, crew_meal_mode: 'included' }), 0);
});

test('transport charge only applies in flat mode', () => {
  assert.equal(
    transportChargeCentavos({ transport_mode: 'flat', transport_flat_centavos: 250000 }),
    250000,
  );
  assert.equal(
    transportChargeCentavos({ transport_mode: 'distance', transport_flat_centavos: 250000 }),
    0,
  );
  assert.equal(transportChargeCentavos({ transport_mode: 'included' }), 0);
});

test('credit reduces the final installment first', () => {
  const plan = [{ amount_php: 5000 }, { amount_php: 3000 }, { amount_php: 2000 }];
  const out = applyCreditToFinalInstallment(plan, 1500);
  assert.deepEqual(
    out.map((i) => i.amount_php),
    [5000, 3000, 500],
  );
  // input untouched (pure)
  assert.equal(plan[2]?.amount_php, 2000);
});

test('credit cascades upward when it exceeds the final installment', () => {
  const plan = [{ amount_php: 5000 }, { amount_php: 3000 }, { amount_php: 2000 }];
  // 4000 credit: zero the last 2000, then 2000 off the middle 3000 → 1000
  const out = applyCreditToFinalInstallment(plan, 4000);
  assert.deepEqual(
    out.map((i) => i.amount_php),
    [5000, 1000, 0],
  );
});

test('credit never pushes an installment below zero and absorbs the excess', () => {
  const plan = [{ amount_php: 1000 }, { amount_php: 1000 }];
  const out = applyCreditToFinalInstallment(plan, 5000);
  assert.deepEqual(
    out.map((i) => i.amount_php),
    [0, 0],
  );
});

/**
 * Unit suite for computeVatFromBase — now LOAD-BEARING: it computes the
 * VAT-inclusive gross the couple is charged (owner ruling 2026-06-25: catalog
 * prices are PRE-VAT, +12% at checkout), used identically by the checkout server
 * action (submitOrderAction), the inline-checkout drawer display, computeOrderTotals,
 * and the BIR receipt. If this drifts, couples are mischarged — so pin the math.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVatFromBase, computeVatFromGross, DEFAULT_VAT_RATE_PCT } from './receipts';

test('default rate is 12%', () => {
  assert.equal(DEFAULT_VAT_RATE_PCT, 12);
});

test('grosses a whole-peso base by 12% (₱10,000 → ₱11,200)', () => {
  assert.deepEqual(computeVatFromBase(10000, 12), { preVat: 10000, vat: 1200, gross: 11200, rate: 12 });
});

test('rounds VAT + gross to 2 decimals (₱3,999 → VAT ₱479.88 → ₱4,478.88)', () => {
  const r = computeVatFromBase(3999, 12);
  assert.equal(r.vat, 479.88);
  assert.equal(r.gross, 4478.88);
  assert.equal(r.preVat, 3999);
});

test('₱1,499 → VAT ₱179.88 → gross ₱1,678.88', () => {
  const r = computeVatFromBase(1499, 12);
  assert.equal(r.vat, 179.88);
  assert.equal(r.gross, 1678.88);
});

test('zero base → zero VAT + zero gross (free SKUs unaffected)', () => {
  assert.deepEqual(computeVatFromBase(0, 12), { preVat: 0, vat: 0, gross: 0, rate: 12 });
});

test('invariant: gross === preVat + vat, for many bases', () => {
  for (const base of [1, 99, 100.1, 250, 2999, 12999, 27999, 53981]) {
    const { preVat, vat, gross } = computeVatFromBase(base, 12);
    assert.equal(gross, Math.round((preVat + vat) * 100) / 100, `gross != preVat+vat at ${base}`);
    // VAT is exactly 12% of the (rounded) base, to 2dp.
    assert.equal(vat, Math.round(preVat * 12) / 100, `vat != 12% at ${base}`);
  }
});

test('honours an explicit non-default rate', () => {
  const r = computeVatFromBase(1000, 0);
  assert.deepEqual(r, { preVat: 1000, vat: 0, gross: 1000, rate: 0 });
});

// computeVatFromGross — VAT-INCLUSIVE back-out for all-in vendor charm prices.
test('vendor ₱999 all-in decomposes to base+VAT summing to exactly ₱999', () => {
  // vat = 999 × 12/112 = 107.036 → 107.04; preVat = 999 − 107.04 = 891.96.
  assert.deepEqual(computeVatFromGross(999), { preVat: 891.96, vat: 107.04, gross: 999, rate: 12 });
});

test('gross back-out invariant: preVat + vat === gross (2dp), any all-in price', () => {
  for (const gross of [999, 2499, 7499, 100, 1, 12345.67]) {
    const { preVat, vat } = computeVatFromGross(gross);
    assert.equal(Math.round((preVat + vat) * 100) / 100, gross);
  }
});

test('gross back-out never charges more than the quoted all-in price', () => {
  // Unlike building UP from base (which would inflate ₱999 → ₱1,118.88), the
  // gross stays the all-in figure the vendor actually sees + pays.
  assert.equal(computeVatFromGross(999).gross, 999);
});

test('the rate is a required argument — there is no implicit tax', () => {
  // Regression guard. `computeVatFromBase` used to default to 12%, which silently overrode the
  // configured `platform_settings.default_vat_rate_pct = 0` and billed every customer SKU 12%
  // over its advertised price. The rate must always come from the caller.
  assert.deepEqual(computeVatFromBase(2500, 0), { preVat: 2500, vat: 0, gross: 2500, rate: 0 });
  assert.deepEqual(computeVatFromBase(2500, 12), { preVat: 2500, vat: 300, gross: 2800, rate: 12 });
});

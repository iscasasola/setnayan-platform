/**
 * Unit suite for computeVatFromBase — now LOAD-BEARING: it computes the
 * VAT-inclusive gross the couple is charged (owner ruling 2026-06-25: catalog
 * prices are PRE-VAT, +12% at checkout), used identically by the checkout server
 * action (submitOrderAction), the inline-checkout drawer display, computeOrderTotals,
 * and the BIR receipt. If this drifts, couples are mischarged — so pin the math.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeVatFromBase, DEFAULT_VAT_RATE_PCT } from './receipts';

test('default rate is 12%', () => {
  assert.equal(DEFAULT_VAT_RATE_PCT, 12);
});

test('grosses a whole-peso base by 12% (₱10,000 → ₱11,200)', () => {
  assert.deepEqual(computeVatFromBase(10000), { preVat: 10000, vat: 1200, gross: 11200, rate: 12 });
});

test('rounds VAT + gross to 2 decimals (₱3,999 → VAT ₱479.88 → ₱4,478.88)', () => {
  const r = computeVatFromBase(3999);
  assert.equal(r.vat, 479.88);
  assert.equal(r.gross, 4478.88);
  assert.equal(r.preVat, 3999);
});

test('₱1,499 → VAT ₱179.88 → gross ₱1,678.88', () => {
  const r = computeVatFromBase(1499);
  assert.equal(r.vat, 179.88);
  assert.equal(r.gross, 1678.88);
});

test('zero base → zero VAT + zero gross (free SKUs unaffected)', () => {
  assert.deepEqual(computeVatFromBase(0), { preVat: 0, vat: 0, gross: 0, rate: 12 });
});

test('invariant: gross === preVat + vat, for many bases', () => {
  for (const base of [1, 99, 100.1, 250, 2999, 12999, 27999, 53981]) {
    const { preVat, vat, gross } = computeVatFromBase(base);
    assert.equal(gross, Math.round((preVat + vat) * 100) / 100, `gross != preVat+vat at ${base}`);
    // VAT is exactly 12% of the (rounded) base, to 2dp.
    assert.equal(vat, Math.round(preVat * 12) / 100, `vat != 12% at ${base}`);
  }
});

test('honours an explicit non-default rate', () => {
  const r = computeVatFromBase(1000, 0);
  assert.deepEqual(r, { preVat: 1000, vat: 0, gross: 1000, rate: 0 });
});

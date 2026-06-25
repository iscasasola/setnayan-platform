/**
 * Unit suite for orderGrossOwed — the voucher-aware "gross owed" used by the
 * payment-approval shortfall guard (admin/payments approvePayment). Owed = base
 * + 12% VAT; base = confirmed_total_php once confirmed, else requested minus the
 * voucher discount. If this drifts, a short payment could promote an order to
 * 'paid' (receipt + payout) — so pin it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderGrossOwed } from './orders';

test('no voucher, unconfirmed → gross of the requested base (₱10,000 → ₱11,200)', () => {
  assert.equal(orderGrossOwed({ requestedTotalPhp: 10000, confirmedTotalPhp: null }), 11200);
});

test('confirmed_total_php wins over requested (and over any voucher)', () => {
  assert.equal(
    orderGrossOwed({ requestedTotalPhp: 10000, confirmedTotalPhp: 7000, voucherDiscountPhp: 2000 }),
    7840, // computeVatFromBase(7000).gross — confirmed used, requested+voucher ignored
  );
});

test('unconfirmed + voucher → gross of (requested − discount)', () => {
  assert.equal(
    orderGrossOwed({ requestedTotalPhp: 10000, confirmedTotalPhp: null, voucherDiscountPhp: 2000 }),
    8960, // computeVatFromBase(8000).gross
  );
});

test('voucher larger than the quote floors the base at 0 (gross 0)', () => {
  assert.equal(
    orderGrossOwed({ requestedTotalPhp: 1000, confirmedTotalPhp: null, voucherDiscountPhp: 5000 }),
    0,
  );
});

test('missing voucher discount is treated as 0', () => {
  assert.equal(orderGrossOwed({ requestedTotalPhp: 3999, confirmedTotalPhp: null }), 4478.88);
});

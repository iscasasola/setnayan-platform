/**
 * Unit suite for orderGrossOwed — the voucher-aware "gross owed" used by the
 * payment-approval shortfall guard (admin/payments approvePayment). Owed = base
 * + 12% VAT; base = confirmed_total_php once confirmed, else requested minus the
 * voucher discount. If this drifts, a short payment could promote an order to
 * 'paid' (receipt + payout) — so pin it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderGrossOwed, isVatInclusiveServiceKey } from './orders';

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

// vatInclusive — vendor charm prices are ALL-IN: owed = the stored total, no ×1.12.
test('vatInclusive vendor ₱999 → owed is ₱999, not ₱1,118.88 (stops the stranding bug)', () => {
  assert.equal(orderGrossOwed({ requestedTotalPhp: 999, confirmedTotalPhp: null }), 1118.88); // customer default: builds VAT up
  assert.equal(
    orderGrossOwed({ requestedTotalPhp: 999, confirmedTotalPhp: null, vatInclusive: true }),
    999, // vendor all-in: stored total IS the gross
  );
});

test('vatInclusive honours confirmed_total_php as the all-in gross too', () => {
  assert.equal(
    orderGrossOwed({ requestedTotalPhp: 999, confirmedTotalPhp: 2499, vatInclusive: true }),
    2499,
  );
});

// isVatInclusiveServiceKey — vendor_ prefix = all-in charm price; customer SKUs are base+VAT.
test('isVatInclusiveServiceKey: vendor keys true, customer keys / null false', () => {
  assert.equal(isVatInclusiveServiceKey('vendor_additional_branch__abc123'), true);
  assert.equal(isVatInclusiveServiceKey('vendor_pro_28d'), true);
  assert.equal(isVatInclusiveServiceKey('SETNAYAN_AI'), false);
  assert.equal(isVatInclusiveServiceKey('ANIMATED_MONOGRAM'), false);
  assert.equal(isVatInclusiveServiceKey(null), false);
  assert.equal(isVatInclusiveServiceKey(undefined), false);
});

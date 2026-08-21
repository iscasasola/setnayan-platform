import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payableAmountPhp } from './payable-amount';

const NO_VOUCHER = { voucherDiscountCentavos: 0, vatRatePct: 0, vatInclusive: false };

test('a plain customer bill is its stored total (VAT is 0.00 in production)', () => {
  assert.equal(payableAmountPhp({ storedTotalPhp: 2499, ...NO_VOUCHER }), 2499);
});

test('🚨 a discount code is SUBTRACTED — the buyer is never QR-charged the full price', () => {
  // This is the one that was live: the drawer charged the discounted figure
  // while the order stored the original, so a payment page reading the column
  // would have taken ₱500 more than the couple agreed to.
  assert.equal(
    payableAmountPhp({ storedTotalPhp: 2500, voucherDiscountCentavos: 50000, vatRatePct: 0, vatInclusive: false }),
    2000,
  );
});

test('a shop price is all-in — nothing is added to it', () => {
  // Owner-locked 2026-07-05: the ₱999 a shop sees is the ₱999 it pays.
  assert.equal(
    payableAmountPhp({ storedTotalPhp: 999, voucherDiscountCentavos: 0, vatRatePct: 12, vatInclusive: true }),
    999,
  );
});

test('a customer price is grossed when a rate is set', () => {
  assert.equal(
    payableAmountPhp({ storedTotalPhp: 1000, voucherDiscountCentavos: 0, vatRatePct: 12, vatInclusive: false }),
    1120,
  );
});

test('a discount bigger than the bill leaves ₱0, never a negative', () => {
  assert.equal(
    payableAmountPhp({ storedTotalPhp: 100, voucherDiscountCentavos: 999999, vatRatePct: 0, vatInclusive: false }),
    0,
  );
});

test('rubbish in a column reads as zero, not NaN in a QR', () => {
  assert.equal(
    payableAmountPhp({ storedTotalPhp: NaN, voucherDiscountCentavos: NaN, vatRatePct: 0, vatInclusive: false }),
    0,
  );
});

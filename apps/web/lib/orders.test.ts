/**
 * Unit suite for orderGrossOwed — the voucher-aware "gross owed" used by the
 * payment-approval shortfall guard (admin/payments approvePayment). Owed = base
 * + 12% VAT; base = confirmed_total_php once confirmed, else requested minus the
 * voucher discount. If this drifts, a short payment could promote an order to
 * 'paid' (receipt + payout) — so pin it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderGrossOwed,
  isVatInclusiveServiceKey,
  orderReconciledToPaid,
  shouldProvisionOnApproval,
  ORDER_SHORTFALL_TOLERANCE_PHP,
} from './orders';

test('no voucher, unconfirmed → gross of the requested base (₱10,000 → ₱11,200)', () => {
  assert.equal(orderGrossOwed({ requestedTotalPhp: 10000, confirmedTotalPhp: null, vatRatePct: 12 }), 11200);
});

test('confirmed_total_php wins over requested (and over any voucher)', () => {
  assert.equal(
    orderGrossOwed({
      requestedTotalPhp: 10000,
      confirmedTotalPhp: 7000,
      voucherDiscountPhp: 2000,
      vatRatePct: 12,
    }),
    7840, // computeVatFromBase(7000).gross — confirmed used, requested+voucher ignored
  );
});

test('unconfirmed + voucher → gross of (requested − discount)', () => {
  assert.equal(
    orderGrossOwed({
      requestedTotalPhp: 10000,
      confirmedTotalPhp: null,
      voucherDiscountPhp: 2000,
      vatRatePct: 12,
    }),
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
  assert.equal(orderGrossOwed({ requestedTotalPhp: 3999, confirmedTotalPhp: null, vatRatePct: 12 }), 4478.88);
});

// vatInclusive — vendor charm prices are ALL-IN: owed = the stored total, no ×1.12.
test('vatInclusive vendor ₱999 → owed is ₱999, not ₱1,118.88 (stops the stranding bug)', () => {
  assert.equal(orderGrossOwed({ requestedTotalPhp: 999, confirmedTotalPhp: null, vatRatePct: 12 }), 1118.88); // customer default: builds VAT up
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

/* -------------------------------------------------------------------------- */
/*  The rate is never implicit (2026-07-21)                                    */
/* -------------------------------------------------------------------------- */

test('omitting the rate charges NO VAT — an unset rate must never invent a tax', () => {
  // This is the regression that shipped: `computeVatFromBase` defaulted to 12 while
  // platform_settings.default_vat_rate_pct said 0, so every customer SKU billed 12% over its
  // advertised price. A ₱2,500 SKU instructed the couple to pay ₱2,800.
  assert.equal(orderGrossOwed({ requestedTotalPhp: 2500, confirmedTotalPhp: null }), 2500);
});

test('an explicit rate still grosses correctly, for the day the ₱3M threshold is crossed', () => {
  assert.equal(
    orderGrossOwed({ requestedTotalPhp: 2500, confirmedTotalPhp: null, vatRatePct: 12 }),
    2800,
  );
});

test('vendor all-in prices ignore the rate entirely, set or not', () => {
  for (const rate of [0, 12]) {
    assert.equal(
      orderGrossOwed({
        requestedTotalPhp: 999,
        confirmedTotalPhp: null,
        vatInclusive: true,
        vatRatePct: rate,
      }),
      999,
    );
  }
});

// ---------------------------------------------------------------------------
// orderReconciledToPaid + shouldProvisionOnApproval — the (c) provisioning gate
// (money fix: SKU activation must fire only when the order actually reaches
// 'paid', i.e. promoted AND fully reconciled). A ₱1 payment on a ₱X order, or
// an approval with promote unchecked, must NOT provision the full SKU.
// ---------------------------------------------------------------------------

test('tolerance constant is ₱1 (centavo rounding across partial payments)', () => {
  assert.equal(ORDER_SHORTFALL_TOLERANCE_PHP, 1);
});

test('orderReconciledToPaid: exact cover reconciles', () => {
  assert.equal(orderReconciledToPaid({ matchedTotalPhp: 11200, owedPhp: 11200 }), true);
});

test('orderReconciledToPaid: ₱1 partial on a ₱11,200 order does NOT reconcile', () => {
  assert.equal(orderReconciledToPaid({ matchedTotalPhp: 1, owedPhp: 11200 }), false);
});

test('orderReconciledToPaid: within ₱1 tolerance still reconciles', () => {
  // 11199 vs 11200 → shortfall of ₱1, absorbed by the tolerance.
  assert.equal(orderReconciledToPaid({ matchedTotalPhp: 11199, owedPhp: 11200 }), true);
});

test('orderReconciledToPaid: ₱1.01 short breaches the tolerance', () => {
  assert.equal(orderReconciledToPaid({ matchedTotalPhp: 11198.99, owedPhp: 11200 }), false);
});

test('orderReconciledToPaid: overpayment reconciles', () => {
  assert.equal(orderReconciledToPaid({ matchedTotalPhp: 20000, owedPhp: 11200 }), true);
});

test('shouldProvisionOnApproval: provisions ONLY when promoted AND reconciled', () => {
  assert.equal(shouldProvisionOnApproval({ promoteOrder: true, reconciledToPaid: true }), true);
});

test('shouldProvisionOnApproval: promote unchecked → no provision (even if reconciled)', () => {
  assert.equal(shouldProvisionOnApproval({ promoteOrder: false, reconciledToPaid: true }), false);
});

test('shouldProvisionOnApproval: promoted but short → no provision', () => {
  assert.equal(shouldProvisionOnApproval({ promoteOrder: true, reconciledToPaid: false }), false);
});

test('shouldProvisionOnApproval: neither → no provision', () => {
  assert.equal(shouldProvisionOnApproval({ promoteOrder: false, reconciledToPaid: false }), false);
});

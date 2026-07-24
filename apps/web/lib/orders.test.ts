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
  isDecisivePaymentMatch,
  referenceContainsCode,
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

// ---------------------------------------------------------------------------
// referenceContainsCode + isDecisivePaymentMatch — the DECISIVE-MATCH predicate
// that gates one-click + batch approval. It MUST be a strict subset of the
// approvePayment shortfall guard: a decisive match here always clears the guard
// there, and a short / mismatched payment must NEVER read as decisive (that's
// the "shortfall rows are excluded from batch" guarantee — the batch action
// re-runs this predicate server-side before any write).
// ---------------------------------------------------------------------------

test('referenceContainsCode: case-insensitive substring, nulls false', () => {
  assert.equal(referenceContainsCode('gcash ref SN1A2B3C4D thanks', 'sn1a2b3c4d'), true);
  assert.equal(referenceContainsCode('SN1A2B3C4D', 'SN1A2B3C4D'), true);
  assert.equal(referenceContainsCode('totally different note', 'SN1A2B3C4D'), false);
  assert.equal(referenceContainsCode(null, 'SN1A2B3C4D'), false);
  assert.equal(referenceContainsCode('SN1A2B3C4D', null), false);
  assert.equal(referenceContainsCode('', ''), false);
});

const CODE = 'SN1A2B3C4D';

test('isDecisivePaymentMatch: reference matches AND amount fully covers → clean (one-click/batch OK)', () => {
  // Customer SKU: the guard computes owed with NO implicit VAT (rate 0), so
  // owed = the ₱2,500 base. A ₱2,500 transfer that carries the code is decisive.
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: `GCash ref ${CODE}`,
      referenceCode: CODE,
      amountPhp: 2500,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    true,
  );
});

test('isDecisivePaymentMatch: SHORTFALL (partial transfer) is NOT decisive → excluded from batch', () => {
  // Reference matches, but ₱1 on a ₱2,500 order does not reconcile. This is the
  // core money-safety case: a short payment can never be batch/one-click approved.
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: CODE,
      referenceCode: CODE,
      amountPhp: 1,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    false,
  );
  // Just over ₱1 short (beyond tolerance) is also excluded.
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: CODE,
      referenceCode: CODE,
      amountPhp: 2498.99,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    false,
  );
});

test('isDecisivePaymentMatch: reference MISMATCH is not decisive even when the amount covers', () => {
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: 'no code in this note',
      referenceCode: CODE,
      amountPhp: 2500,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    false,
  );
});

test('isDecisivePaymentMatch: missing reference number is not decisive', () => {
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: null,
      referenceCode: CODE,
      amountPhp: 2500,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    false,
  );
});

test('isDecisivePaymentMatch: null requested total (ad-hoc order) is never decisive — needs a human', () => {
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: CODE,
      referenceCode: CODE,
      amountPhp: 9999,
      requestedTotalPhp: null,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    false,
  );
});

test('isDecisivePaymentMatch: within ₱1 tolerance still reconciles → decisive', () => {
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: CODE,
      referenceCode: CODE,
      amountPhp: 2499, // ₱1 short, absorbed by the tolerance
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      serviceKey: 'SETNAYAN_AI',
    }),
    true,
  );
});

test('isDecisivePaymentMatch: vendor all-in (VAT-inclusive) ₱999 paid in full → decisive', () => {
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: `paid ${CODE}`,
      referenceCode: CODE,
      amountPhp: 999,
      requestedTotalPhp: 999,
      confirmedTotalPhp: null,
      serviceKey: 'vendor_additional_branch__abc',
    }),
    true,
  );
  // Same order, ₱1 short → not decisive.
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: `paid ${CODE}`,
      referenceCode: CODE,
      amountPhp: 900,
      requestedTotalPhp: 999,
      confirmedTotalPhp: null,
      serviceKey: 'vendor_additional_branch__abc',
    }),
    false,
  );
});

test('isDecisivePaymentMatch: voucher-discounted unconfirmed order — owed nets the discount', () => {
  // requested ₱2,500, ₱500 voucher, unconfirmed → owed ₱2,000. A ₱2,000 transfer
  // with the code is decisive; the pre-voucher ₱2,500 basis is NOT used.
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: CODE,
      referenceCode: CODE,
      amountPhp: 2000,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      voucherDiscountPhp: 500,
      serviceKey: 'SETNAYAN_AI',
    }),
    true,
  );
  // ₱1,900 on the same ₱2,000-owed order is short → not decisive.
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: CODE,
      referenceCode: CODE,
      amountPhp: 1900,
      requestedTotalPhp: 2500,
      confirmedTotalPhp: null,
      voucherDiscountPhp: 500,
      serviceKey: 'SETNAYAN_AI',
    }),
    false,
  );
});

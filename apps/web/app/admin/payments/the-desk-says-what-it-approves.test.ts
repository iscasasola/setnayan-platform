/**
 * the-desk-says-what-it-approves.test.ts — the reconciliation card gives the
 * admin a basis to decide (owner, 2026-08-28).
 *
 * Four claims, each mutation-checked (see the PR body for the before → after
 * occurrence counts):
 *
 *   1. THE BILL IS ITEMISED FROM THE ONE AUTHORITY — the page calls
 *      readOnboardingOrderItems and never grows a second read of the line rows.
 *   2. THE AMOUNT TO SEND IS THE GUARD'S OWN FIGURE — summarizeDeskMoney's
 *      owedPhp sits exactly on isDecisivePaymentMatch's boundary, voucher and
 *      confirmed-total behaviour included, and its "exact/short" verdict flips
 *      on the same tolerance the guard uses.
 *   3. THE CELEBRATION IS SAID, IN ALL THREE STATES — including "no date set"
 *      for a NULL date, which must never render as a blank or a dash.
 *   4. THE DUPLICATE CHECKBOX ONLY RENDERS WHEN THERE IS A COLLISION — derived
 *      by the same rule the approval guard consults — and it names the other
 *      order. On a clean card it does not appear at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  deskBillLineLabel,
  deskDuplicateVerdict,
  summarizeDeskMoney,
} from '../../../lib/admin-payment-desk';
import { isDecisivePaymentMatch, ORDER_SHORTFALL_TOLERANCE_PHP } from '../../../lib/orders';
import { classifyDuplicate } from '../../../lib/payment-reference-match';

// test:unit runs from apps/web, so cwd IS the web root — the same convention
// payment-duplicate-wiring.test.ts uses.
const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Strip comments — the notes explaining a rule must not satisfy the test that
 *  enforces it. */
const noComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

const PAGE_RAW = read('app/admin/payments/page.tsx');
const PAGE = noComments(PAGE_RAW);
const DESK = noComments(read('lib/admin-payment-desk.ts'));

// ── 1 · the bill is itemised from the one authority ─────────────────────────

test('the page reads basket lines through readOnboardingOrderItems, never its own query', () => {
  assert.match(PAGE, /readOnboardingOrderItems\(/, 'the page must call the one authority');
  assert.doesNotMatch(
    PAGE,
    /from\('onboarding_order_items'\)/,
    'a second read of the line rows is the second copy that drifts',
  );
});

test('the line label matches the shape the customer’s own pay page renders', () => {
  assert.equal(deskBillLineLabel('Papic — add 6,000 shots', 'PAPIC_GUEST_6K', 1), 'Papic — add 6,000 shots');
  // Raw code only as a last resort; × N only when there is more than one.
  assert.equal(deskBillLineLabel(null, 'PAPIC_GUEST_6K', 3), 'PAPIC_GUEST_6K × 3');
  assert.equal(deskBillLineLabel('  ', 'X', 1), 'X');
});

test('the raw basket badge is replaced by words a person reads', () => {
  assert.match(
    PAGE,
    /'Bought while creating their event'/,
    'ONBOARDING_SERVICES is our word, not the owner’s',
  );
  assert.match(
    PAGE,
    /p\.order\.service_key === ONBOARDING_SERVICES_SKU/,
    'the human words must be keyed on the basket SKU, not hardcoded per card',
  );
});

// ── 2 · the amount to send is the guard's own figure ────────────────────────

const basket = {
  lines: [
    { chargedPhp: 2400, regularPhp: 2400 },
    { chargedPhp: 499, regularPhp: 899 },
  ],
  requestedTotalPhp: 2899,
  confirmedTotalPhp: null as number | null,
  voucherDiscountCentavos: 0,
  serviceKey: 'ONBOARDING_SERVICES',
};

test('the prod basket: two lines, a ₱400 sign-up saving, owed ₱2,899', () => {
  const m = summarizeDeskMoney({ ...basket, transferredPhp: 2899 });
  assert.equal(m.owedPhp, 2899);
  assert.equal(m.displayTotalPhp, 3299);
  assert.equal(m.signupSavingPhp, 400);
  assert.equal(m.verdict, 'exact');
});

test('owedPhp sits exactly on isDecisivePaymentMatch’s boundary — same tolerance', () => {
  const { owedPhp } = summarizeDeskMoney({ ...basket, transferredPhp: 0 });
  const decisiveAt = (amountPhp: number) =>
    isDecisivePaymentMatch({
      referenceNumber: `GCASH SN123 ${'REFCODE1'}`,
      referenceCode: 'REFCODE1',
      amountPhp,
      requestedTotalPhp: basket.requestedTotalPhp,
      confirmedTotalPhp: basket.confirmedTotalPhp,
      voucherDiscountPhp: basket.voucherDiscountCentavos / 100,
      serviceKey: basket.serviceKey,
    });
  // At owed − tolerance the guard still promotes — the card must say "exact",
  // not "short", or it contradicts the approval it sits above.
  const tol = ORDER_SHORTFALL_TOLERANCE_PHP;
  assert.equal(decisiveAt(owedPhp), true);
  assert.equal(decisiveAt(owedPhp - tol), true);
  assert.equal(summarizeDeskMoney({ ...basket, transferredPhp: owedPhp - tol }).verdict, 'exact');
  // One peso past the tolerance, both flip together.
  assert.equal(decisiveAt(owedPhp - tol - 1), false);
  const short = summarizeDeskMoney({ ...basket, transferredPhp: owedPhp - tol - 1 });
  assert.equal(short.verdict, 'short');
  assert.equal(short.deltaPhp, -(tol + 1));
});

test('a voucher nets off an UNCONFIRMED total, exactly as the guard nets it', () => {
  const m = summarizeDeskMoney({
    lines: [{ chargedPhp: 1000, regularPhp: 1000 }],
    requestedTotalPhp: 1000,
    confirmedTotalPhp: null,
    voucherDiscountCentavos: 20000,
    serviceKey: 'SETNAYAN_AI',
    transferredPhp: 800,
  });
  assert.equal(m.owedPhp, 800);
  assert.equal(m.voucherPhp, 200);
  assert.equal(m.voucherInsideConfirmedTotal, false);
  assert.equal(m.verdict, 'exact');
  assert.equal(
    isDecisivePaymentMatch({
      referenceNumber: 'REFCODE2',
      referenceCode: 'REFCODE2',
      amountPhp: 800,
      requestedTotalPhp: 1000,
      confirmedTotalPhp: null,
      voucherDiscountPhp: 200,
      serviceKey: 'SETNAYAN_AI',
    }),
    true,
  );
});

test('a CONFIRMED total is the owed figure — the voucher is not netted twice', () => {
  const m = summarizeDeskMoney({
    lines: [{ chargedPhp: 2899, regularPhp: null }],
    requestedTotalPhp: 2899,
    confirmedTotalPhp: 2500,
    voucherDiscountCentavos: 30000,
    serviceKey: 'ONBOARDING_SERVICES',
    transferredPhp: 2500,
  });
  assert.equal(m.owedPhp, 2500, 'confirmed wins; the voucher already reconciled into it');
  assert.equal(m.voucherInsideConfirmedTotal, true);
  assert.equal(m.verdict, 'exact');
});

test('no saving is ever invented: unknown or drifted regular prices claim nothing', () => {
  const unknown = summarizeDeskMoney({
    lines: [{ chargedPhp: 499, regularPhp: null }],
    requestedTotalPhp: 499,
    confirmedTotalPhp: null,
    voucherDiscountCentavos: null,
    serviceKey: 'SETNAYAN_AI',
    transferredPhp: 499,
  });
  assert.equal(unknown.signupSavingPhp, 0);
  // Data drift where the charge EXCEEDS retail must suppress, never go negative.
  const drift = summarizeDeskMoney({
    lines: [{ chargedPhp: 900, regularPhp: 800 }],
    requestedTotalPhp: 900,
    confirmedTotalPhp: null,
    voucherDiscountCentavos: null,
    serviceKey: 'X',
    transferredPhp: 900,
  });
  assert.equal(drift.signupSavingPhp, 0);
});

test('the lib passes the guard’s exact arguments — vendor keys VAT-inclusive, no rate of its own', () => {
  assert.match(DESK, /vatInclusive:\s*isVatInclusiveServiceKey\(/);
  assert.doesNotMatch(
    DESK,
    /vatRatePct/,
    'the guard passes no vatRatePct; a card that passes one quotes a different figure',
  );
});

test('overpayment is said, with the figure', () => {
  const m = summarizeDeskMoney({ ...basket, transferredPhp: 3000 });
  assert.equal(m.verdict, 'over');
  assert.equal(m.deltaPhp, 101);
});

// ── 3 · which celebration, in all three states ──────────────────────────────

test('the card says which celebration — and a NULL date reads as intent', () => {
  assert.match(PAGE, /'no date set'/, 'a NULL event date must say so, never a blank or dash');
  assert.match(PAGE, /Not tied to a celebration/, 'a NULL event_id is intent, not breakage');
  assert.match(
    PAGE,
    /Could not read which celebration/,
    'a failed read must be distinguishable from "no celebration"',
  );
  assert.match(PAGE, /fetchOrderEventInfo\(/, 'the page must actually resolve the event');
});

// ── 4 · the duplicate checkbox appears only with a collision, and names it ──

const PRIOR_MATCHED = {
  paymentId: 'pay-1',
  orderId: 'order-A',
  referenceNumber: 'BDO 991234567',
  status: 'matched',
};

test('deskDuplicateVerdict is classifyDuplicate re-shaped — never a second rule', () => {
  // Same-order collision → the guard refuses; the card must say so, no checkbox.
  const same = deskDuplicateVerdict({
    referenceNumber: '991234567',
    orderId: 'order-A',
    priors: [PRIOR_MATCHED],
  });
  assert.deepEqual(same, { kind: 'same_order', priorPaymentId: 'pay-1' });
  // Cross-order collision → the guard warns; the card shows the informed tick.
  const other = deskDuplicateVerdict({
    referenceNumber: '991234567',
    orderId: 'order-B',
    priors: [PRIOR_MATCHED],
  });
  assert.deepEqual(other, {
    kind: 'other_order',
    priorPaymentId: 'pay-1',
    otherOrderId: 'order-A',
  });
  // A rejected prior is the honest re-send — no collision, no checkbox.
  assert.equal(
    deskDuplicateVerdict({
      referenceNumber: '991234567',
      orderId: 'order-B',
      priors: [{ ...PRIOR_MATCHED, status: 'rejected' }],
    }),
    null,
  );
  // Cross-check against the guard's own rule on the same fixtures, so the two
  // can never disagree about what counts as a collision.
  for (const [orderId, expected] of [
    ['order-A', 'refuse'],
    ['order-B', 'warn'],
  ] as const) {
    const guard = classifyDuplicate({
      reference: '991234567',
      orderId,
      priors: [PRIOR_MATCHED],
    });
    assert.equal(guard.kind, expected);
  }
});

test('the checkbox never renders unconditionally — every render sits behind the verdict', () => {
  const occurrences = [...PAGE.matchAll(/name="acknowledge_duplicate"/g)].map((m) => m.index ?? 0);
  assert.ok(occurrences.length >= 1, 'the acknowledgement control must still exist');
  for (const at of occurrences) {
    const before = PAGE.slice(Math.max(0, at - 1500), at);
    assert.ok(
      /dup\?\.kind === 'other_order'/.test(before) || /dupExposure\.failed/.test(before),
      'an acknowledgement checkbox renders outside the collision / failed-check gates — ' +
        'that is the evidence-free question the owner refused to answer',
    );
  }
});

test('when the box renders, it names the other order', () => {
  const gate = PAGE.indexOf("dup?.kind === 'other_order'");
  assert.ok(gate > 0, 'the collision gate could not be found');
  const block = PAGE.slice(gate, gate + 1200);
  assert.match(block, /otherOrderPublicId/, 'the tick must be informed — name the other order');
  assert.match(block, /otherAmountPhp/, 'and say how much is counted there');
});

test('the collision is derived the way the guard derives it', () => {
  assert.match(PAGE, /deskDuplicateVerdict\(/, 'the page must use the shared re-shaping');
  assert.match(PAGE, /MONEY_STATUSES/, 'the read must use the guard’s own status set');
  assert.match(DESK, /classifyDuplicate\(/, 'the lib must delegate to the guard’s rule');
  // A failed collision read is not "no collisions".
  assert.match(PAGE, /return \{ byPaymentId, failed: true \};/);
});

test('a collided row is never one-click material', () => {
  assert.match(
    PAGE,
    /dup === null &&\s*isDecisivePaymentMatch\(/,
    'a known collision must route through the full confirm form, where the informed tick lives',
  );
});

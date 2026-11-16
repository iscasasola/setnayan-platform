/**
 * 🔁 A PLAN CONFIRMED AT /admin/subscriptions IS NOT PAYABLE AGAIN — AND A PLAN NOBODY COULD CHECK IS NOT PAYABLE
 * EITHER (plan-purchase audit, 2026-11-16).
 *
 * A plan purchase has two rows: `vendor_subscriptions` (the plan) and `orders` (where proof is sent). Confirming or
 * rejecting at /admin/subscriptions moves only the plan row, so /pay/<reference> kept the order `awaiting_payment` and
 * drew a live QR for a plan already on (pay twice) or already refused. The plan row's final verdict now wins.
 *
 * 🔒 The independent audit's catch: a REFUSED plan read came back as "no row", the order's `awaiting_payment` stood and
 * the QR was drawn — the same pay-twice fault through the back door. A refused read is now `unchecked`: no QR, no
 * payment logged, "we couldn't check, try again".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { planAwarePayableStatus } from '@/lib/payable-status';

const ok = (status: string | null) => ({ read: 'ok' as const, status });
const REFUSED = { read: 'refused' as const };

test('a confirmed plan settles its open order', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', ok('paid')), 'settled');
  assert.equal(planAwarePayableStatus('submitted', ok('paid')), 'settled');
});

test('a refused or replaced plan closes its open order', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', ok('rejected')), 'closed');
  assert.equal(planAwarePayableStatus('awaiting_payment', ok('superseded')), 'closed');
});

test('a plan still waiting, or no plan row visible, leaves the order to speak for itself', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', ok('pending_payment')), 'awaiting_payment');
  assert.equal(planAwarePayableStatus('awaiting_payment', ok(null)), 'awaiting_payment');
  assert.equal(planAwarePayableStatus('awaiting_payment', ok('something_new')), 'awaiting_payment');
  // Not a plan order at all.
  assert.equal(planAwarePayableStatus('awaiting_payment', null), 'awaiting_payment');
});

test('🔒 a REFUSED plan read fails closed — never a live QR', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', REFUSED), 'unchecked');
  assert.equal(planAwarePayableStatus('submitted', REFUSED), 'unchecked');
  assert.equal(planAwarePayableStatus('draft', REFUSED), 'unchecked');
});

test("the order's own final answer is never overridden", () => {
  assert.equal(planAwarePayableStatus('paid', ok('pending_payment')), 'settled');
  assert.equal(planAwarePayableStatus('cancelled', ok('paid')), 'closed');
  assert.equal(planAwarePayableStatus('paid', REFUSED), 'settled');
  assert.equal(planAwarePayableStatus('cancelled', REFUSED), 'closed');
});

test('the resolver asks the plan row and reports a refused read as refused, never as "no row"', () => {
  const code = stripComments(readFileSync('lib/payable-by-reference.ts', 'utf8'));
  assert.match(code, /status: planAwarePayableStatus\(order\.status, planStatus\)/);
  assert.doesNotMatch(code, /status: statusOf\(order\.status\)/, 'the resolver reads the order alone again');
  assert.match(code, /\.from\('vendor_subscriptions'\)\s*\.select\('status'\)/);
  const fn = code.slice(code.indexOf('async function readPlanStatus'), code.indexOf('export async function fetchPayableByReference'));
  assert.match(fn, /if \(error\) \{[^}]*return \{ read: 'refused' \};/, 'a refused read no longer says refused');
  assert.match(fn, /catch \([^)]*\) \{[^}]*return \{ read: 'refused' \};/, 'a read that throws no longer says refused');
});

test('the payment page draws no QR for an unchecked bill, and returns before any code is minted', () => {
  const page = stripComments(readFileSync('app/pay/[reference]/page.tsx', 'utf8'));
  const gate = page.indexOf("if (payable.status === 'unchecked') {");
  const mint = page.indexOf('mintedQrImage(');
  assert.ok(gate >= 0, 'the page no longer handles an unchecked bill');
  assert.ok(mint > gate, 'a QR is minted before the unchecked bill is turned away');
  const block = page.slice(gate, page.indexOf('</main>', gate));
  assert.match(block, /couldn&rsquo;t check this payment/i, 'the honest sentence is gone');
  assert.match(block, /Try again/, 'there is no way to try again');
  assert.doesNotMatch(block, /PayPanel|qr/i, 'the unchecked tile carries a payment code');
});

test('the proof action logs nothing against an unchecked bill', () => {
  const act = stripComments(readFileSync('app/pay/[reference]/actions.ts', 'utf8'));
  const gate = act.search(/if \(payable\.status === 'unchecked'\) \{\s*back\(/);
  const insert = act.indexOf(".from('payments')");
  assert.ok(gate >= 0, 'submitPaymentProof no longer refuses an unchecked bill');
  assert.ok(insert < 0 || insert > gate, 'a payment can be written before the unchecked refusal');
});

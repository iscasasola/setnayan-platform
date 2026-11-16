/**
 * 🔁 A PLAN CONFIRMED AT /admin/subscriptions IS NOT PAYABLE AGAIN (plan-purchase audit, 2026-11-16).
 *
 * A plan purchase has two rows: `vendor_subscriptions` (the plan) and `orders` (where proof is sent). Confirming or
 * rejecting at /admin/subscriptions moves only the plan row, so /pay/<reference> kept the order `awaiting_payment` and
 * drew a live QR for a plan already on (pay twice) or already refused. The plan row's final verdict now wins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { planAwarePayableStatus } from '@/lib/payable-status';

test('a confirmed plan settles its open order', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', 'paid'), 'settled');
  assert.equal(planAwarePayableStatus('submitted', 'paid'), 'settled');
});

test('a refused or replaced plan closes its open order', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', 'rejected'), 'closed');
  assert.equal(planAwarePayableStatus('awaiting_payment', 'superseded'), 'closed');
});

test('a plan still waiting, or unread, leaves the order to speak for itself', () => {
  assert.equal(planAwarePayableStatus('awaiting_payment', 'pending_payment'), 'awaiting_payment');
  assert.equal(planAwarePayableStatus('awaiting_payment', null), 'awaiting_payment');
  assert.equal(planAwarePayableStatus('awaiting_payment', 'something_new'), 'awaiting_payment');
});

test("the order's own final answer is never overridden", () => {
  assert.equal(planAwarePayableStatus('paid', 'pending_payment'), 'settled');
  assert.equal(planAwarePayableStatus('cancelled', 'paid'), 'closed');
});

test('the payment page resolver asks the plan row for a plan order', () => {
  const code = stripComments(readFileSync('lib/payable-by-reference.ts', 'utf8'));
  assert.match(code, /status: planAwarePayableStatus\(order\.status, planStatus\)/);
  assert.doesNotMatch(code, /status: statusOf\(order\.status\)/, 'the resolver reads the order alone again');
  assert.match(code, /\.from\('vendor_subscriptions'\)\s*\.select\('status'\)/);
});

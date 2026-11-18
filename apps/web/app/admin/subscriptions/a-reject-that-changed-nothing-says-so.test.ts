/**
 * 🔒 A REJECT THAT CHANGED NOTHING SAYS SO (plan-purchase audit, 2026-11-16).
 *
 * `reject_vendor_subscription` is `UPDATE … WHERE status = 'pending_payment'` returning VOID. On a plan that is
 * already `paid` it updates zero rows and raises nothing — and the action used to answer "Order marked rejected" and
 * email the shop that its upgrade "couldn't be confirmed", about a plan that is on. The action must read the row back
 * and announce (banner AND notice) only a row that now says `rejected`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';

const code = stripComments(readFileSync('app/admin/subscriptions/actions.ts', 'utf8'));
const start = code.indexOf('export async function rejectSubscription');
const body = code.slice(start);

test('rejectSubscription reads the row back after the RPC', () => {
  assert.ok(start >= 0, 'rejectSubscription is gone');
  const rpc = body.indexOf("rpc('reject_vendor_subscription'");
  const readBack = body.search(/\.from\('vendor_subscriptions'\)\s*\.select\('status'\)/);
  assert.ok(rpc >= 0, 'the reject RPC is no longer called');
  assert.ok(readBack > rpc, 'the status is not read back after the reject RPC');
});

test('only a row that now says rejected is announced', () => {
  const guard = body.search(/if \(nowStatus !== 'rejected'\) \{\s*redirect\(/);
  const notify = body.indexOf('notifyVendorSubscriptionRejected(');
  const done = body.indexOf("done=rejected");
  assert.ok(guard >= 0, 'a zero-row reject is no longer caught');
  assert.ok(notify > guard, 'the shop is told "rejected" before the row is checked');
  assert.ok(done > guard, 'the admin is told "rejected" before the row is checked');
});

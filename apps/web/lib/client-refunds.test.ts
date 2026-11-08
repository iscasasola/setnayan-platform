/**
 * 💸 lib/client-refunds.ts — the one refund shape (Supplier Build 2 lane E).
 *   1 · a database row is shaped once — NUMERIC strings become numbers, the day stays its own string;
 *   2 · the total is to the centavo;
 *   3 · every refusal the database answers has words; an unknown one never reads as success.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { REFUND_REFUSAL_WORDS, clientRefundOf, refundDayWords, refundRefusalWords, refundedTotalPhp } from './client-refunds';

test('1 · a row is shaped once', () => {
  const r = clientRefundOf({ refund_id: 'r', event_id: 'e', event_vendor_id: 'v', amount_php: '3000.50', refunded_on: '2026-11-01', reason: 'Drone dropped', proof_r2_key: null, created_at: '2026-11-01T02:00:00Z' });
  assert.equal(r.amountPhp, 3000.5);
  assert.equal(r.refundedOn, '2026-11-01');
  assert.equal(refundDayWords('2026-11-01'), 'Nov 1');
});

test('2 · the total is to the centavo', () => {
  assert.equal(refundedTotalPhp([{ amountPhp: 0.1 }, { amountPhp: 0.2 }]), 0.3);
  assert.equal(refundedTotalPhp([]), 0);
});

test('3 · every database refusal has words; an unknown one is a failure, never success', () => {
  for (const k of ['unauthenticated', 'not_your_client', 'amount', 'reason', 'date', 'more_than_received']) {
    assert.ok(REFUND_REFUSAL_WORDS[k], `no words for ${k}`);
  }
  assert.match(refundRefusalWords('something_new'), /Nothing was recorded/);
});

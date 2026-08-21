/**
 * A finished order must never show a live payment code.
 *
 * The first cut of `statusOf` listed 'expired' and 'failed' — NEITHER IS A REAL
 * public.order_status LABEL — and omitted 'fulfilled' and 'lapsed', which
 * therefore fell through to "still wants money". A shop or couple opening the
 * link for an order that was already paid and delivered would have been shown a
 * QR pre-filled with the amount, and paying it a second time is money we then
 * have to give back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusOf } from './payable-status';

/** Every label of public.order_status, read out of production 2026-08-21. */
const ORDER_STATUS = [
  'draft',
  'submitted',
  'awaiting_payment',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
  'lapsed',
] as const;

test('money already taken never shows a payment code again', () => {
  assert.equal(statusOf('paid'), 'settled');
  assert.equal(statusOf('fulfilled'), 'settled');
  assert.equal(statusOf('refunded'), 'settled');
});

test('a dead order says so instead of asking for money', () => {
  assert.equal(statusOf('cancelled'), 'closed');
  assert.equal(statusOf('lapsed'), 'closed');
});

test('only an unpaid order shows the QR', () => {
  assert.equal(statusOf('awaiting_payment'), 'awaiting_payment');
  assert.equal(statusOf('submitted'), 'awaiting_payment');
  assert.equal(statusOf('draft'), 'awaiting_payment');
});

test('every real label is handled — none falls through to a guess', () => {
  for (const label of ORDER_STATUS) {
    const got = statusOf(label);
    assert.ok(
      got === 'settled' || got === 'closed' || got === 'awaiting_payment',
      `${label} produced ${got}`,
    );
  }
  // The three that must be payable are exactly the three above; if the enum
  // grows, an unknown label must FAIL CLOSED rather than open a payment page.
  assert.equal(statusOf('some_future_label'), 'closed');
  assert.equal(statusOf(''), 'closed');
});

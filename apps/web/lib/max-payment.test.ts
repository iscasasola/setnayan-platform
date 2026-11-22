/**
 * 💳 THE MOST IN ONE PAYMENT — owner 2026-11-17: "We do not allow transactions above 100,000."
 *
 *   1 · "above" is refused, equal is allowed;
 *   2 · a setting that cannot be read (null, junk, 0, negative) falls back to the RULED value — never a higher ceiling;
 *   3 · the ceiling is the admin setting handed in: a lower setting refuses sooner.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PAYMENT_PHP_DEFAULT,
  maxPaymentCentavos,
  maxPaymentPhpOrDefault,
  withinMaxPayment,
} from '@/lib/max-payment';

test('1 · above the most is refused; exactly the most is allowed', () => {
  assert.equal(MAX_PAYMENT_PHP_DEFAULT, 100_000);
  assert.equal(withinMaxPayment(10_000_000, 100_000), true);
  assert.equal(withinMaxPayment(10_000_001, 100_000), false);
  assert.equal(withinMaxPayment(0, 100_000), true);
  assert.equal(withinMaxPayment(Number.NaN, 100_000), false);
  assert.equal(withinMaxPayment(Number.POSITIVE_INFINITY, 100_000), false);
});

test('2 · an unreadable setting falls back to the ruled 100,000 — never higher', () => {
  for (const bad of [null, undefined, '', 'abc', 0, -5, Number.NaN, {}]) {
    assert.equal(maxPaymentPhpOrDefault(bad), MAX_PAYMENT_PHP_DEFAULT, `fell to ${String(bad)}`);
  }
  // NUMERIC arrives from PostgREST as a string or a number.
  assert.equal(maxPaymentPhpOrDefault('100000.00'), 100_000);
  assert.equal(maxPaymentPhpOrDefault(50_000), 50_000);
  assert.equal(maxPaymentCentavos(100_000), 10_000_000);
});

test('3 · a lower admin setting refuses sooner', () => {
  assert.equal(withinMaxPayment(5_000_00, 5_000), true);
  assert.equal(withinMaxPayment(5_000_01, 5_000), false);
});

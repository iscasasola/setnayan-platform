/**
 * vendor-seats pure helpers. extraSeatsFromPaidCount is the recompute both the
 * extra-seat ACTIVATION hook and the REVERSAL path in lib/sku-activation.ts feed
 * a `SELECT count(paid orders)` through — the lifecycle fix that lets a refunded
 * seat order LOWER vendor_profiles.extra_agent_seats (recompute, never a
 * decrement, so it is self-healing).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extraSeatsFromPaidCount, effectiveSeatCap } from './vendor-seats';

test('extraSeatsFromPaidCount: a positive count passes through (floored to int)', () => {
  assert.equal(extraSeatsFromPaidCount(3), 3);
  assert.equal(extraSeatsFromPaidCount(1), 1);
  assert.equal(extraSeatsFromPaidCount(2.9), 2); // floor
});

test('extraSeatsFromPaidCount: zero paid orders → 0 (a refund of the last seat)', () => {
  assert.equal(extraSeatsFromPaidCount(0), 0);
});

test('extraSeatsFromPaidCount: null/undefined/negative/NaN → 0 (never inflates)', () => {
  assert.equal(extraSeatsFromPaidCount(null), 0);
  assert.equal(extraSeatsFromPaidCount(undefined), 0);
  assert.equal(extraSeatsFromPaidCount(-4), 0);
  assert.equal(extraSeatsFromPaidCount(Number.NaN), 0);
});

test('effectiveSeatCap: base + extra, Infinity stays Infinity', () => {
  assert.equal(effectiveSeatCap(5, 3), 8);
  assert.equal(effectiveSeatCap(5, 0), 5);
  assert.equal(effectiveSeatCap(Number.POSITIVE_INFINITY, 3), Number.POSITIVE_INFINITY);
});

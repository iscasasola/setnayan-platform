/**
 * Unit suite for the vendor booking-fee schedule (owner-directed 2026-07-24,
 * final): a flat 5% rate, ₱50 floor (binds ≤₱1,000), NO cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeePhp,
  bookingFeeEffectiveRate,
  BOOKING_FEE,
  BOOKING_FEE_RATE,
} from './booking-fee';

test('rate is a flat 5%', () => {
  assert.equal(BOOKING_FEE_RATE, 0.05);
  assert.equal(BOOKING_FEE.rate, 0.05);
});

test('floor: any positive proposal at/below ₱1,000 → ₱50', () => {
  assert.equal(bookingFeePhp(1), 50);
  assert.equal(bookingFeePhp(500), 50);
  assert.equal(bookingFeePhp(1_000), 50); // 5% × 1,000 = 50 → floor meets the line
});

test('just above the floor is continuous: ₱1,001 → ₱50.05', () => {
  // 5% × 1,001 = 50.05
  assert.equal(bookingFeePhp(1_001), 50.05);
});

test('linear span — a straight 5%, unbounded (no cap)', () => {
  assert.equal(bookingFeePhp(10_000), 500);
  assert.equal(bookingFeePhp(50_000), 2_500);
  assert.equal(bookingFeePhp(100_000), 5_000);
  assert.equal(bookingFeePhp(200_000), 10_000);
  assert.equal(bookingFeePhp(1_000_000), 50_000);
  assert.equal(bookingFeePhp(3_000_000), 150_000);
});

test('₱0 / barter / junk → 0 (no consideration, no fee — open sign-off #4)', () => {
  assert.equal(bookingFeePhp(0), 0);
  assert.equal(bookingFeePhp(-5_000), 0);
  assert.equal(bookingFeePhp(Number.NaN), 0);
  assert.equal(bookingFeePhp(Number.POSITIVE_INFINITY), 0);
});

test('effective rate: flat 5% at and above the floor', () => {
  assert.equal(bookingFeeEffectiveRate(10_000), 0.05);
  assert.equal(bookingFeeEffectiveRate(200_000), 0.05);
  assert.equal(bookingFeeEffectiveRate(1_000_000), 0.05); // no cap → stays flat
  assert.ok(bookingFeeEffectiveRate(500) > 0.05); // floor → higher effective rate
  assert.equal(bookingFeeEffectiveRate(0), 0);
});

test('monotonic non-decreasing across the whole range', () => {
  let prev = -1;
  for (let amt = 0; amt <= 250_000; amt += 250) {
    const fee = bookingFeePhp(amt);
    assert.ok(fee >= prev, `fee dropped at ₱${amt}: ${fee} < ${prev}`);
    prev = fee;
  }
});

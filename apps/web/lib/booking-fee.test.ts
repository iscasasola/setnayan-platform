/**
 * Unit suite for the vendor booking-fee schedule (owner-directed 2026-07-23,
 * final): a flat 2% rate, ₱50 floor (binds ≤₱2,500), ₱4,000 cap (binds ≥₱200,000).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeePhp,
  bookingFeeEffectiveRate,
  BOOKING_FEE,
  BOOKING_FEE_RATE,
} from './booking-fee';

test('rate is a flat 2%', () => {
  assert.equal(BOOKING_FEE_RATE, 0.02);
  assert.equal(BOOKING_FEE.rate, 0.02);
});

test('floor: any positive proposal at/below ₱2,500 → ₱50', () => {
  assert.equal(bookingFeePhp(1), 50);
  assert.equal(bookingFeePhp(1_000), 50);
  assert.equal(bookingFeePhp(2_500), 50); // 2% × 2,500 = 50 → floor meets the line
});

test('just above the floor is continuous: ₱2,501 → ₱50.02', () => {
  // 2% × 2,501 = 50.02
  assert.equal(bookingFeePhp(2_501), 50.02);
});

test('linear span — a straight 2%', () => {
  assert.equal(bookingFeePhp(10_000), 200);
  assert.equal(bookingFeePhp(50_000), 1_000);
  assert.equal(bookingFeePhp(100_000), 2_000);
  assert.equal(bookingFeePhp(150_000), 3_000);
});

test('cap: locks at ₱4,000 from ₱200,000 upward', () => {
  assert.equal(bookingFeePhp(200_000), 4_000); // 2% × 200,000 = 4,000 → cap meets the line
  assert.equal(bookingFeePhp(200_001), 4_000);
  assert.equal(bookingFeePhp(300_000), 4_000);
  assert.equal(bookingFeePhp(1_000_000), BOOKING_FEE.capPhp);
  assert.equal(bookingFeePhp(3_000_000), 4_000);
});

test('₱0 / barter / junk → 0 (no consideration, no fee — open sign-off #4)', () => {
  assert.equal(bookingFeePhp(0), 0);
  assert.equal(bookingFeePhp(-5_000), 0);
  assert.equal(bookingFeePhp(Number.NaN), 0);
  assert.equal(bookingFeePhp(Number.POSITIVE_INFINITY), 0);
});

test('effective rate: flat 2% across the linear span, falls above the cap', () => {
  assert.equal(bookingFeeEffectiveRate(10_000), 0.02);
  assert.equal(bookingFeeEffectiveRate(150_000), 0.02);
  assert.equal(bookingFeeEffectiveRate(200_000), 0.02);
  assert.ok(bookingFeeEffectiveRate(1_000_000) < 0.02); // capped → lower effective rate
  assert.ok(bookingFeeEffectiveRate(1_000) > 0.02); // floor → higher effective rate
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

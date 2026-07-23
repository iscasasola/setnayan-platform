/**
 * Unit suite for the vendor booking-fee schedule (owner-directed 2026-07-23:
 * a single LINEAR rate, ₱50 floor, ₱4,000 cap locked at ₱300,000). The rate is
 * fixed by the cap anchor: ₱4,000 ÷ ₱300,000 = 1.3333%.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeePhp,
  bookingFeeEffectiveRate,
  BOOKING_FEE,
  BOOKING_FEE_RATE,
} from './booking-fee';

test('rate is fixed by the cap anchor: ₱4,000 / ₱300,000', () => {
  assert.equal(BOOKING_FEE_RATE, 4000 / 300000);
  assert.ok(Math.abs(BOOKING_FEE_RATE - 0.0133333) < 1e-6);
});

test('floor: any positive proposal below the floor-crossing → ₱50', () => {
  assert.equal(bookingFeePhp(1), 50);
  assert.equal(bookingFeePhp(1_000), 50);
  assert.equal(bookingFeePhp(3_750), 50); // 1.3333% × 3,750 = 50 → floor meets the line
});

test('just above the floor-crossing is continuous: ₱3,751 → ₱50.01', () => {
  // 1.3333% × 3,751 = 50.0133 → 50.01
  assert.equal(bookingFeePhp(3_751), 50.01);
});

test('linear span — a straight 1.3333%', () => {
  assert.equal(bookingFeePhp(10_000), 133.33);
  assert.equal(bookingFeePhp(50_000), 666.67);
  assert.equal(bookingFeePhp(75_000), 1_000);
  assert.equal(bookingFeePhp(150_000), 2_000);
  assert.equal(bookingFeePhp(225_000), 3_000);
});

test('cap: locks at ₱4,000 from ₱300,000 upward', () => {
  assert.equal(bookingFeePhp(300_000), 4_000);
  assert.equal(bookingFeePhp(300_001), 4_000);
  assert.equal(bookingFeePhp(1_000_000), BOOKING_FEE.capPhp);
  assert.equal(bookingFeePhp(3_000_000), 4_000);
});

test('₱0 / barter / junk → 0 (no consideration, no fee — open sign-off #4)', () => {
  assert.equal(bookingFeePhp(0), 0);
  assert.equal(bookingFeePhp(-5_000), 0);
  assert.equal(bookingFeePhp(Number.NaN), 0);
  assert.equal(bookingFeePhp(Number.POSITIVE_INFINITY), 0);
});

test('effective rate: flat 1.3333% across the linear span, falls above the cap', () => {
  assert.ok(Math.abs(bookingFeeEffectiveRate(10_000) - 0.0133333) < 1e-4);
  assert.ok(Math.abs(bookingFeeEffectiveRate(150_000) - 0.0133333) < 1e-6);
  assert.equal(bookingFeeEffectiveRate(300_000), 4000 / 300000);
  assert.ok(bookingFeeEffectiveRate(1_000_000) < bookingFeeEffectiveRate(300_000));
  assert.ok(bookingFeeEffectiveRate(1_000) > 0.0133333); // floor → higher effective rate
  assert.equal(bookingFeeEffectiveRate(0), 0);
});

test('monotonic non-decreasing across the whole range', () => {
  let prev = -1;
  for (let amt = 0; amt <= 400_000; amt += 250) {
    const fee = bookingFeePhp(amt);
    assert.ok(fee >= prev, `fee dropped at ₱${amt}: ${fee} < ${prev}`);
    prev = fee;
  }
});

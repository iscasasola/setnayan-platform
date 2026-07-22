/**
 * Unit suite for the vendor booking-fee schedule (owner-locked 2026-07-21).
 * The boundary cases are lifted verbatim from the build brief's test table
 * (Booking_Fee_Build_Plan_2026-07-21.md): 2,500→₱50 · 2,501→₱50.02 ·
 * 50,000→₱1,000 · 150,000→₱2,500 · 300,000→₱4,000 · >300,000→₱4,000, plus the
 * model doc's worked examples.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bookingFeePhp, bookingFeeEffectiveRate, BOOKING_FEE } from './booking-fee';

test('floor: any positive proposal up to ₱2,500 → ₱50 flat', () => {
  assert.equal(bookingFeePhp(1), 50);
  assert.equal(bookingFeePhp(1_000), 50);
  assert.equal(bookingFeePhp(2_500), 50);
});

test('just above the floor is continuous: ₱2,501 → ₱50.02', () => {
  // 50 + 2% × (2,501 − 2,500) = 50 + 0.02
  assert.equal(bookingFeePhp(2_501), 50.02);
});

test('build-brief boundary table', () => {
  assert.equal(bookingFeePhp(50_000), 1_000);
  assert.equal(bookingFeePhp(150_000), 2_500);
  assert.equal(bookingFeePhp(300_000), 4_000);
  assert.equal(bookingFeePhp(300_001), 4_000);
});

test('model-doc worked examples', () => {
  assert.equal(bookingFeePhp(10_000), 200); // 2.00%
  assert.equal(bookingFeePhp(80_000), 1_450); // 50 + 950 + 450 → 1.81%
  assert.equal(bookingFeePhp(1_000_000), 4_000); // capped → 0.40%
});

test('cap: never exceeds ₱4,000, no matter how large', () => {
  assert.equal(bookingFeePhp(3_000_000), BOOKING_FEE.capPhp);
  assert.equal(bookingFeePhp(999_999_999), 4_000);
});

test('₱0 / barter / junk → 0 (no consideration, no fee — open sign-off #4)', () => {
  assert.equal(bookingFeePhp(0), 0);
  assert.equal(bookingFeePhp(-5_000), 0);
  assert.equal(bookingFeePhp(Number.NaN), 0);
  assert.equal(bookingFeePhp(Number.POSITIVE_INFINITY), 0);
});

test('effective rate only ever falls (2.00% → 0.40%)', () => {
  assert.equal(bookingFeeEffectiveRate(10_000), 0.02);
  assert.ok(bookingFeeEffectiveRate(80_000) < 0.02);
  assert.ok(bookingFeeEffectiveRate(300_000) < bookingFeeEffectiveRate(80_000));
  assert.ok(Math.abs(bookingFeeEffectiveRate(1_000_000) - 0.004) < 1e-9);
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

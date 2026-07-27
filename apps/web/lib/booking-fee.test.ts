/**
 * Unit suite for the vendor booking-fee schedule (owner-directed 2026-07-24,
 * owner-locked 2026-07-25): 5% on the first ₱100,000, then 1% above;
 * ₱50 floor (binds ≤₱1,000); NO cap.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeePhp,
  bookingFeeEffectiveRate,
  BOOKING_FEE,
  BOOKING_FEE_RATE,
} from './booking-fee';

test('the head-band rate is 5%', () => {
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

test('the TAPER — the owner\u2019s own worked examples', () => {
  // Vendor_Monetization_Model_LOCKED_2026-07-25.md \u00a7 3, verbatim. These four
  // numbers are the spec; if any moves, the code no longer matches the model.
  assert.equal(bookingFeePhp(60_000), 3_000);      // all inside the 5% band
  assert.equal(bookingFeePhp(300_000), 7_000);     // 5,000 + 1% of 200,000
  assert.equal(bookingFeePhp(1_000_000), 14_000);  // 5,000 + 1% of 900,000
  assert.equal(bookingFeePhp(10_000_000), 104_000);// 5,000 + 1% of 9,900,000
});

test('the 5% band applies in full below \u20b1100,000', () => {
  assert.equal(bookingFeePhp(10_000), 500);
  assert.equal(bookingFeePhp(50_000), 2_500);
  assert.equal(bookingFeePhp(100_000), 5_000);
});

test('CONTINUITY at the band edge \u2014 no cliff at \u20b1100,000', () => {
  // A cliff would mean a booking just over the edge costs LESS (or lurches
  // more) than one just under it, which is exactly the shape that invites
  // gaming the declared amount.
  const at = bookingFeePhp(100_000);
  assert.equal(at, 5_000);
  // A ±₱1 probe moves by the LOCAL slope — ₱0.05 below the edge (5%), ₱0.01
  // above it (1%). Anything larger than that is a genuine step, i.e. a cliff.
  assert.ok(bookingFeePhp(100_001) - at <= 0.01 + 1e-9, 'step UP at the edge');
  assert.ok(at - bookingFeePhp(99_999) <= 0.05 + 1e-9, 'step DOWN at the edge');
  // And the ordering never inverts across the edge.
  assert.ok(bookingFeePhp(99_999) < at && at < bookingFeePhp(100_001));
});

test('the taper is a DISCOUNT, never a surcharge', () => {
  // Above the band the effective rate must FALL, and must never exceed 5%.
  for (const amt of [200_000, 500_000, 1_000_000, 10_000_000]) {
    assert.ok(
      bookingFeePhp(amt) < amt * 0.05,
      `\u20b1${amt} pays at or above the old flat 5% \u2014 the taper is not discounting`,
    );
  }
});

test('MONOTONIC \u2014 declaring more never pays less', () => {
  // The anti-gaming property. Swept across the band edge, where a naive
  // two-tier formula is most likely to invert.
  let prev = 0;
  for (let amt = 0; amt <= 400_000; amt += 137) {
    const fee = bookingFeePhp(amt);
    assert.ok(fee >= prev, `fee fell at \u20b1${amt}: ${fee} < ${prev}`);
    prev = fee;
  }
});

test('effective rate: 5% inside the band, then falls toward 1%', () => {
  assert.equal(bookingFeeEffectiveRate(100_000), 0.05);
  // ₱1M pays ₱14,000 → 1.4%, well under the flat rate it replaced.
  assert.ok(Math.abs(bookingFeeEffectiveRate(1_000_000) - 0.014) < 1e-9);
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

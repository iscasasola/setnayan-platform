/**
 * Unit suite for the vendor booking-fee schedule — owner 2026-11-20: 5% on the
 * first ₱100,000, then 3% above; ₱50 floor (binds ≤₱1,000); LOCKED at
 * ₱100,000. Unverified shops: the head rate on the whole booking, locked too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeePhp,
  bookingFeeEffectiveRate,
  bookingFeePhpFor,
  unverifiedBookingFeePhp,
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

test('the 20 Nov schedule — worked examples', () => {
  // Specs DECISION_LOG 2026-11-20 "BOOKING FEE: 5% OF THE FIRST ₱100,000, 3% AFTER, LOCKED AT ₱100,000".
  assert.equal(bookingFeePhp(50_000), 2_500);        // all inside the 5% band
  assert.equal(bookingFeePhp(100_000), 5_000);       // the band edge
  assert.equal(bookingFeePhp(250_000), 9_500);       // 5,000 + 3% of 150,000
  assert.equal(bookingFeePhp(1_000_000), 32_000);    // 5,000 + 3% of 900,000
  assert.equal(bookingFeePhp(3_266_666), 99_999.98); // just under the lock
  assert.equal(bookingFeePhp(3_266_667), 100_000);   // the lock is reached (~₱3.27M)
  assert.equal(bookingFeePhp(5_000_000), 100_000);   // locked: 2% of ₱5M
  assert.equal(bookingFeePhp(10_000_000), 100_000);  // locked: 1% of ₱10M
});

test('unverified shops: the head rate on the WHOLE booking, same floor, same lock', () => {
  assert.equal(unverifiedBookingFeePhp(500), 50);
  assert.equal(unverifiedBookingFeePhp(50_000), 2_500);
  assert.equal(unverifiedBookingFeePhp(250_000), 12_500);
  assert.equal(unverifiedBookingFeePhp(2_000_000), 100_000);
  assert.equal(unverifiedBookingFeePhp(10_000_000), 100_000);
  assert.equal(bookingFeePhpFor(250_000, BOOKING_FEE, { verified: false }), 12_500);
  assert.equal(bookingFeePhpFor(250_000, BOOKING_FEE, { verified: true }), 9_500);
});

test('a schedule with no lock given is locked at the ruled default, never unlocked', () => {
  const { capPhp: _drop, ...noCap } = BOOKING_FEE;
  void _drop;
  assert.equal(bookingFeePhp(10_000_000, noCap), 100_000);
  assert.equal(bookingFeePhp(10_000_000, { ...BOOKING_FEE, capPhp: 50_000 }), 50_000);
});

test('THE PAYMENT CEILING also bounds the fee — the lower of the lock and max_payment_php wins', () => {
  // Owner 2026-11-17: "We do not allow transactions above 100,000." A fee is one payment.
  assert.equal(bookingFeePhp(10_000_000, { ...BOOKING_FEE, maxPhp: 50_000 }), 50_000);
  assert.equal(unverifiedBookingFeePhp(10_000_000, { ...BOOKING_FEE, maxPhp: 50_000 }), 50_000);
  // A lock above the ceiling is held to the ceiling; a lock below it wins.
  assert.equal(bookingFeePhp(10_000_000, { ...BOOKING_FEE, capPhp: 200_000, maxPhp: 150_000 }), 150_000);
  assert.equal(bookingFeePhp(10_000_000, { ...BOOKING_FEE, capPhp: 80_000, maxPhp: 150_000 }), 80_000);
  // A schedule built WITHOUT the field still caps at the ruled default.
  const { maxPhp: _drop, ...noMax } = BOOKING_FEE;
  void _drop;
  assert.equal(bookingFeePhp(10_000_000, { ...noMax, capPhp: 200_000 }), 100_000);
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
  // A ±₱1 probe moves by the LOCAL slope — ₱0.05 below the edge (5%), ₱0.03
  // above it (3%). Anything larger than that is a genuine step, i.e. a cliff.
  assert.ok(bookingFeePhp(100_001) - at <= 0.03 + 1e-9, 'step UP at the edge');
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

test('effective rate: 5% inside the band, then falls — and keeps falling once locked', () => {
  assert.equal(bookingFeeEffectiveRate(100_000), 0.05);
  // ₱1M pays ₱32,000 → 3.2%; once locked, ₱5M = 2% and ₱10M = 1% (the owner's own figures).
  assert.ok(Math.abs(bookingFeeEffectiveRate(1_000_000) - 0.032) < 1e-9);
  assert.ok(Math.abs(bookingFeeEffectiveRate(5_000_000) - 0.02) < 1e-9);
  assert.ok(Math.abs(bookingFeeEffectiveRate(10_000_000) - 0.01) < 1e-9);
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

test('THE SHOWN FEE IS THE BILLED FEE — NUMERIC rounding, never a float (ship review 21 Nov)', () => {
  // ₱100,003.50 → 5,000 + 3% of 3.50 = 5,000.105 → SQL round() → ₱5,000.11. A float sum gave ₱5,000.10.
  assert.equal(bookingFeePhp(100_003.5), 5_000.11);
  // Property: against an exact reference in whole centavos × hundredths of a percent, over many amounts —
  // every half-centavo edge in the tail, a sweep through the band, and pseudo-random prices to ₱5M.
  const ref = (php: number, flat: boolean) => {
    const a = BigInt(Math.round(php * 100));
    const band = 10_000_000n; // ₱100,000
    const units = flat ? a * 500n : (a < band ? a : band) * 500n + (a > band ? a - band : 0n) * 300n;
    let fee = (units + 5_000n) / 10_000n; // half away from zero, once
    if (fee < 5_000n) fee = 5_000n; // ₱50 floor
    if (fee > 10_000_000n) fee = 10_000_000n; // ₱100,000 lock
    return Number(fee) / 100;
  };
  const amounts: number[] = [];
  for (let c = 1; c <= 400; c++) amounts.push(100_000 + c * 0.5); // every half-peso above the band edge
  for (let c = 1; c <= 400; c++) amounts.push(c * 2.5 + 0.1); // through the floor
  let seed = 7;
  for (let i = 0; i < 3_000; i++) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    amounts.push(Math.round((seed / 2_147_483_648) * 500_000_000) / 100);
  }
  for (const php of amounts) {
    assert.equal(bookingFeePhp(php), ref(php, false), `taper disagrees with NUMERIC at ₱${php}`);
    assert.equal(unverifiedBookingFeePhp(php), ref(php, true), `flat disagrees with NUMERIC at ₱${php}`);
  }
});

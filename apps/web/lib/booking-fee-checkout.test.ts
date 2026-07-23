/**
 * Unit suite for the vendor Booking-Fee checkout split — the owner's rule
 * (2026-07-23): absorb the %, pass the fixed ₱15 on card, GCash percentage-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bookingFeeInclusiveCentavos,
  BOOKING_FEE_CARD_FIXED_CENTAVOS,
} from './booking-fee-checkout';

test('card fixed pass-through is ₱15 (1500 centavos)', () => {
  assert.equal(BOOKING_FEE_CARD_FIXED_CENTAVOS, 1500);
});

test('GCash = the fee itself (no fixed fee added)', () => {
  assert.equal(bookingFeeInclusiveCentavos(76_000, 'gcash'), 76_000); // ₱760
  assert.equal(bookingFeeInclusiveCentavos(5_000, 'gcash'), 5_000); // ₱50 floor
  assert.equal(bookingFeeInclusiveCentavos(400_000, 'gcash'), 400_000); // ₱4,000 cap
});

test('card = fee + ₱15 (inclusive, not a surcharge line)', () => {
  assert.equal(bookingFeeInclusiveCentavos(76_000, 'card'), 77_500); // ₱775
  assert.equal(bookingFeeInclusiveCentavos(5_000, 'card'), 6_500); // ₱65 at the floor
  assert.equal(bookingFeeInclusiveCentavos(400_000, 'card'), 401_500); // ₱4,015 at the cap
});

test('a ₱0 / junk fee → 0 for both (no phantom card fee)', () => {
  assert.equal(bookingFeeInclusiveCentavos(0, 'card'), 0);
  assert.equal(bookingFeeInclusiveCentavos(0, 'gcash'), 0);
  assert.equal(bookingFeeInclusiveCentavos(-5, 'card'), 0);
  assert.equal(bookingFeeInclusiveCentavos(Number.NaN, 'card'), 0);
});

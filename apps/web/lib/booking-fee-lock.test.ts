/**
 * Unit suite for the LOCK-path booking-fee helpers (owner 2026-07-24) — the
 * service_key round-trip, the free-5 boundary, and the pure decideLockFee rule
 * that the SQL RPC mirrors. Money code: the 5th-vs-6th boundary, the flag-off
 * no-op, and the confirmed-total fee base each get a direct assertion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOKING_FEE_LOCK_SERVICE_PREFIX,
  FREE_BOOKING_LIMIT,
  bookingFeeLockServiceKey,
  chargeIdFromBookingFeeLockServiceKey,
  isFreeBooking,
  decideLockFee,
} from './booking-fee-lock';

// ── service_key round-trip ───────────────────────────────────────────────────

test('service_key embeds the charge id and round-trips', () => {
  const key = bookingFeeLockServiceKey('abc-123');
  assert.equal(key, `${BOOKING_FEE_LOCK_SERVICE_PREFIX}abc-123`);
  assert.equal(chargeIdFromBookingFeeLockServiceKey(key), 'abc-123');
});

test('non-booking-fee keys → null (no false match with other vendor_ keys)', () => {
  assert.equal(chargeIdFromBookingFeeLockServiceKey('vendor_additional_branch__x'), null);
  assert.equal(chargeIdFromBookingFeeLockServiceKey('vendor_ai_addon'), null);
  assert.equal(chargeIdFromBookingFeeLockServiceKey('SETNAYAN_AI'), null);
  assert.equal(chargeIdFromBookingFeeLockServiceKey(BOOKING_FEE_LOCK_SERVICE_PREFIX), null); // empty suffix
  assert.equal(chargeIdFromBookingFeeLockServiceKey(null), null);
  assert.equal(chargeIdFromBookingFeeLockServiceKey(undefined), null);
});

// ── free-5 boundary ──────────────────────────────────────────────────────────

test('free-5 boundary: bookings 1..5 free, 6+ charged', () => {
  assert.equal(FREE_BOOKING_LIMIT, 5);
  assert.equal(isFreeBooking(1), true);
  assert.equal(isFreeBooking(5), true); // the 5th is still free
  assert.equal(isFreeBooking(6), false); // the 6th pays
  assert.equal(isFreeBooking(7), false);
});

test('free-5: a 0 / negative ordinal is not "free" (defensive)', () => {
  assert.equal(isFreeBooking(0), false);
  assert.equal(isFreeBooking(-1), false);
  assert.equal(isFreeBooking(Number.NaN), false);
});

// ── decideLockFee — the pure rule the RPC mirrors ────────────────────────────

test('flag OFF → no charge, no order (byte-identical to today)', () => {
  const d = decideLockFee({ flagEnabled: false, verified: true, bookingOrdinal: 6, agreedTotalPhp: 100_000 });
  assert.deepEqual(d, { charge: false, free: false, feePhp: 0, createOrder: false });
});

test('not verified (off-platform) → no charge even with flag on', () => {
  const d = decideLockFee({ flagEnabled: true, verified: false, bookingOrdinal: 6, agreedTotalPhp: 100_000 });
  assert.deepEqual(d, { charge: false, free: false, feePhp: 0, createOrder: false });
});

test('5th lock → free: a waived charge, no money, no order', () => {
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 5, agreedTotalPhp: 100_000 });
  assert.deepEqual(d, { charge: true, free: true, feePhp: 0, createOrder: false });
});

test('6th lock → head-band 5% of a ₱100,000 confirmed total, order issued', () => {
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp: 100_000 });
  // 5% × ₱100,000 = ₱5,000
  assert.deepEqual(d, { charge: true, free: false, feePhp: 5_000, createOrder: true });
});

test('fee base is the confirmed total, tapered, with no ceiling', () => {
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp: 1_000_000 });
  // Taper (owner-locked 2026-07-25): 5% of the first ₱100,000 = ₱5,000, then
  // 1% of the remaining ₱900,000 = ₱9,000 → ₱14,000. Uncapped, but no longer
  // the punitive flat ₱50,000.
  assert.equal(d.feePhp, 14_000);
  assert.equal(d.createOrder, true);
});

test('6th lock with a ₱0 / barter total → charge cleared, NO order', () => {
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp: 0 });
  assert.equal(d.free, false);
  assert.equal(d.feePhp, 0);
  assert.equal(d.createOrder, false);
});

test('6th lock with a null total → no order (nothing to charge on)', () => {
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp: null });
  assert.equal(d.createOrder, false);
  assert.equal(d.feePhp, 0);
});

test('floor: a tiny 6th booking still floors at ₱50', () => {
  const d = decideLockFee({ flagEnabled: true, verified: true, bookingOrdinal: 6, agreedTotalPhp: 500 });
  assert.equal(d.feePhp, 50); // 5% × 500 = 25 → floored to ₱50
  assert.equal(d.createOrder, true);
});

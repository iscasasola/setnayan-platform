/**
 * Unit suite for the LOCK-path booking-fee helpers (owner 2026-07-24) — the
 * service_key round-trip, the free-booking boundary, and the pure decideLockFee
 * rule that the SQL RPC mirrors. Money code: no free first booking (20 Nov), the
 * flag-off no-op, and the confirmed-total fee base each get a direct assertion.
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
import { BOOKING_FEE } from './booking-fee';

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

// ── free-booking boundary ────────────────────────────────────────────────────

test('20 Nov: no booking takes a free first place any more', () => {
  assert.equal(FREE_BOOKING_LIMIT, 0);
  for (const n of [1, 2, 5, 6]) assert.equal(isFreeBooking(n), false, `booking ${n} took a free place`);
});

test('free booking: a 0 / negative ordinal is not "free" (defensive)', () => {
  assert.equal(isFreeBooking(0), false);
  assert.equal(isFreeBooking(-1), false);
  assert.equal(isFreeBooking(Number.NaN), false);
});

// ── decideLockFee — the pure rule the RPC mirrors ────────────────────────────

const SOURCED = {
  flagEnabled: true,
  onPlatform: true,
  attribution: 'sourced',
  forYou: true,
  shopVerified: true,
  frozenFree: false,
  launchOffer: false,
  promoWindow: false,
  schedule: BOOKING_FEE,
  nextPlatformNumber: 7,
  freeEveryNth: 100_000,
  ticketWaiting: false,
} as const;

test('flag OFF → no charge, no order', () => {
  const d = decideLockFee({ ...SOURCED, flagEnabled: false, agreedTotalPhp: 100_000 });
  assert.equal(d.charge, false);
  assert.equal(d.createOrder, false);
  assert.equal(d.reason, 'off');
});

test('off-platform (no marketplace shop) → no charge even with flag on', () => {
  const d = decideLockFee({ ...SOURCED, onPlatform: false, agreedTotalPhp: 100_000 });
  assert.equal(d.charge, false);
  assert.equal(d.reason, 'off');
});

test('the FIRST sourced booking is billed now (no free first booking)', () => {
  const d = decideLockFee({ ...SOURCED, agreedTotalPhp: 100_000 });
  assert.deepEqual(
    { free: d.free, feePhp: d.feePhp, createOrder: d.createOrder, reason: d.reason },
    { free: false, feePhp: 5_000, createOrder: true, reason: 'billed' },
  );
});

test('fee base is the confirmed total: 5% then 3%, locked at the cap', () => {
  assert.equal(decideLockFee({ ...SOURCED, agreedTotalPhp: 1_000_000 }).feePhp, 32_000);
  assert.equal(decideLockFee({ ...SOURCED, agreedTotalPhp: 10_000_000 }).feePhp, 100_000);
});

test('a ₱0 / barter total → charge cleared, NO order', () => {
  const d = decideLockFee({ ...SOURCED, agreedTotalPhp: 0 });
  assert.equal(d.feePhp, 0);
  assert.equal(d.createOrder, false);
  assert.equal(d.reason, 'zero');
});

test('a null total → no order (nothing to charge on)', () => {
  const d = decideLockFee({ ...SOURCED, agreedTotalPhp: null });
  assert.equal(d.createOrder, false);
  assert.equal(d.feePhp, 0);
});

test('floor: a tiny booking still floors at ₱50', () => {
  const d = decideLockFee({ ...SOURCED, agreedTotalPhp: 500 });
  assert.equal(d.feePhp, 50); // 5% × 500 = 25 → floored to ₱50
  assert.equal(d.createOrder, true);
});

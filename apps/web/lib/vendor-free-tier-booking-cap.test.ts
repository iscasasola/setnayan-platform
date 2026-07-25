import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_TIER_ACTIVE_BOOKING_CAP,
  freeTierBookingCapApplies,
  freeTierRemainingBookingSlots,
  isAtFreeTierBookingCap,
} from './vendor-free-tier-booking-cap';

// ── freeTierBookingCapApplies: only the free tiers are capped ────────────────

test('applies: Free and Verified are capped', () => {
  assert.equal(freeTierBookingCapApplies('free'), true);
  assert.equal(freeTierBookingCapApplies('verified'), true);
  assert.equal(freeTierBookingCapApplies(null), true);
  assert.equal(freeTierBookingCapApplies(undefined), true);
});

test('applies: Solo / Pro / Enterprise / Custom are unlimited (not capped)', () => {
  assert.equal(freeTierBookingCapApplies('solo'), false);
  assert.equal(freeTierBookingCapApplies('pro'), false);
  assert.equal(freeTierBookingCapApplies('enterprise'), false);
  assert.equal(freeTierBookingCapApplies('custom'), false);
});

// ── freeTierRemainingBookingSlots ────────────────────────────────────────────

test('remaining: a paid tier is unlimited (null)', () => {
  assert.equal(freeTierRemainingBookingSlots('solo', 99), null);
  assert.equal(freeTierRemainingBookingSlots('pro', 0), null);
});

test('remaining: free tier counts down from the cap', () => {
  assert.equal(freeTierRemainingBookingSlots('free', 0), 3);
  assert.equal(freeTierRemainingBookingSlots('free', 1), 2);
  assert.equal(freeTierRemainingBookingSlots('verified', 2), 1);
  assert.equal(freeTierRemainingBookingSlots('free', 3), 0);
});

test('remaining: never negative, and at/over cap clamps to 0', () => {
  assert.equal(freeTierRemainingBookingSlots('free', 4), 0);
  assert.equal(freeTierRemainingBookingSlots('free', 100), 0);
});

test('remaining: a non-finite / negative count is treated as 0 used', () => {
  assert.equal(freeTierRemainingBookingSlots('free', Number.NaN), 3);
  assert.equal(freeTierRemainingBookingSlots('free', -5), 3);
});

// ── isAtFreeTierBookingCap: the lock-blocking predicate ──────────────────────

test('atCap: free tier blocks only once 3 active bookings are held', () => {
  assert.equal(isAtFreeTierBookingCap('free', 2), false);
  assert.equal(isAtFreeTierBookingCap('free', 3), true);
  assert.equal(isAtFreeTierBookingCap('free', 4), true);
});

test('atCap: a paid tier is never blocked', () => {
  assert.equal(isAtFreeTierBookingCap('solo', 10), false);
  assert.equal(isAtFreeTierBookingCap('enterprise', 1000), false);
});

test('cap constant is 3 (the owner-locked value)', () => {
  assert.equal(FREE_TIER_ACTIVE_BOOKING_CAP, 3);
});

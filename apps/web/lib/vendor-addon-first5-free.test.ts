import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADDONS_FREE_DURING_FIRST5,
  COMMITTED_BOOKING_STATUSES,
  addonIsFreeUnderFirst5,
  first5BookingsRemaining,
  isAddonFreeDuringFirst5,
  nonStackingFreeExpiry,
  vendorInFirst5Window,
} from './vendor-addon-first5-free';
import { FREE_BOOKING_LIMIT } from './booking-fee-lock';
import { VENDOR_3D_PLAN_UNLOCK_BOOKED_STATUSES } from './vendor-3d-plan-unlock';

/**
 * "Free until your 6th booking" (owner-locked 2026-07-25) on the two
 * couple-visibility add-ons. These tests pin the three things that decide money:
 * the OFF default, the exact off-by-one at the boundary, and fail-closed reads.
 */

// ── the switch defaults OFF ─────────────────────────────────────────────────

test('nothing is free unless the policy is explicitly enabled', () => {
  assert.equal(
    addonIsFreeUnderFirst5({ sku: 'ads_3d_plan', committedBookingCount: 0 }),
    false,
  );
  assert.equal(
    addonIsFreeUnderFirst5({ sku: 'ads_3d_plan', committedBookingCount: 0, enabled: false }),
    false,
  );
});

// ── scope: only the two couple-visibility add-ons ───────────────────────────

test('scope: 3D Plan Ads + Papic Challenge only', () => {
  assert.deepEqual([...ADDONS_FREE_DURING_FIRST5].sort(), ['ads_3d_plan', 'papic_challenge']);
  assert.equal(isAddonFreeDuringFirst5('ads_3d_plan'), true);
  assert.equal(isAddonFreeDuringFirst5('papic_challenge'), true);
});

test('the paid-from-day-one add-ons are NEVER free under this perk', () => {
  // Deep Search especially: each run costs us real money (~PHP 10-30 of web
  // search + synthesis), so a giveaway here would be a per-use loss.
  for (const sku of [
    'ai_chatbot_basic',
    'ai_chatbot_advanced',
    'deep_search_about_you',
    'deep_search_market',
  ] as const) {
    assert.equal(isAddonFreeDuringFirst5(sku), false, sku);
    assert.equal(
      addonIsFreeUnderFirst5({ sku, committedBookingCount: 0, enabled: true }),
      false,
      sku,
    );
  }
});

// ── THE BOUNDARY — free through 5, paying from 6 ────────────────────────────

test('boundary: free at 0-5 committed bookings, charged from 6', () => {
  for (const n of [0, 1, 2, 3, 4, 5]) {
    assert.equal(vendorInFirst5Window(n), true, `count ${n} should be inside`);
  }
  for (const n of [6, 7, 50]) {
    assert.equal(vendorInFirst5Window(n), false, `count ${n} should be outside`);
  }
});

test('boundary is anchored to the fee engine, not a magic 5', () => {
  assert.equal(vendorInFirst5Window(FREE_BOOKING_LIMIT), true);
  assert.equal(vendorInFirst5Window(FREE_BOOKING_LIMIT + 1), false);
});

test('end to end at the boundary, policy on', () => {
  const on = { sku: 'ads_3d_plan' as const, enabled: true };
  assert.equal(addonIsFreeUnderFirst5({ ...on, committedBookingCount: 5 }), true);
  assert.equal(addonIsFreeUnderFirst5({ ...on, committedBookingCount: 6 }), false);
});

// ── fail CLOSED: a bad count must never mint a free entitlement ─────────────

test('a garbage booking count is treated as OUTSIDE the window', () => {
  for (const n of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(vendorInFirst5Window(n), false, String(n));
    assert.equal(
      addonIsFreeUnderFirst5({ sku: 'papic_challenge', committedBookingCount: n, enabled: true }),
      false,
      String(n),
    );
  }
});

// ── the "bookings remaining" counter behind the UI copy ─────────────────────

test('bookings remaining counts down and floors at 0', () => {
  assert.equal(first5BookingsRemaining(0), 5);
  assert.equal(first5BookingsRemaining(4), 1);
  assert.equal(first5BookingsRemaining(5), 0);
  assert.equal(first5BookingsRemaining(9), 0);
  assert.equal(first5BookingsRemaining(Number.NaN), 0);
});

// ── the repeatable grant must NOT stack ─────────────────────────────────────
// The one-time trial was abuse-proof via its atomic claim; a repeatable grant is
// not, so the window is clamped to one cycle ahead.

test('a repeatable free grant never stacks past one cycle', () => {
  const cycle = '2026-08-22T00:00:00.000Z'; // ~now + 28d
  assert.equal(nonStackingFreeExpiry(null, cycle), cycle);
  assert.equal(nonStackingFreeExpiry(undefined, cycle), cycle);
  // Clicking again mid-cycle re-lands on the SAME target, not target + 28d.
  assert.equal(nonStackingFreeExpiry('2026-08-10T00:00:00.000Z', cycle), cycle);
  assert.equal(nonStackingFreeExpiry(cycle, cycle), cycle);
});

test('a longer live window (e.g. a paid cycle) is never shortened', () => {
  const cycle = '2026-08-22T00:00:00.000Z';
  const paidThrough = '2026-12-01T00:00:00.000Z';
  assert.equal(nonStackingFreeExpiry(paidThrough, cycle), paidThrough);
});

test('a malformed value never shortens a live window', () => {
  const paidThrough = '2026-12-01T00:00:00.000Z';
  assert.equal(nonStackingFreeExpiry(paidThrough, 'not-a-date'), paidThrough);
  assert.equal(nonStackingFreeExpiry('garbage', '2026-08-22T00:00:00.000Z'), '2026-08-22T00:00:00.000Z');
});

// ── drift guard: our committed-status set must match the platform's ─────────

test('COMMITTED_BOOKING_STATUSES matches the shared booked-status set', () => {
  // If these ever diverge, "inside the first 5" here stops meaning "fee waived"
  // in booking_fee_open_lock_charge, and vendors get billed inconsistently.
  assert.deepEqual(
    [...COMMITTED_BOOKING_STATUSES].sort(),
    [...VENDOR_3D_PLAN_UNLOCK_BOOKED_STATUSES].sort(),
  );
});

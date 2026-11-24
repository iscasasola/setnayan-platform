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
  // (Deep Search left the add-ons 2026-11-22 — not sold at all; the paid plans include it monthly.)
  for (const sku of [
    'ai_chatbot_basic',
    'ai_chatbot_advanced',
  ] as const) {
    assert.equal(isAddonFreeDuringFirst5(sku), false, sku);
    assert.equal(
      addonIsFreeUnderFirst5({ sku, committedBookingCount: 0, enabled: true }),
      false,
      sku,
    );
  }
});

// ── THE WINDOW IS 0 — owner 21 Nov: "Make it 0" ──────────────────────────
// There is no free add-on window: the first booking is billed. 0 is NO window, not "free before the first booking".

test('21 Nov: no committed-booking count is inside the window — the window is 0', () => {
  for (const n of [0, 1, 2, 5, 6, 50]) {
    assert.equal(vendorInFirst5Window(n), false, `count ${n} must be outside`);
  }
});

test("21 Nov: the add-on's first booking is billed (policy on, before and at the first booking)", () => {
  const on = { sku: 'ads_3d_plan' as const, enabled: true };
  for (const committedBookingCount of [0, 1]) {
    assert.equal(addonIsFreeUnderFirst5({ ...on, committedBookingCount }), false, `count ${committedBookingCount}`);
    assert.equal(
      addonIsFreeUnderFirst5({ sku: 'papic_challenge', committedBookingCount, enabled: true }),
      false,
      `papic_challenge count ${committedBookingCount}`,
    );
  }
});

test('the add-on window stays its own number — the fee also has no free booking (both 0, decided separately)', () => {
  assert.equal(FREE_BOOKING_LIMIT, 0);
  assert.equal(vendorInFirst5Window(0), false);
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

test('bookings remaining is 0 for every count — there is no window to count down (21 Nov)', () => {
  assert.equal(first5BookingsRemaining(0), 0);
  assert.equal(first5BookingsRemaining(1), 0);
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


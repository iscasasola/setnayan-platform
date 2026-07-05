/**
 * Vendor badge engine invariants (Node built-in test runner, run via tsx).
 * Guards the pure, deterministic core of lib/vendor-badges.ts —
 * `computeVendorBadges`, which never touches Supabase.
 *
 * Focus here is the `couple_trusted` gate + the canonical render order:
 *
 *   1. COUPLE_TRUSTED — earned by a verified vendor with `review_count ≥ 10`
 *      AND `avg_rating_overall ≥ 4.7`. A simple count-floor + rating bar
 *      (owner decision 2026-07-05) — it does NOT depend on booking counts.
 *      Verified-gated. Absolute (non-percentile) threshold that stacks with
 *      the other badges.
 *   2. ORDER — every vendor's badge array follows the ONE canonical order:
 *      new → verified → couple_trusted → most_booking → top_pick.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeVendorBadges,
  type VendorBadge,
  type VendorBadgeInput,
} from './vendor-badges';

// Fixed "now" so the New window is deterministic. Vendors below are created
// well before this so they never pick up the `new` badge unless we want it.
const NOW = Date.parse('2026-07-01T00:00:00Z');
const OLD = '2025-01-01T00:00:00Z'; // > 90 days before NOW → not "new"

function input(over: Partial<VendorBadgeInput> & { vendor_profile_id: string }): VendorBadgeInput {
  return {
    verification_state: 'verified',
    created_at: OLD,
    avg_rating_overall: 0,
    review_count: 0,
    ...over,
  };
}

// couple_trusted no longer depends on booking counts; pass 0 unless a test is
// specifically exercising the most_booking / top_pick percentile gates.
function badgesFor(v: VendorBadgeInput, bookings = 0): VendorBadge[] {
  const counts = new Map<string, number>([[v.vendor_profile_id, bookings]]);
  const out = computeVendorBadges([v], counts, { now: NOW });
  return out.get(v.vendor_profile_id) ?? [];
}

// ── couple_trusted: qualification ────────────────────────────────────────────

test('(a) verified · 10 reviews · avg 4.7 → couple_trusted', () => {
  const v = input({
    vendor_profile_id: 'v-a',
    review_count: 10,
    avg_rating_overall: 4.7,
  });
  assert.ok(badgesFor(v).includes('couple_trusted'));
});

test('(b) verified · 9 reviews · avg 4.9 → NOT couple_trusted (below count floor)', () => {
  const v = input({
    vendor_profile_id: 'v-b',
    review_count: 9,
    avg_rating_overall: 4.9,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('(c) verified · 15 reviews · avg 4.6 → NOT couple_trusted (below rating bar)', () => {
  const v = input({
    vendor_profile_id: 'v-c',
    review_count: 15,
    avg_rating_overall: 4.6,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('(d) UNVERIFIED · 20 reviews · avg 5.0 → NOT couple_trusted', () => {
  const v = input({
    vendor_profile_id: 'v-d',
    verification_state: 'pending',
    review_count: 20,
    avg_rating_overall: 5.0,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('boundary — exactly 10 reviews and exactly 4.7★ qualifies (>=)', () => {
  const v = input({
    vendor_profile_id: 'v-edge',
    review_count: 10,
    avg_rating_overall: 4.7,
  });
  assert.ok(badgesFor(v).includes('couple_trusted'));
});

test('does NOT depend on booking counts — qualifies with 0 completed bookings', () => {
  const v = input({
    vendor_profile_id: 'v-nobookings',
    review_count: 12,
    avg_rating_overall: 4.8,
  });
  assert.ok(badgesFor(v, 0).includes('couple_trusted'));
});

// ── couple_trusted: stacking + canonical order ───────────────────────────────

test('couple_trusted stacks immediately after verified in the canonical render order', () => {
  // Two-vendor pool: the runaway leader `v-lead` soaks up the most_booking /
  // top_pick percentile gates, so `v-stack` is left with exactly its absolute
  // badges — verified + couple_trusted — to assert the stacking order cleanly.
  const stack = input({
    vendor_profile_id: 'v-stack',
    review_count: 10,
    avg_rating_overall: 4.8,
  });
  const lead = input({
    vendor_profile_id: 'v-lead',
    review_count: 500,
    avg_rating_overall: 5,
  });
  const counts = new Map<string, number>([
    ['v-stack', 1],
    ['v-lead', 999],
  ]);
  const out = computeVendorBadges([stack, lead], counts, { now: NOW });
  assert.deepEqual(out.get('v-stack'), ['verified', 'couple_trusted']);
});

test('canonical order holds across a mixed pool: new → verified → couple_trusted → most_booking → top_pick', () => {
  // A single verified vendor that qualifies for ALL badges. With a one-vendor
  // pool the percentile gates (most_booking/top_pick) resolve to that vendor,
  // so every badge fires and we can assert the full ordering in one array.
  const v = input({
    vendor_profile_id: 'v-all',
    created_at: '2026-06-20T00:00:00Z', // within 90 days of NOW → "new"
    review_count: 20,
    avg_rating_overall: 4.9,
  });
  const badges = badgesFor(v, 25);
  assert.deepEqual(badges, [
    'new',
    'verified',
    'couple_trusted',
    'most_booking',
    'top_pick',
  ]);
});

/**
 * Vendor badge engine invariants (Node built-in test runner, run via tsx).
 * Guards the pure, deterministic core of lib/vendor-badges.ts —
 * `computeVendorBadges`, which never touches Supabase.
 *
 * Focus here is the `couple_trusted` gate + the canonical render order:
 *
 *   1. COUPLE_TRUSTED — earned by a verified vendor with
 *      `trusted_review_count ≥ 10` AND `trusted_avg_rating ≥ 4.7`, counted
 *      over ONLY receipt-backed, arm's-length reviews (the
 *      `vendor_trusted_review_stats` fields). It NO LONGER reads the raw
 *      `review_count` / `avg_rating_overall`, so fake / self-dealt reviews
 *      that inflate those raw counts can't earn the badge. A simple
 *      count-floor + rating bar (owner decision 2026-07-05) — it does NOT
 *      depend on booking counts. Verified-gated. Absolute (non-percentile)
 *      threshold that stacks with the other badges.
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
    trusted_avg_rating: 0,
    trusted_review_count: 0,
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

test('(a) verified · trusted 10 reviews · trusted avg 4.7 → couple_trusted', () => {
  const v = input({
    vendor_profile_id: 'v-a',
    trusted_review_count: 10,
    trusted_avg_rating: 4.7,
  });
  assert.ok(badgesFor(v).includes('couple_trusted'));
});

test('(b) verified · trusted 9 reviews · trusted avg 5.0 → NOT couple_trusted (below count floor)', () => {
  const v = input({
    vendor_profile_id: 'v-b',
    trusted_review_count: 9,
    trusted_avg_rating: 5.0,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('(c) verified · trusted 20 reviews · trusted avg 4.6 → NOT couple_trusted (below rating bar)', () => {
  const v = input({
    vendor_profile_id: 'v-c',
    trusted_review_count: 20,
    trusted_avg_rating: 4.6,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('(d) UNVERIFIED · trusted 30 reviews · trusted avg 5.0 → NOT couple_trusted', () => {
  const v = input({
    vendor_profile_id: 'v-d',
    verification_state: 'pending',
    trusted_review_count: 30,
    trusted_avg_rating: 5.0,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('(e) verified · HIGH raw reviews but 0 trusted → NOT couple_trusted (raw reviews cannot earn it)', () => {
  // The anti-fraud invariant: a vendor with a mountain of raw (unfiltered)
  // reviews — e.g. sockpuppet couples on self-made "delivered" events —
  // must NOT earn the badge when none of those reviews are receipt-backed,
  // arm's-length (trusted_review_count 0).
  const v = input({
    vendor_profile_id: 'v-raw-only',
    review_count: 500,
    avg_rating_overall: 5.0,
    trusted_review_count: 0,
    trusted_avg_rating: 0,
  });
  assert.ok(!badgesFor(v).includes('couple_trusted'));
});

test('boundary — exactly 10 trusted reviews and exactly 4.7★ qualifies (>=)', () => {
  const v = input({
    vendor_profile_id: 'v-edge',
    trusted_review_count: 10,
    trusted_avg_rating: 4.7,
  });
  assert.ok(badgesFor(v).includes('couple_trusted'));
});

test('does NOT depend on booking counts — qualifies with 0 completed bookings', () => {
  const v = input({
    vendor_profile_id: 'v-nobookings',
    trusted_review_count: 12,
    trusted_avg_rating: 4.8,
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
    trusted_review_count: 10,
    trusted_avg_rating: 4.8,
  });
  const lead = input({
    vendor_profile_id: 'v-lead',
    review_count: 500,
    avg_rating_overall: 5,
    trusted_review_count: 500,
    trusted_avg_rating: 5,
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
    // Trusted fields now drive BOTH couple_trusted AND top_pick.
    trusted_review_count: 20,
    trusted_avg_rating: 4.9,
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

// ── most_booking: reads the VETTED completed-events count ─────────────────────
// The `bookingCounts` map passed to computeVendorBadges is the vetted count
// from `vendor_public_completed_events_stats` (keyed by vendor_profile_id).
// These tests assert the badge honors that map — a vendor absent from it (its
// self-dealt events excluded → 0 vetted) never earns most_booking, even against
// a peer that has vetted bookings.

test('most_booking honors the VETTED count map — vendor with 0 vetted events never earns it', () => {
  // `fraud` has a runaway RAW booking count in the real world, but its vetted
  // count (what the map carries) is 0 because all its "delivered" events were
  // self-dealt and excluded by the view. `real` has a modest vetted count.
  // Only `real` should earn most_booking.
  const fraud = input({ vendor_profile_id: 'v-fraud' });
  const real = input({ vendor_profile_id: 'v-real' });
  const vettedCounts = new Map<string, number>([
    // v-fraud intentionally ABSENT → defaults to 0 vetted events.
    ['v-real', 8],
  ]);
  const out = computeVendorBadges([fraud, real], vettedCounts, { now: NOW });
  assert.ok(!(out.get('v-fraud') ?? []).includes('most_booking'));
  assert.ok((out.get('v-real') ?? []).includes('most_booking'));
});

test('most_booking uses the count from the map, not any raw review field on the input', () => {
  // A vendor with a big raw review_count but a 0 vetted-events entry must not
  // earn most_booking — bookings come exclusively from the vetted map.
  const v = input({
    vendor_profile_id: 'v-rawreviews',
    review_count: 999,
    avg_rating_overall: 5,
  });
  // vetted map is empty → 0 completed events → no most_booking.
  const out = computeVendorBadges([v], new Map(), { now: NOW });
  assert.ok(!(out.get('v-rawreviews') ?? []).includes('most_booking'));
});

// ── top_pick: scores on TRUSTED review stats, never raw ───────────────────────

test('top_pick — vendor with HIGH raw reviews but 0 trusted reviews does NOT qualify', () => {
  // The anti-fraud invariant for top_pick: the score is
  // trusted_avg_rating × ln(trusted_review_count + 1). A vendor with a mountain
  // of raw (unfiltered / sockpuppet) reviews but 0 TRUSTED reviews scores 0
  // (ln(1) = 0) and can never enter the top 5%, even as the only vendor.
  const v = input({
    vendor_profile_id: 'v-rawtop',
    review_count: 1000,
    avg_rating_overall: 5.0,
    trusted_review_count: 0,
    trusted_avg_rating: 0,
  });
  assert.ok(!badgesFor(v, 50).includes('top_pick'));
});

test('top_pick — a vendor with trusted reviews outranks a raw-only peer', () => {
  // `trusted` has real trusted reviews; `rawonly` has only raw (fake) reviews.
  // Only `trusted` earns top_pick — the raw-only vendor scores 0 and is out.
  const trusted = input({
    vendor_profile_id: 'v-trusted-top',
    trusted_review_count: 30,
    trusted_avg_rating: 4.9,
  });
  const rawonly = input({
    vendor_profile_id: 'v-rawonly-top',
    review_count: 500,
    avg_rating_overall: 5.0,
    trusted_review_count: 0,
    trusted_avg_rating: 0,
  });
  const out = computeVendorBadges([trusted, rawonly], new Map(), { now: NOW });
  assert.ok((out.get('v-trusted-top') ?? []).includes('top_pick'));
  assert.ok(!(out.get('v-rawonly-top') ?? []).includes('top_pick'));
});

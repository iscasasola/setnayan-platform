/**
 * Unit suite for the RSVP attendance projection. Load-bearing invariants:
 * the range envelope holds (low ≤ expected ≤ high), plus-ones count as heads,
 * and the rates are clamped so a bad override can't break the envelope.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  projectAttendance,
  headcountsFromGuests,
  headcountsFromStats,
  DEFAULT_PENDING_ATTENDANCE_RATE,
  DEFAULT_MAYBE_ATTENDANCE_RATE,
  type StatusHeadcounts,
} from './rsvp-projection';
import type { GuestRow, GuestStats } from './guests';

function guest(p: Partial<GuestRow>): GuestRow {
  return {
    guest_id: 'g',
    public_id: 'S89G-x',
    event_id: 'e',
    first_name: 'A',
    last_name: 'B',
    display_name: null,
    side: 'both',
    group_category: 'family',
    role: 'guest',
    extra_roles: [],
    plus_one_allowed: false,
    plus_one_name: null,
    plus_one_of_guest_id: null,
    plus_one_mode: null,
    email: null,
    mobile: null,
    meal_preference: null,
    dietary_restrictions: null,
    photo_consent: false,
    faceblock_enabled: false,
    photo_url: null,
    photo_source: null,
    photo_updated_at: null,
    invited_to_blocks: [],
    rsvp_status: 'pending',
    notes: null,
    qr_token: 'q',
    custom_tags: [],
    seating_priority: null,
    created_at: '2026-01-01',
    ...p,
  };
}

test('projectAttendance: range envelope holds with default rates', () => {
  const heads: StatusHeadcounts = { attending: 80, pending: 40, maybe: 10, declined: 5 };
  const p = projectAttendance(heads);
  assert.equal(p.low, 80); // confirmed only
  assert.equal(p.high, 130); // confirmed + all pending + all maybe
  // expected = 80 + 0.85*40 + 0.5*10 = 80 + 34 + 5 = 119
  assert.equal(p.expected, 119);
  assert.ok(p.low <= p.expected && p.expected <= p.high);
  assert.equal(p.undecidedHeads, 50);
  assert.equal(p.rates.pendingRate, DEFAULT_PENDING_ATTENDANCE_RATE);
  assert.equal(p.rates.maybeRate, DEFAULT_MAYBE_ATTENDANCE_RATE);
});

test('projectAttendance: all confirmed → degenerate range, expected==low==high', () => {
  const p = projectAttendance({ attending: 50, pending: 0, maybe: 0, declined: 3 });
  assert.equal(p.low, 50);
  assert.equal(p.high, 50);
  assert.equal(p.expected, 50);
  assert.equal(p.undecidedHeads, 0);
});

test('projectAttendance: out-of-range rates are clamped, envelope preserved', () => {
  const heads: StatusHeadcounts = { attending: 10, pending: 20, maybe: 0, declined: 0 };
  // pendingRate 5 would push expected to 110 without clamping; clamp to 1 → 30.
  const p = projectAttendance(heads, { pendingRate: 5, maybeRate: -2 });
  assert.equal(p.rates.pendingRate, 1);
  assert.equal(p.rates.maybeRate, 0);
  assert.equal(p.expected, 30);
  assert.ok(p.expected <= p.high);
});

test('headcountsFromGuests: plus-one counts as a second head', () => {
  const guests = [
    guest({ rsvp_status: 'attending', plus_one_allowed: true }), // 2 heads
    guest({ rsvp_status: 'attending', plus_one_allowed: false }), // 1
    guest({ rsvp_status: 'pending', plus_one_allowed: true }), // 2
    guest({ rsvp_status: 'declined' }), // 1
  ];
  const heads = headcountsFromGuests(guests);
  assert.equal(heads.attending, 3);
  assert.equal(heads.pending, 2);
  assert.equal(heads.declined, 1);
  assert.equal(heads.maybe, 0);
});

test('headcountsFromStats: attributes plus-ones to open buckets, not confirmed', () => {
  const stats: GuestStats = {
    total: 100,
    attending: 60,
    pending: 30,
    declined: 5,
    maybe: 10,
    plus_ones: 8,
  };
  const heads = headcountsFromStats(stats);
  // confirmed heads never inflated by the undated plus-one pool.
  assert.equal(heads.attending, 60);
  // the 8 plus-ones split across the 40 open (pending+maybe) heads.
  assert.equal(heads.pending + heads.maybe, 30 + 10 + 8);
});

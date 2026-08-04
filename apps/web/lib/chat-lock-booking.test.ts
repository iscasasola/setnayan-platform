import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  planChatLockBooking,
  CONFIRMED_LOCK_STATUSES,
  type ChatLockAction,
} from '@/lib/chat-lock-booking';

const plan = (
  marketplaceVendorId: string | null,
  verified: boolean,
  currentStatus: string | null,
): ChatLockAction =>
  planChatLockBooking({ marketplaceVendorId, verified, currentStatus });

test('no marketplace link → skip_no_link (off-platform: price only, no fee)', () => {
  // Even a "verified" flag and a fresh status can't book without a link.
  assert.equal(plan(null, true, 'considering'), 'skip_no_link');
  assert.equal(plan(null, false, null), 'skip_no_link');
});

test('marketplace + not verified → blocked_not_verified (link wins over status)', () => {
  assert.equal(plan('vp-1', false, 'considering'), 'blocked_not_verified');
  assert.equal(plan('vp-1', false, 'shortlisted'), 'blocked_not_verified');
  // Not-verified is checked BEFORE the already-booked short-circuit.
  assert.equal(plan('vp-1', false, 'contracted'), 'blocked_not_verified');
});

test('verified + fresh status → book (first lock writes the negotiated total)', () => {
  assert.equal(plan('vp-1', true, null), 'book');
  assert.equal(plan('vp-1', true, 'considering'), 'book');
  assert.equal(plan('vp-1', true, 'shortlisted'), 'book');
  assert.equal(plan('vp-1', true, 'inquiring'), 'book');
});

test('verified + already-booked status → refresh_fee_only (never rewrite frozen price)', () => {
  for (const s of CONFIRMED_LOCK_STATUSES) {
    assert.equal(
      plan('vp-1', true, s),
      'refresh_fee_only',
      `${s} is a booked status → must not rewrite`,
    );
  }
});

test('CONFIRMED_LOCK_STATUSES matches the DB trigger + lib/events canonical set', () => {
  assert.deepEqual(
    [...CONFIRMED_LOCK_STATUSES].sort(),
    ['complete', 'contracted', 'delivered', 'deposit_paid'],
  );
});

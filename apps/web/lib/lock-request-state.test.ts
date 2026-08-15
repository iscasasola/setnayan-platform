/**
 * The flag-OFF identity proof for the whole read model, in one table — plus the
 * two rows that only a state-keyed derivation classifies correctly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  lockRequestStateOf,
  lockRequestDaysLeft,
  isAwaitingVendor,
  type LockRequestRow,
} from './lock-request-state';

const row = (status: string | null, state: string | null = null): LockRequestRow => ({
  status,
  lock_request_state: state,
});

test('flag OFF is byte-identical to "is it a confirmed status?"', () => {
  const CONFIRMED = ['contracted', 'deposit_paid', 'delivered', 'complete'];
  const OTHER = ['considering', 'shortlisted', null];
  // Markers present or absent must make NO difference while the flag is off.
  for (const marker of [null, 'pending', 'agreed', 'declined', 'cancelled', 'expired']) {
    for (const s of CONFIRMED) {
      assert.equal(lockRequestStateOf(row(s, marker), false), 'locked', `${s}/${marker}`);
    }
    for (const s of OTHER) {
      assert.equal(lockRequestStateOf(row(s, marker), false), 'none', `${s}/${marker}`);
    }
  }
  // MUTATION: make the flag-off branch consult lock_request_state ⇒ red.
});

test('a legacy or Locked-QR booking never shows a phantom "waiting"', () => {
  // vendor_claim_locked_qr promotes to deposit_paid without touching any lock_*
  // column (owner-exempt 2026-08-04 §6.4). Derive, never backfill.
  assert.equal(lockRequestStateOf(row('deposit_paid', null), true), 'locked');
  assert.equal(lockRequestStateOf(row('contracted', null), true), 'locked');
  // And a confirmed row carrying a STALE pending marker is still a booking —
  // this is the shape the sweep status floor exists to protect.
  assert.equal(lockRequestStateOf(row('deposit_paid', 'pending'), true), 'locked');
});

test('the request states map through when the flag is on', () => {
  assert.equal(lockRequestStateOf(row('considering', 'pending'), true), 'requested');
  assert.equal(lockRequestStateOf(row('considering', 'declined'), true), 'declined');
  assert.equal(lockRequestStateOf(row('considering', 'cancelled'), true), 'cancelled');
  assert.equal(lockRequestStateOf(row('considering', 'expired'), true), 'expired');
  assert.equal(lockRequestStateOf(row('considering', null), true), 'none');
});

test('AGREED-but-not-confirmed does not fall through to "none"', () => {
  // Reachable: "Change pick" reverts status while the marker lingers. Reporting
  // 'none' would offer Lock again on a booking the supplier believes they hold.
  // MUTATION: delete the 'agreed' case ⇒ this reddens.
  assert.notEqual(lockRequestStateOf(row('considering', 'agreed'), true), 'none');
});

test('every state member is reachable — no arm is dead', () => {
  const seen = new Set([
    lockRequestStateOf(row('considering', null), true),
    lockRequestStateOf(row('considering', 'pending'), true),
    lockRequestStateOf(row('considering', 'declined'), true),
    lockRequestStateOf(row('considering', 'cancelled'), true),
    lockRequestStateOf(row('considering', 'expired'), true),
    lockRequestStateOf(row('contracted', null), true),
  ]);
  for (const s of ['none', 'requested', 'declined', 'cancelled', 'expired', 'locked']) {
    assert.ok(seen.has(s as never), `${s} is unreachable — a surface would never render it`);
  }
});

test('isAwaitingVendor is true only while the supplier owes an answer', () => {
  assert.equal(isAwaitingVendor(row('considering', 'pending'), true), true);
  assert.equal(isAwaitingVendor(row('considering', 'pending'), false), false);
  assert.equal(isAwaitingVendor(row('contracted', 'pending'), true), false);
  assert.equal(isAwaitingVendor(row('considering', 'declined'), true), false);
});

test('days left is whole days, floored at zero, and null without a deadline', () => {
  const now = new Date('2026-08-15T00:00:00Z');
  assert.equal(lockRequestDaysLeft('2026-08-22T00:00:00Z', now), 7);
  assert.equal(lockRequestDaysLeft('2026-08-15T06:00:00Z', now), 1, 'part of a day still counts');
  assert.equal(lockRequestDaysLeft('2026-08-10T00:00:00Z', now), 0, 'never negative');
  assert.equal(lockRequestDaysLeft(null, now), null);
  assert.equal(lockRequestDaysLeft('not-a-date', now), null);
});

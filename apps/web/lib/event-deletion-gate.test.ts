/**
 * Guard suite for the two decisions behind removing a celebration.
 *
 * These are the only parts of `deleteOwnEvent` that decide anything; the rest
 * is I/O. Both are tested for the direction that COSTS — a delete wrongly
 * allowed — not just the happy path.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';

import {
  BOOKED_VENDOR_STATUSES,
  SETTLED_ORDER_STATUSES,
  confirmationMatches,
  deletionIsBlocked,
} from './event-deletion-gate';

test('the money gate fails CLOSED on an unmeasured read', () => {
  // 🔒 THE ONE THAT MATTERS. `null` is "we could not check whether this couple
  // has paid for anything", and the safe answer to that is no. If this ever
  // returns false for null, an unreadable orders table becomes a green light to
  // destroy a paid-for celebration.
  assert.equal(deletionIsBlocked(null), true);
});

test('the money gate refuses when anything has been paid for', () => {
  assert.equal(deletionIsBlocked(1), true);
  assert.equal(deletionIsBlocked(12), true);
});

test('the money gate allows when no money has moved', () => {
  // Prod today: every event has 0 settled orders, so this is the live path.
  assert.equal(deletionIsBlocked(0), false);
});

test('a refund still counts as money moved', () => {
  // Not a behaviour of the function — a property of the STATUS LIST it is fed.
  // A refunded order is a record of money that moved and came back; it is still
  // a receipt somebody may need.
  assert.ok(SETTLED_ORDER_STATUSES.includes('refunded'));
  assert.ok(SETTLED_ORDER_STATUSES.includes('paid'));
  assert.ok(SETTLED_ORDER_STATUSES.includes('fulfilled'));
});

test('the settled list never counts intent as payment', () => {
  // `submitted` / `awaiting_payment` / `draft` are somebody having STARTED a
  // purchase. Prod holds exactly one such row — the owner's own unpaid ₱499
  // test order — and blocking on it would refuse the delete of a test event
  // that nobody has paid a peso for.
  for (const notMoney of [
    'draft',
    'submitted',
    'awaiting_payment',
    'cancelled',
    'lapsed',
  ]) {
    assert.ok(
      !(SETTLED_ORDER_STATUSES as readonly string[]).includes(notMoney),
      `${notMoney} is intent, not money`,
    );
  }
});

test('booked suppliers exclude the ones merely being considered', () => {
  // 32 of prod's 45 supplier rows are `considering` — a name typed into a list.
  // Counting those as "booked suppliers you will lose" would make the warning
  // frightening and wrong.
  for (const notBooked of ['considering', 'shortlisted']) {
    assert.ok(
      !(BOOKED_VENDOR_STATUSES as readonly string[]).includes(notBooked),
      `${notBooked} is not a booking`,
    );
  }
  assert.ok(BOOKED_VENDOR_STATUSES.includes('contracted'));
  assert.ok(BOOKED_VENDOR_STATUSES.includes('deposit_paid'));
});

test('the typed confirmation ignores case and surrounding space', () => {
  assert.equal(confirmationMatches('cale & ice', 'Cale & Ice'), true);
  assert.equal(confirmationMatches('  Cale & Ice  ', 'Cale & Ice'), true);
});

test('the typed confirmation refuses a near miss', () => {
  assert.equal(confirmationMatches('Cale and Ice', 'Cale & Ice'), false);
  assert.equal(confirmationMatches('Cale', 'Cale & Ice'), false);
  assert.equal(confirmationMatches('', 'Cale & Ice'), false);
});

test('an empty box can never delete a nameless event', () => {
  // 🪤 The one input a stray press produces is an empty box. If the event's own
  // display name is blank or whitespace, a naive equality check makes '' === ''
  // true and the confirmation step evaporates for exactly the event whose name
  // nobody could have typed.
  assert.equal(confirmationMatches('', ''), false);
  assert.equal(confirmationMatches('   ', '   '), false);
});

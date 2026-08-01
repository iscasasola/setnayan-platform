/**
 * Pure-logic tests for slot-seat-reservations.
 *
 * These cover DISPLAY and INPUT-SHAPE only. The capacity rule itself is
 * deliberately NOT reimplemented here — it lives in SQL and is proven in
 * tests/db/slot-seat-reservations.db.test.ts. A TypeScript "can this party
 * fit?" helper would be a read-then-write invitation, so there is nothing here
 * to test for it, on purpose.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReservableSlot,
  validatePartySize,
  seatsRemaining,
  availabilityLabel,
  reserveFailureMessage,
  PARTY_SIZE_MAX,
  OCCUPYING_STATUSES,
  type ReserveStatus,
} from './slot-seat-reservations';

test('a slot is reservable only when the vendor gave it seats', () => {
  assert.equal(isReservableSlot(12), true);
  assert.equal(isReservableSlot(1), true);
  // NULL means "not a seated slot" — it is NOT the number zero. This is the
  // discriminator that keeps the shipped tier-#3 booking path untouched.
  assert.equal(isReservableSlot(null), false);
  assert.equal(isReservableSlot(undefined), false);
  assert.equal(isReservableSlot(0), false);
  assert.equal(isReservableSlot(Number.NaN), false);
});

test('party size accepts whole people and nothing else', () => {
  assert.equal(validatePartySize(1), null);
  assert.equal(validatePartySize(8), null);
  assert.equal(validatePartySize(PARTY_SIZE_MAX), null);

  assert.ok(validatePartySize(0));
  assert.ok(validatePartySize(-3));
  assert.ok(validatePartySize(2.5));
  assert.ok(validatePartySize(PARTY_SIZE_MAX + 1));
  assert.ok(validatePartySize('4' as unknown));
  assert.ok(validatePartySize(null));
  assert.ok(validatePartySize(undefined));
  assert.ok(validatePartySize(Number.NaN));
});

test('seats remaining never goes negative', () => {
  assert.equal(seatsRemaining(12, 0), 12);
  assert.equal(seatsRemaining(12, 7), 5);
  assert.equal(seatsRemaining(12, 12), 0);
  // A restaurant that lowered capacity under live tables reads as over-full.
  // Showing "-3 seats left" would be worse than showing none.
  assert.equal(seatsRemaining(8, 11), 0);
});

test('availability reads as fully booked at and past zero', () => {
  assert.equal(
    availabilityLabel({
      slotId: 's',
      date: '2027-12-03',
      seatsCapacity: 12,
      seatsTaken: 6,
      seatsRemaining: 6,
    }),
    '6 of 12 seats left',
  );
  assert.equal(
    availabilityLabel({
      slotId: 's',
      date: '2027-12-03',
      seatsCapacity: 12,
      seatsTaken: 12,
      seatsRemaining: 0,
    }),
    'Fully booked',
  );
});

test('every non-ok reserve status has its own message', () => {
  const statuses: Exclude<ReserveStatus, 'ok'>[] = [
    'full',
    'already_reserved',
    'not_reservable',
    'slot_not_found',
    'not_authorized',
    'date_in_past',
    'invalid_party_size',
    'invalid_input',
  ];
  const seen = new Set<string>();
  for (const s of statuses) {
    const msg = reserveFailureMessage(s);
    assert.ok(msg && msg.length > 0, `${s} has no message`);
    assert.ok(!seen.has(msg), `${s} reuses another status's message`);
    seen.add(msg);
  }
});

test('only held and confirmed occupy capacity', () => {
  assert.deepEqual([...OCCUPYING_STATUSES], ['held', 'confirmed']);
  assert.ok(!(OCCUPYING_STATUSES as readonly string[]).includes('cancelled'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { capturerName, capturedAtLabel, creditLine } from './capture-credit-pure';

/**
 * THE CREDIT'S RULE — "who took this photograph", and when to say nothing.
 *
 * Every case here is one this project can actually be in. The production
 * measurement that shaped the whole ladder (2026-08-27): 14 of 14 photographs
 * carry a capturer id, 32 of the 34 people rows have no name at all, and the
 * account behind all 14 has no display name either — so `null` is not an edge
 * case, it is the state that ships.
 */

test('the ladder prefers the person spine, then the guest list, then the account', () => {
  assert.equal(
    capturerName({ personDisplay: 'Ninang Cora', guestDisplay: 'C. Reyes', userDisplay: 'cora' }),
    'Ninang Cora',
  );
  assert.equal(capturerName({ personFirst: 'Cora', guestDisplay: 'C. Reyes' }), 'Cora');
  assert.equal(capturerName({ guestDisplay: 'C. Reyes', userDisplay: 'creyes' }), 'C. Reyes');
  assert.equal(capturerName({ guestFirst: 'Cora', userDisplay: 'creyes' }), 'Cora');
  assert.equal(capturerName({ userDisplay: 'Kuya Dino' }), 'Kuya Dino');
});

test('a nameless person spine falls through instead of winning with a blank', () => {
  // This is the production shape exactly: the person row exists and is empty.
  assert.equal(
    capturerName({ personDisplay: null, personFirst: null, guestDisplay: 'Tita Remy' }),
    'Tita Remy',
  );
  assert.equal(capturerName({ personDisplay: '   ', guestFirst: 'Remy' }), 'Remy');
});

test('nobody knows ⇒ NOTHING, never "Unknown" and never "A guest"', () => {
  assert.equal(capturerName({}), null);
  assert.equal(capturerName({ personDisplay: null, guestDisplay: '', userDisplay: '  ' }), null);
});

test('an email address is never a credit', () => {
  // users.display_name is occasionally seeded from the address, and the wall is
  // read by every guest in the room.
  assert.equal(capturerName({ userDisplay: 'iscasasolaii@gmail.com' }), null);
  assert.equal(capturerName({ personDisplay: 'bea@example.com', guestFirst: 'Bea' }), 'Bea');
});

test('NO TIMEZONE ⇒ NO TIME — the reader’s own clock is never printed as the venue’s', () => {
  const shotAt = '2026-12-12T08:12:00.000Z'; // 4:12 PM in Manila
  assert.equal(capturedAtLabel(shotAt, 'Asia/Manila'), '4:12 PM');
  assert.equal(capturedAtLabel(shotAt, null), null);
  assert.equal(capturedAtLabel(shotAt, undefined), null);
  assert.equal(capturedAtLabel(shotAt, 'Not/AZone'), null);
  assert.equal(capturedAtLabel(null, 'Asia/Manila'), null);
  assert.equal(capturedAtLabel('not-a-date', 'Asia/Manila'), null);
});

test('the venue clock is the venue’s wherever the reader is', () => {
  // The same instant, formatted for the same venue, must not move because the
  // process runs somewhere else. CI runs in UTC — the one clock where a
  // timezone mistake cancels out — so this asserts the zone is honoured, not
  // that the machine happens to agree.
  const shotAt = '2026-12-12T08:12:00.000Z';
  assert.equal(capturedAtLabel(shotAt, 'Asia/Manila'), '4:12 PM');
  assert.equal(capturedAtLabel(shotAt, 'America/New_York'), '3:12 AM');
  assert.notEqual(
    capturedAtLabel(shotAt, 'Asia/Manila'),
    capturedAtLabel(shotAt, 'America/New_York'),
  );
});

test('a time with no name is not a credit', () => {
  // A bare "4:12 PM" under a photograph is a timestamp, not the thing the
  // archetype asked for.
  assert.equal(creditLine(null, '2026-12-12T08:12:00.000Z', 'Asia/Manila'), null);
  assert.equal(creditLine('Ninang Cora', '2026-12-12T08:12:00.000Z', 'Asia/Manila'), 'Ninang Cora · 4:12 PM');
  assert.equal(creditLine('Ninang Cora', null, 'Asia/Manila'), 'Ninang Cora');
  assert.equal(creditLine('Ninang Cora', '2026-12-12T08:12:00.000Z', null), 'Ninang Cora');
});

/**
 * appointment-slots — time-slot options + the meeting date window (today → day
 * before the event).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIME_SLOTS, dayBeforeEventIso, isoDate } from './appointment-slots';

test('TIME_SLOTS run 8:00 AM to 8:00 PM in 30-min steps', () => {
  assert.equal(TIME_SLOTS[0].value, '08:00');
  assert.equal(TIME_SLOTS[0].label, '8:00 AM');
  assert.equal(TIME_SLOTS[TIME_SLOTS.length - 1].value, '20:00');
  assert.equal(TIME_SLOTS[TIME_SLOTS.length - 1].label, '8:00 PM');
  // 8:00 → 20:00 inclusive, every 30 min = 25 slots (no 20:30).
  assert.equal(TIME_SLOTS.length, 25);
  assert.ok(TIME_SLOTS.some((s) => s.value === '12:00' && s.label === '12:00 PM'));
  assert.ok(TIME_SLOTS.some((s) => s.value === '13:30' && s.label === '1:30 PM'));
});

test('dayBeforeEventIso returns the day before, or null', () => {
  assert.equal(dayBeforeEventIso('2027-02-14'), '2027-02-13');
  assert.equal(dayBeforeEventIso('2027-03-01'), '2027-02-28'); // month rollover
  assert.equal(dayBeforeEventIso(null), null);
  assert.equal(dayBeforeEventIso(''), null);
  assert.equal(dayBeforeEventIso('not-a-date'), null);
});

test('isoDate formats a Date as yyyy-mm-dd', () => {
  assert.equal(isoDate(new Date('2027-02-14T09:30:00')), '2027-02-14');
});

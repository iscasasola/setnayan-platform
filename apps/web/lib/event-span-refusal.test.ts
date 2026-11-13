import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventSpanDays, eventSpanRefusal } from './event-type-profile';

test('span is inclusive', () => {
  assert.equal(eventSpanDays('2027-03-01', '2027-03-01'), 1);
  assert.equal(eventSpanDays('2027-03-01', '2027-03-08'), 8);
});

test('a span longer than the type maximum is refused with a sentence', () => {
  assert.equal(eventSpanRefusal({ startDate: '2027-03-01', endDate: '2027-03-07', maxDays: 7 }), null);
  assert.match(eventSpanRefusal({ startDate: '2027-03-01', endDate: '2027-03-08', maxDays: 7 }) ?? '', /up to 7 days/);
  assert.match(eventSpanRefusal({ startDate: '2027-03-01', endDate: '2027-03-02', maxDays: 1 }) ?? '', /one day/);
  assert.equal(eventSpanRefusal({ startDate: '2027-03-01', endDate: '2027-03-30', maxDays: 30 }), null);
  assert.match(eventSpanRefusal({ startDate: '2027-03-05', endDate: '2027-03-01', maxDays: 7 }) ?? '', /before/);
});

test('no end date means one day and is never refused', () => {
  assert.equal(eventSpanRefusal({ startDate: '2027-03-01', endDate: null, maxDays: 1 }), null);
});

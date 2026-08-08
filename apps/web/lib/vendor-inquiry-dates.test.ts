import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pendingInquiryDates } from './vendor-inquiry-dates';
import { buildCustomerCalendarMonth } from './vendor-customers';

test('counts pending enquiries per date, oldest date first', () => {
  const out = pendingInquiryDates([
    { inquiry_status: 'pending', event: { event_date: '2026-12-12' } },
    { inquiry_status: 'pending', event: { event_date: '2026-12-12' } },
    { inquiry_status: 'pending', event: { event_date: '2026-11-03' } },
  ]);
  assert.deepEqual(out, [
    { requestedDate: '2026-11-03', count: 1 },
    { requestedDate: '2026-12-12', count: 2 },
  ]);
});

test('only PENDING threads count — an accepted enquiry is no longer a question', () => {
  const out = pendingInquiryDates([
    { inquiry_status: 'accepted', event: { event_date: '2026-12-12' } },
    { inquiry_status: 'declined', event: { event_date: '2026-12-12' } },
    { inquiry_status: null, event: { event_date: '2026-12-12' } },
  ]);
  assert.deepEqual(out, []);
});

test('🔑 a thread with no date is DROPPED, never bucketed', () => {
  // Putting it on "today" would mark a day nobody asked about.
  const out = pendingInquiryDates([
    { inquiry_status: 'pending', event: { event_date: null } },
    { inquiry_status: 'pending', event: null },
    { inquiry_status: 'pending' },
  ]);
  assert.deepEqual(out, []);
});

test('🪤 a timestamp is truncated to its civil day, never re-parsed', () => {
  // `new Date('2026-12-12T00:00:00Z')` is the 11th west of Greenwich. Slicing
  // the string cannot drift; parsing it can.
  const out = pendingInquiryDates([
    { inquiry_status: 'pending', event: { event_date: '2026-12-12T15:30:00+08:00' } },
  ]);
  assert.deepEqual(out, [{ requestedDate: '2026-12-12', count: 1 }]);
});

test('garbage dates are dropped rather than guessed at', () => {
  const out = pendingInquiryDates([
    { inquiry_status: 'pending', event: { event_date: 'someday' } },
    { inquiry_status: 'pending', event: { event_date: '12/12/2026' } },
  ]);
  assert.deepEqual(out, []);
});

test('🔑 an enquiry ANNOTATES a day — it never becomes the day’s state', () => {
  const month = buildCustomerCalendarMonth(
    [],
    [],
    [],
    [],
    [],
    '2026-12',
    '2026-12-01',
    [{ requestedDate: '2026-12-12', count: 2 }],
  );
  const asked = month.days.find((d) => d.date === '2026-12-12');
  assert.ok(asked);
  assert.equal(asked.inquiryCount, 2, 'the question is recorded');
  assert.equal(
    asked.state,
    null,
    'an OPEN day with an enquiry must stay open — marking it taken would be a lie',
  );
});

test('🔑 an enquiry never masks a real state', () => {
  const month = buildCustomerCalendarMonth(
    [],
    [],
    [],
    [],
    [{ requestedDate: '2026-12-20', pendingCount: 3 }],
    '2026-12',
    '2026-12-01',
    [{ requestedDate: '2026-12-20', count: 1 }],
  );
  const day = month.days.find((d) => d.date === '2026-12-20');
  assert.ok(day);
  assert.equal(day.state, 'waitlist', 'the real state survives the annotation');
  assert.equal(day.inquiryCount, 1);
});

test('omitting the list entirely leaves every day at zero (backward compatible)', () => {
  const month = buildCustomerCalendarMonth([], [], [], [], [], '2026-12', '2026-12-01');
  assert.ok(month.days.every((d) => d.inquiryCount === 0));
});

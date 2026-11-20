/**
 * 📅 HOW FAR AWAY A SHOP TAKES BOOKINGS (owner 2026-11-19, DECISION_LOG "AT LEAST AND AT MOST, EMPTY AT MOST =
 * 3 YEARS"; drawing `schedule_questions_placement_2026-11-19.html` §5). The pure rule in `lib/booking-window.ts`, and
 * the places that must read it — so a reader that stops honouring it fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEB } from '@/lib/design-rules-scan';
import {
  addCivilMonths,
  atLeastWords,
  atMostWords,
  bookingWindowFromForm,
  bookingWindowOf,
  bookingWindowSpan,
  outsideBookingWindow,
  tooSoonDays,
  windowRefusals,
  OPEN_BOOKING_WINDOW,
} from './booking-window';

const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('empty means the same day and 3 years; anything out of range reads as empty', () => {
  assert.deepEqual(bookingWindowOf(null), { minDays: 0, maxMonths: 36 });
  assert.deepEqual(bookingWindowOf({ booking_min_days: null, booking_max_months: null }), OPEN_BOOKING_WINDOW);
  assert.deepEqual(bookingWindowOf({ booking_min_days: 7, booking_max_months: 24 }), { minDays: 7, maxMonths: 24 });
  assert.deepEqual(bookingWindowOf({ booking_min_days: 99, booking_max_months: 99 }), OPEN_BOOKING_WINDOW);
});

test('the span: At least days from today, At most months from today (a short month keeps its last day)', () => {
  assert.deepEqual(bookingWindowSpan('2026-11-20', { minDays: 7, maxMonths: 24 }), { first: '2026-11-27', last: '2028-11-20' });
  assert.equal(addCivilMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(addCivilMonths('2027-12-31', 2), '2028-02-29');
  assert.equal(outsideBookingWindow('2026-11-26', '2026-11-20', { minDays: 7, maxMonths: 24 }), 'too_soon');
  assert.equal(outsideBookingWindow('2026-11-27', '2026-11-20', { minDays: 7, maxMonths: 24 }), null);
  assert.equal(outsideBookingWindow('2028-11-21', '2026-11-20', { minDays: 7, maxMonths: 24 }), 'too_far');
  assert.equal(outsideBookingWindow('2029-11-20', '2026-11-20', OPEN_BOOKING_WINDOW), null, 'empty At most = 3 years');
  assert.equal(outsideBookingWindow('2029-11-21', '2026-11-20', OPEN_BOOKING_WINDOW), 'too_far');
  assert.deepEqual(tooSoonDays('2026-11-20', { minDays: 3, maxMonths: 36 }), ['2026-11-20', '2026-11-21', '2026-11-22']);
  assert.deepEqual(tooSoonDays('2026-11-20', OPEN_BOOKING_WINDOW), [], 'same day allowed');
});

test('only the drawing\'s picks are stored; Same day and 3 years are stored empty', () => {
  assert.deepEqual(bookingWindowFromForm('7', '24'), { booking_min_days: 7, booking_max_months: 24 });
  assert.deepEqual(bookingWindowFromForm('0', '36'), { booking_min_days: null, booking_max_months: null });
  assert.equal(bookingWindowFromForm('5', '24'), null);
  assert.equal(bookingWindowFromForm('7', '48'), null);
  assert.equal(bookingWindowFromForm('', ''), null);
  assert.deepEqual([0, 3, 7, 14, 30].map(atLeastWords), ['Same day', '3 days', '7 days', '14 days', '30 days']);
  assert.deepEqual([6, 12, 24, 36].map(atMostWords), ['6 months', '1 year', '2 years', '3 years']);
});

test('Find\'s half: every card of a shop is refused on a day outside its window; another shop is untouched', () => {
  const r = windowRefusals(
    new Map([
      ['shopA', ['a1', 'a2']],
      ['shopB', ['b1']],
    ]),
    new Map([
      ['shopA', { minDays: 14, maxMonths: 6 }],
      ['shopB', OPEN_BOOKING_WINDOW],
    ]),
    ['2026-11-25', '2027-01-10', '2027-06-01'],
    '2026-11-20',
  );
  assert.deepEqual(
    r.map((x) => `${x.card}@${x.day}`).sort(),
    ['a1@2026-11-25', 'a1@2027-06-01', 'a2@2026-11-25', 'a2@2027-06-01'],
  );
});

test('every reader honours it: Check a date, its side card, Find, the bench, the ask — and the fixed 37 months is gone', () => {
  const cad = read('lib/check-a-date.ts');
  assert.doesNotMatch(cad, /export const CHECK_DATE_MONTHS_AHEAD/, 'drawing §5: "Removed: the fixed 37 months"');
  const server = read('lib/check-a-date.server.ts');
  assert.match(server, /booking_min_days, booking_max_months/, 'Check a date reads the shop\'s window');
  assert.match(server, /checkDateWindowFor\(today, bookingWindow\)/);
  assert.equal((server.match(/withBookingWindow\(checkDateAnswer\(/g) ?? []).length, 2, 'the page and its side card');
  const bench = read('lib/bench-bookable-days.server.ts');
  assert.equal((bench.match(/windowRefusals\(cardsBySupplier, windows, days, windowToday\(\)\)/g) ?? []).length, 2, 'Find and the bench');
  const ask = read('app/dashboard/[eventId]/vendors/actions.ts');
  assert.match(ask, /readBookingWindow\(createAdminClient\(\), targetVendor\.marketplace_vendor_id\)[\s\S]{0,300}bookingWindowMessage\(outside, shopWindow\)/);
  // Above the slot / daily-capacity split, so a card with time slots is checked too (ship review of #8058).
  const fin = ask.slice(ask.indexOf('export async function finalizeVendor('));
  const windowAt = fin.indexOf('readBookingWindow(');
  const splitAt = fin.indexOf('let slotPathLocked = false;');
  assert.ok(windowAt > 0 && splitAt > 0, 'finalizeVendor still reads the window and still splits slot / #2');
  assert.ok(windowAt < splitAt, 'the window check runs before the slot path, not only inside #2');
  assert.equal((fin.match(/readBookingWindow\(/g) ?? []).length, 1, 'one window check, not one per path');
  // A write the row policy turns into zero rows must not read "saved" (ship review of #8058).
  const save = read('app/vendor-dashboard/calendar/actions.ts');
  const body = save.slice(save.indexOf('async function saveBookingWindow('), save.indexOf("backToCalendar(formData, 'booking_window_saved')"));
  assert.match(body, /\.select\('vendor_profile_id'\)/);
  assert.match(body, /saved\.length === 0\) backToCalendar\(formData, 'save_failed'\)/);
});

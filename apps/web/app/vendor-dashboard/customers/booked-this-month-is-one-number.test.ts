/**
 * 📊 TODAY'S "BOOKED · EVENTS THIS MONTH" OPENS CLIENTS ON THE SAME NUMBER (EB-219 · owner 75a46e3c item 9).
 *
 * Found by the every-button walk: Today said "0 booked this month" and the door it opened said "6 booked", because
 * Clients' Booked counted every date plus the outside bookings. Owner, 16 Nov 2026: Today's tap opens Clients
 * **filtered to this month**, so it shows the same number, with "All months" one tap away; Today's count stays.
 *
 * What is measured:
 *   1. Today's Booked link, parsed the way Clients parses it, lands on the Booked door AND the month filter;
 *   2. the number: one function (`bookedThisMonthCount`) — distinct events, every day of this month, nothing from
 *      another month, and a short read is null ("couldn't load"), never 0 or a smaller count;
 *   3. both screens print THAT function's result over THE SAME read (`fetchVendorRoomEventsDetailed`) for the same
 *      Manila month — so they cannot drift — and Clients' Booked tile, its pinned count and its list all follow it in
 *      month scope, with "All months" offered beside it.
 *
 * SABOTAGE (run 16 Nov 2026): pointing Today's link back at `?door=booked` turns test 1 red; letting Clients' month
 * tile print its own lanes (dropping the `monthCount` return in `doorValue`) turns test 3 red; returning 0 for a short read turns
 * test 2 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { TODAY_STAT_HREFS } from '@/app/vendor-dashboard/_components/today-stats';
import { BOOKED_ALL_MONTHS_HREF, BOOKED_WITHIN_MONTH, bookedThisMonthCount } from '@/lib/booked-this-month';
import { stripComments } from '@/lib/strip-comments';
import { customersDoorOf } from './segments';

const WEB = path.resolve(import.meta.dirname, '../../..');
const src = (rel: string) => stripComments(readFileSync(path.join(WEB, rel), 'utf8'));

test('1 · Today\'s Booked opens Clients › Booked filtered to this month', () => {
  const url = new URL(TODAY_STAT_HREFS.booked, 'https://x.test');
  assert.equal(url.pathname, '/vendor-dashboard/customers');
  const sp = Object.fromEntries(url.searchParams);
  assert.equal(customersDoorOf(sp), 'booked', 'Today\'s Booked does not open the Booked door');
  assert.equal(sp.within, BOOKED_WITHIN_MONTH, 'Today\'s Booked opens every month, not this month — the counts disagree');
  const all = Object.fromEntries(new URL(BOOKED_ALL_MONTHS_HREF, 'https://x.test').searchParams);
  assert.equal(customersDoorOf(all), 'booked');
  assert.equal(all.within, undefined, '"All months" is still filtered');
});

test('2 · the number: distinct events dated this month; a short read is "couldn\'t load", never 0', () => {
  const events = [
    { eventId: 'a', bookedDate: '2026-11-02' }, // earlier this month — counted
    { eventId: 'a', bookedDate: '2026-11-03' }, // same event, second day — once
    { eventId: 'b', bookedDate: '2026-11-30' },
    { eventId: 'c', bookedDate: '2026-12-01' }, // next month — not counted
    { eventId: 'd', bookedDate: '2026-10-31' }, // last month — not counted
  ];
  assert.equal(bookedThisMonthCount({ events, complete: true }, '2026-11'), 2);
  assert.equal(bookedThisMonthCount({ events, complete: false }, '2026-11'), null);
  assert.equal(bookedThisMonthCount({ events: [], complete: false }, '2026-11'), null);
  assert.equal(bookedThisMonthCount(null, '2026-11'), null);
  assert.equal(bookedThisMonthCount({ events: [], complete: true }, '2026-11'), 0);
});

test('3 · Today and Clients print that one function over the same read, for the same month', () => {
  const overview = src('lib/vendor-overview.ts');
  assert.match(overview, /fetchVendorRoomEventsDetailed\(supabase, vendorProfileId\)/, 'Today no longer reads the room bookings');
  assert.match(overview, /const bookedThisMonth = bookedThisMonthCount\(roomRead, monthPrefix\);/, 'Today counts its own way');
  assert.match(overview, /const monthPrefix = manilaTodayIso\(\)\.slice\(0, 7\);/);

  const page = src('app/vendor-dashboard/customers/page.tsx');
  assert.match(page, /search\.within === BOOKED_WITHIN_MONTH\s*\?\s*fetchVendorRoomEventsDetailed\(supabase, vendorProfileId\)/, 'Clients\' month filter reads something else');
  assert.match(page, /const todayIso = manilaTodayIso\(\);/);
  assert.match(page, /const monthCount = monthRead \? bookedThisMonthCount\(monthRead, todayIso\.slice\(0, 7\)\) : null;/);
  // The tile, and the pinned "N booked" (both via `doorValue`), print `monthCount` in month scope — not the lanes.
  assert.match(page, /if \(k === 'booked' && monthRead\) return monthCount === null \? null : formatCount\(monthCount\);/, 'the Booked tile does not print Today\'s number in month scope');
  assert.match(page, /k === 'booked' && monthIds \? \(monthCount \?\? 0\) : doorCount\(k\)/, 'the Booked list\'s own total counts the all-months lanes in month scope');
  assert.match(page, /\{ key: 'booked', value: doorValue\('booked'\)/);
  assert.match(page, /const pinCounts = `\$\{doorValue\('booked'\)/);
  // The list itself: the month's events, from every lane; "All months" beside it.
  assert.match(page, /if \(k === 'booked' && monthIds\) for \(const l of CUSTOMER_LANES\) subset\[l\] = lanes\[l\]\.filter\(\(r\) => monthIds\.has\(r\.eventId\)\);/);
  assert.match(page, /\{k === 'booked' \? <BookedMonthScope thisMonth=\{monthScoped\} \/> : null\}/, '"All months" is not offered over Booked');
});

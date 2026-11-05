/**
 * A couple's hand-typed record reads "asking" on the supplier's calendar until
 * the supplier agrees — it never holds the date (owner 2026-10-10).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { askingDates, pendingInquiryDates } from './vendor-inquiry-dates';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NONE: ReadonlySet<string> = new Set();
const thread = (event_id: string, inquiry_status: string, event_date: string | null) => ({
  event_id,
  inquiry_status,
  event: { event_date },
});

test('with no claimed record it is exactly the pending count it replaced', () => {
  const threads = [
    thread('e1', 'pending', '2026-12-18'),
    thread('e2', 'accepted', '2026-12-18'),
    thread('e3', 'pending', '2026-12-20'),
  ];
  assert.deepEqual(askingDates(threads, NONE), pendingInquiryDates(threads));
});

test('a claimed record’s date is asking even though its thread is open (a customer)', () => {
  const threads = [thread('e-own', 'accepted', '2026-12-18')];
  assert.deepEqual(pendingInquiryDates(threads), [], 'the pending rule alone would drop the date');
  assert.deepEqual(askingDates(threads, new Set(['e-own'])), [{ requestedDate: '2026-12-18', count: 1 }]);
});

test('one thread is one asking — a claimed record still pending is not counted twice', () => {
  const threads = [thread('e-own', 'pending', '2026-12-18'), thread('e2', 'pending', '2026-12-18')];
  assert.deepEqual(askingDates(threads, new Set(['e-own'])), [{ requestedDate: '2026-12-18', count: 2 }]);
});

test('an ended conversation asks about nothing, and a date we cannot read is dropped', () => {
  const own = new Set(['e1', 'e2', 'e3', 'e4', 'e5']);
  const threads = [
    thread('e1', 'declined', '2026-12-18'),
    thread('e2', 'withdrawn', '2026-12-18'),
    thread('e3', 'expired', '2026-12-18'),
    thread('e4', 'displaced', '2026-12-18'),
    thread('e5', 'accepted', null),
  ];
  assert.deepEqual(askingDates(threads, own), []);
});

test('"still asking" is read from the claimed link and ends at the supplier’s yes', () => {
  const read = code('lib/claimed-records-asking.server.ts');
  assert.match(read, /\.eq\('claimed_vendor_profile_id', vendorProfileId\)/);
  assert.match(read, /\.eq\('status', 'claimed'\)/);
  assert.match(read, /\.eq\('marketplace_vendor_id', vendorProfileId\)/, 'the booking rows must be scoped by the caller’s own shop');
  assert.match(read, /r\.lock_request_state !== 'agreed'/, 'only the supplier’s own yes ends the asking');
  // A failed read is reported, never returned as "nobody is asking".
  assert.match(read, /if \(inviteErr\) return \{ eventIds, error: inviteErr\.message \};/);
  assert.match(read, /if \(rowErr\) return \{ eventIds, error: rowErr\.message \};/);
  // It writes nothing: the date is never held by a record.
  assert.doesNotMatch(read, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(/);
});

// 🔗 BATCH 5 JOIN (2026-10-14). Customers › Dates (#6514, S-PR3) redrew the supplier's month: "Holding" (amber) is
// now every OPEN conversation — pending OR accepted — about a dated event that holds no seat (`openAsksOf` in
// `lib/vendor-dates.ts`, dates from one admin `events` read). A claimed couple's thread is opened `accepted`
// (`seatClaimedCoupleAsCustomer`), so the hand-typed record reads "asking" on the month until the supplier's yes
// books a seat — the same claim, held by #6514's one rule instead of a second read beside it.
test('the supplier’s month counts a claimed couple as asking until their date holds a seat (Dates, #6514)', async () => {
  const seat = code('lib/claimed-couple-is-a-customer.server.ts');
  assert.match(seat, /\.update\(\{ inquiry_status: 'accepted', accepted_at: /, 'the claimed couple’s thread is opened accepted');
  const { openAsksOf } = await import('./vendor-dates');
  const threads = [{ thread_id: 't-own', event_id: 'e-own', inquiry_status: 'accepted', created_at: '2026-10-01T00:00:00Z' }];
  const events = new Map([['e-own', { date: '2026-12-18', name: 'Cruz' }]]);
  assert.deepEqual(
    openAsksOf(threads, events, new Set()).map((a) => [a.eventId, a.date]),
    [['e-own', '2026-12-18']],
    'an accepted (claimed) couple with no seat must read as asking',
  );
  assert.deepEqual(openAsksOf(threads, events, new Set(['e-own'])), [], 'a date already held is not asking');
  const page = code('app/vendor-dashboard/customers/page.tsx');
  assert.match(page, /const bookedEventIds = new Set\(bookings\.map\(\(b\) => b\.eventId\)\);/);
  assert.match(page, /await readOpenAsks\(threadsRead\.threads, bookedEventIds\)/);
});

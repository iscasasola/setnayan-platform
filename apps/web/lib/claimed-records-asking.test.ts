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

test('the supplier’s calendar counts them, started with the page’s other reads, minus dates already held', () => {
  const page = code('app/vendor-dashboard/customers/page.tsx');
  assert.match(page, /readClaimedRecordEventsStillAsking\(createAdminClient\(\), vendorProfileId\),\s*\]\);/);
  assert.doesNotMatch(page, /await readClaimedRecordEventsStillAsking\(/, 'the read is awaited on its own line');
  assert.match(page, /const heldEventIds = new Set\(bookings\.map\(\(b\) => b\.eventId\)\);/);
  assert.match(page, /askingDates\(\s*threads,\s*new Set\(\[\.\.\.claimedAsking\.eventIds\]\.filter\(\(id\) => !heldEventIds\.has\(id\)\)\),\s*\)/);
  assert.match(page, /if \(claimedAsking\.error\) \{\s*logQueryError\(/);
});

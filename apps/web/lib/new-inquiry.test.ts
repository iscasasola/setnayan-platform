import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countNewInquiries, isNewInquiry } from './new-inquiry';
import { stripComments } from './strip-comments';

/**
 * CYC-14 (16 Nov 2026): supplier Today said "1 new inquiry" for a couple who had ALREADY BOOKED. The claim tested
 * here: an inquiry stops counting as new once it becomes a booking, or once the supplier answers it — on Today's
 * cards AND on the console badge, by one rule.
 * Sabotage: drop the booked check or the answered check from `isNewInquiry`, or count raw `pending` threads in
 * either surface again → red.
 */
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const asked = { inquiry_status: 'pending', event_id: 'ev-1', vendor_first_reply_at: null };

test('a pending, unanswered inquiry for an event not booked here is new', () => {
  assert.equal(isNewInquiry(asked, new Set()), true);
  assert.equal(countNewInquiries([asked], new Set()), 1);
});

test('the couple BOOKED this shop → the inquiry is no longer new (the CYC-14 case)', () => {
  assert.equal(isNewInquiry(asked, new Set(['ev-1'])), false);
  assert.equal(countNewInquiries([asked, { ...asked, event_id: 'ev-2' }], new Set(['ev-1'])), 1, 'only the unbooked one counts');
});

test('the supplier ANSWERED it → no longer new, even while the thread still reads pending', () => {
  assert.equal(isNewInquiry({ ...asked, vendor_first_reply_at: '2026-11-16T08:00:00Z' }, new Set()), false);
});

test('accepted, declined or withdrawn threads were never "new"', () => {
  for (const s of ['accepted', 'declined', 'withdrawn', 'expired']) {
    assert.equal(isNewInquiry({ ...asked, inquiry_status: s }, new Set()), false, s);
  }
});

test('Today\'s cards and the console badge both count by the one rule', () => {
  const overview = read('lib/vendor-overview.ts');
  assert.match(overview, /const bookedHere = new Set\(roomBookings\.map\(\(b\) => b\.eventId\)\);/);
  assert.match(overview, /const pendingThreads = threads\.filter\(\(t\) => isNewInquiry\(t, bookedHere\)\);/);
  assert.doesNotMatch(overview, /threads\.filter\(\(t\) => t\.inquiry_status === 'pending'\)/, 'Today counts raw pending threads again');
  const layout = read('app/vendor-dashboard/layout.tsx');
  // The #7898 audit: ONE exact head count — no row cap, no admin client in the layout.
  assert.match(layout, /\.select\('thread_id', \{ count: 'exact', head: true \}\)\s*\.eq\('vendor_profile_id', vp\.vendor_profile_id\)\s*\.eq\('inquiry_status', 'pending'\)\s*\.is\('vendor_first_reply_at', null\);/);
  assert.match(layout, /if \(booked\.length > 0\) q = q\.not\('event_id', 'in', `\(\$\{booked\.join\(','\)\}\)`\);/, 'the badge counts booked events again');
  assert.match(layout, /supabase\.rpc\('current_vendor_booked_event_ids'\)/);
  assert.doesNotMatch(layout, /createAdminClient/, 'the layout reads with the admin client again');
  assert.doesNotMatch(layout, /\.limit\(200\)/, 'the badge is silently capped again');
});

test('the booked ids are read in either PostgREST shape, and only uuid-shaped ids reach the filter', async () => {
  const { bookedEventIdsOf } = await import('./new-inquiry');
  const a = '11111111-2222-3333-4444-555555555555';
  assert.deepEqual(bookedEventIdsOf([a, a]), [a]);
  assert.deepEqual(bookedEventIdsOf([{ current_vendor_booked_event_ids: a }]), [a]);
  assert.deepEqual(bookedEventIdsOf(['x),(evil', null, 3]), []);
  assert.deepEqual(bookedEventIdsOf(null), []);
});

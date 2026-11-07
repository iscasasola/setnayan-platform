/**
 * shop-review-door.test.ts — the printed Reviews code opens WRITE A REVIEW (owner 2026-11-06, "Write a review").
 *
 * Every branch of `/v/<slug>/review` against stubbed clients: signed out → sign in and come back; one ready booking →
 * its "Leave a review"; several → the most recent event's; none → the shop's reviews; a renamed shop → the door on its
 * new address; and the honest-read rule (lib/guests-read-is-honest.test.ts): a REFUSED read lands on the shop's
 * reviews — never a 404, never a silent "no booking".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickReviewBooking, readReviewDoor, reviewDoorPath, reviewDoorTarget, type ReviewBookingRow, type ReviewDoor } from '@/lib/shop-review-door';
import { safeNext } from '@/lib/safe-next';
import { stripComments } from '@/lib/strip-comments';

type Result = { data: unknown; error: unknown };

/** A thenable query builder answering per table; records the filters each table was read with. */
function stub(byTable: Record<string, Result | (() => never)>, seen: Record<string, string[]> = {}): SupabaseClient {
  return {
    from(table: string) {
      const log = (seen[table] ??= []);
      const answer = () => {
        const r = byTable[table];
        if (typeof r === 'function') return r();
        return r ?? { data: null, error: { message: `unexpected read of ${table}` } };
      };
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'ilike', 'in', 'is', 'order', 'limit']) {
        b[m] = (...args: unknown[]) => {
          log.push(`${m}:${JSON.stringify(args)}`);
          return b;
        };
      }
      b.maybeSingle = () => Promise.resolve().then(answer);
      b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve().then(answer).then(resolve, reject);
      return b;
    },
  } as unknown as SupabaseClient;
}

const NOW = Date.parse('2026-11-06T00:00:00Z');
const SHOP = { data: { vendor_profile_id: 'vp1', business_slug: 'saysay' }, error: null };
const MEMBERS = {
  data: [
    { event_id: 'evOld', events: { event_date: '2026-03-01' } },
    { event_id: 'evNew', events: [{ event_date: '2026-10-20' }] },
    { event_id: 'evNext', events: { event_date: '2027-05-01' } },
  ],
  error: null,
};
const done = (event_id: string, vendor_id: string): ReviewBookingRow => ({
  event_id,
  vendor_id,
  status: 'complete',
  completion_status: null,
  service_marked_complete_at: null,
  customer_confirmed_received_at: null,
});
const notYet = (event_id: string, vendor_id: string): ReviewBookingRow => ({ ...done(event_id, vendor_id), status: 'booked' });
const noRename = async (): Promise<string | null> => null;
const REFUSED = { data: null, error: { code: '42501', message: 'permission denied for table event_vendors' } };

const door = (user: SupabaseClient, admin: SupabaseClient, userId: string | null = 'u1', renamed = noRename) =>
  readReviewDoor({ supabase: user, admin }, 'saysay', userId, renamed, NOW);

test('signed out → the login page, returning to this same door (its own `next`, and it passes safeNext)', async () => {
  const d = await door(stub({}), stub({}), null);
  assert.deepEqual(d, { kind: 'sign_in', next: '/v/saysay/review' });
  const target = reviewDoorTarget(d);
  assert.equal(target, '/login?next=%2Fv%2Fsaysay%2Freview');
  assert.equal(safeNext(new URLSearchParams(target.split('?')[1]).get('next')), '/v/saysay/review');
});

test('one booking ready for a review → that booking\'s "Leave a review"', async () => {
  const seen: Record<string, string[]> = {};
  const d = await door(stub({ event_members: MEMBERS, event_vendors: { data: [done('evNew', 'ev-v1')], error: null } }, seen), stub({ vendor_profiles: SHOP }));
  assert.deepEqual(d, { kind: 'review', eventId: 'evNew', vendorId: 'ev-v1' });
  assert.equal(reviewDoorTarget(d), '/dashboard/evNew/vendors/ev-v1/review');
  // Only events this person HOSTS, only this shop's bookings, removed ones excluded.
  assert.ok(seen.event_members!.includes('eq:["member_type","couple"]'));
  assert.ok(seen.event_members!.includes('eq:["user_id","u1"]'));
  assert.ok(seen.event_vendors!.includes('eq:["marketplace_vendor_id","vp1"]'));
  assert.ok(seen.event_vendors!.includes('in:["event_id",["evOld","evNew","evNext"]]'));
  assert.ok(seen.event_vendors!.includes('is:["archived_at",null]'));
});

test('several ready bookings → the most recent event\'s', async () => {
  const d = await door(
    stub({ event_members: MEMBERS, event_vendors: { data: [done('evOld', 'a'), done('evNew', 'b'), notYet('evNext', 'c')], error: null } }),
    stub({ vendor_profiles: SHOP }),
  );
  assert.deepEqual(d, { kind: 'review', eventId: 'evNew', vendorId: 'b' });
});

test('"marked done, awaiting your Yes" counts as ready — the review page\'s first step is that Yes', () => {
  const awaiting = { ...notYet('evNew', 'x'), service_marked_complete_at: '2026-11-04T00:00:00Z' };
  const dates = new Map([['evNew', '2026-11-01']]);
  assert.equal(pickReviewBooking([awaiting], dates, NOW)?.vendor_id, 'x');
  assert.equal(pickReviewBooking([{ ...awaiting, completion_status: 'disputed' }], dates, NOW), null);
});

test('no booking ready (event still ahead) → the shop\'s reviews, to read', async () => {
  const d = await door(stub({ event_members: MEMBERS, event_vendors: { data: [notYet('evNext', 'c')], error: null } }), stub({ vendor_profiles: SHOP }));
  assert.deepEqual(d, { kind: 'read', slug: 'saysay', reason: 'no_booking' });
  assert.equal(reviewDoorTarget(d), '/v/saysay#reviews');
});

test('hosts no event at all → the shop\'s reviews, and no booking read is made', async () => {
  const seen: Record<string, string[]> = {};
  const d = await door(stub({ event_members: { data: [], error: null } }, seen), stub({ vendor_profiles: SHOP }));
  assert.deepEqual(d, { kind: 'read', slug: 'saysay', reason: 'no_booking' });
  assert.equal(seen.event_vendors, undefined);
});

for (const [what, user, admin] of [
  ['the shop read', stub({}), stub({ vendor_profiles: { data: null, error: { message: 'timeout' } } })],
  ['the events read', stub({ event_members: REFUSED }), stub({ vendor_profiles: SHOP })],
  ['the bookings read', stub({ event_members: MEMBERS, event_vendors: REFUSED }), stub({ vendor_profiles: SHOP })],
  ['a read that THROWS', stub({ event_members: () => { throw new Error('fetch failed'); } }), stub({ vendor_profiles: SHOP })],
] as const) {
  test(`a REFUSED ${what} → the shop's reviews (read_failed), never a 404 and never "no booking"`, async () => {
    const d: ReviewDoor = await door(user, admin);
    assert.equal(d.kind, 'read');
    assert.equal((d as Extract<ReviewDoor, { kind: 'read' }>).reason, 'read_failed');
    assert.equal(reviewDoorTarget(d), '/v/saysay#reviews');
  });
}

test('a renamed shop → the same door on its new address; a genuinely missing one → the shop page (which 404s itself)', async () => {
  const moved = await door(stub({}), stub({ vendor_profiles: { data: null, error: null } }), 'u1', async () => '/saysay-events');
  assert.deepEqual(moved, { kind: 'moved', slug: 'saysay-events' });
  assert.equal(reviewDoorTarget(moved), '/v/saysay-events/review');
  const missing = await door(stub({}), stub({ vendor_profiles: { data: null, error: null } }));
  assert.deepEqual(missing, { kind: 'read', slug: 'saysay', reason: 'missing_shop' });
});

test('the route decides nothing itself — it hands every branch to readReviewDoor and never notFound()s', () => {
  const src = stripComments(readFileSync(new URL('../app/v/[slug]/review/route.ts', import.meta.url), 'utf8'));
  assert.equal((src.match(/readReviewDoor\(/g) ?? []).length, 1);
  assert.equal((src.match(/NextResponse\.redirect\(/g) ?? []).length, 1);
  assert.doesNotMatch(src, /notFound\(/);
  assert.match(src, /is_anonymous/, 'a guest pass must sign in like a stranger');
  assert.equal(reviewDoorPath('saysay'), '/v/saysay/review');
});

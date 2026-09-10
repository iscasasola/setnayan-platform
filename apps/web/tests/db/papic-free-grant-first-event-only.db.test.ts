/**
 * The Papic free pool grant is account-scoped, not event-scoped: an account's
 * FIRST event ever gets the admin-configured allowance (owner-confirmed
 * 2026-09-04); every event after that gets a minimal 1-point free_grant row
 * instead of the full allowance.
 *
 * 🔑 WHY THIS TESTS THE TRIGGER, NOT THE APP CODE. The real seeding mechanism
 * is the `papic_seed_free_grant_trg` AFTER INSERT trigger — originally on
 * `public.events` (migration 20270902100836), moved by 20271204225094 to
 * `public.event_members` (member_type='couple') because `events` carries no
 * owner column and can never know "is this account's first event". No amount
 * of TypeScript around `ensureFreePapicPoolGrantAdmin` can prove this: the
 * trigger fires regardless of insertion path (raw SQL, a backfill script, any
 * future call site) and the app-layer insert is racing it, not driving it.
 *
 * 🔑 WHY 1 POINT, NOT 0. `papic_event_pool_status()` (migration
 * 20271185813837) fences on `SUM(points) > 0`, not on row existence — a
 * 0-point row would be indistinguishable from no grant at all and silently
 * revert the event to unmetered. See papic-free-grant.ts's docblock for the
 * full account.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

// event_type deliberately avoids 'wedding': events_wedding_fields_consistency
// requires ceremony_type + venue_setting to travel together with it, which is
// orthogonal to what this suite tests.
async function makeEvent(displayName: string, eventType = 'birthday'): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, $2) RETURNING event_id`,
    [displayName, eventType],
  );
  return ev.rows[0]!.event_id;
}

let userSeq = 0;
async function newUser(): Promise<string> {
  userSeq += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`papic-free-grant-${userSeq}@test.local`],
  );
  return r.rows[0]!.id;
}

async function joinAsCouple(eventId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
}

async function grantFor(eventId: string): Promise<{ points: number } | undefined> {
  const res = await db.query<{ points: number }>(
    `SELECT points FROM public.papic_event_point_grants
      WHERE event_id = $1 AND source = 'free_grant'`,
    [eventId],
  );
  return res.rows[0];
}

test('an account\'s FIRST event ever: the trigger grants the full allowance', async () => {
  const userId = await newUser();
  const eventId = await makeEvent('First event, first account', 'anniversary');
  await joinAsCouple(eventId, userId);

  const grant = await grantFor(eventId);
  assert.ok(grant, 'expected the trigger to seed a free_grant row');
  assert.equal(grant!.points, 50, 'first event ever should get the full allowance');
});

test('the SAME account\'s SECOND event, a DIFFERENT event_type: fenced at the 1-point minimum', async () => {
  const userId = await newUser();
  const firstEventId = await makeEvent('Account f2, first event', 'simple_event');
  await joinAsCouple(firstEventId, userId);
  assert.equal((await grantFor(firstEventId))!.points, 50);

  // Different event_type on purpose — per-type would have been a farming
  // loophole (16 event_types x 50 points on one account). Must still be fenced.
  const secondEventId = await makeEvent('Account f2, second event, different type', 'anniversary');
  await joinAsCouple(secondEventId, userId);

  const secondGrant = await grantFor(secondEventId);
  assert.ok(secondGrant, 'a repeat event must still get a fencing row, not no row at all');
  assert.equal(
    secondGrant!.points,
    1,
    'second event for the same account must be fenced at the 1-point minimum, not 50 and not 0',
  );
});

test('the 1-point minimum still fences the event — applies=TRUE, remaining=1, never "unmetered"', async () => {
  const userId = await newUser();
  const firstEventId = await makeEvent('Account f3, first event', 'debut');
  await joinAsCouple(firstEventId, userId);
  const secondEventId = await makeEvent('Account f3, second event', 'debut');
  await joinAsCouple(secondEventId, userId);
  assert.equal((await grantFor(secondEventId))!.points, 1);

  const status = await db.query<{ applies: boolean; remaining_points: number }>(
    `SELECT applies, remaining_points FROM public.papic_event_pool_status($1)`,
    [secondEventId],
  );
  const row = status.rows[0]!;
  // The whole point of the 1-point row: a 0-point row (or no row) would leave
  // applies FALSE and papic_reserve_event_points() takes its "fence absent ->
  // allow" branch, i.e. unmetered capture.
  assert.equal(row.applies, true, 'the 1-point minimum must still flip applies=TRUE');
  assert.equal(row.remaining_points, 1);
});

test('a DIFFERENT account\'s first event is unaffected by another account\'s history', async () => {
  const userA = await newUser();
  const userB = await newUser();

  const aEvent = await makeEvent('Account A, first event', 'debut');
  await joinAsCouple(aEvent, userA);
  assert.equal((await grantFor(aEvent))!.points, 50);

  const bEvent = await makeEvent('Account B, first event, unrelated to A', 'debut');
  await joinAsCouple(bEvent, userB);
  assert.equal(
    (await grantFor(bEvent))!.points,
    50,
    'account B has no prior events of its own and must get the full allowance',
  );
});

test('a non-couple event_members row (guest, vendor, coordinator) never seeds a grant', async () => {
  const eventId = await makeEvent('Non-couple member insert');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'vendor')`,
    [eventId, await newUser()],
  );
  const grant = await grantFor(eventId);
  assert.equal(grant, undefined, 'a vendor/guest/coordinator join must not trigger the free grant');
});

test('an event with no couple member yet has no grant — confirms events alone no longer seeds it', async () => {
  const eventId = await makeEvent('Bare event, no members at all');
  const grant = await grantFor(eventId);
  assert.equal(grant, undefined);
  const status = await db.query<{ applies: boolean }>(
    `SELECT applies FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  assert.equal(status.rows[0]!.applies, false);
});

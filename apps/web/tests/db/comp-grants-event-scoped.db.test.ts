/**
 * A comp grant can be scoped to ONE event — and a NULL event_id still means
 * every event the user hosts.
 *
 * 🔑 WHY THIS IS A DB TEST. Before migration 20271205612762, `comp_grants` was
 * user-scoped only: `event_has_comp_for_sku()` resolved a grant through
 * "any host of this event", with no per-event filter at all. A comp meant for
 * a couple's wedding therefore unlocked their earlier debut too. The fix lives
 * entirely inside two SECURITY DEFINER SQL functions; no TypeScript can see
 * whether they honour `event_id`, and a stubbed client would "pass" against
 * a mock that never ran the predicate.
 *
 * Run: cd apps/web && npx tsx --test tests/db/comp-grants-event-scoped.db.test.ts
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

let seq = 0;
async function newUser(): Promise<string> {
  seq += 1;
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`comp-scope-${seq}@test.local`],
  );
  return r.rows[0]!.id;
}

/** A non-wedding event: the wedding CHECK wants ceremony fields this suite does not test. */
async function hostedEvent(userId: string, name: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, userId],
  );
  return eventId;
}

async function grant(userId: string, eventId: string | null, skus: string[] | null) {
  await db.query(
    `INSERT INTO public.comp_grants (user_id, event_id, source, scope, scoped_skus, rationale)
     VALUES ($1, $2, 'external_promo', $3, $4, 'test: event-scoped comp grant, twenty chars')`,
    [userId, eventId, skus ? 'specific_skus' : 'all_services', skus],
  );
}

const has = async (eventId: string, sku: string) =>
  (
    await db.query<{ ok: boolean }>(`SELECT public.event_has_comp_for_sku($1, $2) AS ok`, [
      eventId,
      sku,
    ])
  ).rows[0]!.ok;

const activeSkus = async (eventId: string) =>
  (await db.query<{ s: string[] }>(`SELECT public.event_comp_active_skus($1) AS s`, [eventId]))
    .rows[0]!.s;

test('the column exists and is nullable — a grant with no event_id still inserts', async () => {
  const u = await newUser();
  await hostedEvent(u, 'nullable check');
  await assert.doesNotReject(grant(u, null, ['PAPIC_ONE_50']));
});

test('an event-scoped grant unlocks THAT event and not the same host\'s other event', async () => {
  const u = await newUser();
  const wedding = await hostedEvent(u, 'the one being comped');
  const debut = await hostedEvent(u, 'the earlier debut');
  await grant(u, wedding, ['PAPIC_ONE_50']);

  assert.equal(await has(wedding, 'PAPIC_ONE_50'), true, 'the scoped event must be unlocked');
  assert.equal(
    await has(debut, 'PAPIC_ONE_50'),
    false,
    'the SAME host\'s other event must stay locked — this is the whole bug',
  );
  assert.deepEqual(await activeSkus(wedding), ['PAPIC_ONE_50']);
  assert.deepEqual(await activeSkus(debut), [], 'the batch function must agree with the gate');
});

test('a NULL event_id keeps the old meaning — every event the host has', async () => {
  const u = await newUser();
  const a = await hostedEvent(u, 'account-wide A');
  const b = await hostedEvent(u, 'account-wide B');
  await grant(u, null, ['SEATING_3D']);

  assert.equal(await has(a, 'SEATING_3D'), true);
  assert.equal(await has(b, 'SEATING_3D'), true);
});

test('event_id is a filter on top of the host check, never a bypass of it', async () => {
  // A grant pointing at an event its user does NOT host must unlock nothing —
  // neither for the real host nor for the grantee.
  const host = await newUser();
  const stranger = await newUser();
  const ev = await hostedEvent(host, 'somebody else\'s party');
  await hostedEvent(stranger, 'the stranger has an event too');
  await grant(stranger, ev, ['PAPIC_ONE_50']);

  assert.equal(await has(ev, 'PAPIC_ONE_50'), false, 'the grantee is not a host of that event');
});

test('an all_services grant scoped to one event does not spill to the other', async () => {
  const u = await newUser();
  const comped = await hostedEvent(u, 'all services here');
  const other = await hostedEvent(u, 'nothing here');
  await grant(u, comped, null);

  assert.equal(await has(comped, 'ANY_SKU_AT_ALL'), true);
  assert.equal(await has(other, 'ANY_SKU_AT_ALL'), false);
  assert.deepEqual(await activeSkus(other), []);
});

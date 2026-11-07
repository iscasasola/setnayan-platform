/**
 * THE PAPIC UNLOCK PASS AND THE PAPIC_SEATS PACK GIVE NOTHING AWAY ANY MORE.
 *
 * Owner, 2026-11-05, asked whether anybody still holds either: "no one. remove
 * both". Both were already off sale; what was left was what they still DID for
 * an event holding one. Migration 20271309535584 takes the database half out:
 *
 *   1. an active PAPIC_UNLOCK order no longer lifts a guest's per-guest number
 *      in papic_record_guest_capture;
 *   2. it no longer counts as a "flat pass" that sizes a pool by head count;
 *   3. papic_provision_seats (the pack's five-seat minting RPC) is gone.
 *
 * Each test seeds the exact order that used to unlock the behaviour, so a
 * regression that brings any of it back turns this file red.
 *
 * The seat-camera half (a pack seat or an Unlock event recording at cost 0)
 * is app code, pinned by lib/papic-unlock-and-seats-pack-are-gone.test.ts.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

/** An event with NO pool (no couple member ⇒ no free grant, no grants at all),
 *  so the only thing that could lift a guest's number is the Unlock pass. */
async function eventWithoutPool(): Promise<{ eventId: string; userId: string }> {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`unlock-gone ${n}`],
  );
  const userId = await one<string>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [
    `unlock-gone-${n}@example.test`,
  ]);
  return { eventId, userId };
}

async function paidOrder(eventId: string, userId: string, serviceKey: string): Promise<void> {
  n += 1;
  await db.query(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, $3, 1, 'paid', $4)`,
    [eventId, userId, serviceKey, `GONE-${n}`],
  );
}

async function guest(eventId: string): Promise<string> {
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, ugc_terms_accepted_at)
     VALUES ($1, 'Ana', 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId],
  );
}

const shoot = (guestId: string, cost: number) =>
  one<{ status: string; unlimited?: boolean }>(
    `SELECT public.papic_record_guest_capture($1, $2, false, 'photo', NULL, NULL, $3)`,
    [guestId, `r2://media/unlock-gone/${Math.random()}`, cost],
  );

test('1 · an Unlock pass no longer lifts a guest past the per-guest number', async () => {
  const { eventId, userId } = await eventWithoutPool();
  // PAPIC_GUEST so the guest may shoot at all on an event with no pool; then the
  // pass that used to make her unlimited.
  await paidOrder(eventId, userId, 'PAPIC_GUEST');
  await paidOrder(eventId, userId, 'PAPIC_UNLOCK');
  const g = await guest(eventId);

  const applies = await one<boolean>(`SELECT applies FROM public.papic_event_pool_status($1)`, [eventId]);
  assert.equal(applies, false, 'a pool applies here — the test would not isolate the Unlock pass');

  const small = await shoot(g, 1);
  assert.equal(small.status, 'ok', 'an ordinary shot was refused — the fixture is wrong, not the rule');
  assert.equal(small.unlimited, false, 'the Unlock pass still reports this guest as unlimited');

  // One shot priced past the platform's per-guest number. With the pass lifting
  // the limit this was 'ok'; now it is refused like on any other event.
  const big = await shoot(g, 1000);
  assert.equal(big.status, 'quota_exhausted', 'the Unlock pass still lets a guest past the per-guest number');
});

test('2 · an Unlock pass is no longer a flat pass that sizes a pool', async () => {
  const { eventId, userId } = await eventWithoutPool();
  await paidOrder(eventId, userId, 'PAPIC_UNLOCK');
  await paidOrder(eventId, userId, 'PAPIC_UNLOCK_LTD');

  assert.equal(await one<boolean>(`SELECT public.papic_event_has_flat_pass($1)`, [eventId]), false);
  const r = await db.query<{ applies: boolean; base_points: number; total_points: number }>(
    `SELECT applies, base_points, total_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  assert.equal(r.rows[0]?.applies, false, 'the pass still conjures a pool sized by head count');

  const codes = await one<string[]>(
    `SELECT pass_service_codes FROM public.papic_event_pool_config WHERE config_key = 'default'`,
  );
  assert.deepEqual(codes, [], 'a flat pass is still configured');
});

test('3 · the pack’s seat-minting RPC is gone', async () => {
  const fn = await one<string | null>(`SELECT to_regprocedure('public.papic_provision_seats(uuid)')::text`);
  assert.equal(fn, null, 'papic_provision_seats still exists — the retired pack can still mint seats');
});

test('4 · no live function still reads the Unlock pass by its code', async () => {
  const r = await db.query<{ proname: string }>(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public' AND p.prosrc ~ $1`,
    ["service_key\\s*=\\s*'PAPIC_UNLOCK"],
  );
  assert.deepEqual(r.rows.map((x) => x.proname), []);
});

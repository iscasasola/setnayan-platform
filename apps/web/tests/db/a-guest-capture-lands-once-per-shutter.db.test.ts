/**
 * A GUEST CAPTURE LANDS ONCE PER SHUTTER — event-day L1·2 (migration
 * 20271272777206), `papic_record_guest_capture` run against the REPLAYED schema.
 *
 * Before: a retry after a lost answer (bad venue signal — the phone never heard
 * "saved") recorded the same shot again: two rows, and the cost metered twice
 * against the couple's per-guest ceiling. Now the phone's shutter id rides
 * every retry and the offline queue, and the function answers a repeat with the
 * FIRST row and charges nothing.
 *
 * PGlite is one session, so the race is not staged; the property the guest's
 * advisory lock protects is — the second call, made after the first committed,
 * adds no row and no spend. The lock + order is held to the SQL by the last test.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the duplicate branch removed → the migration's own assertion refuses to
 *     apply, every test red;
 *   • the duplicate branch moved after the meters (before the INSERT) → test 4 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

const MIGRATION = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '20271272777206_a_guest_capture_lands_once_per_shutter.sql');

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

type Reply = { status: string; duplicate?: boolean; capture_id?: string; used?: number; remaining?: number };

async function seedGuest(): Promise<string> {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [`once per shutter ${n}`],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note) VALUES ($1, 5000, 'admin', 'once per shutter')`,
    [eventId],
  );
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, ugc_terms_accepted_at)
     VALUES ($1, $2, 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId, `Shutter${n}`],
  );
}

async function capture(guestId: string, clientId: string | null, cost = 1): Promise<Reply> {
  return one<Reply>(
    `SELECT public.papic_record_guest_capture(
       p_guest_id => $1, p_r2_object_key => $2, p_media_type => 'photo',
       p_points_cost => $3, p_client_capture_id => $4::uuid)`,
    [guestId, `r2://media/papic/guest/${guestId}/papic-${clientId ?? Math.random()}.jpg`, cost, clientId],
  );
}
const rows = async (guestId: string) =>
  one<number>(`SELECT COUNT(*)::int FROM public.papic_guest_captures WHERE guest_id = $1`, [guestId]);
const spent = async (guestId: string) =>
  one<number>(`SELECT COALESCE(SUM(points_cost), 0)::int FROM public.papic_guest_captures WHERE guest_id = $1`, [guestId]);

const ID_A = '0b6e2a4c-1f3d-4e5a-9b7c-8d9e0f1a2b3c';
const ID_B = '1c7f3b5d-2a4e-4f6b-8c8d-9e0f1a2b3c4d';

test('the same shutter sent twice is ONE row and ONE spend — the second answers with the first', async () => {
  const g = await seedGuest();
  const first = await capture(g, ID_A, 7);
  const again = await capture(g, ID_A, 7);
  assert.equal(first.status, 'ok');
  assert.equal(first.duplicate, false);
  assert.ok(first.capture_id, 'the reply no longer names the row it wrote');
  assert.equal(again.status, 'ok', 'a retry of a landed shot was refused');
  assert.equal(again.duplicate, true, 'a retry recorded a second capture');
  assert.equal(again.capture_id, first.capture_id);
  assert.equal(await rows(g), 1);
  assert.equal(await spent(g), 7, 'the retry was charged again');
  assert.equal(again.used, first.used, 'the retry reports a different spend than the first');
});

test('two different shutters are two captures', async () => {
  const g = await seedGuest();
  await capture(g, ID_A);
  await capture(g, ID_B);
  assert.equal(await rows(g), 2);
});

test('a camera that sends no id records exactly as before', async () => {
  const g = await seedGuest();
  assert.equal((await capture(g, null)).status, 'ok');
  assert.equal((await capture(g, null)).status, 'ok');
  assert.equal(await rows(g), 2);
});

test('the repeat is asked inside the guest’s lock, before any meter and before the insert', () => {
  const sql = readFileSync(MIGRATION, 'utf8').replace(/--[^\n]*/g, '');
  const lock = sql.indexOf('PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_id::text, 0));');
  const ask = sql.indexOf('client_capture_id = p_client_capture_id');
  // The two refusals a retry must never meet: the couple's ceiling and the flat 150.
  const meters = ["'reason', 'guest_spend_ceiling'", "'reason', 'per_guest_credits'"].map((m) => sql.indexOf(m));
  const insert = sql.indexOf('INSERT INTO public.papic_guest_captures');
  assert.ok(lock > -1 && ask > -1 && insert > -1, 'a landmark moved — re-point this guard');
  assert.ok(lock < ask, 'the repeat is asked outside the lock');
  assert.ok(ask < insert, 'the repeat is asked after the insert');
  meters.forEach((m) => assert.ok(m > -1 && ask < m, 'the repeat is asked after a meter — a retry at the cap would be refused for a shot that landed'));
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS papic_guest_captures_client_capture_uniq\s+ON public\.papic_guest_captures \(guest_id, client_capture_id\)/);
});

test('one writer, and the guest camera can still call it', async () => {
  assert.equal(
    await one<number>(`SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'papic_record_guest_capture'`),
    1,
  );
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(
      await one<boolean>(
        `SELECT has_function_privilege($1, 'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer,timestamp with time zone,uuid)', 'EXECUTE')`,
        [role],
      ),
      true,
      `${role} lost EXECUTE`,
    );
  }
});

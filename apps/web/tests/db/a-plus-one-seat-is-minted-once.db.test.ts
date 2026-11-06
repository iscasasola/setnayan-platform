/**
 * A PLUS-ONE SEAT IS MINTED ONCE — event-day L1·1 (migration 20271272305444,
 * `public.guest_plus_one_seat_mint`), run against the REPLAYED schema.
 *
 * Before: `nameTheSeats` read the bringer's seats, planned, then inserted one
 * `guests` row per new name. Two submits of one reply (double tap · a retry
 * after a lost answer · two tabs) each planned the same create and each
 * inserted — the same +1 twice, and past the couple's count with a +2.
 *
 * PGlite runs one session, so the RACE itself cannot be staged here. What is
 * proved instead is the property the lock protects: the SECOND call — the one
 * a racing submit makes after the first committed — finds the seat and adds
 * nothing, and the count is asked inside the function, not taken from the
 * caller. The lock is held to the SQL by the last test.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18):
 *   • the same-name lookup removed from the function       → test 1 red (2 rows);
 *   • the `v_live >= v_allowed` refusal removed            → tests 2 + 3 red;
 *   • `pg_advisory_xact_lock` removed from the function    → test 5 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';

const MIGRATION = join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '20271272305444_a_plus_one_seat_is_minted_under_a_lock.sql');

async function bringer(first: string, count: number): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_count)
     VALUES ($1, $2, 'Reyes', 'both', 'friends', $3) RETURNING guest_id`,
    [EVENT, first, count],
  );
  return g.rows[0]!.guest_id;
}
async function mint(bringerId: string, first: string, last: string): Promise<{ status: string; guest_id?: string; existing?: boolean }> {
  const r = await db.query<{ out: { status: string; guest_id?: string; existing?: boolean } }>(
    `SELECT public.guest_plus_one_seat_mint($1, $2, $3::jsonb) AS out`,
    [EVENT, bringerId, JSON.stringify({ first_name: first, last_name: last, meal_preference: 'fish', plus_one_name_confirmed_at: new Date().toISOString() })],
  );
  return r.rows[0]!.out;
}
async function seats(bringerId: string): Promise<Array<{ first_name: string; side: string; meal_preference: string | null }>> {
  return (
    await db.query<{ first_name: string; side: string; meal_preference: string | null }>(
      `SELECT first_name, side::text AS side, meal_preference::text AS meal_preference
         FROM public.guests WHERE plus_one_of_guest_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [bringerId],
    )
  ).rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Ana and Ben', 'birthday', 'ana-and-ben') RETURNING event_id`,
  );
  EVENT = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

test('the same name sent twice is ONE seat — the second call returns the first', async () => {
  const nene = await bringer('Nene', 2);
  const a = await mint(nene, 'Carla', 'Cruz');
  const b = await mint(nene, ' carla ', 'CRUZ');
  assert.equal(a.status, 'ok');
  assert.equal(a.existing, false);
  assert.equal(b.status, 'ok');
  assert.equal(b.existing, true, 'a second submit of the same name made another seat');
  assert.equal(b.guest_id, a.guest_id);
  // Nene's +2 is two rows from the start (the database mints them with the number — 20271281805227); the
  // name fills one of them, ONCE, and the other is still waiting.
  const rows = await seats(nene);
  assert.equal(rows.length, 2, `expected Nene's two seats, found ${rows.length}`);
  const carla = rows.filter((r) => r.first_name === 'Carla');
  assert.equal(carla.length, 1, `expected one Carla, found ${carla.length}`);
  assert.equal(carla[0]!.side, 'both', 'the seat did not take the bringer’s side');
  assert.equal(carla[0]!.meal_preference, 'fish', 'the seat’s own answer was dropped');
});

test('never past the couple’s count — a +1 asked for a second name is `full`', async () => {
  const jun = await bringer('Jun', 1);
  assert.equal((await mint(jun, 'Lia', 'Santos')).status, 'ok');
  const second = await mint(jun, 'Mara', 'Lopez');
  assert.equal(second.status, 'full');
  assert.equal((await seats(jun)).length, 1);
});

test('a guest the couple gave no seat mints nothing, whatever the form posts', async () => {
  const solo = await bringer('Solo', 0);
  assert.equal((await mint(solo, 'Crafted', 'Post')).status, 'full');
  assert.equal((await seats(solo)).length, 0);
});

test('only the server can call it', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_function_privilege($1, 'public.guest_plus_one_seat_mint(uuid, uuid, jsonb)', 'EXECUTE') AS ok`,
      [role],
    );
    assert.equal(r.rows[0]!.ok, false, `${role} may mint seats`);
  }
});

test('the plan and the write are one call under a lock on the bringer', () => {
  const sql = readFileSync(MIGRATION, 'utf8').replace(/--[^\n]*/g, '');
  const lock = sql.indexOf('pg_advisory_xact_lock');
  assert.ok(lock > -1, 'the mint takes no lock');
  assert.match(sql.slice(lock, lock + 120), /p_bringer_guest_id/, 'the lock is not keyed on the bringer');
  assert.ok(lock < sql.indexOf('SELECT plus_one_allowed'), 'the allowance is read before the lock');
  assert.ok(lock < sql.indexOf('INSERT INTO public.guests'), 'the insert is outside the lock');
  // …and the reply no longer inserts a seat itself.
  const actions = readFileSync(join(__dirname, '..', '..', 'app', '[slug]', 'actions.ts'), 'utf8');
  const fn = actions.slice(actions.indexOf('async function nameTheSeats('), actions.indexOf('async function eraseGuestFaceData('));
  assert.ok(fn.length > 500, 'nameTheSeats moved — re-point this guard');
  assert.doesNotMatch(fn, /from\('guests'\)\s*\.insert\(/, 'a seat is inserted outside the locked writer again');
  assert.match(fn, /rpc\('guest_plus_one_seat_mint'/);
});

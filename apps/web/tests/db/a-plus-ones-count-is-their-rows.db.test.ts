/**
 * 🪑 A GUEST'S +N IS THEIR +1 ROWS — after ANY write of the number (migration 20271281805227), and the one-time
 * backfill (20271282098748) mints what was missing, twice-run to the same result. Run against the REPLAYED schema.
 *
 * Owner, verbatim, 2026-10-21: "why does Ronald Dane Llarena have a +1 but no row under him" → "fix it".
 *
 * THE PROPERTY: after any write, a guest's live +1 rows = max(their number, their NAMED +1s) — the number never
 * stands without its rows, and a number never removes a named person (owner 2026-09-29: "3 named · 1 allowed").
 * Writers covered by construction (the database does it): insert with a number, the number changed, the old on/off
 * box, lowered, raised, to zero — whoever wrote it.
 *
 * 🛡 SABOTAGED, each seen RED, then restored (2026-10-21) — see the PR body for the run.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

const BACKFILL = path.join(__dirname, '..', '..', '..', '..', 'supabase', 'migrations', '20271282098748_backfill_missing_plus_one_seats_owner_ruled_2026_10_21.sql');

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';

async function guest(first: string, cols: Record<string, unknown> = {}): Promise<string> {
  const keys = ['event_id', 'first_name', 'last_name', 'side', 'group_category', ...Object.keys(cols)];
  const vals = [EVENT, first, 'Loo', 'groom', 'family', ...Object.values(cols)];
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING guest_id`,
    vals,
  );
  return r.rows[0]!.guest_id;
}
type Seat = { guest_id: string; first_name: string; display_name: string | null; side: string; named: boolean };
async function seats(bringer: string): Promise<Seat[]> {
  return (
    await db.query<Seat>(
      `SELECT guest_id, first_name, display_name, side::text AS side, plus_one_name_confirmed_at IS NOT NULL AS named
         FROM public.guests WHERE plus_one_of_guest_id = $1 AND deleted_at IS NULL ORDER BY created_at, display_name`,
      [bringer],
    )
  ).rows;
}
const setCount = (id: string, n: number) => db.query(`UPDATE public.guests SET plus_one_count = $1 WHERE guest_id = $2`, [n, id]);
async function holds(id: string) {
  const n = (await db.query<{ c: number }>(`SELECT plus_one_count AS c FROM public.guests WHERE guest_id = $1`, [id])).rows[0]!.c;
  const s = await seats(id);
  assert.equal(s.length, Math.max(n, s.filter((x) => x.named).length), `+${n} with ${s.length} live rows`);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Cale and Ice', 'birthday', 'cale-and-ice') RETURNING event_id`,
  );
  EVENT = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

test('a guest added with +3 has three "TBA" rows, in their side, numbered by seat', async () => {
  const antonio = await guest('Antonio', { plus_one_count: 3 });
  const s = await seats(antonio);
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => x.display_name).sort(), ['+1 · TBA', '+2 · TBA', '+3 · TBA']);
  assert.ok(s.every((x) => x.first_name === 'TBA' && x.side === 'groom' && !x.named));
  await holds(antonio);
});

test('every later write of the number keeps the rows equal — raise, lower, zero, the old on/off box', async () => {
  const ronald = await guest('Ronald');
  assert.equal((await seats(ronald)).length, 0);
  await setCount(ronald, 2);
  await holds(ronald);
  await setCount(ronald, 4);
  await holds(ronald);
  await setCount(ronald, 1);
  await holds(ronald);
  await setCount(ronald, 0);
  await holds(ronald);
  // The old card's on/off box writes only the boolean; the count trigger turns it into one seat — and it gets its row.
  await db.query(`UPDATE public.guests SET plus_one_allowed = true WHERE guest_id = $1`, [ronald]);
  await holds(ronald);
  assert.equal((await seats(ronald)).length, 1);
});

test('lowering the number removes only unnamed seats (and their chairs) — never a named +1', async () => {
  const errol = await guest('Errol', { plus_one_count: 3 });
  const [first] = await seats(errol);
  await db.query(`UPDATE public.guests SET first_name = 'Ana', last_name = 'Cruz', display_name = NULL, plus_one_name_confirmed_at = now() WHERE guest_id = $1`, [first!.guest_id]);
  await setCount(errol, 0);
  const left = await seats(errol);
  assert.deepEqual(left.map((x) => x.first_name), ['Ana'], 'a number removed a named +1, or kept a placeholder');
  await holds(errol);
});

test('a +1 is never given rows of their own', async () => {
  const lea = await guest('Lea', { plus_one_count: 1 });
  const [seat] = await seats(lea);
  assert.equal((await seats(seat!.guest_id)).length, 0);
});

/* ── the backfill ────────────────────────────────────────────────────────────────────────────────────────────────── */

async function drifted(first: string, count: number): Promise<string> {
  // The state prod holds: a number set before rows existed — staged with the new trigger switched off.
  await db.query(`ALTER TABLE public.guests DISABLE TRIGGER a_plus_ones_count_is_their_rows_ins`);
  try {
    return await guest(first, { plus_one_count: count });
  } finally {
    await db.query(`ALTER TABLE public.guests ENABLE TRIGGER a_plus_ones_count_is_their_rows_ins`);
  }
}
const allRows = async () =>
  (await db.query<{ guest_id: string; first_name: string; deleted: boolean; of: string | null; c: number }>(
    `SELECT guest_id, first_name, deleted_at IS NOT NULL AS deleted, plus_one_of_guest_id AS of, plus_one_count AS c FROM public.guests ORDER BY guest_id`,
  )).rows;

test('the backfill mints what was missing — once; twice is the same; a removed seat and a named +1 are left alone', async () => {
  const missing = await drifted('Missing', 2); // Antonio / Ronald: allowed, never given rows
  const partly = await drifted('Partly', 2);
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_of_guest_id, plus_one_name_confirmed_at) VALUES ($1, 'Ben', 'Reyes', 'groom', 'family', $2, now())`,
    [EVENT, partly],
  ); // one NAMED +1 already
  const removed = await drifted('Juanita', 1); // the host removed her seat
  const seat = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_of_guest_id, deleted_at) VALUES ($1, 'TBA', '+1', 'groom', 'family', $2, now()) RETURNING guest_id`,
    [EVENT, removed],
  );
  assert.ok(seat.rows[0]);
  assert.equal((await seats(missing)).length, 0, 'the drift was not staged');

  const sql = fs.readFileSync(BACKFILL, 'utf8');
  await db.exec(sql);
  const once = await allRows();
  assert.equal((await seats(missing)).length, 2, 'the missing seats were not minted');
  const p = await seats(partly);
  assert.equal(p.length, 2, 'the guest with one named +1 did not get their second seat');
  assert.equal(p.filter((x) => x.named && x.first_name === 'Ben').length, 1, 'the named +1 was touched');
  assert.equal((await seats(removed)).length, 0, 'a seat the host removed was given back');

  await db.exec(sql);
  assert.deepEqual(await allRows(), once, 'a second run changed something');
});

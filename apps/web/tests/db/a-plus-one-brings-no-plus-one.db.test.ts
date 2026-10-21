/**
 * 🚫 A +1 BRINGS NO +1 — the database half (migration 20271281624693), run against the REPLAYED schema.
 * Owner, verbatim, 2026-10-21: *"a +1 of a guest cannot have their own +1."*
 *
 * The app refuses it at every writer (lib/a-plus-one-brings-no-plus-one.test.ts); this proves no writer at all — a
 * future one, a script, a hand-run SQL — can: a +1 row's own number stays 0 (CHECK `a_plus_one_brings_no_one`), a row
 * can never point at a +1 as its bringer nor a bringer become a +1 (trigger `a_plus_one_has_no_plus_one`), and the
 * reply's seat mint answers `bringer_is_plus_one` and inserts nothing. A normal guest's +1 still works (anti-vacuity).
 *
 * 🛡 SABOTAGED, each seen RED, then restored (2026-10-21) — see the PR body for the run.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let EVENT = '';

async function guest(first: string, extra: { count?: number; allowed?: boolean; of?: string | null } = {}): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_count, plus_one_allowed, plus_one_of_guest_id)
     VALUES ($1, $2, 'Ang', 'both', 'friends', $3, $4, $5) RETURNING guest_id`,
    [EVENT, first, extra.count ?? 0, extra.allowed ?? false, extra.of ?? null],
  );
  return g.rows[0]!.guest_id;
}
async function refused(sql: string, params: unknown[]): Promise<string> {
  try {
    await db.query(sql, params);
  } catch (e) {
    return String((e as Error).message);
  }
  return '';
}
const liveSeats = async (bringer: string) =>
  (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.guests WHERE plus_one_of_guest_id = $1`, [bringer])).rows[0]!.n;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Pam and Co', 'birthday', 'pam-and-co') RETURNING event_id`,
  );
  EVENT = ev.rows[0]!.event_id;
});
after(async () => {
  await db?.close();
});

test('a guest may still bring +1 … +4, and their +1 is a row at 0 (anti-vacuity)', async () => {
  const pam = await guest('Pam', { count: 2 });
  const pamela = await guest('Pamela', { of: pam });
  const row = (await db.query<{ c: number; a: boolean }>(`SELECT plus_one_count AS c, plus_one_allowed AS a FROM public.guests WHERE guest_id = $1`, [pamela])).rows[0]!;
  assert.deepEqual(row, { c: 0, a: false });
  await db.query(`UPDATE public.guests SET plus_one_count = 4 WHERE guest_id = $1`, [pam]);
});

test('a +1 row can never be given a number of their own — inserted, set, or switched on', async () => {
  const anne = await guest('Anne', { count: 1 });
  const paul = await guest('Paul', { of: anne });
  assert.match(await refused(`UPDATE public.guests SET plus_one_count = 1 WHERE guest_id = $1`, [paul]), /a_plus_one_brings_no_one/);
  assert.match(await refused(`UPDATE public.guests SET plus_one_count = 4 WHERE guest_id = $1`, [paul]), /a_plus_one_brings_no_one/);
  // The old on/off box: the count trigger turns it into "at least one" — still refused.
  assert.match(await refused(`UPDATE public.guests SET plus_one_allowed = true WHERE guest_id = $1`, [paul]), /a_plus_one_brings_no_one/);
  assert.match(
    await refused(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_count, plus_one_of_guest_id)
       VALUES ($1, 'Xyza', 'Ortiz', 'both', 'friends', 2, $2)`,
      [EVENT, anne],
    ),
    /a_plus_one_brings_no_one/,
  );
});

test('a row can never name a +1 as the guest who brings them', async () => {
  const xyza = await guest('Xyza', { count: 1 });
  const tba = await guest('TBA', { of: xyza });
  assert.match(await refused(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, plus_one_of_guest_id) VALUES ($1, 'Nene', 'Punzalan', 'both', 'friends', $2)`,
    [EVENT, tba],
  ), /can.t bring their own \+1/);
  const nene = await guest('Nene');
  assert.match(await refused(`UPDATE public.guests SET plus_one_of_guest_id = $1 WHERE guest_id = $2`, [tba, nene]), /can.t bring their own \+1/);
  assert.match(await refused(`UPDATE public.guests SET plus_one_of_guest_id = guest_id WHERE guest_id = $1`, [nene]), /can.t bring their own \+1/);
  assert.equal(await liveSeats(tba), 0);
});

test('a guest who already brings +1s cannot become somebody’s +1 (a removed seat counts — it can come back)', async () => {
  const jkidd = await guest('Jkidd', { count: 1 });
  const violet = await guest('Violet');
  const seat = await guest('TBA', { of: violet });
  // Violet keeps no number (0), but her seat row points at her.
  assert.match(await refused(`UPDATE public.guests SET plus_one_of_guest_id = $1 WHERE guest_id = $2`, [jkidd, violet]), /can.t bring their own \+1/);
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [seat]);
  assert.match(await refused(`UPDATE public.guests SET plus_one_of_guest_id = $1 WHERE guest_id = $2`, [jkidd, violet]), /can.t bring their own \+1/);
  // A guest bringing nobody may still become a +1 (the rule is not "nothing moves").
  const dwight = await guest('Dwight');
  await db.query(`UPDATE public.guests SET plus_one_of_guest_id = $1 WHERE guest_id = $2`, [jkidd, dwight]);
});

test('the reply’s seat mint refuses a +1 bringer and inserts nothing; a guest’s mint still works', async () => {
  const amy = await guest('Amy', { count: 2 });
  const plus = await guest('Ben', { of: amy });
  const seat = JSON.stringify({ first_name: 'Carla', last_name: 'Cruz', plus_one_name_confirmed_at: new Date().toISOString() });
  const out = (await db.query<{ out: { status: string } }>(`SELECT public.guest_plus_one_seat_mint($1, $2, $3::jsonb) AS out`, [EVENT, plus, seat])).rows[0]!.out;
  assert.equal(out.status, 'bringer_is_plus_one');
  assert.equal(await liveSeats(plus), 0, 'a seat was minted under a +1');
  const viaGuest = (await db.query<{ out: { status: string } }>(`SELECT public.guest_plus_one_seat_mint($1, $2, $3::jsonb) AS out`, [EVENT, amy, seat])).rows[0]!.out;
  assert.equal(viaGuest.status, 'ok', 'a guest’s own mint stopped working (the refusal would pass vacuously)');
});

test('the CHECK is validated — no +1 row in the replayed schema carries extra seats', async () => {
  const c = (await db.query<{ v: boolean }>(`SELECT convalidated AS v FROM pg_constraint WHERE conname = 'a_plus_one_brings_no_one'`)).rows[0];
  assert.ok(c, 'the constraint is missing');
  assert.equal(c.v, true);
});

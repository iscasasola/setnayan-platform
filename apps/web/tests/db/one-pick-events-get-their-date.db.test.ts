/**
 * OLD ONE-PICK EVENTS GET THEIR DATE SAVED (owner 16 Nov 2026, "a").
 *
 * Migration 20271348421195 is a one-time fill: an event made before 14 Nov that
 * carries ONE picked day as a lone "option" and no date gets that day as its
 * date, ending in the state a NEW one-pick event is born in (PR #7615):
 * day precision, no options, date status locked, and every live Papic camera
 * with no window stamped with the default window.
 *
 * The replay builds an empty database, so the rows are seeded here and the
 * migration file is run again against them. Asserted:
 *   1. the one-pick row is filled — date, precision, options cleared, locked;
 *   2. its window-less camera gets the default window (−6 months → the day
 *      23:59:59 Manila + 12h); a camera that already had a window is untouched;
 *   3. a 2-option row and a one-candidate WINDOW row are not touched at all;
 *   4. no history row is written (a new event has none) and the history
 *      trigger is switched back ON afterwards;
 *   5. a second run changes nothing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATION = '20271348421195_one_pick_events_get_their_date.sql';

let replay: ReplayResult;
let db: PGlite;
let fillSql: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const here = dirname(fileURLToPath(import.meta.url));
  fillSql = readFileSync(
    join(here, '..', '..', '..', '..', 'supabase', 'migrations', MIGRATION),
    'utf8',
  );
});

after(async () => {
  await db.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  return r.rows[0]!.v;
}

async function newEvent(mode: string | null, candidates: string[]): Promise<string> {
  return one<string>(
    `INSERT INTO public.events (slug, event_type, display_name, date_mode, date_candidates)
     VALUES ($1, 'birthday', 'One Pick Test', $2, $3::date[]) RETURNING event_id AS v`,
    [`one-pick-${randomUUID().slice(0, 8)}`, mode, candidates],
  );
}

async function newSeat(eventId: string, index: number, from: string | null, until: string | null): Promise<string> {
  return one<string>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, valid_from, valid_until)
     VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, $4, $5) RETURNING seat_id AS v`,
    [eventId, index, randomUUID().replace(/-/g, ''), from, until],
  );
}

type Ev = {
  event_date: string | null;
  event_date_precision: string;
  date_candidates: string[] | null;
  date_status: string;
};

async function ev(id: string): Promise<Ev> {
  const r = await db.query<Ev>(
    `SELECT event_date::text, event_date_precision, date_candidates::text[] AS date_candidates, date_status
       FROM public.events WHERE event_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

async function seat(id: string): Promise<{ from: string | null; until: string | null }> {
  const r = await db.query<{ from: string | null; until: string | null }>(
    `SELECT valid_from::text AS from,
            to_char(valid_until AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') AS until
       FROM public.paparazzi_seats WHERE seat_id = $1`,
    [id],
  );
  return r.rows[0]!;
}

let onePick: string;
let twoOptions: string;
let windowOne: string;
let bareSeat: string;
let keptSeat: string;
let twoOptionsSeat: string;
let before1: { a: Ev; b: Ev; c: Ev };

test('seed: a one-pick legacy row, a 2-option row and a window row', async () => {
  onePick = await newEvent('specific', ['2027-06-19']);
  twoOptions = await newEvent('specific', ['2027-06-19', '2027-07-03']);
  windowOne = await newEvent('window', ['2027-06-19']);
  bareSeat = await newSeat(onePick, 1, null, null);
  keptSeat = await newSeat(onePick, 2, '2027-05-01', '2027-06-20T03:59:59Z');
  twoOptionsSeat = await newSeat(twoOptions, 1, null, null);
  before1 = { a: await ev(onePick), b: await ev(twoOptions), c: await ev(windowOne) };
  // Anti-vacuity: the seeded one-pick row really is the legacy shape.
  assert.equal(before1.a.event_date, null);
  assert.deepEqual(before1.a.date_candidates, ['2027-06-19']);
  assert.notEqual(before1.a.event_date_precision, 'day');
  assert.notEqual(before1.a.date_status, 'locked');
});

test('the fill runs', async () => {
  await db.exec(fillSql);
});

test('the one-pick row ends as a new one-pick event does', async () => {
  const a = await ev(onePick);
  assert.equal(a.event_date, '2027-06-19');
  assert.equal(a.event_date_precision, 'day');
  assert.equal(a.date_candidates, null);
  assert.equal(a.date_status, 'locked');
});

test("Papic's window is set on its window-less camera, and only there", async () => {
  assert.deepEqual(await seat(bareSeat), { from: '2026-12-19', until: '2027-06-20 11:59:59' });
  assert.deepEqual(await seat(keptSeat), { from: '2027-05-01', until: '2027-06-20 11:59:59' });
  assert.deepEqual(await seat(twoOptionsSeat), { from: null, until: null });
});

test('a 2-option row and a one-candidate window row are not touched', async () => {
  assert.deepEqual(await ev(twoOptions), before1.b);
  assert.deepEqual(await ev(windowOne), before1.c);
});

test('no history row is written, and the history trigger is back ON', async () => {
  const n = await one<number>(
    `SELECT count(*)::int AS v FROM public.booking_changes WHERE event_id = $1`,
    [onePick],
  );
  assert.equal(n, 0);
  const enabled = await one<string>(
    `SELECT tgenabled::text AS v FROM pg_trigger
      WHERE tgrelid = 'public.events'::regclass AND tgname = 'events_keep_booking_history'`,
  );
  assert.equal(enabled, 'O');
});

test('a second run changes 0 rows', async () => {
  const snap = async () =>
    JSON.stringify([
      await ev(onePick), await ev(twoOptions), await ev(windowOne),
      await seat(bareSeat), await seat(keptSeat), await seat(twoOptionsSeat),
    ]);
  const first = await snap();
  await db.exec(fillSql);
  assert.equal(await snap(), first);
  const matching = await one<number>(
    `SELECT count(*)::int AS v FROM public.events
      WHERE event_date IS NULL AND date_mode IS DISTINCT FROM 'window'
        AND cardinality(date_candidates) = 1`,
  );
  assert.equal(matching, 0);
});

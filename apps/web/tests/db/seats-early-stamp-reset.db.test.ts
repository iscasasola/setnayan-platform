/**
 * 🪑 THE ONE-TIME RESET — migration
 * 20271254512668_seats_early_stamp_reset_for_upcoming_events.sql.
 * Owner, 2026-09-30, verbatim: "reset all upcoming events to 'seats only on the
 * day part of the website' they do not need to know their seat yet".
 *
 * The replay has already run the migration against an empty schema, so this
 * seeds events stamped the OLD way and runs the migration's own file again:
 *
 *   • a future event with the stamp → cleared;
 *   • an event with no date, or a month/year-only date → cleared (upcoming);
 *   • a past event and a today event → kept;
 *   • the signs' qr_published_at, the tables and the seat assignments → unchanged.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const MIGRATION = join(
  __dirname, '..', '..', '..', '..', 'supabase', 'migrations',
  '20271254512668_seats_early_stamp_reset_for_upcoming_events.sql',
);
const TODAY = `(now() AT TIME ZONE 'Asia/Manila')::date`;

let replay: ReplayResult;
let db: PGlite;
const ids: Record<string, string> = {};

async function seed(key: string, dateSql: string, precision: string) {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug, ceremony_type, venue_setting, event_date, event_date_precision)
     VALUES ($1, 'wedding', $2, 'catholic', 'banquet_hall', ${dateSql}, $3) RETURNING event_id`,
    [key, `reset-${key}`, precision],
  );
  const id = ev.rows[0]!.event_id;
  ids[key] = id;
  await db.query(`INSERT INTO public.event_floor_plan (event_id, published_at) VALUES ($1, now() - interval '3 days')`, [id]);
  const t = await db.query<{ table_id: string }>(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, qr_published_at)
     VALUES ($1, '7', 'round_8', 8, now() - interval '3 days') RETURNING table_id`,
    [id],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Ana', 'Reyes', 'both', 'friends') RETURNING guest_id`,
    [id],
  );
  await db.query(`INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id) VALUES ($1, $2, $3)`, [
    id, t.rows[0]!.table_id, g.rows[0]!.guest_id,
  ]);
}

async function stamped(key: string): Promise<boolean> {
  const r = await db.query<{ p: string | null }>(`SELECT published_at AS p FROM public.event_floor_plan WHERE event_id = $1`, [ids[key]]);
  return r.rows[0]!.p !== null;
}

let before_signs = 0;
let before_seats = 0;
let before_tables = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await seed('future', `${TODAY} + 20`, 'day');
  await seed('nodate', 'NULL', 'year');
  await seed('monthonly', `${TODAY} - 400`, 'month');
  await seed('today', TODAY, 'day');
  await seed('past', `${TODAY} - 10`, 'day');
  before_signs = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_tables WHERE qr_published_at IS NOT NULL`)).rows[0]!.n;
  before_seats = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_seat_assignments`)).rows[0]!.n;
  before_tables = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_tables`)).rows[0]!.n;
  await db.exec(readFileSync(MIGRATION, 'utf8'));
});

after(async () => {
  await db?.close();
});

test('a future event’s "show early" stamp is cleared', async () => {
  assert.equal(await stamped('future'), false);
});

test('an event with no date, or only a month/year, counts as upcoming and is cleared', async () => {
  assert.equal(await stamped('nodate'), false);
  assert.equal(await stamped('monthonly'), false);
});

test('a past event and a today event keep their stamp', async () => {
  assert.equal(await stamped('past'), true);
  assert.equal(await stamped('today'), true);
});

test('the signs’ stamp, the tables and the seat assignments are untouched', async () => {
  const signs = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_tables WHERE qr_published_at IS NOT NULL`)).rows[0]!.n;
  const seats = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_seat_assignments`)).rows[0]!.n;
  const tables = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_tables`)).rows[0]!.n;
  assert.equal(before_signs, 5);
  assert.deepEqual({ signs, seats, tables }, { signs: before_signs, seats: before_seats, tables: before_tables });
});

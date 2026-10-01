/**
 * 🪑 SEATS SHOW ON THE DAY — migration 20271254054934_seats_show_on_the_day.
 * Owner, 2026-09-30, verbatim: "seatplan will show on the date of the event".
 *
 * `public.guests_may_see_seats(event_id)` is the ONE SQL seat rule, and the
 * guest-facing seat functions ask it instead of reading `published_at`
 * themselves. Proven against the FULL replayed schema:
 *
 *   • before the day + switch off → hidden (the helper, the name search and
 *     the 3D walk all withhold);
 *   • before the day + "Show guests their seats early" on → shown;
 *   • on the day (Manila) → shown with the switch off;
 *   • a date known only to the month/year never opens by itself;
 *   • no client role may call the helper directly.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
const SLUG = 'ana-and-ben-seats-day';
let eventId = '';

const MANILA_TODAY = `(now() AT TIME ZONE 'Asia/Manila')::date`;

async function setDay(offsetDays: number, precision = 'day') {
  await db.query(
    `UPDATE public.events SET event_date = ${MANILA_TODAY} + $2::int, event_date_precision = $3 WHERE event_id = $1`,
    [eventId, offsetDays, precision],
  );
}
async function setEarly(on: boolean) {
  await db.query(`UPDATE public.event_floor_plan SET published_at = ${on ? 'now()' : 'NULL'} WHERE event_id = $1`, [eventId]);
}
async function may(): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(`SELECT public.guests_may_see_seats($1) AS ok`, [eventId]);
  return r.rows[0]!.ok;
}
async function search(): Promise<number> {
  const r = await db.query(`SELECT * FROM public.public_seat_lookup($1, 'Ana Reyes')`, [SLUG]);
  return r.rows.length;
}
async function walk(): Promise<boolean> {
  const r = await db.query<{ s: { published: boolean } }>(`SELECT public.public_venue_scene($1, NULL) AS s`, [SLUG]);
  return r.rows[0]!.s.published;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug, ceremony_type, venue_setting, event_date, event_date_precision)
     VALUES ('Ana & Ben', 'wedding', $1, 'catholic', 'banquet_hall', ${MANILA_TODAY} + 30, 'day') RETURNING event_id`,
    [SLUG],
  );
  eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_floor_plan (event_id) VALUES ($1)`, [eventId]);
  const tbl = await db.query<{ table_id: string }>(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity)
     VALUES ($1, '7', 'round_8', 8) RETURNING table_id`,
    [eventId],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Ana', 'Reyes', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  await db.query(`INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id) VALUES ($1, $2, $3)`, [
    eventId,
    tbl.rows[0]!.table_id,
    g.rows[0]!.guest_id,
  ]);
});

after(async () => {
  await db?.close();
});

test('before the day, switch off → hidden everywhere', async () => {
  await setDay(1);
  await setEarly(false);
  assert.equal(await may(), false);
  assert.equal(await search(), 0, 'the name search withholds');
  assert.equal(await walk(), false, 'the 3D walk withholds');
});

test('before the day, "Show guests their seats early" on → shown', async () => {
  await setDay(1);
  await setEarly(true);
  assert.equal(await may(), true);
  assert.equal(await search(), 1);
  assert.equal(await walk(), true);
});

test('on the day (Manila) → shown with the switch OFF', async () => {
  await setDay(0);
  await setEarly(false);
  assert.equal(await may(), true);
  assert.equal(await search(), 1);
  assert.equal(await walk(), true);
});

test('after the day → still shown with the switch off', async () => {
  await setDay(-1);
  await setEarly(false);
  assert.equal(await may(), true);
});

test('a date known only to the month or year never opens by itself', async () => {
  for (const precision of ['month', 'year']) {
    await setDay(-1, precision);
    await setEarly(false);
    assert.equal(await may(), false, `precision=${precision}`);
  }
});

test('no client role may call the helper directly', async () => {
  const r = await db.query<{ anon: boolean; authed: boolean }>(
    `SELECT has_function_privilege('anon', 'public.guests_may_see_seats(uuid)', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.guests_may_see_seats(uuid)', 'EXECUTE') AS authed`,
  );
  assert.deepEqual(r.rows[0], { anon: false, authed: false });
});

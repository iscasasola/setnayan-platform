/**
 * 🧑‍🤝‍🧑 A UNIT TRADE IS ONE TRANSACTION (seat plan L11, from L10's note on #8460; migration
 * 20271365089548_seat_plan_table_names_kinds_locks). `swap_seat_unit_assignments` trades two same-size units — a guest
 * and their +1 each — so pair i of one side takes pair i of the other's chairs, all at once; and when any part cannot
 * happen (a locked seat, a guest with no seat), NOTHING moves.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let t1 = '';
let t2 = '';
const g: Record<string, string> = {};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('Ana & Ben', 'birthday', ((now() AT TIME ZONE 'Asia/Manila')::date + 60), 'day') RETURNING event_id`,
  );
  eventId = e.rows[0]!.event_id;
  const t = await db.query<{ table_id: string }>(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order)
     VALUES ($1, 'Table 1', 'round_10', 10, 1), ($1, 'Table 2', 'round_10', 10, 2) RETURNING table_id`,
    [eventId],
  );
  [t1, t2] = [t.rows[0]!.table_id, t.rows[1]!.table_id];
  for (const name of ['ana', 'anaPlus', 'ben', 'benPlus', 'cy', 'loner']) {
    const r = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status) VALUES ($1, $2, 'Test', 'both', 'friends', 'attending') RETURNING guest_id`,
      [eventId, name],
    );
    g[name] = r.rows[0]!.guest_id;
  }
  const seat = (guest: string, table: string, n: number) =>
    db.query(`INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES ($1, $2, $3, $4)`, [
      eventId,
      table,
      guest,
      n,
    ]);
  await seat(g.ana!, t1, 0);
  await seat(g.anaPlus!, t1, 1);
  await seat(g.ben!, t2, 4);
  await seat(g.benPlus!, t2, 5);
  await seat(g.cy!, t2, 6);
});

after(async () => {
  await db?.close();
});

const seatOf = async (guest: string) =>
  (await db.query<{ table_id: string; seat_number: number }>(
    `SELECT table_id, seat_number FROM public.event_seat_assignments WHERE guest_id = $1`,
    [guest],
  )).rows[0];

test('two pairs trade chairs, pair for pair, in one call', async () => {
  await db.query(`SELECT public.swap_seat_unit_assignments($1, $2::uuid[], $3::uuid[])`, [
    eventId,
    [g.ana, g.anaPlus],
    [g.ben, g.benPlus],
  ]);
  assert.deepEqual(await seatOf(g.ana!), { table_id: t2, seat_number: 4 });
  assert.deepEqual(await seatOf(g.anaPlus!), { table_id: t2, seat_number: 5 });
  assert.deepEqual(await seatOf(g.ben!), { table_id: t1, seat_number: 0 });
  assert.deepEqual(await seatOf(g.benPlus!), { table_id: t1, seat_number: 1 });
  assert.deepEqual(await seatOf(g.cy!), { table_id: t2, seat_number: 6 }, 'nobody else moves');
});

test('a locked seat anywhere in the trade refuses it, and nothing moves', async () => {
  await db.query(`UPDATE public.event_seat_assignments SET locked = TRUE WHERE guest_id = $1`, [g.benPlus]);
  await assert.rejects(
    db.query(`SELECT public.swap_seat_unit_assignments($1, $2::uuid[], $3::uuid[])`, [eventId, [g.ana, g.anaPlus], [g.ben, g.benPlus]]),
    /locked to their seat/,
  );
  assert.deepEqual(await seatOf(g.ana!), { table_id: t2, seat_number: 4 }, 'the first pair did not trade either');
  assert.deepEqual(await seatOf(g.ben!), { table_id: t1, seat_number: 0 });
  await db.query(`UPDATE public.event_seat_assignments SET locked = FALSE WHERE guest_id = $1`, [g.benPlus]);
});

test('a guest with no seat, uneven sides, or a repeated guest is refused, and nothing moves', async () => {
  await assert.rejects(
    db.query(`SELECT public.swap_seat_unit_assignments($1, $2::uuid[], $3::uuid[])`, [eventId, [g.ana, g.anaPlus], [g.ben, g.loner]]),
    /has no seat assignment/,
  );
  assert.deepEqual(await seatOf(g.ana!), { table_id: t2, seat_number: 4 }, 'the lead pair did not move');
  await assert.rejects(
    db.query(`SELECT public.swap_seat_unit_assignments($1, $2::uuid[], $3::uuid[])`, [eventId, [g.ana, g.anaPlus], [g.ben]]),
    /same length/,
  );
  await assert.rejects(
    db.query(`SELECT public.swap_seat_unit_assignments($1, $2::uuid[], $3::uuid[])`, [eventId, [g.ana, g.ana], [g.ben, g.benPlus]]),
    /appears twice/,
  );
});

test('anon cannot call it; signed-in callers can (their RLS decides what they reach)', async () => {
  const grants = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'swap_seat_unit_assignments' AND privilege_type = 'EXECUTE'`,
  );
  const who = new Set(grants.rows.map((r) => r.grantee));
  assert.ok(who.has('authenticated'));
  assert.ok(!who.has('anon') && !who.has('PUBLIC'));
});

/**
 * 🪑 ACCEPT WRITES THE PREVIEW IN ONE TRANSACTION (seat plan § 4.6 preview D, § 6 Accept; migration
 * 20271366023002_apply_seat_plan). `apply_seat_plan` refuses a stale preview (its base must match the seats now — the
 * TS twin `seatPlanBase` must agree byte for byte), clears only unlocked seats at unlocked tables, adds the plan's new
 * tables, and seats each row re-checking the hard rules. Any refusal writes NOTHING.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { seatPlanBase } from '../../lib/seat-plan-preview';

let replay: ReplayResult;
let db: ReplayResult['db'];
let eventId = '';
let t1 = '';
let t2 = '';
let spare = '';
let locked = '';
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
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity, sort_order, table_kind, locked)
     VALUES ($1, 'Table 1', 'round_10', 4, 1, 'regular', FALSE),
            ($1, 'Table 2', 'round_10', 4, 2, 'regular', FALSE),
            ($1, 'Table 3', 'round_10', 4, 3, 'spare', FALSE),
            ($1, 'Table 4', 'round_10', 4, 4, 'regular', TRUE)
     RETURNING table_id`,
    [eventId],
  );
  [t1, t2, spare, locked] = t.rows.map((r) => r.table_id) as [string, string, string, string];
  for (const [name, rsvp] of [['ana', 'attending'], ['ben', 'attending'], ['cy', 'pending'], ['dee', 'declined'], ['eve', 'attending'], ['pin', 'attending']] as const) {
    const r = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status) VALUES ($1, $2, 'Test', 'both', 'friends', $3) RETURNING guest_id`,
      [eventId, name, rsvp],
    );
    g[name] = r.rows[0]!.guest_id;
  }
  await db.query(`INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number) VALUES ($1, $2, $3, 0)`, [eventId, t1, g.ana]);
  await db.query(`INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id, seat_number, locked) VALUES ($1, $2, $3, 0, TRUE)`, [eventId, locked, g.pin]);
});

after(async () => {
  await db?.close();
});

const seats = async () =>
  (await db.query<{ guest_id: string; table_id: string; seat_number: number | null }>(
    `SELECT guest_id, table_id, seat_number FROM public.event_seat_assignments WHERE event_id = $1`,
    [eventId],
  )).rows;
const apply = (base: string, clear: string[], newTables: unknown[], rows: unknown[], positions: unknown = {}) =>
  db.query<{ apply_seat_plan: { seated: number; added_table_ids: string[]; new_table_ids: Record<string, string>; cleared: unknown[] } }>(
    `SELECT public.apply_seat_plan($1, $2, $3::uuid[], $4::jsonb, $5::jsonb, $6::jsonb)`,
    [eventId, base, clear, JSON.stringify(newTables), JSON.stringify(positions), JSON.stringify(rows)],
  );

test('the TS fingerprint and the SQL one agree, so a fresh preview is accepted', async () => {
  const base = seatPlanBase(await seats());
  const r = await apply(base, [], [], [{ guest_id: g.ben, table: t1, seat_number: 1 }]);
  assert.equal(r.rows[0]!.apply_seat_plan.seated, 1);
  assert.ok((await seats()).some((s) => s.guest_id === g.ben && s.table_id === t1 && s.seat_number === 1));
});

test('a stale preview is refused and nothing is written', async () => {
  const stale = seatPlanBase([{ guest_id: g.ana!, table_id: t1, seat_number: 0 }]); // from before ben was seated
  const before_ = await seats();
  await assert.rejects(apply(stale, [], [], [{ guest_id: g.cy, table: t2, seat_number: 0 }]), /stale_preview/);
  assert.deepEqual(await seats(), before_);
});

test('every hard rule refuses the whole plan: Spare, locked, a removed or missing chair, a declined guest, a taken chair', async () => {
  const base = seatPlanBase(await seats());
  const before_ = await seats();
  const cases: Array<[unknown[], RegExp]> = [
    [[{ guest_id: g.cy, table: t2, seat_number: 0 }, { guest_id: g.eve, table: spare, seat_number: 0 }], /never seats anyone/],
    [[{ guest_id: g.cy, table: locked, seat_number: 1 }], /never seats anyone/],
    [[{ guest_id: g.cy, table: t2, seat_number: 9 }], /not a chair/],
    [[{ guest_id: g.dee, table: t2, seat_number: 0 }], /cannot be seated/],
    [[{ guest_id: g.cy, table: t1, seat_number: 0 }], /duplicate key|unique/i],
  ];
  for (const [rows, why] of cases) {
    await assert.rejects(apply(base, [], [], rows), why);
    assert.deepEqual(await seats(), before_, `nothing written after ${why}`);
  }
});

test('"Seat everyone again" clears unlocked seats, adds a table, seats into it — and returns what Undo needs', async () => {
  const base = seatPlanBase(await seats());
  const r = await apply(
    base,
    [g.ana!, g.ben!],
    [{ key: 'Table 5', label: 'Table 5', type: 'round_10', capacity: 10, sort_order: 5, x: 150, y: 40 }],
    [
      { guest_id: g.ana, table: 'new:Table 5', seat_number: 0 },
      { guest_id: g.ben, table: 'new:Table 5', seat_number: 1 },
      { guest_id: g.cy, table: t2, seat_number: 0 },
    ],
  );
  const out = r.rows[0]!.apply_seat_plan;
  assert.equal(out.seated, 3);
  assert.equal(out.added_table_ids.length, 1);
  assert.equal(out.cleared.length, 2, 'the two seats it took off come back for Undo');
  const added = await db.query<{ x_pos: number; label_is_auto: boolean }>(`SELECT x_pos, label_is_auto FROM public.event_tables WHERE table_id = $1`, [out.added_table_ids[0]]);
  assert.equal(Number(added.rows[0]!.x_pos), 100, 'a position is clamped');
  assert.equal(added.rows[0]!.label_is_auto, true);
  assert.ok((await seats()).some((s) => s.guest_id === g.pin && s.table_id === locked), 'the locked seat never moves');
});

test('a seat to clear that is locked refuses the plan', async () => {
  const base = seatPlanBase(await seats());
  const before_ = await seats();
  await assert.rejects(apply(base, [g.pin!], [], []), /locked, at a locked table, or gone/);
  assert.deepEqual(await seats(), before_);
});

test('anon cannot call it; signed-in callers can (their RLS decides what they reach)', async () => {
  const grants = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'apply_seat_plan' AND privilege_type = 'EXECUTE'`,
  );
  const who = new Set(grants.rows.map((r) => r.grantee));
  assert.ok(who.has('authenticated'));
  assert.ok(!who.has('anon') && !who.has('PUBLIC'));
});

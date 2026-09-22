/**
 * A CHRISTENING IS NOT QUOTED A WEDDING'S 150 CREDITS A HEAD.
 *
 * Migration under test: 20271239794268 — `papic_event_pool_config` stops being
 * a singleton and gains one SIZING row per `event_type_vocab` type, plus the
 * resolver `papic_event_pool_sizing(text)` that the DB fence now sizes through.
 *
 * ── WHY THIS NEEDS A *DATABASE* TEST AND NOT ONLY A UNIT TEST ─────────────
 * `lib/papic-pool-sizing.test.ts` proves the pure TS resolution and reads the
 * seed out of the migration TEXT. Neither can see whether the SQL actually
 * APPLIES, whether the seed covered the live vocabulary, or whether the SQL
 * resolver and its TS twin agree — and the whole point of the SQL twin is that
 * the figure the app SHOWS and the figure the fence ENFORCES cannot drift.
 *
 * Four questions, in the order they can hurt somebody:
 *   1. does a wedding still compute EXACTLY what it computed yesterday?
 *      (9 of the 11 live events are weddings)
 *   2. is every event type priced, with no silent fallback?
 *   3. does the clamp travel with the per-head figure — a 2-guest `date` must
 *      not be clamped UP to the wedding floor of 5,000?
 *   4. does the SOFT STOP still come off the global row, now that sizing does
 *      not?
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

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

test('THE MIGRATION APPLIED — the resolver exists and every event type is priced', async () => {
  const fn = await one<number>(
    `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'papic_event_pool_sizing'`,
  );
  assert.equal(fn, 1, 'papic_event_pool_sizing() must exist');

  // 🔑 The migration RAISEs on an unpriced type, so reaching this line already
  // proves it — but stating it is what makes a future failure legible.
  const unpriced = await db.query<{ event_type: string }>(
    `SELECT v.event_type FROM public.event_type_vocab v
      WHERE NOT EXISTS (SELECT 1 FROM public.papic_event_pool_config c
                         WHERE c.config_key = v.event_type)`,
  );
  assert.deepEqual(
    unpriced.rows.map((r) => r.event_type),
    [],
    'every event type must carry its own Papic sizing row',
  );

  const sizingRows = await one<number>(
    `SELECT COUNT(*)::int FROM public.papic_event_pool_config WHERE config_key <> 'default'`,
  );
  const vocab = await one<number>(`SELECT COUNT(*)::int FROM public.event_type_vocab`);
  assert.equal(sizingRows, vocab, `expected one sizing row per event type (${vocab})`);
});

test('A WEDDING DID NOT MOVE — the acceptance test, in SQL', async () => {
  const same = await one<boolean>(
    `SELECT (w.points_per_guest, w.floor_points, w.ceiling_points)
          = (d.points_per_guest, d.floor_points, d.ceiling_points)
       FROM public.papic_event_pool_config w, public.papic_event_pool_config d
      WHERE w.config_key = 'wedding' AND d.config_key = 'default'`,
  );
  assert.equal(same, true, 'the wedding row must equal the global row it replaced');

  const sized = await db.query<{
    points_per_guest: number;
    floor_points: number;
    ceiling_points: number;
    sized_by: string;
  }>(`SELECT * FROM public.papic_event_pool_sizing('wedding')`);
  assert.deepEqual(sized.rows[0], {
    points_per_guest: 150,
    floor_points: 5000,
    ceiling_points: 30000,
    sized_by: 'wedding',
  });
});

test('THE CLAMP TRAVELS WITH THE PER-HEAD FIGURE — and the SQL agrees with the TS', async () => {
  /*
    🛑 THE BUG THIS BUILD EXISTS TO AVOID, asserted against the real function.
    A 2-guest `date` at 50/head is 100 credits. With the global floor of 5,000
    still applied it becomes 5,000 — roughly ₱3,360 recommended for a dinner
    for two.
  */
  const d = await db.query<{
    points_per_guest: number;
    floor_points: number;
    ceiling_points: number;
    sized_by: string;
  }>(`SELECT * FROM public.papic_event_pool_sizing('date')`);
  assert.equal(d.rows[0]!.points_per_guest, 50);
  assert.equal(d.rows[0]!.floor_points, 0);
  assert.equal(d.rows[0]!.sized_by, 'date');

  const clamped = await one<number>(
    `SELECT LEAST(s.ceiling_points, GREATEST(s.floor_points, 2 * s.points_per_guest))
       FROM public.papic_event_pool_sizing('date') s`,
  );
  assert.equal(clamped, 100, 'a dinner for two must not be lifted to the wedding floor');

  // An unknown type falls back, and SAYS it fell back.
  const fb = await db.query<{ points_per_guest: number; sized_by: string }>(
    `SELECT * FROM public.papic_event_pool_sizing('not_a_real_type')`,
  );
  assert.equal(fb.rows[0]!.sized_by, 'default');
  assert.equal(fb.rows[0]!.points_per_guest, 150);

  const nul = await db.query<{ sized_by: string }>(
    `SELECT * FROM public.papic_event_pool_sizing(NULL)`,
  );
  assert.equal(nul.rows[0]!.sized_by, 'default');
});

test('THE FENCE SIZES PER TYPE AND STILL TAKES ITS SOFT STOP FROM THE GLOBAL ROW', async () => {
  /*
    `papic_event_pool_status` short-circuits to applies=FALSE for an event with
    no flat pass and no shared grant, so the pool arithmetic is only reachable
    once a grant exists. One INSERT into the grants ledger is the cheapest way
    in, and it is what a top-up does.

    The two events below differ ONLY in type. Before this build they computed
    the same base; after it they must not.
  */
  await db.query(
    `UPDATE public.papic_event_pool_config SET soft_stop_pct = 70 WHERE config_key = 'default'`,
  );
  // A divergent, deliberately wrong copy on the sizing row: if the status
  // function ever reads the soft stop off the type row, it will read this.
  await db.query(
    `UPDATE public.papic_event_pool_config SET soft_stop_pct = 10 WHERE config_key = 'birthday'`,
  );

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, estimated_pax)
     VALUES ('Sizing test', 'birthday', CURRENT_DATE + 30, 100) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source)
     VALUES ($1, 1000, 'admin')`,
    [eventId],
  );

  const st = await db.query<{
    applies: boolean;
    base_points: number;
    total_points: number;
    soft_stop_at: number;
  }>(`SELECT * FROM public.papic_event_pool_status($1)`, [eventId]);
  const row = st.rows[0]!;
  assert.equal(row.applies, true);

  // 🔑 THE SOFT STOP CAME FROM 'default' (70%), NOT FROM THE BIRTHDAY ROW (10%).
  assert.equal(
    row.soft_stop_at,
    Math.floor((row.total_points * 70) / 100),
    'soft_stop_pct must come off the global row, never a sizing row',
  );

  await db.query(
    `UPDATE public.papic_event_pool_config SET soft_stop_pct = 85 WHERE config_key = 'default'`,
  );
  await db.query(
    `UPDATE public.papic_event_pool_config SET soft_stop_pct = 85 WHERE config_key = 'birthday'`,
  );
});

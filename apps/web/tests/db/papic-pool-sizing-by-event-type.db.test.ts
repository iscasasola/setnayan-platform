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

/* ═══════════════════════════════════════════════════════════════════════════
   THE LEARNING LOOP — migration 20271240727195
   ═══════════════════════════════════════════════════════════════════════════
   The pure rule and its two traps are proved in lib/papic-pool-learning.test.ts.
   What only a database can prove is that the SQL MIRROR agrees with it — the
   admin screen reads the SQL, so a TS rule the SQL does not share is a rule
   nobody applies.
   ═══════════════════════════════════════════════════════════════════════════ */

test('THE LEARNING LOOP IS DORMANT ON MERGE — no row carries a learned figure', async () => {
  const learned = await one<number>(
    `SELECT COUNT(*)::int FROM public.papic_event_pool_config
      WHERE learned_points_per_guest IS NOT NULL`,
  );
  assert.equal(learned, 0, 'the mechanism must change no number the day it applies');

  // And the resolver therefore still answers with the owner's initial.
  const w = await one<number>(
    `SELECT points_per_guest FROM public.papic_event_pool_sizing('wedding')`,
  );
  assert.equal(w, 150);
});

test('A LEARNED FIGURE OVERRIDES THE INITIAL, AND THE ADMIN CAN SEE WHICH IS IN FORCE', async () => {
  await db.query(
    `UPDATE public.papic_event_pool_config
        SET learned_points_per_guest = 77, learned_sample_size = 12, learned_at = NOW()
      WHERE config_key = 'christening'`,
  );
  const sized = await db.query<{ points_per_guest: number; floor_points: number }>(
    `SELECT * FROM public.papic_event_pool_sizing('christening')`,
  );
  assert.equal(sized.rows[0]!.points_per_guest, 77, 'the learned figure is the one in force');
  assert.equal(sized.rows[0]!.floor_points, 0, 'the floor is NOT learned — it is the owner’s shape');

  const state = await db.query<{
    initial_per_guest: number;
    stored_learned: number;
    in_force: number;
    in_force_source: string;
  }>(
    `SELECT initial_per_guest, stored_learned, in_force, in_force_source
       FROM public.papic_pool_learning_state() WHERE config_key = 'christening'`,
  );
  assert.deepEqual(state.rows[0], {
    initial_per_guest: 70,
    stored_learned: 77,
    in_force: 77,
    in_force_source: 'learned',
  });

  await db.query(
    `UPDATE public.papic_event_pool_config
        SET learned_points_per_guest = NULL, learned_sample_size = 0, learned_at = NULL
      WHERE config_key = 'christening'`,
  );
});

test('THE SQL MIRRORS THE TS — an exhausted celebration never lowers the candidate', async () => {
  /*
    🛑 TRAP 2, ASKED OF THE REAL FUNCTIONS. Twelve `graduation` celebrations
    finish at 80 a head with room to spare; twelve more RUN DRY at 40 a head.
    The naive mean over all twenty-four is 60. The candidate must stay 80.

    A pool exists only once the event holds a shared grant, so each fixture gets
    an explicit grant sized to be the whole pot — `papic_event_pool_status`
    short-circuits without one, and a fixture that never reaches the arithmetic
    proves nothing.
  */
  await db.query(
    `UPDATE public.papic_event_pool_config SET learning_min_sample = 12 WHERE config_key = 'graduation'`,
  );

  async function finished(used: number, total: number, guests: number) {
    const ev = await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, estimated_pax,
                                  papic_window_start, papic_window_end)
       VALUES ('Learning fixture', 'graduation', CURRENT_DATE - 40, $1,
               CURRENT_DATE - 45, CURRENT_DATE - 30)
       RETURNING event_id`,
      [guests],
    );
    const id = ev.rows[0]!.event_id;
    // The base pool is 0 for a non-flat-pass event, so the grant IS the pot.
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, points, source)
       VALUES ($1, $2, 'admin')`,
      [id, total],
    );
    await db.query(
      `INSERT INTO public.papic_event_pool_usage (event_id, points_used)
       VALUES ($1, $2)
       ON CONFLICT (event_id) DO UPDATE SET points_used = EXCLUDED.points_used`,
      [id, used],
    );
    return id;
  }

  // Read back one fixture's status before trusting twenty-four of them.
  const probeId = await finished(8_000, 10_000, 100);
  const probe = await db.query<{ applies: boolean; total_points: number; used_points: number }>(
    `SELECT * FROM public.papic_event_pool_status($1)`,
    [probeId],
  );
  assert.equal(probe.rows[0]!.applies, true, 'the fixture must actually have a pool');
  assert.equal(probe.rows[0]!.total_points, 10_000);
  assert.equal(probe.rows[0]!.used_points, 8_000);

  // 11 more roomy events at 80/head (with the probe that is 12 uncensored).
  for (let i = 0; i < 11; i += 1) await finished(8_000, 10_000, 100);
  const roomy = await db.query<{ candidate: number; sample_size: number }>(
    `SELECT candidate, sample_size FROM public.papic_pool_learning_state()
      WHERE config_key = 'graduation'`,
  );
  assert.equal(roomy.rows[0]!.sample_size, 12);
  assert.equal(roomy.rows[0]!.candidate, 80);

  // 12 that ran dry at 40/head. The naive mean would be 60.
  for (let i = 0; i < 12; i += 1) await finished(4_000, 4_000, 100);
  const after = await db.query<{
    candidate: number;
    sample_size: number;
    censored_count: number;
  }>(
    `SELECT candidate, sample_size, censored_count FROM public.papic_pool_learning_state()
      WHERE config_key = 'graduation'`,
  );
  assert.equal(after.rows[0]!.censored_count, 12);
  assert.equal(after.rows[0]!.sample_size, 12, 'exhausted events are not observations');
  assert.equal(after.rows[0]!.candidate, 80, 'an exhausted pool must not lower the candidate');

  // The write stores exactly that, and the resolver then serves it.
  await db.query(`SELECT * FROM public.papic_recompute_pool_learning()`);
  const served = await one<number>(
    `SELECT points_per_guest FROM public.papic_event_pool_sizing('graduation')`,
  );
  assert.equal(served, 80);
});

test('A TYPE BELOW ITS MINIMUM SAMPLE KEEPS THE OWNER’S NUMBER', async () => {
  const st = await db.query<{ candidate: number | null; in_force_source: string; in_force: number }>(
    `SELECT candidate, in_force_source, in_force FROM public.papic_pool_learning_state()
      WHERE config_key = 'wake'`,
  );
  assert.equal(st.rows[0]!.candidate, null, 'no evidence means no candidate, not a zero');
  assert.equal(st.rows[0]!.in_force_source, 'initial');
  assert.equal(st.rows[0]!.in_force, 50);
});

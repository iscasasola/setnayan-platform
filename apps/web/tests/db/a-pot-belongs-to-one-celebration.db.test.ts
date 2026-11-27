/**
 * A POT BELONGS TO ONE CELEBRATION.
 *
 * A couple can hold several celebrations — a wedding, its engagement party, its
 * bridal shower — and every grouping of them will be tempted by the same
 * shortcut: "your celebrations have 30,000 shots" reads beautifully on a screen.
 * (The linked-cluster "year" that first raised this was retired and its tables
 * dropped, 20271363906595; the rule outlives it.)
 *
 * 🛑 IT WOULD ALSO CHANGE WHAT EVERY CUSTOMER ALREADY BOUGHT. The pot is
 * per-celebration BY CONSTRUCTION today: `papic_event_pool_usage` is keyed
 * `event_id PRIMARY KEY`, grants are keyed `event_id`, and every reserve/
 * release door takes `p_event_id`. That is the primitive people pay for — not a
 * display detail. Rolling it up across celebrations is not a feature, it is a
 * silent repricing of celebrations that are already sold.
 *
 * ── WHY THIS FILE AND NOT A COMMENT ────────────────────────────────────────
 * The migration says all of this in prose. Prose has never once failed a build.
 * `test:db:ci` runs inside the REQUIRED "typecheck + lint" job, so this gates
 * the merge with nothing to remember and nothing to wire.
 *
 * ── THE PATIENT LIST IS DERIVED, NEVER TYPED ───────────────────────────────
 * 🔑 This repo's recorded guard failure is `one-top-bar.test.ts`: right about
 * the disease, wrong about the patient list — it checked five hard-coded trees
 * and the defect went to the surfaces nobody had listed. So every check below
 * asks the SCHEMA which tables and functions are Papic's, and then asserts the
 * discovered list is non-empty. A rename that empties the sweep fails loudly
 * instead of passing vacuously.
 *
 * Test 1 is behavioural and is the one that matters: two celebrations of one
 * owner, points really granted to one. The name-shaped checks after it catch
 * the mistake one commit EARLIER, at the moment the column appears.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function newEvent(name: string, ownerId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, estimated_pax)
     VALUES ($1, 'celebration', 100) RETURNING event_id`,
    [name],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, ownerId],
  );
  return eventId;
}

async function poolStatus(eventId: string) {
  const r = await db.query<{
    applies: boolean;
    total_points: number;
    remaining_points: number;
  }>(`SELECT applies, total_points, remaining_points
        FROM public.papic_event_pool_status($1)`, [eventId]);
  return r.rows[0]!;
}

/* ───────────────────────── 1 · the behaviour ───────────────────────────── */

test('two celebrations of ONE owner keep two separate pots', async () => {
  const owner = await newUser('cluster-pot-owner@example.com');
  const wedding = await newEvent('The wedding', owner);
  const shower = await newEvent('The bridal shower', owner);

  /*
   * ⚠ EVERY CELEBRATION ALREADY HOLDS A FREE 50-POINT GRANT, seeded by the
   * `papic_seed_free_grant` AFTER INSERT trigger (20270902100836). The first
   * cut of this test asserted the un-topped-up sibling had NO pot at all and
   * failed — on the seed, not on a leak. Measuring the sibling BEFORE and
   * AFTER is the honest form: it needs no belief about what a fresh pot holds,
   * and it still catches the only thing that matters, which is the 5,000
   * arriving somewhere nobody paid for it.
   */
  const showerBefore = await poolStatus(shower);

  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, 5000, 'admin', 'phase 7a guard')`,
    [wedding],
  );

  const weddingPot = await poolStatus(wedding);
  const showerAfter = await poolStatus(shower);

  assert.ok(
    weddingPot.total_points >= 5000,
    `the wedding should hold its own grant, got ${weddingPot.total_points}`,
  );

  assert.equal(
    showerAfter.total_points,
    showerBefore.total_points,
    `THE POT SPREAD ACROSS CELEBRATIONS. The bridal shower went from ` +
      `${showerBefore.total_points} to ${showerAfter.total_points} points ` +
      'because a SIBLING was topped up. Nobody bought the shower anything — ' +
      'this is the silent repricing this file exists to prevent.',
  );
  assert.ok(
    showerAfter.total_points < 5000,
    `the shower can see the wedding's 5,000 (it holds ${showerAfter.total_points})`,
  );
});

test('spending the wedding\'s pot does not move the shower\'s', async () => {
  const owner = await newUser('cluster-pot-spend@example.com');
  const wedding = await newEvent('Spend wedding', owner);
  const party = await newEvent('Spend engagement party', owner);

  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source)
     VALUES ($1, 5000, 'admin'), ($2, 5000, 'admin')`,
    [wedding, party],
  );

  const before = await poolStatus(party);
  await db.query(`INSERT INTO public.papic_event_pool_usage (event_id, points_used)
                  VALUES ($1, 400)
                  ON CONFLICT (event_id) DO UPDATE SET points_used =
                    public.papic_event_pool_usage.points_used + 400`, [wedding]);
  const after = await poolStatus(party);

  assert.equal(
    after.remaining_points,
    before.remaining_points,
    'a camera shooting at the wedding drained the engagement party — usage is ' +
      'no longer keyed to one celebration',
  );
});

/* ─────────────────── 2 · the pot's key is the celebration ──────────────── */

test('papic_event_pool_usage is keyed by the celebration and nothing else', async () => {
  const pk = await db.query<{ col: string }>(
    `SELECT a.attname AS col
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'public.papic_event_pool_usage'::regclass
        AND i.indisprimary
      ORDER BY a.attname`,
  );
  assert.deepEqual(
    pk.rows.map((r) => r.col),
    ['event_id'],
    'the usage ledger stopped being one row per celebration',
  );
});

/* ──────────── 3 · nothing Papic learns what a cluster is ───────────────── */

test('no Papic table names a cluster', async () => {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name LIKE 'papic%'
      ORDER BY table_name, column_name`,
  );
  assert.ok(
    cols.rows.length > 20,
    `discovered only ${cols.rows.length} Papic columns — the sweep found nothing ` +
      'to check, which is a broken guard, not a pass',
  );

  const offenders = cols.rows.filter((r) => /cluster/i.test(r.column_name));
  assert.deepEqual(
    offenders,
    [],
    `a Papic table grew a cluster column: ${offenders
      .map((o) => `${o.table_name}.${o.column_name}`)
      .join(', ')}`,
  );
});

test('no Papic function has learned the word event_cluster', async () => {
  const fns = await db.query<{ name: string; def: string }>(
    `SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'papic%'`,
  );
  assert.ok(
    fns.rows.length > 10,
    `discovered only ${fns.rows.length} Papic functions — the sweep is empty, ` +
      'which is a broken guard, not a pass',
  );
  const offenders = fns.rows
    .filter((r) => /event_cluster/i.test(r.def))
    .map((r) => r.name);
  assert.deepEqual(
    offenders,
    [],
    `these Papic functions now read the cluster: ${offenders.join(', ')}. The ` +
      'pot is per-celebration; a function that joins the cluster is the rollup.',
  );
});

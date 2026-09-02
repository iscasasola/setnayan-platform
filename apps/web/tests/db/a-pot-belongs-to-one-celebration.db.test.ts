/**
 * A POT BELONGS TO ONE CELEBRATION — AND A CLUSTER CANNOT TAKE IT AWAY.
 *
 * Phase 7a shipped `event_clusters` + `event_cluster_members`: a wedding, its
 * engagement party and its bridal shower can now be named as one year (owner
 * lock 2026-07-15). Three later phases sit on that primitive, and every one of
 * them will be tempted by the same shortcut — "the year has 30,000 shots" reads
 * beautifully on a screen.
 *
 * 🛑 IT WOULD ALSO CHANGE WHAT EVERY CUSTOMER ALREADY BOUGHT. The pot is
 * per-celebration BY CONSTRUCTION today: `papic_event_pool_usage` is keyed
 * `event_id PRIMARY KEY`, grants are keyed `event_id`, and every reserve/
 * release door takes `p_event_id`. That is the primitive people pay for — not a
 * display detail. Rolling it up to a cluster is not a feature, it is a silent
 * repricing of celebrations that are already sold.
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
 * Test 1 is behavioural and is the one that matters: two celebrations really in
 * one cluster, points really granted to one. The name-shaped checks after it
 * catch the mistake one commit EARLIER, at the moment the column appears.
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

/**
 * Columns that mean "this row holds value". A cluster may hold none of them.
 *
 * ⚠ DELIBERATELY BROAD, AND IT WILL SOMEDAY FIRE ON SOMETHING INNOCENT — a
 * share token, say. That is the trade this guard is making: a loud false
 * positive lands in review where a person narrows the pattern on purpose,
 * whereas a pattern tight enough never to nag is also tight enough to miss the
 * one column that pools the money. If it fires on something harmless, narrow
 * it in the diff and say why. Do not delete it.
 */
const VALUE_BEARING =
  /(point|credit|shot|amount|price|peso|centavo|balance|budget|wallet|token|pool|guest_count|pax)/i;

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

test('two celebrations in ONE cluster keep two separate pots', async () => {
  const owner = await newUser('cluster-pot-owner@example.com');
  const wedding = await newEvent('The wedding', owner);
  const shower = await newEvent('The bridal shower', owner);

  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1, 'Our year') RETURNING event_cluster_id`,
    [owner],
  );
  const clusterId = c.rows[0]!.event_cluster_id;

  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, is_anchor, linked_by)
     VALUES ($1, $2, TRUE, $3), ($1, $4, FALSE, $3)`,
    [clusterId, wedding, owner, shower],
  );

  // Both really are in the one cluster — otherwise this test proves nothing.
  const members = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_cluster_members
      WHERE event_cluster_id = $1`,
    [clusterId],
  );
  assert.equal(members.rows[0]!.n, 2, 'the two celebrations must share a cluster');

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
    `THE POT SPREAD ACROSS THE CLUSTER. The bridal shower went from ` +
      `${showerBefore.total_points} to ${showerAfter.total_points} points ` +
      'because a SIBLING was topped up. Nobody bought the shower anything — ' +
      'this is the silent repricing the 7a migration exists to prevent.',
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

  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1, 'Spend year') RETURNING event_cluster_id`,
    [owner],
  );
  const clusterId = c.rows[0]!.event_cluster_id;
  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, linked_by)
     VALUES ($1,$2,$3), ($1,$4,$3)`,
    [clusterId, wedding, owner, party],
  );

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

test('no Papic table references or names a cluster', async () => {
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

  const fks = await db.query<{ src: string }>(
    `SELECT c.conrelid::regclass::text AS src
       FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.event_clusters'::regclass`,
  );
  assert.deepEqual(
    fks.rows.map((r) => r.src).filter((t) => t.includes('papic')),
    [],
    'a Papic table now points at event_clusters',
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

/* ─────────── 4 · a cluster is a label, never a container of value ──────── */

test('the cluster tables hold no value of any kind', async () => {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('event_clusters','event_cluster_members')`,
  );
  assert.ok(cols.rows.length >= 12, 'both cluster tables must exist to be checked');

  const offenders = cols.rows
    .filter((r) => VALUE_BEARING.test(r.column_name))
    .map((r) => `${r.table_name}.${r.column_name}`);
  assert.deepEqual(
    offenders,
    [],
    `a cluster grew a value-bearing column (${offenders.join(', ')}). A cluster ` +
      'is a LABEL over celebrations. The moment it can hold points, the pot is ' +
      'no longer per-celebration.',
  );
});

/* ─────────── 5 · one celebration cannot be in two years ────────────────── */

test('a celebration belongs to at most one cluster', async () => {
  const owner = await newUser('cluster-unique@example.com');
  const wedding = await newEvent('Unique wedding', owner);
  const a = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1,'Year A') RETURNING event_cluster_id`, [owner]);
  const b = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1,'Year B') RETURNING event_cluster_id`, [owner]);

  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id) VALUES ($1,$2)`,
    [a.rows[0]!.event_cluster_id, wedding],
  );
  await assert.rejects(
    () => db.query(
      `INSERT INTO public.event_cluster_members (event_cluster_id, event_id) VALUES ($1,$2)`,
      [b.rows[0]!.event_cluster_id, wedding],
    ),
    /unique|duplicate/i,
    'the same celebration was filed into two years — it now has two places to ' +
      'be drawn, and two candidate pots',
  );
});

test('a cluster has at most one anchor', async () => {
  const owner = await newUser('cluster-anchor@example.com');
  const one = await newEvent('Anchor one', owner);
  const two = await newEvent('Anchor two', owner);
  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1,'Anchor year') RETURNING event_cluster_id`, [owner]);
  const clusterId = c.rows[0]!.event_cluster_id;

  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, is_anchor)
     VALUES ($1,$2,TRUE)`, [clusterId, one]);
  await assert.rejects(
    () => db.query(
      `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, is_anchor)
       VALUES ($1,$2,TRUE)`, [clusterId, two]),
    /unique|duplicate/i,
    'two celebrations claim to be the one the others are shown beside',
  );
});

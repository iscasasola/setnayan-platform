/**
 * A BUDGET ROLLUP IS NOT A NEW DOOR ONTO SOMEBODY ELSE'S MONEY.
 *
 * 7d adds the first surface that prints one couple's budget target beside
 * another's. That is exactly the shape of a disclosure bug, so the reads it is
 * built from are pinned here against the real schema.
 *
 * ─── 🪤 THE TRAP THIS FILE EXISTS FOR ─────────────────────────────────────
 * `events_host` is `security_invoker = false` and its own WHERE admits a couple
 * member **OR AN ACCEPTED MODERATOR**. `lib/budget-visibility.ts` was written
 * because of that: production carried a live, accepted `wedding_planner_external`
 * with `checkout: false` on an event with a ₱930,000 target, and not one surface
 * that PRINTS the figure asked which areas the delegate actually held. A rollup
 * that simply selected `events_host` for every member would be the same leak,
 * on a new page. `fetchClusterBudgets` therefore re-asks COUPLE membership per
 * read and shows the money of nothing else.
 *
 * ─── 🔑 AND MEMBERSHIP IS RE-ASKED, NOT INHERITED FROM THE LINK ───────────
 * 7a's INSERT policy checks both halves — your cluster AND your celebration —
 * but only at LINK time. Nothing revokes a membership row when a person leaves
 * an event, so a cluster can outlive the access that justified it. The last
 * test builds exactly that row.
 *
 * ⚠ ASSERTS THE OUTCOME, NEVER A THROW. Under RLS a refused SELECT is filtered
 * to zero rows and resolves happily, so counting what is VISIBLE survives
 * whichever mechanism does the refusing.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role','',false)`).catch(() => {});
  }
}

async function newUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/** A celebration with a budget target already typed by its host. */
async function newEventWithBudget(
  name: string,
  coupleId: string,
  budgetCentavos: number | null,
): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, estimated_budget_centavos)
     VALUES ($1,'celebration',$2) RETURNING event_id`,
    [name, budgetCentavos],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`,
    [eventId, coupleId],
  );
  return eventId;
}

async function newCluster(ownerId: string, name: string): Promise<string> {
  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1,$2) RETURNING event_cluster_id`,
    [ownerId, name],
  );
  return c.rows[0]!.event_cluster_id;
}

async function link(clusterId: string, eventId: string, ownerId: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, linked_by)
     VALUES ($1,$2,$3)`,
    [clusterId, eventId, ownerId],
  );
}

/**
 * THE ROLLUP'S TWO READS, as `lib/cluster-budgets.ts` actually issues them:
 * COUPLE membership first, then `events_host` — and a target is reported ONLY
 * where both answered. Reproduced in SQL so the TypeScript and the policies are
 * checked against each other rather than each against itself.
 */
async function rollupVisibleTargets(
  uid: string,
  eventIds: string[],
): Promise<Array<{ event_id: string; target: number | null }>> {
  return asUser(uid, async () => {
    const mine = await db.query<{ event_id: string }>(
      `SELECT event_id FROM public.event_members
        WHERE user_id = $1 AND member_type = 'couple' AND event_id = ANY($2::uuid[])`,
      [uid, eventIds],
    );
    const mineSet = new Set(mine.rows.map((r) => r.event_id));

    const hosts = await db.query<{ event_id: string; estimated_budget_centavos: string | null }>(
      `SELECT event_id, estimated_budget_centavos
         FROM public.events_host WHERE event_id = ANY($1::uuid[])`,
      [eventIds],
    );

    return hosts.rows
      .filter((r) => mineSet.has(r.event_id))
      .map((r) => ({
        event_id: r.event_id,
        target: r.estimated_budget_centavos === null ? null : Number(r.estimated_budget_centavos),
      }));
  });
}

/* ── the honest path ─────────────────────────────────────────────────────── */

test('a host sees the budgets of the celebrations in their own year', async () => {
  const me = await newUser('rollup-owner@example.com');
  const wedding = await newEventWithBudget('My wedding', me, 80_000_000); // ₱800,000
  const shower = await newEventWithBudget('My shower', me, 4_500_000); // ₱45,000
  const cluster = await newCluster(me, 'Our year');
  await link(cluster, wedding, me);
  await link(cluster, shower, me);

  const seen = await rollupVisibleTargets(me, [wedding, shower]);
  assert.equal(seen.length, 2, 'the host cannot read their own budgets');
  const total = seen.reduce((a, r) => a + (r.target ?? 0), 0);
  assert.equal(total, 84_500_000, 'the year did not add up to its celebrations');
});

test('a celebration with no target reads as no target — not as zero', async () => {
  const me = await newUser('rollup-untargeted@example.com');
  const party = await newEventWithBudget('Untargeted party', me, null);

  const seen = await rollupVisibleTargets(me, [party]);
  assert.equal(seen.length, 1, 'the row itself must be readable');
  assert.equal(
    seen[0]!.target,
    null,
    'an unset budget came back as a number — the column, not the app, is where ' +
      'the difference between "none" and "₱0" starts',
  );
});

/* ── 🔒 the rollup is not a new door ─────────────────────────────────────── */

test("a stranger's celebration contributes nothing to your year", async () => {
  const me = await newUser('rollup-thief@example.com');
  const stranger = await newUser('rollup-victim@example.com');
  const mine = await newEventWithBudget('Mine', me, 10_000_000);
  const theirs = await newEventWithBudget('Theirs', stranger, 93_000_000); // ₱930,000

  const seen = await rollupVisibleTargets(me, [mine, theirs]);
  assert.deepEqual(
    seen.map((r) => r.event_id),
    [mine],
    "a stranger's budget was readable through the rollup's own two queries",
  );
});

test('a GUEST at a linked celebration is shown none of its money', async () => {
  const host = await newUser('rollup-host@example.com');
  const guest = await newUser('rollup-guest@example.com');
  const party = await newEventWithBudget('The engagement party', host, 25_000_000);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'guest')`,
    [party, guest],
  );

  const seen = await rollupVisibleTargets(guest, [party]);
  assert.deepEqual(seen, [], 'a guest read the host\'s budget');
});

test('an ACCEPTED DELEGATE is inside events_host — and still gets no budget from the rollup', async () => {
  const host = await newUser('rollup-delegate-host@example.com');
  const planner = await newUser('rollup-delegate@example.com');
  const wedding = await newEventWithBudget('Delegated wedding', host, 93_000_000);

  /*
   * The row that made this test necessary: an accepted planner with
   * `checkout: false`. `accepted_at` DEFAULTS to NOW() and `removed_at` stays
   * NULL, which is exactly what `current_moderator_event_ids()` asks for —
   * there is no `status` column, and a first cut of this test that invented one
   * failed here rather than passing on a delegate who was never seated.
   *
   * ⚠ If the table's shape drifts again, SAY SO. A silently skipped setup would
   * leave this file green while proving nothing.
   */
  const inserted = await db
    .query(
      `INSERT INTO public.event_moderators
         (event_id, user_id, role_subtype, permissions_json)
       VALUES ($1,$2,'wedding_planner_external', jsonb_build_object('checkout', false))`,
      [wedding, planner],
    )
    .then(() => true)
    .catch((e: Error) => e.message);
  assert.equal(
    inserted,
    true,
    `could not seat an accepted delegate, so this guard proves nothing: ${inserted}`,
  );

  // Half the point: the delegate really can reach the view. Without this the
  // test below would pass even if events_host had been narrowed, and the guard
  // would be measuring nothing.
  const viaView = await asUser(planner, async () => {
    const r = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.events_host WHERE event_id = $1`,
      [wedding],
    );
    return r.rows[0]!.n;
  });
  assert.equal(
    viaView,
    1,
    'events_host no longer admits an accepted moderator — the belt in ' +
      'lib/cluster-budgets.ts may now be dead code, so re-read it before ' +
      'trusting this file',
  );

  const seen = await rollupVisibleTargets(planner, [wedding]);
  assert.deepEqual(
    seen,
    [],
    'a delegate read the couple\'s budget through the cluster rollup. ' +
      'events_host admits any accepted moderator; only a COUPLE check keeps ' +
      'the figure out of a surface that prints it.',
  );
});

test('losing your place at a celebration takes its budget out of your year', async () => {
  /*
   * 🔑 THE ONE THE LINK POLICY CANNOT CATCH. 7a checks both halves at INSERT;
   * nothing re-checks them afterwards, so a cluster outlives the membership
   * that justified it. If the rollup trusted the membership row instead of
   * re-asking, this budget would keep printing forever.
   */
  const me = await newUser('rollup-departed@example.com');
  const wedding = await newEventWithBudget('A wedding I left', me, 55_000_000);
  const cluster = await newCluster(me, 'A year I kept');
  await link(cluster, wedding, me);

  const before = await rollupVisibleTargets(me, [wedding]);
  assert.equal(before.length, 1, 'setup failed — the budget was never visible to begin with');

  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [
    wedding,
    me,
  ]);

  // The link survives; the access does not.
  const stillLinked = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_cluster_members WHERE event_cluster_id = $1`,
    [cluster],
  );
  assert.equal(stillLinked.rows[0]!.n, 1, 'the membership row vanished, so this proves nothing');

  const after = await rollupVisibleTargets(me, [wedding]);
  assert.deepEqual(
    after,
    [],
    'a cluster kept printing the budget of a celebration its owner no longer ' +
      'hosts — the link outlived the access and the rollup never re-asked',
  );
});

/* ── the cluster still holds no money of its own ─────────────────────────── */

test('7d added no money column to either cluster table', async () => {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('event_clusters','event_cluster_members')`,
  );
  assert.ok(cols.rows.length >= 12, 'both cluster tables must exist to be checked');
  const offenders = cols.rows
    .filter((r) => /(budget|amount|price|peso|centavo|total|balance)/i.test(r.column_name))
    .map((r) => `${r.table_name}.${r.column_name}`);
  assert.deepEqual(
    offenders,
    [],
    `a cluster grew a money column (${offenders.join(', ')}). The rollup is ` +
      'DERIVED ON READ; a stored total is stale the first time a host edits ' +
      'their budget, and a stale money number is read as fact.',
  );
});

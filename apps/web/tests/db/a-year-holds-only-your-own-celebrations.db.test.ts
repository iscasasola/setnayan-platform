/**
 * A YEAR HOLDS ONLY YOUR OWN CELEBRATIONS.
 *
 * The 7a linking policy needs BOTH halves — your cluster AND your celebration —
 * and either half alone is a defect this schema has already paid for once:
 *
 *   · cluster-ownership alone → anyone may file SOMEBODY ELSE'S wedding into
 *     their own year. An insert policy that only checks whose row it is has no
 *     opinion about what is in it.
 *   · couple-membership alone → anyone may push their celebration into a
 *     STRANGER'S year.
 *
 * 🔑 ONE QUERY, MANY PREDICATES: deleting either half of the WITH CHECK leaves
 * the happy path perfectly green, because the honest case satisfies both. Every
 * test below is built to be the row that ONE predicate alone would let through,
 * so removing either half turns something red. Proved by mutation, not assumed.
 *
 * ⚠ AND IT ASSERTS THE OUTCOME, NEVER A THROW. Under RLS a refused SELECT is
 * filtered to zero rows and resolves happily — a denial and a no-op are the
 * same value — so counting what is actually visible survives whichever
 * mechanism does the refusing.
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

/** Returns the postgres error message, or null when the statement succeeded. */
async function attempt(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
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

async function newEvent(name: string, coupleId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1,'celebration') RETURNING event_id`, [name]);
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple')`, [eventId, coupleId]);
  return eventId;
}

async function newCluster(ownerId: string, name: string): Promise<string> {
  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name)
     VALUES ($1,$2) RETURNING event_cluster_id`, [ownerId, name]);
  return c.rows[0]!.event_cluster_id;
}

async function memberCount(clusterId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_cluster_members
      WHERE event_cluster_id = $1`, [clusterId]);
  return r.rows[0]!.n;
}

/* ── the honest path still works ─────────────────────────────────────────── */

/*
 * 🪤 THE GAP THIS CLOSES. Every other test here builds its cluster with the
 * elevated replay role and only the MEMBER insert runs as a person — so a
 * broken INSERT grant or policy on `event_clusters` itself would have passed
 * the whole file. Nobody could ever make a year and every refusal test would
 * still be green. The creation path has to be exercised as the person.
 */
test('a signed-in person can create a year of their own', async () => {
  const me = await newUser('year-creator@example.com');
  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `INSERT INTO public.event_clusters (owner_user_id, display_name)
         VALUES ($1, 'A year I made myself')`,
        [me],
      ),
    ),
  );
  assert.equal(err, null, `a person could not create their own year: ${err}`);

  const mine = await asUser(me, async () => {
    const r = await db.query<{ display_name: string; public_id: string }>(
      `SELECT display_name, public_id FROM public.event_clusters`);
    return r.rows;
  });
  assert.equal(mine.length, 1, 'the year they just made is not readable to them');
  assert.match(
    mine[0]!.public_id, /^S89Y-[0-9A-Z]{10}$/,
    `the canonical id did not mint: ${mine[0]!.public_id}`,
  );
});

test('you cannot create a year in somebody else\'s name', async () => {
  const me = await newUser('year-forger@example.com');
  const victim = await newUser('year-forged-on@example.com');
  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `INSERT INTO public.event_clusters (owner_user_id, display_name)
         VALUES ($1, 'Not mine')`, [victim])));
  /*
   * ⚠ ASSERT THE OUTCOME, NOT THE WORDING. Two different mechanisms can refuse
   * this — the RLS WITH CHECK, or the absence of the column grant — and a test
   * pinned to one message goes red when the OTHER one does the refusing, which
   * reads as a regression while the data is perfectly safe.
   */
  assert.notEqual(err, null, 'a year was filed under a stranger\'s name');
  const landed = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.event_clusters WHERE owner_user_id = $1`,
    [victim]);
  assert.equal(landed.rows[0]!.n, 0, 'the forged year is in the table');
});

test('you can group your own celebrations', async () => {
  const me = await newUser('year-owner@example.com');
  const wedding = await newEvent('My wedding', me);
  const shower = await newEvent('My shower', me);
  const cluster = await newCluster(me, 'Our year');

  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `INSERT INTO public.event_cluster_members
           (event_cluster_id, event_id, is_anchor, linked_by)
         VALUES ($1,$2,TRUE,$3), ($1,$4,FALSE,$3)`,
        [cluster, wedding, me, shower],
      ),
    ),
  );
  assert.equal(err, null, `the owner was refused their own year: ${err}`);
  assert.equal(await memberCount(cluster), 2, 'the owner could not build their own year');
});

/* ── half one: your cluster, somebody else's celebration ─────────────────── */

test("you cannot file a stranger's wedding into your year", async () => {
  const me = await newUser('year-thief@example.com');
  const stranger = await newUser('year-victim@example.com');
  const theirWedding = await newEvent('Their wedding', stranger);
  const myCluster = await newCluster(me, 'My year');

  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `INSERT INTO public.event_cluster_members (event_cluster_id, event_id)
         VALUES ($1,$2)`,
        [myCluster, theirWedding],
      ),
    ),
  );
  assert.match(
    String(err),
    /row-level security/i,
    'a stranger\'s celebration was filed into a year they do not know exists',
  );
  assert.equal(await memberCount(myCluster), 0, 'the row landed anyway');
});

/* ── half two: your celebration, somebody else's cluster ─────────────────── */

test("you cannot push your celebration into a stranger's year", async () => {
  const me = await newUser('year-pusher@example.com');
  const stranger = await newUser('year-host@example.com');
  const myWedding = await newEvent('My own wedding', me);
  const theirCluster = await newCluster(stranger, 'Their year');

  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `INSERT INTO public.event_cluster_members (event_cluster_id, event_id)
         VALUES ($1,$2)`,
        [theirCluster, myWedding],
      ),
    ),
  );
  assert.match(String(err), /row-level security/i, 'a stranger\'s year gained a member');
  assert.equal(await memberCount(theirCluster), 0, 'the row landed anyway');
});

/* ── a guest is not a host ───────────────────────────────────────────────── */

test('a GUEST at a linked celebration is not shown the year it belongs to', async () => {
  const host = await newUser('year-host2@example.com');
  const guest = await newUser('year-guest@example.com');
  const party = await newEvent('The engagement party', host);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'guest')`, [party, guest]);
  const cluster = await newCluster(host, 'Host year');
  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id)
     VALUES ($1,$2)`, [cluster, party]);

  const seenByGuest = await asUser(guest, async () => {
    const r = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.event_cluster_members`);
    return r.rows[0]!.n;
  });
  assert.equal(
    seenByGuest, 0,
    'a guest learned their party belongs to a group — the cluster became a ' +
      'disclosure channel. current_event_ids() is ANY membership; the read ' +
      'policy is deliberately couple-only.',
  );

  const seenByHost = await asUser(host, async () => {
    const r = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.event_cluster_members`);
    return r.rows[0]!.n;
  });
  assert.equal(seenByHost, 1, 'the host cannot see their own year');
});

test('a stranger cannot read your year at all', async () => {
  const me = await newUser('year-private@example.com');
  const stranger = await newUser('year-nosy@example.com');
  await newCluster(me, 'Private year');

  const seen = await asUser(stranger, async () => {
    const r = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM public.event_clusters`);
    return r.rows[0]!.n;
  });
  assert.equal(seen, 0, "a stranger can list other people's years");
});

/* ── the row is yours, the field is not ──────────────────────────────────── */

test('a member row cannot be re-pointed at another celebration after the fact', async () => {
  const me = await newUser('year-repoint@example.com');
  const stranger = await newUser('year-repoint-victim@example.com');
  const mine = await newEvent('Repoint mine', me);
  const theirs = await newEvent('Repoint theirs', stranger);
  const cluster = await newCluster(me, 'Repoint year');
  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id)
     VALUES ($1,$2)`, [cluster, mine]);

  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `UPDATE public.event_cluster_members SET event_id = $1
          WHERE event_cluster_id = $2`, [theirs, cluster])));
  assert.match(
    String(err),
    /permission denied|column/i,
    'UPDATE(event_id) is granted — a member row can be walked onto a ' +
      "stranger's celebration without ever passing the both-halves check",
  );

  const still = await db.query<{ event_id: string }>(
    `SELECT event_id FROM public.event_cluster_members WHERE event_cluster_id = $1`,
    [cluster]);
  assert.equal(still.rows[0]!.event_id, mine, 'the row moved anyway');
});

test('a cluster cannot be handed to somebody else', async () => {
  const me = await newUser('year-handoff@example.com');
  const stranger = await newUser('year-recipient@example.com');
  const cluster = await newCluster(me, 'Handoff year');

  const err = await asUser(me, () =>
    attempt(() =>
      db.query(
        `UPDATE public.event_clusters SET owner_user_id = $1
          WHERE event_cluster_id = $2`, [stranger, cluster])));
  assert.match(String(err), /permission denied|column/i,
    'UPDATE(owner_user_id) is granted — a year can be pushed onto a stranger');
});

test('anon holds nothing on either cluster table', async () => {
  const rows = await db.query<{ table_name: string; privilege_type: string }>(
    `SELECT table_name, privilege_type
       FROM information_schema.role_table_grants
      WHERE grantee IN ('anon','PUBLIC')
        AND table_schema = 'public'
        AND table_name IN ('event_clusters','event_cluster_members')`);
  assert.deepEqual(
    rows.rows, [],
    `anon/PUBLIC hold grants on the cluster tables: ${JSON.stringify(rows.rows)}`,
  );
});

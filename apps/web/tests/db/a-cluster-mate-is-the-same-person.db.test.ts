/**
 * A PERSON INVITED TO THREE OCCASIONS OF ONE CLUSTER IS ONE PERSON.
 *
 * Item 7b on top of 7a's event_clusters/event_cluster_members. The person
 * spine (public.people, guests.person_id, resolve_or_claim_person) already
 * existed and was already wired — measured in prod 2026-09-02: 36 guests, 0
 * with an email, 0 with a person_id. The resolver is not broken; it
 * deliberately refuses to auto-seed a person from a NAME alone, because a
 * global name match is unsafe (two "Maria Santos" anywhere in the product).
 *
 * 20271191258098 adds a BOUNDED name match: two guests of the same name in
 * DIFFERENT celebrations of the SAME cluster resolve to one person. Bounded
 * by event_cluster_members, never by name alone — so the same guard this
 * file proves also has to prove the negative: two UNCLUSTERED celebrations
 * with a same-named guest must NOT silently merge.
 *
 * 🔑 ORDER MUST NOT MATTER: a host can link a cluster before or after the
 * guest lists exist. Both orders are tested so a fix for one direction can't
 * quietly leave the other broken.
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

async function asUser<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  if (uid) {
    await db.query(`SELECT set_config('request.jwt.claim.role','authenticated',false)`);
    await db.exec(`SET ROLE authenticated`);
  }
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

async function linkToCluster(clusterId: string, eventId: string, linkedBy: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, linked_by)
     VALUES ($1,$2,$3)`, [clusterId, eventId, linkedBy]);
}

async function addGuest(eventId: string, first: string, last: string): Promise<{ guestId: string; personId: string | null }> {
  const r = await db.query<{ guest_id: string; person_id: string | null }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,$2,$3,'both','family')
     RETURNING guest_id, person_id`,
    [eventId, first, last],
  );
  return { guestId: r.rows[0]!.guest_id, personId: r.rows[0]!.person_id };
}

/* ───────────── 1 · guests exist first, the cluster links them after ────── */

test('linking a cluster unifies two already-existing same-name guests', async () => {
  const owner = await newUser('cluster-mate-backfill@example.com');
  const wedding = await newEvent('Backfill wedding', owner);
  const shower = await newEvent('Backfill shower', owner);

  const g1 = await addGuest(wedding, 'Maria', 'Santos');
  const g2 = await addGuest(shower, 'Maria', 'Santos');
  assert.equal(g1.personId, null, 'an unclustered guest minted a person eagerly');
  assert.equal(g2.personId, null, 'an unclustered guest minted a person eagerly');

  const cluster = await newCluster(owner, 'Backfill year');
  await linkToCluster(cluster, wedding, owner);
  await linkToCluster(cluster, shower, owner);

  const rows = await db.query<{ person_id: string | null }>(
    `SELECT person_id FROM public.guests WHERE guest_id IN ($1,$2)`,
    [g1.guestId, g2.guestId],
  );
  const ids = rows.rows.map((r) => r.person_id);
  assert.ok(ids[0] !== null, 'the wedding guest still has no person after the cluster formed');
  assert.equal(
    ids[0], ids[1],
    `linking the cluster left two person rows instead of one: ${JSON.stringify(ids)}`,
  );
});

/* ───────────── 2 · the cluster exists first, guests arrive after ───────── */

test('a guest added to a second celebration of an existing cluster joins its cluster-mate', async () => {
  const owner = await newUser('cluster-mate-forward@example.com');
  const wedding = await newEvent('Forward wedding', owner);
  const engagement = await newEvent('Forward engagement party', owner);
  const cluster = await newCluster(owner, 'Forward year');
  await linkToCluster(cluster, wedding, owner);
  await linkToCluster(cluster, engagement, owner);

  const g1 = await addGuest(wedding, 'Jose', 'Reyes');
  assert.equal(g1.personId, null, 'the first cluster-mate has nobody to match yet');

  const g2 = await addGuest(engagement, 'Jose', 'Reyes');
  assert.ok(g2.personId, 'the second cluster-mate did not resolve a person');

  const first = await db.query<{ person_id: string | null }>(
    `SELECT person_id FROM public.guests WHERE guest_id = $1`, [g1.guestId]);
  assert.equal(
    first.rows[0]!.person_id, g2.personId,
    'the two cluster-mates ended up as two different people',
  );

  // A third celebration in the SAME cluster converges on the SAME node.
  const party = await newEvent('Forward bachelor party', owner);
  await linkToCluster(cluster, party, owner);
  const g3 = await addGuest(party, 'Jose', 'Reyes');
  assert.equal(
    g3.personId, g2.personId,
    'a third occasion in the same cluster minted a fourth person instead of reusing the third',
  );
});

/* ───────────── 3 · unclustered celebrations never merge ────────────────── */

test('two UNCLUSTERED celebrations with a same-named guest do NOT silently merge', async () => {
  const owner = await newUser('cluster-mate-unclustered@example.com');
  const eventA = await newEvent('Unclustered A', owner);
  const eventB = await newEvent('Unclustered B', owner);

  const gA = await addGuest(eventA, 'Ana', 'Cruz');
  const gB = await addGuest(eventB, 'Ana', 'Cruz');

  assert.equal(gA.personId, null, 'an unclustered guest was linked to a person anyway');
  assert.equal(gB.personId, null, 'an unclustered guest was linked to a person anyway');
});

test('a different name in the same cluster does not match', async () => {
  const owner = await newUser('cluster-mate-nomatch@example.com');
  const wedding = await newEvent('Nomatch wedding', owner);
  const shower = await newEvent('Nomatch shower', owner);
  const cluster = await newCluster(owner, 'Nomatch year');
  await linkToCluster(cluster, wedding, owner);
  await linkToCluster(cluster, shower, owner);

  const g1 = await addGuest(wedding, 'Pedro', 'Garcia');
  const g2 = await addGuest(shower, 'Juana', 'Dela Cruz');

  assert.equal(g1.personId, null, 'two different names in one cluster were merged');
  assert.equal(g2.personId, null, 'two different names in one cluster were merged');
});

/* ───────────── 4 · the pot guard from 7a is untouched by this file ─────── */

test('the shot pot guard from 7a still holds after the person-spine wiring', async () => {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name LIKE 'papic%'`);
  const offenders = cols.rows.filter((r) => /cluster/i.test(r.column_name));
  assert.deepEqual(
    offenders, [],
    `7b introduced a Papic/cluster column: ${offenders.map((o) => `${o.table_name}.${o.column_name}`).join(', ')}`,
  );
});

/* ───────────── 5 · the roster read shape respects the SAME RLS as 7a ───── */

test('the couple sees one roster row for their cluster-mate guest', async () => {
  const owner = await newUser('roster-owner@example.com');
  const wedding = await newEvent('Roster wedding', owner);
  const shower = await newEvent('Roster shower', owner);
  const cluster = await newCluster(owner, 'Roster year');
  await linkToCluster(cluster, wedding, owner);
  await linkToCluster(cluster, shower, owner);
  await addGuest(wedding, 'Liza', 'Torres');
  await addGuest(shower, 'Liza', 'Torres');

  const rows = await asUser(owner, async () => {
    const r = await db.query<{ identity_key: string; celebrations: unknown[] }>(
      `SELECT identity_key, celebrations FROM public.cluster_guest_roster($1)`,
      [cluster],
    );
    return r.rows;
  });

  assert.equal(rows.length, 1, `expected one unified roster row, got ${rows.length}`);
  assert.equal(
    (rows[0]!.celebrations as unknown[]).length, 2,
    'the one person should carry both per-celebration guest rows underneath',
  );
});

test('a stranger reads zero roster rows for a cluster that is not theirs', async () => {
  const owner = await newUser('roster-owner2@example.com');
  const stranger = await newUser('roster-stranger@example.com');
  const wedding = await newEvent('Roster wedding 2', owner);
  const cluster = await newCluster(owner, 'Roster year 2');
  await linkToCluster(cluster, wedding, owner);
  await addGuest(wedding, 'Marco', 'Diaz');

  const rows = await asUser(stranger, async () => {
    const r = await db.query<{ identity_key: string }>(
      `SELECT identity_key FROM public.cluster_guest_roster($1)`, [cluster]);
    return r.rows;
  });
  assert.equal(rows.length, 0, "a stranger could read another host's roster");
});

test('a GUEST (not the couple) reads zero cluster roster rows', async () => {
  const host = await newUser('roster-host3@example.com');
  const guestAccount = await newUser('roster-guest3@example.com');
  const wedding = await newEvent('Roster wedding 3', host);
  const g = await addGuest(wedding, 'Nina', 'Ramos');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id)
     VALUES ($1,$2,'guest',$3)`, [wedding, guestAccount, g.guestId]);
  const cluster = await newCluster(host, 'Roster year 3');
  await linkToCluster(cluster, wedding, host);

  const rows = await asUser(guestAccount, async () => {
    const r = await db.query<{ identity_key: string }>(
      `SELECT identity_key FROM public.cluster_guest_roster($1)`, [cluster]);
    return r.rows;
  });
  assert.equal(
    rows.length, 0,
    'a guest learned their celebration belongs to a cluster via the roster — ' +
      'event_cluster_members read is deliberately couple-only, not current_event_ids()',
  );
});

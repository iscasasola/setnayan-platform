/**
 * A SEAT LINK, UNDONE, GIVES THE ROW BACK — and a NAME never inherits an account.
 *
 * The owner's own wedding, 2026-09-30: a test account was bound to the GROOM
 * row. The `link_guest_to_account_person` trigger then re-pointed the row's
 * person_id at the test account's person, so `is_event_celebrant` counted the
 * wrong account and the creator's own row stopped reading as theirs.
 *
 * lib/seat-unlink.ts undoes it with plain statements whose effect depends on a
 * TRIGGER — `set_guest_person` fires on UPDATE OF email and re-derives the
 * person from the row's own address. A TS test cannot see that, so this file
 * runs the same statements against the replayed schema:
 *
 *   1. the incident, replayed: binding a stranger makes them a celebrant;
 *   2. the unlink's statements: delete that ONE guest membership, clear the
 *      person that account put there while re-sending the row's own email —
 *      the creator's person comes back, the stranger stops being a celebrant,
 *      and the creator's couple membership is untouched;
 *   3. 20271254506023: a same-name row in another celebration of the cluster
 *      does NOT inherit a person an account has claimed, while two unclaimed
 *      name-only rows still converge (7b unchanged).
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

async function newUser(email: string): Promise<{ id: string; personId: string }> {
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  const p = await db.query<{ person_id: string }>(
    `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
    [id],
  );
  assert.ok(p.rows[0], `no claimed person was made for ${email} — the fixture is wrong, not the rule`);
  return { id, personId: p.rows[0]!.person_id };
}

async function newEvent(name: string, creatorId: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1,'celebration') RETURNING event_id`,
    [name],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1,$2,'couple','created_event')`,
    [eventId, creatorId],
  );
  return eventId;
}

async function celebrant(eventId: string, userId: string): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(`SELECT public.is_event_celebrant($1,$2) AS ok`, [eventId, userId]);
  return r.rows[0]!.ok;
}

async function personOf(guestId: string): Promise<string | null> {
  const r = await db.query<{ person_id: string | null }>(
    `SELECT person_id FROM public.guests WHERE guest_id = $1`,
    [guestId],
  );
  return r.rows[0]!.person_id;
}

test('an unlink gives the creator their own row back, and the stranger stops being a celebrant', async () => {
  const owner = await newUser('seat-unlink-owner@example.com');
  const stranger = await newUser('seat-unlink-stranger@example.com');
  const eventId = await newEvent('Seat unlink wedding', owner.id);

  // The creator's own celebrant row carries the creator's address → their person.
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role, email)
     VALUES ($1,'Ice','Casasola','both','family','celebrant',$2) RETURNING guest_id`,
    [eventId, 'seat-unlink-owner@example.com'],
  );
  const rowId = g.rows[0]!.guest_id;
  assert.equal(await personOf(rowId), owner.personId, 'the fixture row did not resolve to the creator');
  assert.equal(await celebrant(eventId, owner.id), true);

  // ── 1 · THE INCIDENT: a guest link binds the stranger to that row.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id, joined_via)
     VALUES ($1,$2,'guest',$3,'guest_signup')`,
    [eventId, stranger.id, rowId],
  );
  assert.equal(await personOf(rowId), stranger.personId, 'the link trigger no longer re-points the row (incident not replayed)');
  assert.equal(await celebrant(eventId, stranger.id), true, 'the incident no longer makes the stranger a celebrant');

  // ── 2 · THE UNLINK — the statements lib/seat-unlink.ts runs.
  await db.query(
    `DELETE FROM public.event_members
      WHERE event_id = $1 AND user_id = $2 AND member_type = 'guest' AND guest_id = $3`,
    [eventId, stranger.id, rowId],
  );
  // person was theirs → null; the email was NOT theirs → re-sent, so
  // set_guest_person re-derives the person from the row's own address.
  await db.query(
    `UPDATE public.guests SET person_id = NULL, email = $2 WHERE guest_id = $1`,
    [rowId, 'seat-unlink-owner@example.com'],
  );

  assert.equal(await personOf(rowId), owner.personId, 'the unlink left the creator’s row without the creator');
  assert.equal(await celebrant(eventId, stranger.id), false, 'the stranger is still a celebrant after the unlink');
  assert.equal(await celebrant(eventId, owner.id), true, 'the creator stopped being a celebrant of their own event');
  const couple = await db.query(
    `SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2 AND member_type = 'couple'`,
    [eventId, owner.id],
  );
  assert.equal(couple.rows.length, 1, 'the unlink touched the couple’s own membership');
});

test('a name in another celebration of the cluster never inherits a CLAIMED person', async () => {
  const owner = await newUser('seat-unlink-cluster-owner@example.com');
  const guestAccount = await newUser('seat-unlink-cluster-guest@example.com');
  const wedding = await newEvent('Cluster wedding', owner.id);
  const shower = await newEvent('Cluster shower', owner.id);
  const c = await db.query<{ event_cluster_id: string }>(
    `INSERT INTO public.event_clusters (owner_user_id, display_name) VALUES ($1,'Cluster year') RETURNING event_cluster_id`,
    [owner.id],
  );
  const cluster = c.rows[0]!.event_cluster_id;
  for (const ev of [wedding, shower]) {
    await db.query(
      `INSERT INTO public.event_cluster_members (event_cluster_id, event_id, linked_by) VALUES ($1,$2,$3)`,
      [cluster, ev, owner.id],
    );
  }

  // A wedding row holding an ACCOUNT's person (bound — rightly or wrongly).
  const w = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Carla','Dizon','both','family') RETURNING guest_id`,
    [wedding],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id, joined_via)
     VALUES ($1,$2,'guest',$3,'guest_signup')`,
    [wedding, guestAccount.id, w.rows[0]!.guest_id],
  );
  assert.equal(await personOf(w.rows[0]!.guest_id), guestAccount.personId);

  // A same-name, name-only row in the shower must NOT pick that account up.
  const s = await db.query<{ guest_id: string; person_id: string | null }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Carla','Dizon','both','family') RETURNING guest_id, person_id`,
    [shower],
  );
  assert.equal(
    s.rows[0]!.person_id,
    null,
    'a typed name inherited somebody’s ACCOUNT across the cluster (20271254506023 regressed)',
  );

  // 7b unchanged: two UNCLAIMED name-only rows still converge.
  const a = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Lito','Ramos','both','family') RETURNING guest_id`,
    [wedding],
  );
  const b = await db.query<{ person_id: string | null }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Lito','Ramos','both','family') RETURNING person_id`,
    [shower],
  );
  assert.ok(b.rows[0]!.person_id, 'the gate also stopped two unclaimed cluster-mates converging (7b broken)');
  assert.equal(await personOf(a.rows[0]!.guest_id), b.rows[0]!.person_id);
});

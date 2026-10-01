/**
 * tests/db/a-label-is-asked.db.test.ts — a label counts only once the other
 * person says yes; one partner at a time; groups are joined, never placed.
 *
 * Owner, 2026-09-29, on the People picker:
 *   > "add partner (to become a couple)"
 *   > "assigning a label needs a handshake"
 *
 * Migration 20271254271392. The database is the control — the People actions
 * say the same rules in plain words, but a hand-made request meets THIS. Most
 * tests are negatives: they assert an attempt FAILS, because a handshake test
 * that only proves the happy path proves nothing about the handshake.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let ice = '';
let claire = '';
let maria = '';
let juan = '';
let icePerson = '';
let clairePerson = '';
let mariaPerson = '';
let juanPerson = '';

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}
/** Run `sql` as `uid` (or as the pipeline when null); the error message or null. */
async function attempt(uid: string | null, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    if (uid) await asUser(uid);
    else await reset();
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    await reset();
  }
}
async function row(from: string, to: string) {
  await reset();
  const r = await db.query<{
    connection_id: string;
    relation: string | null;
    layer: string | null;
    status: string;
    proposed_relation: string | null;
    proposed_status: string | null;
  }>(
    `SELECT connection_id, relation, layer, status, proposed_relation, proposed_status
       FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2 AND deleted_at IS NULL`,
    [from, to],
  );
  return r.rows[0]!;
}
/** A connection both people have accepted, unlabelled — as the roster makes one. */
async function connect(fromUid: string, from: string, toUid: string, to: string): Promise<void> {
  await asUser(fromUid);
  await db.query(
    `INSERT INTO public.person_connections (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, NULL, NULL, 'pending', $3)`,
    [from, to, fromUid],
  );
  await asUser(toUid);
  await db.query(
    `UPDATE public.person_connections SET status = 'confirmed', confirmed_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [from, to],
  );
  await reset();
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string, name: string): Promise<[string, string]> => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    );
    const uid = r.rows[0]!.id;
    await db.query(`UPDATE public.people SET display_name = $2 WHERE claimed_by_user_id = $1`, [uid, name]);
    const p = await db.query<{ person_id: string }>(
      `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
      [uid],
    );
    return [uid, p.rows[0]!.person_id];
  };
  [ice, icePerson] = await mk('ice@asked.test', 'Ice Casasola');
  [claire, clairePerson] = await mk('claire@asked.test', 'Claire Reyes');
  [maria, mariaPerson] = await mk('maria@asked.test', 'Maria Santos');
  [juan, juanPerson] = await mk('juan@asked.test', 'Juan Cruz');
  await connect(ice, icePerson, claire, clairePerson);
});

after(async () => {
  await db.close();
});

// ── the vocabulary ──────────────────────────────────────────────────────────

test('🔴 partner is a word the database accepts — and so is every word it held before', async () => {
  await reset();
  const r = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conname = 'person_connections_relation_check'`,
  );
  const def = r.rows[0]!.def;
  for (const w of ['spouse', 'parent', 'child', 'sibling', 'godparent', 'godchild', 'friend', 'partner']) {
    assert.ok(def.includes(`'${w}'`), `the relation CHECK no longer holds '${w}'`);
  }
});

// ── the handshake ───────────────────────────────────────────────────────────

test('🔴 on a CONFIRMED connection the declarer cannot simply SET a label', async () => {
  const err = await attempt(
    ice,
    `UPDATE public.person_connections SET relation = 'sibling', layer = 'family'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.ok(err, 'a label was written onto a connection nobody asked Claire about');
  assert.match(err!, /asked, not set/);
  assert.equal((await row(icePerson, clairePerson)).relation, null);
});

test('🔒 …and the person asked cannot set it for them either', async () => {
  const err = await attempt(
    claire,
    `UPDATE public.person_connections SET relation = 'friend', layer = 'friend'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.ok(err, 'the recipient wrote a label with no ask');
});

test('🔒 only the declarer may ASK — the recipient cannot put an ask in the declarer’s mouth', async () => {
  const err = await attempt(
    claire,
    `UPDATE public.person_connections SET proposed_relation = 'parent', proposed_status = 'pending'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.ok(err);
  assert.match(err!, /only the declarer may ask/);
});

test('the declarer ASKS — and an asked label derives no kin (relation stays empty)', async () => {
  const err = await attempt(
    ice,
    `UPDATE public.person_connections
        SET proposed_relation = 'sibling', proposed_status = 'pending', proposed_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.equal(err, null, `the declarer could not ask: ${err}`);
  const r = await row(icePerson, clairePerson);
  assert.equal(r.proposed_relation, 'sibling');
  assert.equal(r.proposed_status, 'pending');
  assert.equal(r.relation, null, 'an unconfirmed label reached `relation`, which is what kinship reads');
});

test('🔒 the declarer cannot answer their own ask — neither accept nor decline', async () => {
  const accept = await attempt(
    ice,
    `UPDATE public.person_connections
        SET relation = 'sibling', layer = 'family', proposed_relation = NULL, proposed_status = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.ok(accept, 'the declarer accepted their own label');
  const decline = await attempt(
    ice,
    `UPDATE public.person_connections SET proposed_status = 'declined'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.ok(decline, 'the declarer declined their own ask');
});

test('🔒 the person asked cannot accept a DIFFERENT word than the one asked', async () => {
  const err = await attempt(
    claire,
    `UPDATE public.person_connections
        SET relation = 'parent', layer = 'family', proposed_relation = NULL, proposed_status = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.ok(err, 'Claire turned "sibling" into "parent" by accepting');
});

test('🔴 DECLINE — the person asked says no; the label is gone, the connection stays', async () => {
  const err = await attempt(
    claire,
    `UPDATE public.person_connections SET proposed_status = 'declined', proposal_answered_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.equal(err, null, `Claire could not decline: ${err}`);
  const r = await row(icePerson, clairePerson);
  assert.equal(r.proposed_status, 'declined', 'the decline was not kept for "didn’t confirm"');
  assert.equal(r.relation, null);
  assert.equal(r.status, 'confirmed', 'declining a label took the connection with it');
});

test('🔴 CONFIRM — asked again, the person asked says yes and it becomes the label', async () => {
  const ask = await attempt(
    ice,
    `UPDATE public.person_connections
        SET proposed_relation = 'sibling', proposed_status = 'pending', proposed_at = now(), proposal_answered_at = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.equal(ask, null, `asking again after a no was refused: ${ask}`);
  const yes = await attempt(
    claire,
    `UPDATE public.person_connections
        SET relation = 'sibling', layer = 'family', proposed_relation = NULL, proposed_status = NULL,
            proposed_at = NULL, proposal_answered_at = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.equal(yes, null, `Claire could not confirm: ${yes}`);
  const r = await row(icePerson, clairePerson);
  assert.equal(r.relation, 'sibling');
  assert.equal(r.proposed_relation, null);
});

test('either side may TAKE BACK an agreed label — it only ever removes', async () => {
  const err = await attempt(
    claire,
    `UPDATE public.person_connections SET relation = NULL, layer = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, clairePerson],
  );
  assert.equal(err, null, `the person asked could not take a label back: ${err}`);
  assert.equal((await row(icePerson, clairePerson)).relation, null);
});

test('🔒 a separate ask exists only on a confirmed connection — never on an unanswered request', async () => {
  await asUser(maria);
  await db.query(
    `INSERT INTO public.person_connections (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'friend', 'friend', 'pending', $3)`,
    [mariaPerson, juanPerson, maria],
  );
  await reset();
  const err = await attempt(
    maria,
    `UPDATE public.person_connections SET proposed_relation = 'sibling', proposed_status = 'pending'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [mariaPerson, juanPerson],
  );
  assert.ok(err, 'an ask was stacked on a request that is itself unanswered');
  // …and on an unanswered request, only the declarer words the label it carries.
  const reword = await attempt(
    juan,
    `UPDATE public.person_connections SET relation = 'partner', layer = 'family'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [mariaPerson, juanPerson],
  );
  assert.ok(reword, 'the person asked re-worded the request about them');
  await reset();
  await db.query(`DELETE FROM public.person_connections WHERE from_person_id = $1 AND to_person_id = $2`, [
    mariaPerson,
    juanPerson,
  ]);
});

// ── one partner at a time ───────────────────────────────────────────────────

test('🔴 ONE PARTNER — a second partner ask from the same person is refused', async () => {
  await connect(ice, icePerson, maria, mariaPerson);
  await connect(ice, icePerson, juan, juanPerson);
  const first = await attempt(
    ice,
    `UPDATE public.person_connections SET proposed_relation = 'partner', proposed_status = 'pending', proposed_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, mariaPerson],
  );
  assert.equal(first, null, `the first partner ask was refused: ${first}`);
  const second = await attempt(
    ice,
    `UPDATE public.person_connections SET proposed_relation = 'partner', proposed_status = 'pending', proposed_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, juanPerson],
  );
  assert.ok(second, 'Ice asked two people to be her partner at once');
  assert.match(second!, /one partner at a time/);
});

test('🔒 a partner request SOMEBODY ELSE sent does not block you naming your own', async () => {
  // Juan asks Claire (a stranger to this) to be his partner — a request on a
  // fresh connection. Claire's own partner ask must still go through.
  await asUser(juan);
  await db.query(
    `INSERT INTO public.person_connections (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'partner', 'family', 'pending', $3)`,
    [juanPerson, clairePerson, juan],
  );
  await reset();
  await connect(claire, clairePerson, maria, mariaPerson);
  const err = await attempt(
    claire,
    `UPDATE public.person_connections SET proposed_relation = 'partner', proposed_status = 'pending', proposed_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [clairePerson, mariaPerson],
  );
  assert.equal(err, null, `an incoming request blocked Claire’s own partner: ${err}`);
});

test('🔴 accepting a partner while you already hold one is refused', async () => {
  // Maria has an ask from Ice (pending) and one from Claire (pending). She
  // accepts Ice — now agreed — then cannot also accept Claire.
  const yesIce = await attempt(
    maria,
    `UPDATE public.person_connections
        SET relation = 'partner', layer = 'family', proposed_relation = NULL, proposed_status = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, mariaPerson],
  );
  assert.equal(yesIce, null, `Maria could not accept Ice: ${yesIce}`);
  const yesClaire = await attempt(
    maria,
    `UPDATE public.person_connections
        SET relation = 'partner', layer = 'family', proposed_relation = NULL, proposed_status = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [clairePerson, mariaPerson],
  );
  assert.ok(yesClaire, 'Maria now has two partners');
  assert.match(yesClaire!, /one partner at a time/);
});

test('replacing is possible: end the old partner, then the new one goes through', async () => {
  const end = await attempt(
    maria,
    `UPDATE public.person_connections SET relation = NULL, layer = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, mariaPerson],
  );
  assert.equal(end, null, `Maria could not end the partnership: ${end}`);
  const yesClaire = await attempt(
    maria,
    `UPDATE public.person_connections
        SET relation = 'partner', layer = 'family', proposed_relation = NULL, proposed_status = NULL
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [clairePerson, mariaPerson],
  );
  assert.equal(yesClaire, null, `the replacement was refused: ${yesClaire}`);
});

// ── an ask does not linger ──────────────────────────────────────────────────

test('the 30-day sweep clears a stale label ask and keeps the connection', async () => {
  const ask = await attempt(
    ice,
    `UPDATE public.person_connections
        SET proposed_relation = 'friend', proposed_status = 'pending', proposed_at = now()
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, juanPerson],
  );
  assert.equal(ask, null, ask ?? '');
  // Age it — a timestamp-only change, which the guard lets anyone make.
  await reset();
  await db.query(
    `UPDATE public.person_connections SET proposed_at = now() - interval '40 days'
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [icePerson, juanPerson],
  );
  await db.query(`SELECT public.expire_stale_connection_requests(30)`);
  const r = await row(icePerson, juanPerson);
  assert.equal(r.proposed_relation, null, 'a month-old ask is still waiting');
  assert.equal(r.status, 'confirmed', 'the sweep took a confirmed connection');
});

// ── groups: joined, never placed ────────────────────────────────────────────

test('🔒 GROUPS — nobody can put another person in a group; they join it themselves', async () => {
  // Owner 2026-09-29: "adding someone to a group does not need a handshake" —
  // then, asked whether members can see a group, "or make a handshake as
  // well?". Members CAN see it (community_roster_member_read shows the roster
  // to every member), so the rule that applies is the handshake — and it
  // already exists: `community_members` admits INSERT for an admin only, and
  // the only door in is the person opening the group's link and pressing Join
  // (/samahan/join/[token]). This pins that no organiser can skip it.
  await reset();
  const c = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name, created_by) VALUES ('Asked Barkada', $1) RETURNING community_id`,
    [ice],
  );
  const community = c.rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role) VALUES ($1, $2, 'organizer')`,
    [community, ice],
  );
  const err = await attempt(
    ice,
    `INSERT INTO public.community_members (community_id, user_id, role) VALUES ($1, $2, 'member')`,
    [community, juan],
  );
  assert.ok(err, 'an organiser put Juan in a group he never joined');
  await reset();
  const n = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.community_members WHERE community_id = $1 AND user_id = $2`,
    [community, juan],
  );
  assert.equal(n.rows[0]!.n, 0);
});

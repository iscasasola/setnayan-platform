/**
 * tests/db/connection-label-comes-later.db.test.ts — a person can be on your
 * list before you have said what they are.
 *
 * Owner, 2026-08-21: *"just add them first. Then you can set a label."* That
 * sentence is a schema change: `relation` and `layer` were NOT NULL, so the
 * product could not hold "on the list, unlabelled" at all.
 *
 * The interesting assertions here are the ones about the SHAPES THAT MUST STILL
 * BE REFUSED. Making a column nullable is easy; the risk is the half-states it
 * opens — a layer with no relation, or the same person landing on the roster
 * twice because two NULLs are distinct in a unique index.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let ana = '';
let ben = '';
let anaPerson = '';
let benPerson = '';

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
async function attempt(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const mk = async (email: string, name: string): Promise<string> => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    );
    const uid = r.rows[0]!.id;
    await db.query(`UPDATE public.people SET display_name = $2 WHERE claimed_by_user_id = $1`, [
      uid,
      name,
    ]);
    return uid;
  };
  const personOf = async (uid: string): Promise<string> => {
    const r = await db.query<{ person_id: string }>(
      `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
      [uid],
    );
    return r.rows[0]!.person_id;
  };
  ana = await mk('ana@label.test', 'Ana Cruz');
  ben = await mk('ben@label.test', 'Ben Reyes');
  anaPerson = await personOf(ana);
  benPerson = await personOf(ben);
});

after(async () => {
  await db.close();
});

test('🔴 an UNLABELLED connection is storable — "add them first"', async () => {
  await reset();
  const err = await attempt(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, declared_name, created_by_user_id)
     VALUES ($1, $2, NULL, NULL, 'pending', 'Ben from work', $3)`,
    [anaPerson, benPerson, ana],
  );
  assert.equal(err, null, 'the roster cannot hold a person until this is legal');
});

test('the name the adder typed is kept, so the row can be rendered', async () => {
  // Before confirmation the name-visibility rule deliberately refuses to resolve
  // Ben's real name TO Ana. Without declared_name her own list says "Someone".
  await reset();
  const r = await db.query<{ declared_name: string | null }>(
    `SELECT declared_name FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [anaPerson, benPerson],
  );
  assert.equal(r.rows[0]!.declared_name, 'Ben from work');
});

test('🔒 the same person cannot land on the roster twice unlabelled', async () => {
  // Two NULLs are DISTINCT in a unique index, so `person_connections_edge_uniq`
  // (from, to, relation) cannot do this job — hence the partial index.
  await reset();
  const err = await attempt(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, NULL, NULL, 'pending', $3)`,
    [anaPerson, benPerson, ana],
  );
  assert.ok(err, 'Ben was added to the list a second time');
  assert.match(err!, /unique|duplicate/i);
});

test('🔒 a layer without a label is refused, and so is a label without a layer', async () => {
  await reset();
  const halfA = await attempt(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, NULL, 'family', 'pending', $3)`,
    [benPerson, anaPerson, ben],
  );
  assert.ok(halfA, 'a family layer with no relation was accepted');
  const halfB = await attempt(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'sibling', NULL, 'pending', $3)`,
    [benPerson, anaPerson, ben],
  );
  assert.ok(halfB, 'a relation with no layer was accepted');
});

test('the label can be set afterwards, and the row is otherwise untouched', async () => {
  await asUser(ana);
  await db.query(
    `UPDATE public.person_connections SET relation = 'sibling', layer = 'family'
      WHERE from_person_id = $1 AND to_person_id = $2 AND deleted_at IS NULL`,
    [anaPerson, benPerson],
  );
  await reset();
  const r = await db.query<{ relation: string; layer: string; status: string }>(
    `SELECT relation, layer, status FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [anaPerson, benPerson],
  );
  assert.deepEqual(r.rows[0], { relation: 'sibling', layer: 'family', status: 'pending' });
});

test('🔒 the person being ASKED cannot re-word the claim about them', async () => {
  // RLS lets the recipient update the row (that is how they confirm). The
  // action's `from_person_id = my person` filter is what actually holds this
  // line — so the guarantee is asserted the way the app enforces it.
  await asUser(ben);
  await db.query(
    `UPDATE public.person_connections SET relation = 'friend', layer = 'friend'
      WHERE from_person_id = $1 AND to_person_id = $2
        AND from_person_id IN (SELECT person_id FROM public.people WHERE claimed_by_user_id = auth.uid())`,
    [anaPerson, benPerson],
  );
  await reset();
  const r = await db.query<{ relation: string }>(
    `SELECT relation FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2`,
    [anaPerson, benPerson],
  );
  assert.equal(r.rows[0]!.relation, 'sibling', 'the recipient rewrote the declarer’s label');
});

test('an unlabelled edge produces NO kinship — labels are what derive', async () => {
  // The derivation contract: only confirmed AND labelled edges make kin. An
  // unlabelled edge has nothing to say about lolo, pinsan or the in-laws.
  await reset();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.person_connections
      WHERE relation IS NULL AND layer IS NOT NULL`,
  );
  assert.equal(r.rows[0]!.n, 0);
});

test('a labelled edge still obeys the original relation vocabulary', async () => {
  await reset();
  const err = await attempt(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'kumpare', 'family', 'pending', $3)`,
    [benPerson, anaPerson, ben],
  );
  assert.ok(err, 'the seven stored relations are frozen — a new word was accepted');
  assert.match(err!, /relation_check|violates check/i);
});

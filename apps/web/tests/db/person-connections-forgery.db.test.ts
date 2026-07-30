/**
 * tests/db/person-connections-forgery.db.test.ts — nobody can forge a
 * relationship, and nobody can confirm one about themselves.
 *
 * ── WHAT SHIPPED, AND WHY IT WAS WRONG ─────────────────────────────────────
 * `person_connections` shipped with ONE policy, FOR ALL, whose WITH CHECK was
 * byte-identical to its USING and accepted EITHER endpoint. So:
 *
 *   · either side could INSERT a row naming the other ......... forgery
 *   · the SAME side could then UPDATE it to confirmed ......... self-approval
 *
 * "X is my sibling" could be declared and confirmed by one person alone.
 *
 * ── WHY A TRIGGER AND NOT ONLY POLICIES ────────────────────────────────────
 * RLS answers WHO may touch a row, never WHICH transition they may make. Both
 * endpoints legitimately need UPDATE — one to retract, the other to confirm —
 * so any UPDATE policy admitting both also admits the declarer setting
 * `confirmed`. Splitting the policy alone LOOKS like a fix and leaves
 * self-approval intact. The transition rule lives in a BEFORE UPDATE trigger
 * that can compare OLD to NEW.
 *
 * Every test below is therefore a NEGATIVE: it asserts an attack FAILS. A
 * security test that only proves the happy path is decoration.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** alice declares; bob is the person the claim is ABOUT. */
let alice = '';
let bob = '';
let alicePerson = '';
let bobPerson = '';

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
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
/**
 * The person node for an account.
 *
 * Do NOT insert one: `person_spine_self_claim_trigger` already creates the
 * account holder's node on user insert, and `people.claimed_by_user_id` is
 * UNIQUE ("one account claims <= 1 person"). Inserting fights the trigger and
 * fails on the unique constraint — which is how this helper came to exist.
 */
async function personFor(uid: string): Promise<string> {
  const r = await db.query<{ person_id: string }>(
    `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
    [uid],
  );
  const id = r.rows[0]?.person_id;
  if (!id) throw new Error(`no auto-claimed person for ${uid} — did the self-claim trigger change?`);
  return id;
}
/** Runs `fn` as `uid` and returns the error message, or null if it succeeded. */
async function attempt(uid: string, sql: string, params: unknown[] = []): Promise<string | null> {
  await asUser(uid);
  try {
    await db.query(sql, params);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  alice = await createUser('alice@test.local');
  bob = await createUser('bob@test.local');
  alicePerson = await personFor(alice);
  bobPerson = await personFor(bob);
});
after(async () => {
  await db.close();
});

/* ── the shape of the fix ── */

test('the FOR ALL policy is gone, replaced by per-command policies', async () => {
  await reset();
  const r = await db.query<{ polname: string; polcmd: string }>(
    `SELECT polname, polcmd FROM pg_policy
      WHERE polrelid = 'public.person_connections'::regclass`,
  );
  const cmds = r.rows.map((x) => x.polcmd).sort();
  assert.ok(!cmds.includes('*'), 'a FOR ALL policy is exactly what allowed forgery');
  // r=select w=update a=insert d=delete
  assert.deepEqual(cmds, ['a', 'd', 'r', 'w'], 'expected one policy per command');
});

test('the transition guard trigger exists — RLS alone cannot do this', async () => {
  await reset();
  const r = await db.query(
    `SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.person_connections'::regclass
        AND tgname = 'person_connections_transition_guard'`,
  );
  assert.equal(r.rows.length, 1);
});

/* ── forgery ── */

test('🔴 bob CANNOT declare a connection FROM alice — forgery is closed', async () => {
  const err = await attempt(
    bob,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'sibling', 'family', 'pending', $3)`,
    [alicePerson, bobPerson, bob],
  );
  assert.ok(err, 'bob authored a claim as alice — forgery is OPEN');
});

test('alice CAN declare her own connection to bob', async () => {
  const err = await attempt(
    alice,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'sibling', 'family', 'pending', $3)`,
    [alicePerson, bobPerson, alice],
  );
  assert.equal(err, null, `the declarer must be able to declare: ${err}`);
});

test('nobody may insert a PRE-CONFIRMED edge', async () => {
  const err = await attempt(
    alice,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'spouse', 'family', 'confirmed', $3)`,
    [alicePerson, bobPerson, alice],
  );
  assert.ok(err, 'a row inserted already-confirmed bypasses the recipient entirely');
});

/* ── self-approval: the half a policy split alone would miss ── */

test('🔴 alice CANNOT confirm the claim she made about bob', async () => {
  await reset();
  const r = await db.query<{ connection_id: string }>(
    `SELECT connection_id FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2 AND status = 'pending' LIMIT 1`,
    [alicePerson, bobPerson],
  );
  const id = r.rows[0]?.connection_id;
  assert.ok(id, 'fixture missing — the declare test should have created this');

  const err = await attempt(
    alice,
    `UPDATE public.person_connections SET status = 'confirmed' WHERE connection_id = $1`,
    [id],
  );
  assert.ok(err, 'THE HOLE: the declarer self-approved their own claim');
  assert.match(err!, /only the recipient/i);
});

test('bob — the person it is about — CAN confirm it', async () => {
  await reset();
  const r = await db.query<{ connection_id: string }>(
    `SELECT connection_id FROM public.person_connections
      WHERE from_person_id = $1 AND to_person_id = $2 AND status = 'pending' LIMIT 1`,
    [alicePerson, bobPerson],
  );
  const err = await attempt(
    bob,
    `UPDATE public.person_connections SET status = 'confirmed' WHERE connection_id = $1`,
    [r.rows[0]!.connection_id],
  );
  assert.equal(err, null, `the recipient must be able to answer: ${err}`);
});

test('an answered connection is final — no silent re-litigation', async () => {
  await reset();
  const r = await db.query<{ connection_id: string }>(
    `SELECT connection_id FROM public.person_connections
      WHERE status = 'confirmed' LIMIT 1`,
  );
  const err = await attempt(
    bob,
    `UPDATE public.person_connections SET status = 'declined' WHERE connection_id = $1`,
    [r.rows[0]!.connection_id],
  );
  assert.ok(err, 'a confirmed connection was flipped to declined in place');
});

/* ── endpoints ── */

test('endpoints are immutable — a confirmed edge cannot be transplanted', async () => {
  await reset();
  const carol = await createUser('carol@test.local');
  const carolPerson = await personFor(carol);
  const r = await db.query<{ connection_id: string }>(
    `SELECT connection_id FROM public.person_connections WHERE status = 'confirmed' LIMIT 1`,
  );
  const err = await attempt(
    alice,
    `UPDATE public.person_connections SET to_person_id = $2 WHERE connection_id = $1`,
    [r.rows[0]!.connection_id, carolPerson],
  );
  assert.ok(err, 'a confirmed relationship was re-pointed at a third person');
  assert.match(err!, /immutable/i);
});

/* ── drafts (owner OD2) ── */

test('a draft is invisible to the person it is about', async () => {
  await reset();
  await asUser(alice);
  await db.query(
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'friend', 'friend', 'draft', $3)`,
    [alicePerson, bobPerson, alice],
  );
  await reset();

  await asUser(bob);
  const seen = await db.query(
    `SELECT 1 FROM public.person_connections WHERE status = 'draft'`,
  );
  await reset();
  assert.equal(seen.rows.length, 0, 'bob can see a claim that was never put to him');

  await asUser(alice);
  const own = await db.query(
    `SELECT 1 FROM public.person_connections WHERE status = 'draft'`,
  );
  await reset();
  assert.equal(own.rows.length, 1, 'the declarer must see their own draft');
});

test('a sent connection cannot be returned to draft', async () => {
  await reset();
  const r = await db.query<{ connection_id: string }>(
    `SELECT connection_id FROM public.person_connections WHERE status = 'confirmed' LIMIT 1`,
  );
  const err = await attempt(
    alice,
    `UPDATE public.person_connections SET status = 'draft' WHERE connection_id = $1`,
    [r.rows[0]!.connection_id],
  );
  assert.ok(err, 'a claim already seen was un-sent');
});

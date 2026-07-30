/**
 * tests/db/kin-pilot-mutual-accounts.db.test.ts — during the pilot, no
 * relationship is stored about someone who has no account.
 *
 * ── WHAT THIS PROTECTS ─────────────────────────────────────────────────────
 * The sharpest exposure in a kin graph is not the graph — it is storing named,
 * dated records of people who have NO ACCOUNT, never agreed to anything, and
 * cannot see or delete their own data. `people.claimed_by_user_id` is nullable
 * by design, so an unclaimed node is entirely possible.
 *
 * While the connection tree runs as a pilot ahead of the NPC submission, a
 * connection may only exist when BOTH endpoints are claimed accounts. Then both
 * parties can see it, answer it, and delete it.
 *
 * The point of testing it: this is a claim the product now makes to users on
 * /privacy — "nothing is recorded about someone without an account". A promise
 * in a privacy policy that nothing enforces is the worst kind of untrue.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let alice = '';
let alicePerson = '';
let bobPerson = '';
let unclaimedPerson = '';

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

  const mk = async (email: string): Promise<string> => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
      [email],
    );
    return r.rows[0]!.id;
  };
  const personOf = async (uid: string): Promise<string> => {
    const r = await db.query<{ person_id: string }>(
      `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
      [uid],
    );
    return r.rows[0]!.person_id;
  };

  alice = await mk('alice@pilot.test');
  const bob = await mk('bob@pilot.test');
  alicePerson = await personOf(alice);
  bobPerson = await personOf(bob);

  // Someone in the graph with NO account — a grandparent who never signed up.
  const r = await db.query<{ person_id: string }>(
    `INSERT INTO public.people (display_name, created_by_user_id)
     VALUES ('Lola (no account)', $1) RETURNING person_id`,
    [alice],
  );
  unclaimedPerson = r.rows[0]!.person_id;
});
after(async () => {
  await db.close();
});

test('the pilot guardrail trigger is installed', async () => {
  await reset();
  const r = await db.query(
    `SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.person_connections'::regclass
        AND tgname = 'kin_pilot_mutual_accounts'`,
  );
  assert.equal(r.rows.length, 1);
});

test('an UNCLAIMED person can exist — the guardrail is on the connection, not the node', async () => {
  await reset();
  const r = await db.query(`SELECT 1 FROM public.people WHERE person_id = $1`, [unclaimedPerson]);
  assert.equal(r.rows.length, 1, 'people.claimed_by_user_id is nullable by design');
});

test('🔴 a connection to someone with NO account is REFUSED', async () => {
  // The promise /privacy now makes to users, enforced in the database.
  const err = await attempt(
    alice,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'parent', 'family', 'pending', $3)`,
    [alicePerson, unclaimedPerson, alice],
  );
  assert.ok(err, 'a relationship was stored about someone who has no account');
  assert.match(err!, /both people must have an account/i);
});

test('a connection between two ACCOUNTS is allowed', async () => {
  const err = await attempt(
    alice,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'friend', 'friend', 'pending', $3)`,
    [alicePerson, bobPerson, alice],
  );
  assert.equal(err, null, `both sides have accounts, this must work: ${err}`);
});

test('an endpoint cannot be MOVED onto an unclaimed person after the fact', async () => {
  // Without covering UPDATE, the guardrail would be a front door with an open
  // window: insert between two accounts, then re-point at the unclaimed node.
  await reset();
  const r = await db.query<{ connection_id: string }>(
    `SELECT connection_id FROM public.person_connections LIMIT 1`,
  );
  const err = await attempt(
    alice,
    `UPDATE public.person_connections SET to_person_id = $2 WHERE connection_id = $1`,
    [r.rows[0]!.connection_id, unclaimedPerson],
  );
  assert.ok(err, 'an endpoint was moved onto a person with no account');
});

test('the refusal explains what to do, not just that it failed', async () => {
  const err = await attempt(
    alice,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'sibling', 'family', 'draft', $3)`,
    [alicePerson, unclaimedPerson, alice],
  );
  assert.match(err!, /invite them first|pilot to end/i);
});

test('drafts are covered too — the guardrail is not a send-time check', async () => {
  const err = await attempt(
    alice,
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_by_user_id)
     VALUES ($1, $2, 'parent', 'family', 'draft', $3)`,
    [alicePerson, unclaimedPerson, alice],
  );
  assert.ok(err, 'an unclaimed person was recorded in a private draft');
});

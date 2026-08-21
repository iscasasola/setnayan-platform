/**
 * tests/db/requests-do-not-linger.db.test.ts — the sentence on /privacy, proved
 * against real rows.
 *
 * > "Requests do not linger. A request nobody answers, and a connection that is
 * >  declined, are both deleted after 30 days."
 *
 * That was live and unbacked: no `DELETE FROM person_connections` existed
 * anywhere. Under RA 10173 we are bound by the retention period we DECLARE, so
 * the copy was the obligation, not an aspiration.
 *
 * The interesting half is what the sweep must NOT take. Deleting too much here
 * is not hygiene, it is destroying a relationship two people agreed to.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { CONNECTION_REQUEST_RETENTION_DAYS } from '../../lib/connection-request-expiry-core';

let replay: ReplayResult;
let db: PGlite;
const people: Record<string, string> = {};

async function mk(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const uid = r.rows[0]!.id;
  const p = await db.query<{ person_id: string }>(
    `SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`,
    [uid],
  );
  return p.rows[0]!.person_id;
}

/** Seed one edge with an explicit age, in days. */
async function seed(
  from: string,
  to: string,
  relation: string | null,
  status: string,
  ageDays: number,
): Promise<void> {
  await db.query(
    // Every placeholder is cast: an untyped NULL leaves Postgres unable to infer
    // the parameter's type at all ("could not determine data type of parameter").
    `INSERT INTO public.person_connections
       (from_person_id, to_person_id, relation, layer, status, created_at, updated_at,
        confirmed_at, declined_at)
     VALUES ($1::uuid, $2::uuid, $3::text,
             CASE WHEN $3::text IS NULL THEN NULL ELSE 'family' END, $4::text,
             now() - make_interval(days => $5::int),
             now() - make_interval(days => $5::int),
             CASE WHEN $4::text = 'confirmed' THEN now() - make_interval(days => $5::int) END,
             CASE WHEN $4::text = 'declined'  THEN now() - make_interval(days => $5::int) END)`,
    [from, to, relation, status, ageDays],
  );
}

async function sweep(days = CONNECTION_REQUEST_RETENTION_DAYS): Promise<number> {
  const r = await db.query<{ expire_stale_connection_requests: number }>(
    `SELECT public.expire_stale_connection_requests($1) AS expire_stale_connection_requests`,
    [days],
  );
  return r.rows[0]!.expire_stale_connection_requests;
}

async function statuses(): Promise<string[]> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.person_connections ORDER BY status`,
  );
  return r.rows.map((x) => x.status);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  people.a = await mk('a@linger.test');
  people.b = await mk('b@linger.test');
  people.c = await mk('c@linger.test');
  people.d = await mk('d@linger.test');
});

after(async () => {
  await db.close();
});

test('the number the sweep uses is the number the copy renders', () => {
  // Two hand-typed numbers agreeing today is how llms.txt drifted for three
  // weeks with green CI. /privacy derives its figure from this constant.
  assert.equal(CONNECTION_REQUEST_RETENTION_DAYS, 30);
});

test('🔴 an unanswered request older than 30 days is DELETED', async () => {
  await seed(people.a!, people.b!, 'sibling', 'pending', 45);
  assert.equal(await sweep(), 1);
  assert.deepEqual(await statuses(), []);
});

test('🔴 a declined connection older than 30 days is DELETED', async () => {
  await seed(people.a!, people.b!, 'friend', 'declined', 40);
  assert.equal(await sweep(), 1);
  assert.deepEqual(await statuses(), []);
});

test('an unsent DRAFT expires too — a private note nobody touched in a month', async () => {
  await seed(people.a!, people.c!, null, 'draft', 60);
  assert.equal(await sweep(), 1);
  assert.deepEqual(await statuses(), []);
});

test('🔒 a CONFIRMED connection is never touched, however old', async () => {
  // Both people agreed to this. It has no expiry, and deleting it would be data
  // loss dressed as hygiene.
  await seed(people.a!, people.b!, 'sibling', 'confirmed', 3650);
  assert.equal(await sweep(), 0, 'the sweep counted a confirmed connection');
  assert.deepEqual(await statuses(), ['confirmed']);
  await db.query(`DELETE FROM public.person_connections`);
});

test('🔒 a request YOUNGER than the window survives — this is a deadline, not a purge', async () => {
  await seed(people.a!, people.b!, 'parent', 'pending', 29);
  await seed(people.a!, people.c!, 'friend', 'declined', 29);
  assert.equal(await sweep(), 0);
  assert.deepEqual(await statuses(), ['declined', 'pending']);
  await db.query(`DELETE FROM public.person_connections`);
});

test('the boundary is the age, not the status — old and young sort correctly together', async () => {
  await seed(people.a!, people.b!, 'sibling', 'pending', 31); // goes
  await seed(people.a!, people.c!, 'friend', 'pending', 2); // stays
  await seed(people.b!, people.c!, 'parent', 'confirmed', 400); // stays
  await seed(people.b!, people.d!, 'friend', 'declined', 90); // goes
  assert.equal(await sweep(), 2);
  assert.deepEqual(await statuses(), ['confirmed', 'pending']);
  await db.query(`DELETE FROM public.person_connections`);
});

test('🔒 a row somebody already removed is not counted twice', async () => {
  // `deleted_at` rows are gone from every read already; re-deleting them would
  // only inflate the number the job reports.
  await seed(people.a!, people.b!, 'sibling', 'pending', 90);
  await db.query(`UPDATE public.person_connections SET deleted_at = now()`);
  assert.equal(await sweep(), 0);
  await db.query(`DELETE FROM public.person_connections`);
});

test('running it twice deletes nothing the second time', async () => {
  await seed(people.a!, people.b!, 'sibling', 'pending', 90);
  assert.equal(await sweep(), 1);
  assert.equal(await sweep(), 0, 'the sweep is not idempotent');
});

test('🔒 no browser role may run a retention sweep', async () => {
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query<{ can: boolean }>(
      `SELECT has_function_privilege($1, 'public.expire_stale_connection_requests(integer)', 'EXECUTE') AS can`,
      [role],
    );
    assert.equal(r.rows[0]!.can, false, `${role} can run the retention sweep`);
  }
});

test('🚨 …and the REVOKE is asserted in the SOURCE, because the replay cannot prove it', async () => {
  // MEASURED, not assumed: deleting the `REVOKE … FROM authenticated` line and
  // re-running left the privilege test above GREEN. The replay never granted
  // EXECUTE in the first place, so revoking it changes nothing here.
  //
  // In PRODUCTION it changes everything. Supabase's default privileges GRANT
  // EXECUTE to `anon` and `authenticated` on every new function in `public` —
  // the exact fact the resolve_or_claim_person lockdown was written to fix
  // (2026-07-31), where a REVOKE FROM PUBLIC alone left `anon` executing.
  // So the privilege check above passes for a reason unrelated to the guard,
  // and the guard has to be read where it actually lives: the migration text.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const sql = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'supabase',
      'migrations',
      '20271155852254_requests_do_not_linger.sql',
    ),
    'utf8',
  );
  for (const role of ['PUBLIC', 'anon', 'authenticated']) {
    assert.ok(
      sql.includes(
        `REVOKE ALL ON FUNCTION public.expire_stale_connection_requests(INTEGER) FROM ${role};`,
      ),
      `the migration no longer revokes the sweep from ${role} — in production that role can run it`,
    );
  }
  assert.ok(
    sql.includes(
      'GRANT EXECUTE ON FUNCTION public.expire_stale_connection_requests(INTEGER) TO service_role;',
    ),
    'the sweep is not granted to service_role — the job that calls it cannot run',
  );
});

test('the pilot trigger now records the owner ruling that supersedes its own text', async () => {
  // Its migration said "for the full product it is probably not [the right
  // trade]", inviting a future session to drop it. The owner ruled the opposite
  // on 2026-08-21, and applied migrations are never edited — so the correction
  // lives on the object, which is what a reader queries.
  const r = await db.query<{ comment: string | null }>(
    `SELECT obj_description(p.oid) AS comment
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'kin_pilot_require_mutual_accounts'`,
  );
  const comment = r.rows[0]?.comment ?? '';
  assert.match(comment, /must have an account to be listed as people/i);
  assert.match(comment, /Do NOT drop this trigger/i);
});

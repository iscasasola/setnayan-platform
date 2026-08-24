/**
 * tests/db/a-samahan-lives-while-one-stays.db.test.ts
 *
 * Two rules, found together because the owner tried to leave his own samahan
 * and nothing happened.
 *
 * 1. 🚨 LEAVING WORKS AT ALL. `community_members` shipped with a DELETE
 *    POLICY and no DELETE GRANT, so Postgres refused every leave before RLS
 *    was consulted — for every member, since 20271023100000. The first test
 *    here is the one that would have caught it: it does not ask whether the
 *    policy is right, it asks whether a person can actually go.
 *
 * 2. A SAMAHAN LIVES WHILE ANYONE IS IN IT (owner 2026-08-24). Closing is a
 *    consequence of the last person leaving — no role may do it to a group
 *    that still holds people.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

let organiser = '';
let member = '';
let community = '';

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
async function attempt(
  uid: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: number; error: string }> {
  await asUser(uid);
  try {
    const res = await db.query(sql, params);
    return { rows: res.affectedRows ?? 0, error: '' };
  } catch (e) {
    return { rows: 0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await reset();
  }
}
async function memberCount(): Promise<number> {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.community_members WHERE community_id = $1`,
    [community],
  );
  return r.rows[0]!.n;
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
  organiser = await mk('org@lives.test');
  member = await mk('member@lives.test');
  const c = await db.query<{ community_id: string }>(
    `INSERT INTO public.communities (name, created_by) VALUES ('Lives Barkada', $1)
     RETURNING community_id`,
    [organiser],
  );
  community = c.rows[0]!.community_id;
  await db.query(
    `INSERT INTO public.community_members (community_id, user_id, role)
     VALUES ($1, $2, 'organizer'), ($1, $3, 'member')`,
    [community, organiser, member],
  );
});

after(async () => {
  await db.close();
});

test('🔴 a member can actually LEAVE — the grant exists, not just the policy', async () => {
  const r = await attempt(
    member,
    `DELETE FROM public.community_members WHERE community_id = $1 AND user_id = $2`,
    [community, member],
  );
  assert.equal(r.error, '', `leaving must not be refused: ${r.error}`);
  assert.equal(r.rows, 1, 'the membership row must actually go');
  assert.equal(await memberCount(), 1, 'one person left behind');
});

test('a stranger cannot delete somebody else’s membership', async () => {
  const stranger = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ('stranger@lives.test', jsonb_build_object('account_type','customer'))
       RETURNING id`,
    )
  ).rows[0]!.id;
  const r = await attempt(
    stranger,
    `DELETE FROM public.community_members WHERE community_id = $1`,
    [community],
  );
  assert.equal(r.rows, 0, 'the DELETE policy still scopes who may remove whom');
  assert.equal(await memberCount(), 1, 'and the roster is untouched');
});

test('🔒 nobody may close a samahan that still holds someone — organizer included', async () => {
  assert.equal(await memberCount(), 1, 'precondition: one member remains');
  const r = await attempt(
    organiser,
    `UPDATE public.communities SET archived = TRUE WHERE community_id = $1`,
    [community],
  );
  assert.match(r.error, /lives while anyone is still in it/i, 'the close must be refused');
  const still = await db.query<{ archived: boolean }>(
    `SELECT archived FROM public.communities WHERE community_id = $1`,
    [community],
  );
  assert.equal(still.rows[0]!.archived, false, 'and the samahan stays open');
});

test('the LAST member leaving is what closes it', async () => {
  const gone = await attempt(
    organiser,
    `DELETE FROM public.community_members WHERE community_id = $1 AND user_id = $2`,
    [community, organiser],
  );
  assert.equal(gone.error, '', `the last organizer must be able to go: ${gone.error}`);
  assert.equal(await memberCount(), 0, 'the roster is empty');

  // With nobody left, the close is permitted — this is the ONLY way it opens.
  const closed = await attempt(
    organiser,
    `UPDATE public.communities SET archived = TRUE WHERE community_id = $1`,
    [community],
  );
  // The ex-member no longer passes the membership USING clause, so their own
  // UPDATE matches zero rows — which is why the app closes it as the service
  // role. What matters is that the TRIGGER no longer objects.
  assert.equal(closed.error, '', `no field-guard objection once empty: ${closed.error}`);

  await db.query(`UPDATE public.communities SET archived = TRUE WHERE community_id = $1`, [
    community,
  ]);
  const row = await db.query<{ archived: boolean }>(
    `SELECT archived FROM public.communities WHERE community_id = $1`,
    [community],
  );
  assert.equal(row.rows[0]!.archived, true, 'an empty samahan can be closed');
});

test('every verb a POLICY declares is a verb the role was GRANTED', async () => {
  // The guard that would have caught this whole class. A policy without its
  // grant can never be reached: Postgres checks the grant first, so the
  // caller gets a permission error and the policy's careful scoping is
  // decoration. Column grants count too — ignoring them makes `events` look
  // broken when it is deliberately revoked.
  const { rows } = await db.query<{ tablename: string; cmd: string; role: string }>(`
    WITH pol AS (
      SELECT tablename, cmd, unnest(roles) AS role
      FROM pg_policies WHERE schemaname='public' AND cmd <> 'ALL'
    ), have AS (
      SELECT table_name, grantee, privilege_type
        FROM information_schema.role_table_grants WHERE table_schema='public'
      UNION
      SELECT table_name, grantee, privilege_type
        FROM information_schema.role_column_grants WHERE table_schema='public'
    )
    SELECT DISTINCT p.tablename, p.cmd, p.role
      FROM pol p
     WHERE p.role IN ('authenticated','anon')
       AND NOT EXISTS (
         SELECT 1 FROM have h
          WHERE h.table_name=p.tablename AND h.grantee=p.role AND h.privilege_type=p.cmd)
     ORDER BY p.tablename, p.cmd
  `);
  const found = rows.map((r) => `${r.tablename}.${r.cmd}.${r.role}`);
  // Each line is a WRITTEN DECISION that a policy can never fire, with the
  // reason — a bill, not a baseline. Every one below was checked by grepping
  // for the writer: all of them go through the service role, so the policy is
  // vestigial documentation rather than a broken path. Do NOT add a line to
  // make this pass; a new entry means somebody's button silently does
  // nothing, which is exactly how leaving a samahan stayed broken.
  const ALLOWED: Record<string, string> = {
    'events.DELETE.authenticated':
      'REVOKED on purpose 2026-08-21 — every delete path goes through service_role so the R2 sweep and the supplier gate cannot be skipped.',
    'orders.INSERT.authenticated':
      'Minting an order is service-role only (order-price-authority); the browser never names a price.',
    'payments.INSERT.authenticated':
      'Written by createMoneyWriterClient() — a dedicated service-role client, deliberately not the caller’s.',
    'data_privacy_controls.SELECT.authenticated':
      'No direct client caller anywhere; reached through RPCs that run elevated.',
    'data_privacy_controls.UPDATE.authenticated': 'Same as its SELECT.',
    'fraud_signals.SELECT.authenticated':
      'Written and read by the fraud runner on the admin client; no couple- or vendor-facing surface reads it.',
    'fraud_signals.UPDATE.authenticated': 'Same as its SELECT.',
    'fraud_enforcement_audit.SELECT.authenticated':
      'Append-only audit written by the enforcement runner on the admin client.',
  };
  const unexplained = found.filter((f) => !(f in ALLOWED)).sort();
  assert.deepEqual(
    unexplained,
    [],
    `policy declares a verb the role cannot use — the policy can never be reached: ${unexplained.join(', ')}`,
  );
});

/**
 * THE ADMIN AUDIT TRAIL IS APPEND-ONLY (migrations replayed).
 *
 * The security audit's top finding: RLS denies admin UPDATE/DELETE, but the
 * SERVICE-ROLE client bypasses RLS — so a rogue or compromised service path could
 * rewrite or erase the record of its own actions. A trigger is the fix precisely
 * because triggers are NOT RLS: they fire for every role.
 *
 * Four claims, and the third is why this shipped as a re-write of PR #2048
 * rather than a merge of it:
 *
 *   1. DELETE is refused, always.
 *   2. A content edit is refused.
 *   3. **A NEW column is protected the day it is added.** #2048 enumerated the
 *      content columns by name and `admin_audit_log.metadata` had appeared since
 *      — an UPDATE touching only `metadata` would have passed its check on a
 *      table that must not be rewritable. This asserts the column-list-free
 *      comparison closes that.
 *   4. The RA 10173 anonymisation UPDATE still succeeds — an append-only trigger
 *      that blocks it breaks account deletion outright.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let userId: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  userId = await makeUser('auditor@test.com');
});

after(async () => {
  await replay?.db?.close?.();
});

/** public.users.user_id FKs auth.users(id), and the on_auth_user_created trigger
 *  mints the public row — so seed auth first and upsert on top, the same shape
 *  first-user-journey.db.test.ts uses. */
async function makeUser(email: string): Promise<string> {
  const a = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const id = a.rows[0]!.id;
  await db.query(
    `INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [id, email],
  );
  return id;
}

async function seedAudit(): Promise<string> {
  const r = await db.query<{ audit_log_id: string }>(
    `INSERT INTO public.admin_audit_log (action, target_table, target_id, reason, actor_user_id, metadata)
     VALUES ('deleted_something', 'events', gen_random_uuid(), 'because', $1, '{"ip":"1.2.3.4"}'::jsonb)
     RETURNING audit_log_id`,
    [userId],
  );
  return r.rows[0]!.audit_log_id;
}

test('both audit tables carry the append-only trigger', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     WHERE c.relname IN ('admin_audit_log','admin_data_access_log')
       AND t.tgname LIKE '%append_only' AND NOT t.tgisinternal`,
  );
  assert.equal(r.rows[0]!.n, 2);
});

test('DELETE is refused — the trail cannot be erased', async () => {
  const id = await seedAudit();
  await assert.rejects(
    () => db.query(`DELETE FROM public.admin_audit_log WHERE audit_log_id=$1`, [id]),
    /DELETE is not permitted/,
  );
  const c = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.admin_audit_log WHERE audit_log_id=$1`, [id]);
  assert.equal(c.rows[0]!.n, 1, 'the row survives');
});

test('rewriting a content column is refused', async () => {
  const id = await seedAudit();
  await assert.rejects(
    () => db.query(`UPDATE public.admin_audit_log SET reason='something else' WHERE audit_log_id=$1`, [id]),
    /may not be modified/,
  );
});

test('⚠ rewriting `metadata` is refused — the exact hole PR #2048 would have shipped', async () => {
  // #2048's carve-out listed action/target_table/target_id/before_json/after_json/
  // reason/created_at/actor_user_id. `metadata` was added later, so this UPDATE
  // satisfied every clause it checked and would have been ALLOWED.
  const id = await seedAudit();
  await assert.rejects(
    () => db.query(
      `UPDATE public.admin_audit_log SET metadata='{"ip":"9.9.9.9"}'::jsonb WHERE audit_log_id=$1`, [id]),
    /may not be modified/,
    'a column added after the guard was written must still be protected',
  );
});

test('the RA 10173 anonymisation UPDATE still succeeds', async () => {
  // The cascade from ON DELETE SET NULL. If this is blocked, deleting a user
  // fails and erasure breaks — worse than the finding being open.
  const id = await seedAudit();
  await db.query(
    `UPDATE public.admin_audit_log SET actor_user_id=NULL WHERE audit_log_id=$1`, [id]);
  const r = await db.query<{ actor_user_id: string | null }>(
    `SELECT actor_user_id FROM public.admin_audit_log WHERE audit_log_id=$1`, [id]);
  assert.equal(r.rows[0]!.actor_user_id, null);
});

test('…and deleting the USER really does cascade through the trigger', async () => {
  // End-to-end: the guard must not break account deletion. This is the case an
  // unconditional append-only trigger gets wrong.
  const doomed = await makeUser('doomed@test.com');
  await db.query(
    `INSERT INTO public.admin_audit_log (action, target_table, actor_user_id)
     VALUES ('x','events',$1)`, [doomed]);
  // Delete the AUTH row — that is what an account deletion does, and the
  // ON DELETE CASCADE / SET NULL chain is what must survive the trigger.
  await db.query(`DELETE FROM auth.users WHERE id=$1`, [doomed]);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.admin_audit_log WHERE actor_user_id IS NULL`);
  assert.ok(r.rows[0]!.n >= 1, 'the audit row survives, anonymised');
});

test('an FK may be CLEARED but never REASSIGNED — clearing is erasure, moving is forgery', async () => {
  const id = await seedAudit();
  const other = await makeUser('someone-else@test.com');
  await assert.rejects(
    () => db.query(
      `UPDATE public.admin_audit_log SET actor_user_id=$1 WHERE audit_log_id=$2`,
      [other, id]),
    /may only be cleared/,
  );
});

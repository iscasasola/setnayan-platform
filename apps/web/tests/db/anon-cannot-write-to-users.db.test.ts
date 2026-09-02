/**
 * anon-cannot-write-to-users.db.test.ts
 *
 * 🔒 `anon` HELD UPDATE AND TRUNCATE ON `public.users` — ALL 53 COLUMNS.
 *
 * Supabase publishes every `public` table as a REST endpoint and the anon key ships
 * in the page source, so these were capabilities reachable with curl. No policy on
 * `users` admits anon for anything — every one is `{authenticated}` — but a grant is
 * not held back by the absence of a policy in every case, and TRUNCATE is the case
 * where it isn't: TRUNCATE IS NOT FILTERED BY RLS AT ALL.
 *
 * ⭐ AND THE OTHER HALF IS THE POINT: `SELECT` MUST SURVIVE.
 * PostgreSQL evaluates an RLS policy expression AS THE CALLING USER, so a policy whose
 * USING clause reads `users` needs the caller to hold SELECT on `users`.
 * `creator_chapters.public_can_read_published_chapter` is roles `{anon,authenticated}`
 * and does exactly that on every public creator-chapter page. Revoke anon's SELECT and
 * that policy does not deny the row — it RAISES, and the page breaks.
 *
 * 🔑 A RAISE INSIDE RLS IS NOT "THIS POLICY SAID NO", IT IS "THE WHOLE CHECK FAILED" —
 * the mechanism that took down private Realtime channels here (`20271187719883`), where
 * one ungranted predicate refused every topic at once. So this file pins BOTH
 * directions. A future narrowing of the read must keep the second test green.
 *
 * Run from apps/web: `npx tsx --test tests/db/anon-cannot-write-to-users.db.test.ts`
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
}, { timeout: 600000 });

after(async () => {
  await db?.close?.();
});

/** Every privilege `anon` holds on public.users, after the replay. */
async function anonPrivileges(): Promise<string[]> {
  const r = (await db.query(
    `SELECT privilege_type FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND table_name = 'users' AND grantee = 'anon'
      ORDER BY privilege_type`,
  )) as { rows: { privilege_type: string }[] };
  return r.rows.map((x) => x.privilege_type);
}

test('🔒 anon holds NO write capability on public.users', async () => {
  const held = await anonPrivileges();
  for (const gone of ['UPDATE', 'TRUNCATE', 'TRIGGER', 'REFERENCES', 'INSERT', 'DELETE']) {
    assert.ok(
      !held.includes(gone),
      `anon still holds ${gone} on public.users — reachable with the anon key and curl`,
    );
  }
});

test('⭐ anon KEEPS SELECT — the public creator-chapter policy cannot evaluate without it', async () => {
  // NOT a relaxation of the test above. This is the guard on the fix itself: a later
  // pass that narrows the read must narrow it COLUMN-WISE and leave a readable
  // `user_id` / `public_profile_enabled`, never revoke SELECT outright.
  const held = await anonPrivileges();
  assert.ok(
    held.includes('SELECT'),
    'anon lost SELECT on public.users — creator_chapters.public_can_read_published_chapter ' +
      'now RAISES instead of denying, and every public creator-chapter page breaks',
  );
});

test('⭐ the policy that depends on that read still exists and still reads users', async () => {
  // If this policy is ever rewritten to stop touching `users`, the SELECT above becomes
  // removable — and this test is where that gets noticed, rather than in production.
  const r = (await db.query(
    `SELECT roles::text AS roles, qual FROM pg_policies
      WHERE tablename = 'creator_chapters'
        AND policyname = 'public_can_read_published_chapter'`,
  )) as { rows: { roles: string; qual: string }[] };
  assert.equal(r.rows.length, 1, 'the public creator-chapter policy is gone');
  assert.match(r.rows[0]!.roles, /anon/, 'the policy no longer applies to anon');
  assert.match(
    r.rows[0]!.qual,
    /from\s+users/i,
    'the policy no longer reads users — anon SELECT on users may now be revocable',
  );
});

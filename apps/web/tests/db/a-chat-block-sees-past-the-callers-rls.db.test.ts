/**
 * A CHAT BLOCK SEES PAST THE CALLER'S RLS (test:db). THE ONE BUILD security fix — build-notes
 * supplier-1build-integration.md §7 item 11, found by lane C2.
 *
 * The shipped `chat_messages_block_guard` (20270223909213) looked up "who is on the other side" INLINE, under the
 * caller's RLS. A couple cannot see an UNPUBLISHED shop's vendor_profiles row, so the lookup came back empty and the
 * guard PASSED for exactly the pair it exists to stop. Migration 20271327631190 re-points the guard at the SECURITY
 * DEFINER helper `chat_pair_is_blocked` — the one hearts already use (20271325581544).
 *
 *   1. PRECONDITION: the couple really cannot see the unpublished shop's row (otherwise this file proves nothing);
 *   2. no block → the couple and the shop can both post (the guard is not a blanket refusal);
 *   3. the couple blocks the unpublished shop → the couple's post is REFUSED (the bug), and so is the shop's;
 *   4. the shop blocks the couple → refused both ways too;
 *   5. after unblocking, posting works again.
 *
 * Every write runs under `SET ROLE authenticated` — the PGlite replay is a superuser, and a policy nobody
 * impersonated past is a policy nobody tested.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', vendorUser: '', vendorId: '', eventId: '', threadId: '' };

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setAuthRole(null).catch(() => {});
}
async function createUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
async function send(asUid: string, body: string) {
  await asUser(asUid);
  try {
    await db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1, $2, $3, $4)`,
      [F.threadId, F.eventId, F.vendorId, body],
    );
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, code: (err as { code?: string }).code, message: (err as Error).message };
  } finally {
    await reset();
  }
}
async function block(blocker: string, blocked: string): Promise<void> {
  await db.query(`INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id) VALUES ($1, $2)`, [
    blocker,
    blocked,
  ]);
}
async function clearBlocks(): Promise<void> {
  await db.query(`DELETE FROM public.blocked_users WHERE blocker_user_id IN ($1, $2)`, [F.couple, F.vendorUser]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('chatblock-couple@chat.test', 'customer');
  F.vendorUser = await createUser('chatblock-vendor@chat.test', 'vendor');

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Unpublished Block Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;
  await db.query(`UPDATE public.vendor_profiles SET is_published = false WHERE vendor_profile_id = $1`, [F.vendorId]);

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Chat Block Test Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [
    F.eventId,
    F.couple,
  ]);
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.couple],
  );
  F.threadId = th.rows[0]!.thread_id;
});

after(async () => {
  await reset();
  await db?.close();
});
beforeEach(async () => {
  await reset();
  await clearBlocks();
});

test('PRECONDITION: the couple cannot see the unpublished shop’s row (the condition that defeated the inline guard)', async () => {
  await asUser(F.couple);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  await reset();
  assert.equal(r.rows[0]!.n, 0, 'the couple can see the shop — this file would not be testing the bug');
});

test('META: the guard is RESTRICTIVE FOR INSERT and asks chat_pair_is_blocked', async () => {
  const p = await db.query<{ permissive: string; cmd: string; with_check: string }>(
    `SELECT permissive, cmd, with_check FROM pg_policies
      WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_block_guard'`,
  );
  assert.equal(p.rows.length, 1, 'chat_messages_block_guard must exist');
  assert.equal(p.rows[0]!.permissive, 'RESTRICTIVE');
  assert.equal(p.rows[0]!.cmd, 'INSERT');
  assert.match(p.rows[0]!.with_check, /chat_pair_is_blocked\(event_id, vendor_profile_id\)/);
});

test('no block: the couple and the unpublished shop can both post', async () => {
  assert.deepEqual(await send(F.couple, 'Hello from the couple'), { ok: true });
  assert.deepEqual(await send(F.vendorUser, 'Hello from the shop'), { ok: true });
});

test('the couple blocked the UNPUBLISHED shop: neither side can post into the thread', async () => {
  await block(F.couple, F.vendorUser);
  const mine = await send(F.couple, 'Posting past my own block');
  assert.equal(mine.ok, false, 'the couple posted into the thread of a shop they blocked (the inline guard bug)');
  const theirs = await send(F.vendorUser, 'Posting to somebody who blocked me');
  assert.equal(theirs.ok, false, 'the blocked shop posted into the blocker’s thread');
});

test('the shop blocked the couple: refused in both directions too', async () => {
  await block(F.vendorUser, F.couple);
  assert.equal((await send(F.couple, 'To a shop that blocked me')).ok, false, 'the blocked couple posted');
  assert.equal((await send(F.vendorUser, 'To a couple I blocked')).ok, false, 'the blocking shop posted');
});

test('after unblocking, posting works again', async () => {
  await block(F.couple, F.vendorUser);
  assert.equal((await send(F.couple, 'Blocked')).ok, false);
  await clearBlocks();
  assert.deepEqual(await send(F.couple, 'Unblocked'), { ok: true });
});

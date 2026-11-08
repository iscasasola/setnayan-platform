/**
 * A MESSAGE CAN BE HEARTED — and only by somebody in that conversation (test:db). THE ONE BUILD, lane C2
 * (owner 8 Nov 2026, v111 "tap = heart"; spec plans/supplier_one_build_2026-11-08 §5.2, B1 §5 guard 3).
 *
 * `chat_message_hearts` mirrors the AS-BUILT chat_messages policies (current_thread_ids() is a stub in prod),
 * so every case below is run under `SET ROLE authenticated` — the PGlite replay is a superuser, and a policy
 * nobody impersonated past is a policy nobody tested.
 *
 *   1. the couple member hearts a message on their thread; the supplier on that thread hearts it too;
 *   2. both read both hearts; an outsider reads none and cannot write one;
 *   3. user_id is forced to the caller — naming somebody else is refused (the sabotage target);
 *   4. un-heart is an UPDATE (hearted = false); there is no DELETE;
 *   5. a BLOCKED pair cannot heart in their shared thread. ⚠ chat_messages_block_guard is RESTRICTIVE FOR
 *      INSERT only, so an EXISTS on chat_messages does NOT carry it — hearts need their own guard, and this
 *      case is what proves they have one.
 *   6. the scope (thread, event, shop) is derived from the message — a forged thread_id is overwritten.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', vendorUser: '', outsider: '', vendorId: '', eventId: '', threadId: '', msgA: '', msgB: '' };

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
async function send(asUid: string, body: string): Promise<string> {
  await asUser(asUid);
  const r = await db.query<{ message_id: string }>(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
     VALUES ($1, $2, $3, $4) RETURNING message_id`,
    [F.threadId, F.eventId, F.vendorId, body],
  );
  await reset();
  return r.rows[0]!.message_id;
}
async function heart(asUid: string, messageId: string, extra: { userId?: string; threadId?: string } = {}) {
  await asUser(asUid);
  try {
    const cols = ['message_id'];
    const vals: unknown[] = [messageId];
    if (extra.userId) {
      cols.push('user_id');
      vals.push(extra.userId);
    }
    if (extra.threadId) {
      cols.push('thread_id');
      vals.push(extra.threadId);
    }
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    await db.query(`INSERT INTO public.chat_message_hearts (${cols.join(', ')}) VALUES (${ph})`, vals);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, code: (err as { code?: string }).code, message: (err as Error).message };
  } finally {
    await reset();
  }
}
async function visibleHearts(asUid: string): Promise<Array<{ message_id: string; user_id: string; hearted: boolean }>> {
  await asUser(asUid);
  const r = await db.query<{ message_id: string; user_id: string; hearted: boolean }>(
    `SELECT message_id, user_id, hearted FROM public.chat_message_hearts ORDER BY created_at`,
  );
  await reset();
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('hearts-couple@chat.test', 'customer');
  F.vendorUser = await createUser('hearts-vendor@chat.test', 'vendor');
  F.outsider = await createUser('hearts-outsider@chat.test', 'customer');

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Hearts Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Hearts Test Event', 'birthday') RETURNING event_id`,
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
  F.msgA = await send(F.couple, 'Hello from the couple');
  F.msgB = await send(F.vendorUser, 'Hello from the supplier');
});

after(async () => {
  await reset();
  await db?.close();
});
beforeEach(reset);

test('META: the table exists with RLS on, and the guard policies are where this file says', async () => {
  const t = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.chat_message_hearts'::regclass`,
  );
  assert.equal(t.rows[0]?.relrowsecurity, true, 'RLS must be enabled at CREATE time');
  const p = await db.query<{ policyname: string; permissive: string; cmd: string }>(
    `SELECT policyname, permissive, cmd FROM pg_policies WHERE tablename = 'chat_message_hearts' ORDER BY policyname`,
  );
  const names = p.rows.map((r) => `${r.policyname}:${r.permissive}:${r.cmd}`);
  assert.ok(names.includes('chat_message_hearts_block_guard_insert:RESTRICTIVE:INSERT'), names.join(', '));
  assert.ok(names.includes('chat_message_hearts_block_guard_update:RESTRICTIVE:UPDATE'), names.join(', '));
  assert.ok(!p.rows.some((r) => r.cmd === 'DELETE' || r.cmd === 'ALL'), 'there must be no DELETE (or ALL) policy');
});

test('the couple and the supplier on the thread can each heart; both see both', async () => {
  assert.deepEqual(await heart(F.couple, F.msgB), { ok: true });
  assert.deepEqual(await heart(F.vendorUser, F.msgA), { ok: true });

  for (const who of [F.couple, F.vendorUser]) {
    const rows = await visibleHearts(who);
    assert.equal(rows.length, 2, 'each side sees both hearts in their own conversation');
  }
  const scope = await db.query<{ thread_id: string; event_id: string; vendor_profile_id: string }>(
    `SELECT thread_id, event_id, vendor_profile_id FROM public.chat_message_hearts WHERE message_id = $1`,
    [F.msgB],
  );
  assert.equal(scope.rows[0]!.thread_id, F.threadId, 'thread_id is derived from the message');
  assert.equal(scope.rows[0]!.event_id, F.eventId);
  assert.equal(scope.rows[0]!.vendor_profile_id, F.vendorId);
});

test('an outsider can neither read nor write a heart on somebody else’s conversation', async () => {
  assert.deepEqual(await visibleHearts(F.outsider), [], 'an outsider must see no hearts');
  const r = await heart(F.outsider, F.msgA);
  assert.equal(r.ok, false, 'an outsider hearting a message they cannot read must be refused');
});

test('a heart is always the caller’s own — naming another person is refused', async () => {
  // The trigger stamps auth.uid(); the WITH CHECK refuses anything else. Naming the supplier as the couple:
  const forged = await heart(F.couple, F.msgB, { userId: F.vendorUser });
  if (forged.ok) {
    // If the row landed, it must be the CALLER's (the trigger overwrote the forged id) — never the supplier's.
    const r = await db.query<{ user_id: string }>(
      `SELECT user_id FROM public.chat_message_hearts WHERE message_id = $1 AND user_id = $2`,
      [F.msgB, F.vendorUser],
    );
    assert.equal(r.rows.length, 0, 'a heart was written in somebody else’s name');
  }
  // Direct proof on the policy itself, with the trigger out of the way: the WITH CHECK names auth.uid().
  const p = await db.query<{ with_check: string }>(
    `SELECT with_check FROM pg_policies WHERE tablename = 'chat_message_hearts' AND policyname = 'chat_message_hearts_own_insert'`,
  );
  assert.match(p.rows[0]!.with_check, /user_id = \( SELECT auth\.uid\(\)/, 'the insert policy must pin user_id to the caller');
});

test('a forged thread_id is overwritten by the message’s own thread', async () => {
  const other = await db.query<{ thread_id: string }>(`SELECT gen_random_uuid() AS thread_id`);
  const msg = await send(F.couple, 'A third message');
  assert.deepEqual(await heart(F.couple, msg, { threadId: other.rows[0]!.thread_id }), { ok: true });
  const r = await db.query<{ thread_id: string }>(
    `SELECT thread_id FROM public.chat_message_hearts WHERE message_id = $1`,
    [msg],
  );
  assert.equal(r.rows[0]!.thread_id, F.threadId);
});

test('un-heart is an UPDATE; there is no DELETE', async () => {
  await asUser(F.couple);
  const up = await db.query(
    `UPDATE public.chat_message_hearts SET hearted = false WHERE message_id = $1 AND user_id = $2`,
    [F.msgB, F.couple],
  );
  assert.equal(up.affectedRows, 1, 'the couple can take their own heart back');
  await reset();

  await asUser(F.vendorUser);
  const theirs = await db.query(
    `UPDATE public.chat_message_hearts SET hearted = false WHERE message_id = $1 AND user_id = $2`,
    [F.msgB, F.couple],
  );
  assert.equal(theirs.affectedRows, 0, 'nobody can take back somebody else’s heart');
  await reset();

  const priv = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('authenticated', 'public.chat_message_hearts', 'DELETE') AS ok`,
  );
  assert.equal(priv.rows[0]!.ok, false, 'authenticated must hold no DELETE grant (default privileges hand one out)');

  await asUser(F.couple);
  let removed = 0;
  try {
    const d = await db.query(`DELETE FROM public.chat_message_hearts WHERE user_id = $1`, [F.couple]);
    removed = d.affectedRows ?? 0;
  } catch {
    removed = 0;
  }
  await reset();
  assert.equal(removed, 0, 'a heart row was DELETEd — un-heart must be hearted = false');
});

test('a BLOCKED pair cannot heart in their shared thread (insert or update)', async () => {
  const msg = await send(F.vendorUser, 'Before the block');
  await db.query(`INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id) VALUES ($1, $2)`, [
    F.couple,
    F.vendorUser,
  ]);
  try {
    const r = await heart(F.couple, msg);
    assert.equal(r.ok, false, 'the blocker hearted a message from the person they blocked');
    const fresh = await db.query<{ message_id: string }>(
      `SELECT message_id FROM public.chat_messages WHERE thread_id = $1 AND body = 'A third message'`,
      [F.threadId],
    );
    const r3 = await heart(F.vendorUser, fresh.rows[0]!.message_id);
    assert.equal(r3.ok, false, 'the blocked person hearted a message in the blocker’s thread');

    // UPDATE path: the vendor's existing heart on msgA cannot be toggled while blocked.
    await asUser(F.vendorUser);
    let updated = 0;
    try {
      const u = await db.query(
        `UPDATE public.chat_message_hearts SET hearted = false WHERE message_id = $1 AND user_id = $2`,
        [F.msgA, F.vendorUser],
      );
      updated = u.affectedRows ?? 0;
    } catch {
      updated = 0;
    }
    await reset();
    assert.equal(updated, 0, 'a blocked person toggled a heart in the shared thread');
  } finally {
    await reset();
    await db.query(`DELETE FROM public.blocked_users WHERE blocker_user_id = $1`, [F.couple]);
  }
});

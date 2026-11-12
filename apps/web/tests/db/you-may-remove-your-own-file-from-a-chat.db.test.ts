/**
 * 👈 YOUR OWN FILE IN A CHAT SWIPES AWAY — DELETED OUTRIGHT (ruling 6076; owner 12 Nov 2026: "delete it outright").
 * Migration 20271341904583 · `public.remove_my_chat_file(message_id)`.
 *
 *   1. the sender removes their own FILE message — the row is gone, its hearts with it, and the stored ref comes back
 *      (the route drops the R2 object with it);
 *   2. the OTHER side's file is refused (NOT_YOURS), and stays;
 *   3. a words-only message is refused (NO_FILE) — this is never a way to delete what was said;
 *   4. an outsider is refused, answered the same as "not yours";
 *   5. the immutable-evidence posture is otherwise unchanged: still no DELETE policy, so a plain DELETE removes
 *      nothing (`chat-immutable-archive.db.test.ts` holds the rest).
 *
 * Every case runs under `SET ROLE authenticated` — the replay is a superuser, and a definer nobody impersonated past
 * is a definer nobody tested.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', vendorUser: '', outsider: '', vendorId: '', eventId: '', threadId: '' };

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
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
/** A message sent by `asUid`; `file` gives it a stored attachment (set as the superuser — the upload's own path). */
async function send(asUid: string, body: string, file = false): Promise<string> {
  await asUser(asUid);
  const r = await db.query<{ message_id: string }>(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1, $2, $3, $4) RETURNING message_id`,
    [F.threadId, F.eventId, F.vendorId, body],
  );
  await reset();
  const id = r.rows[0]!.message_id;
  if (file) {
    await db.query(
      `UPDATE public.chat_messages SET attachment_r2_key = $2, attachment_name = 'photo.jpg', attachment_mime = 'image/jpeg', attachment_size_bytes = 1024 WHERE message_id = $1`,
      [id, `r2://setnayan-thread-files/chat/${F.threadId}/${id}.jpg`],
    );
  }
  return id;
}
async function remove(asUid: string, messageId: string) {
  await asUser(asUid);
  try {
    const r = await db.query<{ thread_id: string; stored_ref: string }>(`SELECT * FROM public.remove_my_chat_file($1)`, [messageId]);
    return { ok: true as const, row: r.rows[0]! };
  } catch (err) {
    return { ok: false as const, message: (err as Error).message };
  } finally {
    await reset();
  }
}
async function exists(messageId: string): Promise<boolean> {
  const r = await db.query(`SELECT 1 FROM public.chat_messages WHERE message_id = $1`, [messageId]);
  return r.rows.length === 1;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.couple = await createUser('remove-couple@chat.test', 'customer');
  F.vendorUser = await createUser('remove-vendor@chat.test', 'vendor');
  F.outsider = await createUser('remove-outsider@chat.test', 'customer');
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Remove Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;
  const ev = await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Remove Test Event', 'birthday') RETURNING event_id`);
  F.eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.couple]);
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.couple],
  );
  F.threadId = th.rows[0]!.thread_id;
});
after(async () => {
  await reset();
  await db?.close();
});
beforeEach(reset);

test('1 · the sender removes their own file — the row and its hearts are gone, the stored ref comes back', async () => {
  const mine = await send(F.couple, 'a photo', true);
  await asUser(F.vendorUser);
  await db.query(`INSERT INTO public.chat_message_hearts (message_id) VALUES ($1)`, [mine]);
  await reset();
  const r = await remove(F.couple, mine);
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(r.row.thread_id, F.threadId);
  assert.equal(r.row.stored_ref, `r2://setnayan-thread-files/chat/${F.threadId}/${mine}.jpg`);
  assert.equal(await exists(mine), false, 'the file message is still there');
  const h = await db.query(`SELECT 1 FROM public.chat_message_hearts WHERE message_id = $1`, [mine]);
  assert.equal(h.rows.length, 0, 'its hearts outlived it');
});

test('1b · the supplier removes their own file too', async () => {
  const theirs = await send(F.vendorUser, 'the moodboard', true);
  const r = await remove(F.vendorUser, theirs);
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(await exists(theirs), false);
});

test('2 · the other side’s file is refused and stays', async () => {
  const supplierFile = await send(F.vendorUser, 'a photo', true);
  const r = await remove(F.couple, supplierFile);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /NOT_YOURS/);
  assert.equal(await exists(supplierFile), true);
});

test('3 · words are never removed this way', async () => {
  const words = await send(F.couple, 'We confirm the 2pm call time');
  const r = await remove(F.couple, words);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /NO_FILE/);
  assert.equal(await exists(words), true);
});

test('4 · an outsider is answered as "not yours" — the function never confirms the file exists', async () => {
  const mine = await send(F.couple, 'a photo', true);
  const r = await remove(F.outsider, mine);
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /NOT_YOURS/);
  assert.equal(await exists(mine), true);
});

test('5 · still no DELETE policy — a plain DELETE removes nothing, even your own file', async () => {
  const mine = await send(F.couple, 'a photo', true);
  await asUser(F.couple);
  await db.query(`DELETE FROM public.chat_messages WHERE message_id = $1`, [mine]).catch(() => undefined);
  await reset();
  assert.equal(await exists(mine), true, 'a member deleted a message without the writer');
  const p = await db.query(`SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND cmd IN ('DELETE', 'ALL')`);
  assert.equal(p.rows.length, 0);
});

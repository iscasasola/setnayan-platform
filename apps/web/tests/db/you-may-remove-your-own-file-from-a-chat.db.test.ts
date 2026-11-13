/**
 * 👈 REMOVING YOUR OWN FILE FROM A CHAT — the undo ring and the swipe (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING
 * SHOWS AT ONCE ON SEND…" + "CHAT FILE UNDO DRAWING APPROVED"). Migration 20271341904583 ·
 * `public.remove_my_chat_file(message_id, mode)` · `public.chat_file_removal_options(message_id)` ·
 * `public.chat_file_removals`.
 *
 *   1. undo inside 10 s, no words → the row is gone for both, its hearts with it, no line; the stored ref comes back;
 *   2. undo after the window → WINDOW_CLOSED, the file stays;
 *   3. words stay — undo and Delete for everyone clear only the attachment columns;
 *   4. Delete for everyone inside 5 min → the file goes, a for-everyone line both sides can read; after → refused;
 *   5. Delete for me → hidden for the caller only: the other side still reads the file and cannot read the hide;
 *   6. booking files (filed to a decision · an order on the event) refuse undo and everyone; Delete for me still works;
 *   7. the other side's file, a words-only message and an outsider are refused, answered as before;
 *   8. still no DELETE policy on chat_messages.
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

const F = { couple: '', vendorUser: '', outsider: '', vendorId: '', eventId: '', threadId: '', orderEventId: '', orderThreadId: '' };

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
/**
 * A message sent by `asUid`; `file` gives it a stored attachment (set as the superuser — the upload's own path);
 * `agoSeconds` moves its created_at into the past (the windows read the row's own time).
 */
async function send(
  asUid: string,
  body: string,
  opts: { file?: boolean; agoSeconds?: number; thread?: 'main' | 'order' } = {},
): Promise<string> {
  const threadId = opts.thread === 'order' ? F.orderThreadId : F.threadId;
  const eventId = opts.thread === 'order' ? F.orderEventId : F.eventId;
  await asUser(asUid);
  const r = await db.query<{ message_id: string }>(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1, $2, $3, $4) RETURNING message_id`,
    [threadId, eventId, F.vendorId, body],
  );
  await reset();
  const id = r.rows[0]!.message_id;
  if (opts.file) {
    await db.query(
      `UPDATE public.chat_messages SET attachment_r2_key = $2, attachment_name = 'photo.jpg', attachment_mime = 'image/jpeg', attachment_size_bytes = 1024 WHERE message_id = $1`,
      [id, `r2://setnayan-thread-files/chat/${threadId}/${id}.jpg`],
    );
  }
  if (opts.agoSeconds) {
    await db.query(`UPDATE public.chat_messages SET created_at = NOW() - make_interval(secs => $2) WHERE message_id = $1`, [
      id,
      opts.agoSeconds,
    ]);
  }
  return id;
}
type Removed = { outcome: string; thread_id: string; stored_ref: string | null; removed_at: string };
async function remove(asUid: string, messageId: string, mode: 'undo' | 'everyone' | 'me') {
  await asUser(asUid);
  try {
    const r = await db.query<Removed>(`SELECT * FROM public.remove_my_chat_file($1, $2)`, [messageId, mode]);
    return { ok: true as const, row: r.rows[0]! };
  } catch (err) {
    return { ok: false as const, message: (err as Error).message };
  } finally {
    await reset();
  }
}
async function options(asUid: string, messageId: string) {
  await asUser(asUid);
  try {
    const r = await db.query<{ is_booking: boolean; sent_seconds_ago: number }>(
      `SELECT * FROM public.chat_file_removal_options($1)`,
      [messageId],
    );
    return r.rows[0]!;
  } finally {
    await reset();
  }
}
async function row(messageId: string) {
  const r = await db.query<{ body: string; attachment_r2_key: string | null; attachment_name: string | null }>(
    `SELECT body, attachment_r2_key, attachment_name FROM public.chat_messages WHERE message_id = $1`,
    [messageId],
  );
  return r.rows[0] ?? null;
}
/** What `asUid` can read of the removals on a message (their own RLS). */
async function removalsSeenBy(asUid: string, messageId: string) {
  await asUser(asUid);
  try {
    const r = await db.query<{ user_id: string; for_everyone: boolean }>(
      `SELECT user_id, for_everyone FROM public.chat_file_removals WHERE message_id = $1`,
      [messageId],
    );
    return r.rows;
  } finally {
    await reset();
  }
}
async function readableBy(asUid: string, messageId: string): Promise<{ attachment_r2_key: string | null } | null> {
  await asUser(asUid);
  try {
    const r = await db.query<{ attachment_r2_key: string | null }>(
      `SELECT attachment_r2_key FROM public.chat_messages WHERE message_id = $1`,
      [messageId],
    );
    return r.rows[0] ?? null;
  } finally {
    await reset();
  }
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
  const mkEvent = async (name: string) => {
    const ev = await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`, [name]);
    const eventId = ev.rows[0]!.event_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, F.couple]);
    const th = await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
      [eventId, F.vendorId, F.couple],
    );
    return { eventId, threadId: th.rows[0]!.thread_id };
  };
  const main = await mkEvent('Remove Test Event');
  F.eventId = main.eventId;
  F.threadId = main.threadId;
  // A second event that HAS an order — the legal hold makes every file in its chat a booking file.
  const held = await mkEvent('Remove Test Event With An Order');
  F.orderEventId = held.eventId;
  F.orderThreadId = held.threadId;
  await db.query(
    `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code) VALUES ($1, $2, 'Papic pack', 1499, 'RMFILE01')`,
    [F.couple, F.orderEventId],
  );
});
after(async () => {
  await reset();
  await db?.close();
});
beforeEach(reset);

// ── the 10-second undo ──────────────────────────────────────────────────────

test('1 · undo inside 10 s, nothing said with it — the row and its hearts are gone for both, no line', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 3 });
  await asUser(F.vendorUser);
  await db.query(`INSERT INTO public.chat_message_hearts (message_id) VALUES ($1)`, [mine]);
  await reset();
  const r = await remove(F.couple, mine, 'undo');
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(r.row.outcome, 'deleted');
  assert.equal(r.row.thread_id, F.threadId);
  assert.equal(r.row.stored_ref, `r2://setnayan-thread-files/chat/${F.threadId}/${mine}.jpg`);
  assert.equal(await row(mine), null, 'the file message is still there');
  const h = await db.query(`SELECT 1 FROM public.chat_message_hearts WHERE message_id = $1`, [mine]);
  assert.equal(h.rows.length, 0, 'its hearts outlived it');
  const lines = await db.query(`SELECT 1 FROM public.chat_file_removals WHERE message_id = $1`, [mine]);
  assert.equal(lines.rows.length, 0, 'undo left a line');
});

test('2 · undo after the 10 s window (past the grace) is refused — the file stays', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 20 });
  const r = await remove(F.couple, mine, 'undo');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /WINDOW_CLOSED/);
  assert.ok((await row(mine))?.attachment_r2_key, 'a refused undo took the file');
});

test('3 · words stay — undo with words clears only the file, and leaves no line', async () => {
  const mine = await send(F.couple, 'Here is the floor plan', { file: true, agoSeconds: 2 });
  const r = await remove(F.couple, mine, 'undo');
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(r.row.outcome, 'file_removed');
  const after = await row(mine);
  assert.equal(after?.body, 'Here is the floor plan', 'the words went with the file');
  assert.equal(after?.attachment_r2_key, null);
  assert.equal(after?.attachment_name, null);
});

// ── Delete for everyone, the first 5 minutes ────────────────────────────────

test('4 · Delete for everyone inside 5 min — the file goes, the words stay, both sides read the line', async () => {
  const mine = await send(F.couple, 'The moodboard', { file: true, agoSeconds: 120 });
  const r = await remove(F.couple, mine, 'everyone');
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(r.row.outcome, 'removed_for_everyone');
  assert.ok(r.row.stored_ref, 'the route needs the ref to drop the object');
  const after = await row(mine);
  assert.equal(after?.body, 'The moodboard');
  assert.equal(after?.attachment_r2_key, null);
  assert.deepEqual(await removalsSeenBy(F.vendorUser, mine), [{ user_id: F.couple, for_everyone: true }]);
  assert.deepEqual(await removalsSeenBy(F.couple, mine), [{ user_id: F.couple, for_everyone: true }]);
  assert.deepEqual(await removalsSeenBy(F.outsider, mine), [], 'an outsider reads the line');
});

test('4b · Delete for everyone after 5 min (past the grace) is refused — the file stays', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 6 * 60 });
  const r = await remove(F.couple, mine, 'everyone');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /WINDOW_CLOSED/);
  assert.ok((await row(mine))?.attachment_r2_key);
});

test('4c · the sheet reads the server’s clock — sent seconds ago, and not a booking file', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 90 });
  const o = await options(F.couple, mine);
  assert.equal(o.is_booking, false);
  assert.ok(o.sent_seconds_ago >= 89 && o.sent_seconds_ago <= 100, `sent ${o.sent_seconds_ago} s ago`);
});

// ── Delete for me ───────────────────────────────────────────────────────────

test('5 · Delete for me hides it for the caller only — the other side still has the file and cannot see the hide', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 60 * 60 });
  const r = await remove(F.couple, mine, 'me');
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(r.row.outcome, 'hidden_for_me');
  assert.equal(r.row.stored_ref, null, 'Delete for me handed the route a ref to drop');
  assert.ok((await row(mine))?.attachment_r2_key, 'Delete for me took the file from everyone');
  assert.ok((await readableBy(F.vendorUser, mine))?.attachment_r2_key, 'the other side lost the file');
  assert.deepEqual(await removalsSeenBy(F.couple, mine), [{ user_id: F.couple, for_everyone: false }]);
  assert.deepEqual(await removalsSeenBy(F.vendorUser, mine), [], 'the other side can read a private hide');
});

test('5b · nobody writes a removal by hand — the function is the only writer', async () => {
  const mine = await send(F.couple, ' ', { file: true });
  await asUser(F.couple);
  const wrote = await db
    .query(`INSERT INTO public.chat_file_removals (message_id, user_id, thread_id, for_everyone) VALUES ($1, $2, $3, TRUE)`, [
      mine,
      F.couple,
      F.threadId,
    ])
    .then(() => true)
    .catch(() => false);
  await reset();
  assert.equal(wrote, false);
});

// ── booking files ───────────────────────────────────────────────────────────

test('6 · a file filed to a decision is a booking file — undo and everyone refused, Delete for me still works', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 2 });
  const topic = await db.query<{ topic_id: string }>(
    `INSERT INTO public.chat_decision_topics (thread_id, title) VALUES ($1, 'Venue') RETURNING topic_id`,
    [F.threadId],
  );
  await db.query(`INSERT INTO public.chat_decision_messages (topic_id, message_id, thread_id) VALUES ($1, $2, $3)`, [
    topic.rows[0]!.topic_id,
    mine,
    F.threadId,
  ]);
  assert.equal((await options(F.couple, mine)).is_booking, true);
  for (const mode of ['undo', 'everyone'] as const) {
    const r = await remove(F.couple, mine, mode);
    assert.equal(r.ok, false, `${mode} removed a booking file`);
    assert.match(r.ok ? '' : r.message, /BOOKING_FILE/);
  }
  assert.ok((await row(mine))?.attachment_r2_key, 'the booking file is gone');
  const me = await remove(F.couple, mine, 'me');
  assert.ok(me.ok, me.ok ? '' : me.message);
  assert.equal(me.row.outcome, 'hidden_for_me');
});

test('6b · a file in a chat whose event has an order is a booking file — even the ring cannot delete it', async () => {
  const mine = await send(F.couple, ' ', { file: true, agoSeconds: 1, thread: 'order' });
  assert.equal((await options(F.couple, mine)).is_booking, true);
  const r = await remove(F.couple, mine, 'undo');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /BOOKING_FILE/);
  assert.ok(await row(mine), 'the ring hard-deleted a booking file');
});

// ── who may ─────────────────────────────────────────────────────────────────

test('7 · the other side’s file is refused and stays', async () => {
  const supplierFile = await send(F.vendorUser, ' ', { file: true });
  for (const mode of ['undo', 'everyone', 'me'] as const) {
    const r = await remove(F.couple, supplierFile, mode);
    assert.equal(r.ok, false);
    assert.match(r.ok ? '' : r.message, /NOT_YOURS/);
  }
  assert.ok((await row(supplierFile))?.attachment_r2_key);
});

test('7b · the supplier removes their own file too', async () => {
  const theirs = await send(F.vendorUser, ' ', { file: true, agoSeconds: 4 });
  const r = await remove(F.vendorUser, theirs, 'undo');
  assert.ok(r.ok, r.ok ? '' : r.message);
  assert.equal(await row(theirs), null);
});

test('7c · words are never removed this way', async () => {
  const words = await send(F.couple, 'We confirm the 2pm call time', { agoSeconds: 2 });
  const r = await remove(F.couple, words, 'undo');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /NO_FILE/);
  assert.equal((await row(words))?.body, 'We confirm the 2pm call time');
});

test('7d · an outsider is answered as "not yours" — neither function confirms the file exists', async () => {
  const mine = await send(F.couple, ' ', { file: true });
  const r = await remove(F.outsider, mine, 'me');
  assert.equal(r.ok, false);
  assert.match(r.ok ? '' : r.message, /NOT_YOURS/);
  await assert.rejects(() => options(F.outsider, mine), /NOT_YOURS/);
  assert.ok(await row(mine));
});

test('8 · still no DELETE policy — a plain DELETE removes nothing, even your own file', async () => {
  const mine = await send(F.couple, ' ', { file: true });
  await asUser(F.couple);
  await db.query(`DELETE FROM public.chat_messages WHERE message_id = $1`, [mine]).catch(() => undefined);
  await reset();
  assert.ok(await row(mine), 'a member deleted a message without the writer');
  const p = await db.query(`SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND cmd IN ('DELETE', 'ALL')`);
  assert.equal(p.rows.length, 0);
});

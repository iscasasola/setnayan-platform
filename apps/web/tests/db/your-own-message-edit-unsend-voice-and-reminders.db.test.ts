/**
 * 💬 UNICHAT PART H1 — edit · unsend · voice notes · reminders (approved Unichat prototype v3, DECISION_LOG 2026-11-20).
 * Migration 20271354347259 · `public.edit_my_chat_message` · `public.unsend_my_chat_message` ·
 * `public.chat_message_revisions` · `public.chat_message_reminders` · `public.claim_my_due_chat_reminders`.
 *
 *   EDIT     1 the sender edits inside 15 min: new words, `edited_at`, the old words kept; the other side reads the edit
 *            2 nobody else edits it — the other side, an outsider; answered the same (NOT_YOURS)
 *            3 after the window → WINDOW_CLOSED, the words stay
 *            4 a card, a message with a file, a filed message, empty words and contact details are refused
 *   UNSEND   5 the sender unsends: the row stays, emptied and marked; the words are kept where nobody in the chat reads
 *            6 nobody else unsends it; after the window it stays; twice is GONE
 *            7 a voice note is unsent (ref kept, columns cleared); a photo is not (it leaves by its own door)
 *   RECORD   8 still no UPDATE / DELETE policy: a sender's direct UPDATE or DELETE changes nothing
 *   REMOVED  9 a removed co-host edits and unsends nothing, and reads nothing
 *   VOICE   10 `voice_seconds` rides an insert from the sender's own folder; out of range is refused
 *   REMIND  11 a member sets a reminder on a message they read; one per message; only they read it
 *           12 an outsider cannot set one (the message is not theirs to read); nobody sets one for someone else
 *           13 the claim hands back only the caller's own DUE reminders, once
 *           14 a removed co-host's due reminder is claimed, and the message read under their RLS returns nothing
 *
 * Every case runs under `SET ROLE authenticated` — the replay is a superuser, and a definer nobody impersonated past is
 * a definer nobody tested.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = { couple: '', cohost: '', vendorUser: '', outsider: '', vendorId: '', eventId: '', threadId: '' };

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
/** A message sent by `asUid` through its own session; `agoSeconds` moves created_at into the past (the windows read the row). */
async function send(asUid: string, body: string, opts: { agoSeconds?: number; file?: 'photo' | 'voice' } = {}): Promise<string> {
  await asUser(asUid);
  const r = await db.query<{ message_id: string }>(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1, $2, $3, $4) RETURNING message_id`,
    [F.threadId, F.eventId, F.vendorId, body],
  );
  await reset();
  const id = r.rows[0]!.message_id;
  if (opts.file === 'photo') {
    await db.query(
      `UPDATE public.chat_messages SET attachment_r2_key = $2, attachment_name = 'photo.jpg', attachment_mime = 'image/jpeg', attachment_size_bytes = 1024 WHERE message_id = $1`,
      [id, `r2://setnayan-thread-files/chat/${F.threadId}/${asUid}/${id}.jpg`],
    );
  }
  if (opts.file === 'voice') {
    await db.query(
      `UPDATE public.chat_messages SET body = '', attachment_r2_key = $2, attachment_name = 'Voice note.webm', attachment_mime = 'audio/webm', attachment_size_bytes = 2048, voice_seconds = 7 WHERE message_id = $1`,
      [id, `r2://setnayan-thread-files/chat/${F.threadId}/${asUid}/${id}.webm`],
    );
  }
  if (opts.agoSeconds) {
    await db.query(`UPDATE public.chat_messages SET created_at = NOW() - make_interval(secs => $2) WHERE message_id = $1`, [id, opts.agoSeconds]);
  }
  return id;
}
type Outcome = { ok: true } | { ok: false; message: string };
async function attempt(asUid: string, sql: string, params: unknown[]): Promise<Outcome> {
  await asUser(asUid);
  try {
    await db.query(sql, params);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  } finally {
    await reset();
  }
}
const edit = (asUid: string, id: string, body: string) => attempt(asUid, `SELECT * FROM public.edit_my_chat_message($1, $2)`, [id, body]);
const unsend = (asUid: string, id: string) => attempt(asUid, `SELECT * FROM public.unsend_my_chat_message($1)`, [id]);
const refused = (o: Outcome, marker: string) => {
  assert.equal(o.ok, false, `expected ${marker}, but it went through`);
  if (!o.ok) assert.match(o.message, new RegExp(marker));
};

type Row = {
  body: string;
  edited_at: string | null;
  unsent_at: string | null;
  attachment_r2_key: string | null;
  attachment_mime: string | null;
  voice_seconds: number | null;
};
const ROW_SQL = `SELECT body, edited_at, unsent_at, attachment_r2_key, attachment_mime, voice_seconds FROM public.chat_messages WHERE message_id = $1`;
/** The row as the database holds it (superuser). */
async function row(id: string): Promise<Row | null> {
  return (await db.query<Row>(ROW_SQL, [id])).rows[0] ?? null;
}
/** The row as `asUid` reads it — their own RLS. */
async function readableBy(asUid: string, id: string): Promise<Row | null> {
  await asUser(asUid);
  try {
    return (await db.query<Row>(ROW_SQL, [id])).rows[0] ?? null;
  } finally {
    await reset();
  }
}
async function revisions(id: string) {
  return (
    await db.query<{ kind: string; body_before: string; attachment_r2_key_before: string | null; voice_seconds_before: number | null; changed_by: string }>(
      `SELECT kind, body_before, attachment_r2_key_before, voice_seconds_before, changed_by FROM public.chat_message_revisions WHERE message_id = $1 ORDER BY revision_id`,
      [id],
    )
  ).rows;
}
async function setReminder(asUid: string, id: string, opts: { forUser?: string; inSeconds?: number; side?: string } = {}): Promise<Outcome> {
  return attempt(
    asUid,
    `INSERT INTO public.chat_message_reminders (message_id, thread_id, user_id, side, remind_at) VALUES ($1, $2, $3, $4, NOW() + make_interval(secs => $5))`,
    [id, F.threadId, opts.forUser ?? asUid, opts.side ?? 'couple', opts.inSeconds ?? 3600],
  );
}
async function claim(asUid: string) {
  await asUser(asUid);
  try {
    return (await db.query<{ reminder_id: string; message_id: string; thread_id: string; side: string }>(`SELECT * FROM public.claim_my_due_chat_reminders()`)).rows;
  } finally {
    await reset();
  }
}
/** Make every pending reminder on a message due (the claim reads the row's own remind_at). */
async function makeDue(id: string): Promise<void> {
  await db.query(`UPDATE public.chat_message_reminders SET remind_at = NOW() - INTERVAL '1 minute' WHERE message_id = $1`, [id]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  F.couple = await createUser('h1-couple@chat.test', 'customer');
  F.cohost = await createUser('h1-cohost@chat.test', 'customer');
  F.vendorUser = await createUser('h1-vendor@chat.test', 'vendor');
  F.outsider = await createUser('h1-outsider@chat.test', 'customer');
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'H1 Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
    [F.vendorUser],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;
  const ev = await db.query<{ event_id: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('H1 Test Event', 'birthday') RETURNING event_id`);
  F.eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple')`, [F.eventId, F.couple, F.cohost]);
  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [F.eventId, F.vendorId, F.couple],
  );
  F.threadId = th.rows[0]!.thread_id;
  // The co-host holds a seat in this chat (whatever the opener trigger seated, this makes it certain).
  await db.query(`INSERT INTO public.chat_thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT (thread_id, user_id) DO UPDATE SET left_at = NULL`, [F.threadId, F.cohost]);
});
after(async () => {
  await reset();
  await db?.close();
});
beforeEach(reset);

// ── edit ────────────────────────────────────────────────────────────────────

test('1 · the sender edits inside 15 min — new words, edited_at, the old words kept; the other side reads the edit', async () => {
  const id = await send(F.couple, 'See you at 3', { agoSeconds: 60 });
  const out = await edit(F.couple, id, '  See you at 4  ');
  assert.deepEqual(out, { ok: true });
  const held = await row(id);
  assert.equal(held?.body, 'See you at 4', 'trimmed, and stored');
  assert.ok(held?.edited_at, 'edited_at is set');
  assert.equal(held?.unsent_at, null);
  const theirs = await readableBy(F.vendorUser, id);
  assert.equal(theirs?.body, 'See you at 4', 'the supplier reads the edit');
  assert.ok(theirs?.edited_at, 'and that it was edited');
  const kept = await revisions(id);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.kind, 'edit');
  assert.equal(kept[0]!.body_before, 'See you at 3');
  assert.equal(kept[0]!.changed_by, F.couple);
  // The same words again: nothing changes, no second history row.
  assert.deepEqual(await edit(F.couple, id, 'See you at 4'), { ok: true });
  assert.equal((await revisions(id)).length, 1);
});

test('2 · nobody else edits it — the other side, a co-host and an outsider are all answered NOT_YOURS', async () => {
  const id = await send(F.couple, 'Only I change this');
  refused(await edit(F.vendorUser, id, 'changed by the shop'), 'NOT_YOURS');
  refused(await edit(F.cohost, id, 'changed by a co-host'), 'NOT_YOURS');
  refused(await edit(F.outsider, id, 'changed by a stranger'), 'NOT_YOURS');
  refused(await edit(F.outsider, '00000000-0000-0000-0000-000000000000', 'no such message'), 'NOT_YOURS');
  assert.equal((await row(id))?.body, 'Only I change this');
  assert.equal((await revisions(id)).length, 0);
  // A GROUP chat's messages name no shop (vendor_profile_id NULL). "In the chat?" must then answer FALSE for a
  // stranger — never NULL, which `IF NOT …` would let through.
  await setAuthUid(db, F.outsider);
  const inChat = await db.query<{ r: boolean | null }>(`SELECT public.chat_message_caller_is_in_chat($1, NULL, $2) AS r`, [F.threadId, F.eventId]);
  await reset();
  assert.equal(inChat.rows[0]!.r, false);
});

test('3 · after the window → WINDOW_CLOSED, and the words stay', async () => {
  const late = await send(F.couple, 'Sent long ago', { agoSeconds: 15 * 60 + 31 });
  refused(await edit(F.couple, late, 'too late'), 'WINDOW_CLOSED');
  assert.equal((await row(late))?.body, 'Sent long ago');
  // Inside the 30 s grace it still goes.
  const grace = await send(F.couple, 'Just in time', { agoSeconds: 15 * 60 + 10 });
  assert.deepEqual(await edit(F.couple, grace, 'Made it'), { ok: true });
});

test('4 · a file, a filed message, empty words and contact details are refused', async () => {
  const photo = await send(F.couple, 'Our venue', { file: 'photo' });
  refused(await edit(F.couple, photo, 'Our other venue'), 'NOT_WORDS');
  const voice = await send(F.couple, 'x', { file: 'voice' });
  refused(await edit(F.couple, voice, 'words over a voice note'), 'NOT_WORDS');

  const filed = await send(F.couple, 'We pick the garden set');
  const topic = await db.query<{ topic_id: string }>(
    `INSERT INTO public.chat_decision_topics (thread_id, title, opened_by_user_id) VALUES ($1, 'Stage set', $2) RETURNING topic_id`,
    [F.threadId, F.couple],
  );
  await db.query(`INSERT INTO public.chat_decision_messages (topic_id, message_id, thread_id, added_by_user_id) VALUES ($1, $2, $3, $4)`, [
    topic.rows[0]!.topic_id,
    filed,
    F.threadId,
    F.couple,
  ]);
  refused(await edit(F.couple, filed, 'We pick the beach set'), 'FILED');
  refused(await unsend(F.couple, filed), 'FILED');

  const plain = await send(F.couple, 'Plain words');
  refused(await edit(F.couple, plain, '   '), 'EMPTY');
  refused(await edit(F.couple, plain, 'x'.repeat(4001)), 'TOO_LONG');
  // Editing is not a way round the send's contact screen.
  refused(await edit(F.couple, plain, 'text me on 0917 123 4567'), 'CONTACT_BLOCKED');
  assert.equal((await row(plain))?.body, 'Plain words');
  assert.equal((await revisions(plain)).length, 0);
});

// ── unsend ──────────────────────────────────────────────────────────────────

test('5 · the sender unsends — the row stays, emptied and marked; the words are kept where nobody in the chat reads them', async () => {
  const id = await send(F.vendorUser, 'Wrong chat, sorry', { agoSeconds: 30 });
  await asUser(F.couple);
  await db.query(`INSERT INTO public.chat_message_hearts (message_id) VALUES ($1)`, [id]);
  await reset();
  assert.deepEqual(await unsend(F.vendorUser, id), { ok: true });
  const held = await row(id);
  assert.ok(held, 'the row is never deleted');
  assert.equal(held!.body, '');
  assert.ok(held!.unsent_at);
  const theirs = await readableBy(F.couple, id);
  assert.equal(theirs?.body, '', 'the other side reads no words');
  assert.ok(theirs?.unsent_at, 'and reads that it was unsent');
  const hearts = await db.query(`SELECT 1 FROM public.chat_message_hearts WHERE message_id = $1`, [id]);
  assert.equal(hearts.rows.length, 1, 'the heart on it stays');
  const kept = await revisions(id);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.kind, 'unsend');
  assert.equal(kept[0]!.body_before, 'Wrong chat, sorry');
  // Nobody in the chat reads what it used to say — not even its sender.
  for (const who of [F.vendorUser, F.couple, F.outsider]) {
    const o = await attempt(who, `SELECT * FROM public.chat_message_revisions WHERE message_id = $1`, [id]);
    refused(o, 'permission denied');
  }
  // An unsent message is not edited back.
  refused(await edit(F.vendorUser, id, 'back again'), 'GONE');
});

test('6 · nobody else unsends it; after the window it stays; twice is GONE', async () => {
  const id = await send(F.couple, 'Mine to take back');
  refused(await unsend(F.vendorUser, id), 'NOT_YOURS');
  refused(await unsend(F.cohost, id), 'NOT_YOURS');
  refused(await unsend(F.outsider, id), 'NOT_YOURS');
  assert.equal((await row(id))?.unsent_at, null);
  const late = await send(F.couple, 'Sent long ago', { agoSeconds: 15 * 60 + 31 });
  refused(await unsend(F.couple, late), 'WINDOW_CLOSED');
  assert.equal((await row(late))?.body, 'Sent long ago');
  assert.deepEqual(await unsend(F.couple, id), { ok: true });
  refused(await unsend(F.couple, id), 'GONE');
  assert.equal((await revisions(id)).length, 1);
});

test('7 · a voice note is unsent (its ref kept, its columns cleared); a photo is not — it leaves by its own door', async () => {
  const voice = await send(F.couple, 'x', { file: 'voice' });
  const before = await row(voice);
  assert.equal(before?.voice_seconds, 7);
  assert.deepEqual(await unsend(F.couple, voice), { ok: true });
  const held = await row(voice);
  assert.equal(held?.attachment_r2_key, null);
  assert.equal(held?.attachment_mime, null);
  assert.equal(held?.voice_seconds, null);
  assert.ok(held?.unsent_at);
  const kept = await revisions(voice);
  assert.equal(kept[0]!.attachment_r2_key_before, before!.attachment_r2_key);
  assert.equal(kept[0]!.voice_seconds_before, 7);

  const photo = await send(F.couple, 'Our venue', { file: 'photo' });
  refused(await unsend(F.couple, photo), 'NOT_WORDS');
  assert.ok((await row(photo))?.attachment_r2_key, 'the photo is untouched');
});

// ── the chat is still the record ────────────────────────────────────────────

test('8 · still no UPDATE or DELETE policy — a sender changes nothing by writing to the table', async () => {
  const id = await send(F.couple, 'The record');
  const upd = await attempt(F.couple, `UPDATE public.chat_messages SET body = 'rewritten' WHERE message_id = $1`, [id]);
  const del = await attempt(F.couple, `DELETE FROM public.chat_messages WHERE message_id = $1`, [id]);
  // Refused outright, or allowed to match no row — either way nothing changed.
  void upd;
  void del;
  assert.equal((await row(id))?.body, 'The record');
  const marks = await attempt(F.couple, `UPDATE public.chat_messages SET unsent_at = NOW(), edited_at = NOW() WHERE message_id = $1`, [id]);
  void marks;
  const held = await row(id);
  assert.equal(held?.unsent_at, null);
  assert.equal(held?.edited_at, null);
  const policies = await db.query<{ cmd: string }>(`SELECT cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages' AND cmd IN ('UPDATE', 'DELETE', 'ALL')`);
  assert.equal(policies.rows.length, 0, 'chat_messages has no UPDATE / DELETE / ALL policy');
  // And nobody inserts history by hand.
  refused(
    await attempt(F.couple, `INSERT INTO public.chat_message_revisions (message_id, thread_id, kind, body_before) VALUES ($1, $2, 'edit', 'forged')`, [id, F.threadId]),
    'permission denied',
  );
});

// ── voice ───────────────────────────────────────────────────────────────────

test('10 · voice_seconds rides an insert from the sender’s own folder; out of range is refused', async () => {
  const key = `r2://setnayan-thread-files/chat/${F.threadId}/${F.couple}/note.webm`;
  const ok = await attempt(
    F.couple,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, attachment_r2_key, attachment_name, attachment_mime, attachment_size_bytes, voice_seconds)
     VALUES ($1, $2, $3, '', $4, 'Voice note.webm', 'audio/webm', 4096, 12)`,
    [F.threadId, F.eventId, F.vendorId, key],
  );
  assert.deepEqual(ok, { ok: true });
  const sent = await db.query<{ voice_seconds: number; sender_user_id: string }>(`SELECT voice_seconds, sender_user_id FROM public.chat_messages WHERE attachment_r2_key = $1`, [key]);
  assert.equal(sent.rows[0]?.voice_seconds, 12);
  assert.equal(sent.rows[0]?.sender_user_id, F.couple);
  const tooLong = await attempt(
    F.couple,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, attachment_r2_key, attachment_name, attachment_mime, attachment_size_bytes, voice_seconds)
     VALUES ($1, $2, $3, '', $4, 'Voice note.webm', 'audio/webm', 4096, 301)`,
    [F.threadId, F.eventId, F.vendorId, `${key}.2`],
  );
  assert.equal(tooLong.ok, false);
  // Somebody else's folder is still refused — a voice note is a chat file like any other.
  const notMine = await attempt(
    F.couple,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, attachment_r2_key, attachment_name, attachment_mime, attachment_size_bytes, voice_seconds)
     VALUES ($1, $2, $3, '', $4, 'Voice note.webm', 'audio/webm', 4096, 5)`,
    [F.threadId, F.eventId, F.vendorId, `r2://setnayan-thread-files/chat/${F.threadId}/${F.vendorUser}/note.webm`],
  );
  assert.equal(notMine.ok, false);
  // The markers are never an end user's to write at send.
  const forged = await attempt(
    F.couple,
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, edited_at) VALUES ($1, $2, $3, 'pre-edited', NOW())`,
    [F.threadId, F.eventId, F.vendorId],
  );
  refused(forged, 'permission denied');
});

// ── reminders ───────────────────────────────────────────────────────────────

test('11 · a member sets a reminder on a message they read — one per message, and only they read it', async () => {
  const id = await send(F.vendorUser, 'Send me the guest count by Friday');
  assert.deepEqual(await setReminder(F.couple, id), { ok: true });
  assert.equal((await setReminder(F.couple, id)).ok, false, 'one reminder per person per message');
  assert.deepEqual(await setReminder(F.vendorUser, id, { side: 'vendor' }), { ok: true }, 'each person has their own');
  const mine = async (who: string) => {
    await asUser(who);
    try {
      return (await db.query<{ user_id: string }>(`SELECT user_id FROM public.chat_message_reminders WHERE message_id = $1`, [id])).rows;
    } finally {
      await reset();
    }
  };
  assert.deepEqual(await mine(F.couple), [{ user_id: F.couple }]);
  assert.deepEqual(await mine(F.vendorUser), [{ user_id: F.vendorUser }]);
  assert.deepEqual(await mine(F.cohost), []);
  assert.deepEqual(await mine(F.outsider), []);
  // Taking it back is the person's own; nobody else's delete touches it.
  await attempt(F.vendorUser, `DELETE FROM public.chat_message_reminders WHERE message_id = $1`, [id]);
  assert.deepEqual(await mine(F.couple), [{ user_id: F.couple }], 'the supplier deleted only their own');
  // No end-user UPDATE: a reminder is never marked delivered (or moved) by hand.
  refused(await attempt(F.couple, `UPDATE public.chat_message_reminders SET delivered_at = NOW() WHERE message_id = $1`, [id]), 'permission denied');
  // In the past, or more than a year out, is refused.
  await attempt(F.couple, `DELETE FROM public.chat_message_reminders WHERE message_id = $1`, [id]);
  assert.equal((await setReminder(F.couple, id, { inSeconds: -3600 })).ok, false);
  assert.equal((await setReminder(F.couple, id, { inSeconds: 400 * 86400 })).ok, false);
});

test('12 · an outsider cannot set one; nobody sets one for someone else; none on an unsent message', async () => {
  const id = await send(F.couple, 'Not for strangers');
  assert.equal((await setReminder(F.outsider, id)).ok, false, 'the message is not theirs to read');
  assert.equal((await setReminder(F.couple, id, { forUser: F.vendorUser })).ok, false, 'never for somebody else');
  const gone = await send(F.couple, 'About to go');
  assert.deepEqual(await setReminder(F.vendorUser, gone, { side: 'vendor' }), { ok: true });
  assert.deepEqual(await unsend(F.couple, gone), { ok: true });
  const left = await db.query(`SELECT 1 FROM public.chat_message_reminders WHERE message_id = $1`, [gone]);
  assert.equal(left.rows.length, 0, 'unsending takes its pending reminders with it');
  assert.equal((await setReminder(F.vendorUser, gone, { side: 'vendor' })).ok, false, 'nothing to be reminded of');
  const all = await db.query(`SELECT 1 FROM public.chat_message_reminders WHERE message_id = $1`, [id]);
  assert.equal(all.rows.length, 0);
});

test('13 · the claim hands back only the caller’s own DUE reminders, once', async () => {
  const due = await send(F.vendorUser, 'Due now');
  const later = await send(F.vendorUser, 'Due later');
  assert.deepEqual(await setReminder(F.couple, due), { ok: true });
  assert.deepEqual(await setReminder(F.couple, later), { ok: true });
  assert.deepEqual(await setReminder(F.vendorUser, due, { side: 'vendor' }), { ok: true });
  await makeDue(due);
  const mine = await claim(F.couple);
  assert.equal(mine.length, 1, 'only the due one, only mine');
  assert.equal(mine[0]!.message_id, due);
  assert.equal(mine[0]!.side, 'couple');
  assert.deepEqual(await claim(F.couple), [], 'claimed once');
  assert.deepEqual(await claim(F.outsider), []);
  const theirs = await claim(F.vendorUser);
  assert.equal(theirs.length, 1, 'the supplier’s own is still theirs to claim');
  assert.equal(theirs[0]!.side, 'vendor');
});

// ── a removed member — LAST: it takes the co-host off the event ─────────────

test('9 + 14 · a removed co-host edits and unsends nothing, reads nothing, and their due reminder finds no message', async () => {
  const own = await send(F.cohost, 'The co-host said this');
  const about = await send(F.vendorUser, 'Quote: forty thousand');
  assert.deepEqual(await setReminder(F.cohost, about), { ok: true });
  assert.ok(await readableBy(F.cohost, about), 'while on the event the co-host reads the chat');

  // Removed from the event: the membership goes, and with it the seat (20271352461498).
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [F.eventId, F.cohost]);

  refused(await edit(F.cohost, own, 'rewritten after leaving'), 'NOT_YOURS');
  refused(await unsend(F.cohost, own), 'NOT_YOURS');
  assert.equal((await row(own))?.body, 'The co-host said this');
  assert.equal(await readableBy(F.cohost, own), null, 'not even their own message');
  assert.equal(await readableBy(F.cohost, about), null);
  assert.equal((await setReminder(F.cohost, own)).ok, false, 'and sets no new reminder');

  // Their old reminder comes due: the claim hands it back (it is their own row) — and the read the app makes before
  // it says anything, under THEIR RLS, returns no message. So nothing about the chat reaches them.
  await makeDue(about);
  const claimed = await claim(F.cohost);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0]!.message_id, about);
  assert.equal(await readableBy(F.cohost, claimed[0]!.message_id), null);
  // The people still in the chat are untouched.
  assert.equal((await readableBy(F.couple, about))?.body, 'Quote: forty thousand');
  assert.equal((await readableBy(F.vendorUser, own))?.body, 'The co-host said this');
});

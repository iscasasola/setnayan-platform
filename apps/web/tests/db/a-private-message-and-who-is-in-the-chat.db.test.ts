/**
 * A PRIVATE MESSAGE REACHES TWO PEOPLE · A SUPPLIER CHAT HAS ITS OWN HOSTS
 * Supplier Build 3 · lane B · migrations 20271329968207 + 20271330575424.
 *
 * ⚖ DECISION_LOG 🔒 2026-11-09 — a message with a recipient is read by its
 *   sender, its recipient and is_admin() only; WORDS ONLY (no file, photo or
 *   card); the recipient must be in the conversation.
 * ⚖ DECISION_LOG 👥 2026-11-09 — a supplier chat starts with the host who
 *   asked; a host (or coordinator) adds other hosts, the supplier cannot; a
 *   host may leave and reads nothing written after.
 * ⚖ Owner: "coordinators/planners see everything. they cannot leave. just
 *   hosts" — and still never a private message between two other people.
 * ⚖ Owner: "make sure their messages do not show to others" — every path that
 *   can carry a message body or its existence is proven below against a THIRD
 *   member who must get nothing.
 *
 * Run (from apps/web): tsx --test tests/db/a-private-message-and-who-is-in-the-chat.db.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const PRIVATE_FILE = '20271329968207_a_private_message_reaches_two_people_and_is_words_only.sql';
const MEMBERS_FILE = '20271330575424_a_supplier_chat_has_its_own_host_members.sql';
const LEFT_NOTE_FILE = '20271330723629_a_host_who_left_keeps_a_note_and_reads_nothing.sql';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(reset);

async function setClaimRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function reset(): Promise<void> {
  await db.exec(`ROLLBACK`).catch(() => {});
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setClaimRole(null).catch(() => {});
}
/** Run `fn` as a signed-in user under the real `authenticated` role. */
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setClaimRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function attempt(uid: string, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await as(uid, fn);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

let seq = 0;
const uniq = () => `pm-${++seq}`;

async function newUser(firstName: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  const id = r.rows[0]!.id;
  await db.query(`UPDATE public.users SET first_name = $2 WHERE user_id = $1`, [id, firstName]);
  return id;
}
async function newShop(owner: string): Promise<string> {
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [owner, `Shop ${uniq()}`],
  );
  return v.rows[0]!.vendor_profile_id;
}
async function newThread(eventId: string, shop: string, createdBy: string): Promise<string> {
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, createdBy],
  );
  return t.rows[0]!.thread_id;
}

type World = {
  eventId: string;
  hostA: string; // asked — the thread's opener
  hostB: string; // a host of the event, NOT in this conversation
  coordinator: string;
  supplier: string;
  shop: string;
  threadId: string;
  stranger: string;
};
async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const stranger = await newUser('Xia');
  const shop = await newShop(supplier);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple'), ($1,$3,'couple'), ($1,$4,'coordinator')`,
    [eventId, hostA, hostB, coordinator],
  );
  const threadId = await newThread(eventId, shop, hostA);
  return { eventId, hostA, hostB, coordinator, supplier, shop, threadId, stranger };
}

async function send(w: World, uid: string, body: string, recipient?: string): Promise<string> {
  return as(uid, async () => {
    const cols = ['thread_id', 'event_id', 'vendor_profile_id', 'body'];
    const vals: unknown[] = [w.threadId, w.eventId, w.shop, body];
    if (recipient) {
      cols.push('recipient_user_id');
      vals.push(recipient);
    }
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (${cols.join(', ')})
       VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING message_id`,
      vals,
    );
    return r.rows[0]!.message_id;
  });
}
/** Bodies `uid` can read in the world's thread, oldest first. */
async function readable(w: World, uid: string): Promise<string[]> {
  return as(uid, async () =>
    (await db.query<{ body: string }>(
      `SELECT body FROM public.chat_messages WHERE thread_id = $1 ORDER BY created_at, message_id`,
      [w.threadId],
    )).rows.map((r) => r.body),
  );
}
async function call(uid: string, sql: string, params: unknown[]): Promise<string> {
  return as(uid, async () => (await db.query<{ r: string }>(sql, params)).rows[0]!.r);
}

test('all three migrations applied on top of the full corpus (not skipped)', () => {
  for (const f of [PRIVATE_FILE, MEMBERS_FILE, LEFT_NOTE_FILE]) {
    assert.ok(!replay.skipped.some((s) => s.file === f), `${f} was skipped during replay`);
  }
});

// ── who is in the conversation ──────────────────────────────────────────────

test('a new thread seats only the host who asked; a host not in it reads nothing', async () => {
  const w = await newWorld();
  const members = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.chat_thread_members WHERE thread_id = $1`, [w.threadId]);
  assert.deepEqual(members.rows.map((r) => r.user_id), [w.hostA]);

  await send(w, w.hostA, 'Hello, are you free on the 12th?');
  await send(w, w.supplier, 'Yes we are.');
  assert.deepEqual(await readable(w, w.hostA), ['Hello, are you free on the 12th?', 'Yes we are.']);
  assert.deepEqual(await readable(w, w.supplier), ['Hello, are you free on the 12th?', 'Yes we are.']);
  assert.deepEqual(await readable(w, w.hostB), [], 'a host of the event who is not in this chat reads nothing');
  assert.deepEqual(await readable(w, w.stranger), []);

  // …and cannot post into it either.
  const err = await attempt(w.hostB, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,'hi')`,
      [w.threadId, w.eventId, w.shop]));
  assert.match(err ?? '', /row-level security|permission denied/i);
});

test('a host adds a host: the added host reads the whole history, and a line says so', async () => {
  const w = await newWorld();
  await send(w, w.hostA, 'Before Ben joined');
  assert.equal(await call(w.supplier, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]), 'not_allowed',
    'the supplier cannot add a host');
  assert.equal(await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.stranger]), 'not_a_host');
  assert.equal(await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]), 'added');
  assert.equal(await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]), 'already');
  assert.deepEqual(await readable(w, w.hostB), ['Before Ben joined', 'Ben was added to this chat by Ana']);
});

test('the coordinator can add a host too; a non-member host cannot', async () => {
  const w = await newWorld();
  const hostC = await newUser('Cid');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [w.eventId, hostC]);
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, hostC]), 'not_allowed');
  assert.equal(await call(w.coordinator, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, hostC]), 'added');
});

test('a host who left reads NO message of the thread, keeps their own row and note; the last host stays', async () => {
  const w = await newWorld();
  await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]);
  await send(w, w.supplier, 'Said while Ben was here');
  assert.equal(
    await call(w.hostB, `SELECT public.chat_thread_leave($1, $2) AS r`, [w.threadId, '  Ana handles the photos now.  ']),
    'left',
  );
  await send(w, w.supplier, 'Said after Ben left');
  // (1) a left host reads 0 messages — not even the ones from before.
  assert.deepEqual(await readable(w, w.hostB), [], 'a host who left reads nothing in the thread');
  assert.ok((await readable(w, w.hostA)).includes('Ben left this chat'), 'the leave line is in the chat');
  // …nor counts it as unread, nor posts into it.
  assert.equal(await call(w.hostB, `SELECT public.count_unread_message_threads()::text AS r`, []), '0');
  const err = await attempt(w.hostB, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,'back')`,
      [w.threadId, w.eventId, w.shop]));
  assert.match(err ?? '', /row-level security|permission denied/i);

  // (2) a left host reads their OWN member row (and the thread row) so the list can grey it.
  const own = await as(w.hostB, async () =>
    (await db.query<{ left: boolean }>(
      `SELECT left_at IS NOT NULL AS left FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2`,
      [w.threadId, w.hostB])).rows);
  assert.deepEqual(own, [{ left: true }]);
  const threadRow = await as(w.hostB, async () =>
    (await db.query(`SELECT 1 FROM public.chat_threads WHERE thread_id = $1`, [w.threadId])).rows.length);
  assert.equal(threadRow, 1);
  assert.equal(
    await call(w.hostB, `SELECT public.chat_thread_my_left_note($1) AS r`, [w.threadId]),
    'Ana handles the photos now.',
    'the member reads their own note (trimmed)',
  );

  // (3) another member cannot read the note — not by column, not by the function.
  for (const other of [w.hostA, w.coordinator, w.supplier]) {
    const byColumn = await attempt(other, () =>
      db.query(`SELECT left_note FROM public.chat_thread_members WHERE thread_id = $1`, [w.threadId]));
    assert.match(byColumn ?? '', /permission denied/i, 'left_note must not be selectable by another member');
    const star = await attempt(other, () => db.query(`SELECT * FROM public.chat_thread_members WHERE thread_id = $1`, [w.threadId]));
    assert.match(star ?? '', /permission denied/i, 'SELECT * must not reach left_note either');
    assert.equal(await call(other, `SELECT public.chat_thread_my_left_note($1) AS r`, [w.threadId]), null);
  }
  // …while who is in the chat stays readable to a member.
  const roster = await as(w.hostA, async () =>
    (await db.query<{ user_id: string }>(
      `SELECT user_id FROM public.chat_thread_members WHERE thread_id = $1 ORDER BY user_id`, [w.threadId])).rows.length);
  assert.equal(roster, 2);

  assert.equal(await call(w.hostA, `SELECT public.chat_thread_leave($1) AS r`, [w.threadId]), 'last_host');
  assert.equal(await call(w.supplier, `SELECT public.chat_thread_leave($1) AS r`, [w.threadId]), 'cannot_leave');
  assert.equal(await call(w.stranger, `SELECT public.chat_thread_leave($1) AS r`, [w.threadId]), 'not_a_member');
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_leave($1) AS r`, [w.threadId]), 'not_a_member', 'already left');

  // (4) rejoining yourself: the history is readable again, the note is gone, a line says so.
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]), 'rejoined');
  const back = await readable(w, w.hostB);
  for (const b of ['Said while Ben was here', 'Ben left this chat', 'Said after Ben left', 'Ben joined']) {
    assert.ok(back.includes(b), `after rejoining Ben reads "${b}": ${JSON.stringify(back)}`);
  }
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_my_left_note($1) AS r`, [w.threadId]), null);
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]), 'already');
});

test('a leave note is at most 200 characters; a note without a leave is refused', async () => {
  const w = await newWorld();
  await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]);
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_leave($1, $2) AS r`, [w.threadId, 'x'.repeat(300)]), 'left');
  const n = await db.query<{ n: number }>(
    `SELECT char_length(left_note) AS n FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2`,
    [w.threadId, w.hostB]);
  assert.equal(n.rows[0]!.n, 200);
  await assert.rejects(
    db.query(`UPDATE public.chat_thread_members SET left_note = $3 WHERE thread_id = $1 AND user_id = $2`,
      [w.threadId, w.hostB, 'y'.repeat(201)]),
    /chat_thread_members_left_note_is_short/,
  );
  await assert.rejects(
    db.query(`UPDATE public.chat_thread_members SET left_note = 'hi' WHERE thread_id = $1 AND user_id = $2`,
      [w.threadId, w.hostA]),
    /chat_thread_members_note_only_when_left/,
  );
});

test('a host who never was in the thread cannot "rejoin" it', async () => {
  const w = await newWorld();
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]), 'not_allowed');
});

test('a coordinator is in every thread of the event, even one opened before they joined, and cannot leave', async () => {
  const w = await newWorld();
  const otherShop = await newShop(await newUser('Ola'));
  const second = await newThread(w.eventId, otherShop, w.hostA);
  const lateCoordinator = await newUser('Lia');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'coordinator')`, [w.eventId, lateCoordinator]);
  await send(w, w.hostA, 'For everyone here');
  for (const c of [w.coordinator, lateCoordinator]) {
    const ids = await as(c, async () =>
      (await db.query<{ thread_id: string }>(
        `SELECT thread_id FROM public.chat_threads WHERE event_id = $1`, [w.eventId])).rows.map((r) => r.thread_id).sort());
    assert.deepEqual(ids, [w.threadId, second].sort(), 'the coordinator sees every supplier thread of the event');
    assert.deepEqual(await readable(w, c), ['For everyone here']);
    assert.equal(await call(c, `SELECT public.chat_thread_leave($1) AS r`, [w.threadId]), 'cannot_leave');
  }
});

// ── a private message ───────────────────────────────────────────────────────

test('a private message: sender and recipient read it; a third host, the coordinator and a stranger do not', async () => {
  const w = await newWorld();
  await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]);
  await send(w, w.hostA, 'Shared with everyone');
  await send(w, w.hostA, 'Only for the supplier', w.supplier);
  await send(w, w.supplier, 'Only for Ana', w.hostA);
  assert.deepEqual(
    (await readable(w, w.hostA)).filter((b) => !b.includes('added')),
    ['Shared with everyone', 'Only for the supplier', 'Only for Ana'],
  );
  assert.deepEqual(
    (await readable(w, w.supplier)).filter((b) => !b.includes('added')),
    ['Shared with everyone', 'Only for the supplier', 'Only for Ana'],
  );
  for (const third of [w.hostB, w.coordinator, w.stranger]) {
    const seen = await readable(w, third);
    assert.ok(!seen.some((b) => b.startsWith('Only for')), `a third member read a private message: ${JSON.stringify(seen)}`);
  }
  assert.ok((await readable(w, w.hostB)).includes('Shared with everyone'));
  assert.ok((await readable(w, w.coordinator)).includes('Shared with everyone'));
});

test('a private message is words only — no file, no card, never from the system', async () => {
  const w = await newWorld();
  // Files and cards are written with server-held columns, so prove it at the
  // table itself, whoever writes.
  await assert.rejects(
    db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, sender_user_id, body, recipient_user_id, attachment_url, attachment_name)
       VALUES ($1,$2,$3,'couple',$4,'a photo',$5,'https://example.invalid/p.jpg','p.jpg')`,
      [w.threadId, w.eventId, w.shop, w.hostA, w.supplier]),
    /chat_messages_private_is_words_only/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, sender_user_id, body, recipient_user_id, attachment_r2_key)
       VALUES ($1,$2,$3,'couple',$4,'a file',$5,'chat/x.pdf')`,
      [w.threadId, w.eventId, w.shop, w.hostA, w.supplier]),
    /chat_messages_private_is_words_only/,
  );

  const proposal = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status)
     VALUES ($1,$2,'Full day',100000,'draft') RETURNING proposal_id`, [w.shop, w.eventId]);
  await assert.rejects(
    db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, sender_user_id, body, recipient_user_id, proposal_id)
       VALUES ($1,$2,$3,'vendor',$4,'a quote',$5,$6)`,
      [w.threadId, w.eventId, w.shop, w.supplier, w.hostA, proposal.rows[0]!.proposal_id]),
    /chat_messages_private_is_words_only/,
  );
  await assert.rejects(
    db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, body, recipient_user_id)
       VALUES ($1,$2,$3,'system','a system line',$4)`,
      [w.threadId, w.eventId, w.shop, w.hostA]),
    /chat_messages_private_is_words_only|PRIVATE_NEEDS_A_SENDER/,
  );
});

test('a private message goes to someone in this conversation — never a stranger, a host not in it, or oneself', async () => {
  const w = await newWorld();
  const toStranger = await attempt(w.hostA, () => send(w, w.hostA, 'psst', w.stranger));
  assert.match(toStranger ?? '', /PRIVATE_NOT_A_MEMBER/);
  const toOutsideHost = await attempt(w.hostA, () => send(w, w.hostA, 'psst', w.hostB));
  assert.match(toOutsideHost ?? '', /PRIVATE_NOT_A_MEMBER/);
  const toSelf = await attempt(w.hostA, () => send(w, w.hostA, 'psst', w.hostA));
  assert.match(toSelf ?? '', /PRIVATE_NOT_TO_SELF/);
  // The coordinator is in the conversation, so may be written to privately.
  await send(w, w.hostA, 'for Cora', w.coordinator);
  assert.ok((await readable(w, w.coordinator)).includes('for Cora'));
  assert.ok(!(await readable(w, w.supplier)).includes('for Cora'));
});

// ── every other path a private message could travel ─────────────────────────

test('unread counters: another person\'s private message never counts for a third member', async () => {
  const w = await newWorld();
  await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]);
  // Ben and Cora have read everything so far (including the "added" line).
  for (const uid of [w.hostB, w.coordinator]) {
    await db.query(
      `INSERT INTO public.chat_thread_reads (thread_id, user_id, last_read_at) VALUES ($1,$2, NOW() + INTERVAL '1 second')
       ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`, [w.threadId, uid]);
  }
  await db.query(`SELECT pg_sleep(1.1)`);
  await send(w, w.supplier, 'Only for Ana', w.hostA);

  const total = (uid: string) => call(uid, `SELECT public.count_unread_message_threads()::text AS r`, []);
  const byEvent = (uid: string) => as(uid, async () =>
    (await db.query<{ n: number }>(
      `SELECT COALESCE(sum(unread_count),0)::int AS n FROM public.unread_message_threads_by_event() WHERE event_id = $1`,
      [w.eventId])).rows[0]!.n);
  assert.equal(await total(w.hostB), '0');
  assert.equal(await byEvent(w.hostB), 0);
  assert.equal(await total(w.coordinator), '0');
  assert.equal(await total(w.hostA), '1', 'the recipient is told');
  assert.equal(await byEvent(w.hostA), 1);
});

test('hearts on a private message are as private as the message', async () => {
  const w = await newWorld();
  await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]);
  const id = await send(w, w.hostA, 'Only for the supplier', w.supplier);
  await as(w.supplier, () => db.query(`INSERT INTO public.chat_message_hearts (message_id) VALUES ($1)`, [id]));
  const count = (uid: string) => as(uid, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_message_hearts WHERE message_id = $1`, [id])).rows[0]!.n);
  assert.equal(await count(w.hostA), 1);
  assert.equal(await count(w.hostB), 0);
  assert.equal(await count(w.coordinator), 0);
});

test('the push webhook never carries a private message (a shared one still goes out)', async () => {
  const w = await newWorld();
  await db.query(
    `INSERT INTO vault.secrets (name, secret) VALUES ('notify_webhook_secret', 'test-only-not-a-secret')
     ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret`);
  try {
    await db.exec(`DELETE FROM net._http_calls`);
    await send(w, w.hostA, 'Only for the supplier', w.supplier);
    assert.equal((await db.query(`SELECT 1 FROM net._http_calls`)).rows.length, 0, 'a private message fired the webhook');
    await send(w, w.hostA, 'Shared with everyone');
    assert.equal((await db.query(`SELECT 1 FROM net._http_calls`)).rows.length, 1, 'a shared message must still notify');
  } finally {
    await db.exec(`DELETE FROM vault.secrets WHERE name = 'notify_webhook_secret'`);
  }
});

test('ChatHostStrip\'s source names the thread\'s own people, not the whole event', async () => {
  const w = await newWorld();
  await db.exec(`SET ROLE service_role`);
  try {
    const r = await db.query<{ j: Array<{ user_id: string; kind: string }> }>(
      `SELECT public.thread_chat_hosts($1) AS j`, [w.threadId]);
    const got = r.rows[0]!.j.map((p) => `${p.kind}:${p.user_id}`).sort();
    assert.deepEqual(got, [`coordinator:${w.coordinator}`, `host:${w.hostA}`].sort());
  } finally {
    await db.exec(`RESET ROLE`);
  }
  const denied = await attempt(w.hostA, () => db.query(`SELECT public.thread_chat_hosts($1)`, [w.threadId]));
  assert.match(denied ?? '', /permission denied/i, 'thread_chat_hosts is service_role only');
});

test('every function that reads chat_messages bodies is one this lane audited', async () => {
  // A new SECURITY DEFINER reader of chat_messages bypasses RLS and so must
  // filter recipient_user_id itself. This list is the audit; adding a reader
  // fails here until someone decides whether it can leak a private message.
  const r = await db.query<{ proname: string }>(
    `SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef AND p.prosrc ~* '\\mchat_messages\\M'
      ORDER BY 1`);
  const got = r.rows.map((x) => x.proname);
  console.log('SECURITY DEFINER readers of chat_messages:', JSON.stringify(got));
  assert.deepEqual(got, AUDITED_DEFINER_READERS);
});

// The measured list, each judged for a private-message leak (see the report
// for the reasoning per function). Kept sorted.
const AUDITED_DEFINER_READERS: string[] = [
  'apply_dropped_offer', // 🏷 PR-4 (20271339379038): reads ONE message's offer id · good-until · event · thread, never its body; a private line can never carry an offer (tg_chat_messages_offer_is_this_suppliers refuses it); inserts its own system line; returns the new quote id
  // 20271340018194 (Piece 1 · PR-3): inserts the new quote version's card line (a shop message with its proposal_id);
  // reads no message and returns the new proposal id — no body leaves it.
  'change_ask_write_version',
  // 🗳 20271338412990 (chat decisions · polls): none returns a body. The filing check reads a message's thread_id and
  // recipient_user_id only to REFUSE a private line ('private'); file / move lock the message row; poll_open inserts
  // its own system line and returns the poll id.
  'chat_decision_file_message', // locks the message row; returns a status word
  'chat_decision_filing_refusal', // thread + recipient only — refuses a private line; returns a word, no body
  'chat_decision_move_message', // locks the message row; returns a status word
  // 👈 20271342335343: the caller's own file only — returns is_booking + seconds since sent, never a body.
  'chat_file_removal_options',
  // 💬 20271340374819 (event group chats): the Groups list's last line is filtered to rows the CALLER may read
  // (shared · sent · one of its recipients) — pinned by event-group-chats-and-a-private-line-to-several.db.test.ts;
  // the post-line helper inserts a system line and returns nothing.
  'chat_group_list', // preview filtered by recipient_user_ids for the caller
  'chat_group_post_line', // inserts a system line in a group; returns nothing
  // 👈 20271342335343: EXECUTE revoked from every browser role; returns one boolean (is this file part of the booking).
  'chat_message_is_booking_file',
  'chat_poll_open', // inserts the poll's own system line; returns the poll id
  'chat_record_post_line', // finds the thread and inserts a system line; returns nothing
  'count_unread_message_threads', // filters recipient_user_id (20271329968207/20271330575424)
  // 📁 20271339773560 (Piece 3b · a supplier's files): a trigger, EXECUTE revoked from every browser role. It only
  // checks that NEW.chat_message_id is a message of THIS shop's thread with THIS event (EXISTS) — never reads a body,
  // returns nothing but NEW, and its refusal is a fixed sentence.
  'guard_event_supplier_file', // EXISTS on message_id + thread only; no body read or returned
  // 👈 20271342335343 (DECISION_LOG 2026-11-13 chat file undo ring + swipe): removes or hides the CALLER's own file —
  // sender = auth.uid() and still readable by them; returns only an outcome word, that row's thread id and stored ref
  // (their own file), never a body, never another row. The options read returns two facts about the caller's own file
  // (booking? seconds since sent); the booking check returns one boolean and is callable by neither browser role.
  // Pinned by you-may-remove-your-own-file-from-a-chat.db.test.ts.
  'remove_my_chat_file',
  'tg_chat_message_hearts_scope', // copies a heart's thread from its message; returns no body
  'tg_chat_messages_card_names_this_conversation', // validates NEW's card ids; returns no other row
  'tg_chat_messages_group_rules', // 20271340374819: reads NEW's thread kind only; returns no other row
  'tg_chat_messages_guard_end_user_write', // screens NEW's own body only
  'tg_chat_messages_offer_is_this_suppliers', // 🏷 PR-4: validates NEW's offer id + day and refuses it on a private line; reads no other message
  'tg_chat_messages_private_is_between_members', // this lane's recipient check
  'unread_message_threads_by_event', // filters recipient_user_id
  'unread_message_threads_by_vendor', // filters recipient_user_id
];

test('no view reads chat_messages', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_views WHERE schemaname = 'public' AND definition ~* '\\mchat_messages\\M'`);
  const m = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_matviews WHERE schemaname = 'public' AND definition ~* '\\mchat_messages\\M'`);
  assert.equal(r.rows[0]!.n + m.rows[0]!.n, 0);
});

// ── the canonical helper and the backfill ───────────────────────────────────

test('current_thread_ids() is read by exactly the measured callers', async () => {
  const pol = await db.query<{ name: string }>(
    `SELECT tablename || '.' || policyname AS name FROM pg_policies
      WHERE COALESCE(qual,'') || COALESCE(with_check,'') ~ 'current_thread_ids' ORDER BY 1`);
  const fns = await db.query<{ name: string }>(
    `SELECT DISTINCT p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosrc ~ 'current_thread_ids' ORDER BY 1`);
  const got = { policies: pol.rows.map((r) => r.name), functions: fns.rows.map((r) => r.name) };
  console.log('current_thread_ids callers:', JSON.stringify(got));
  assert.deepEqual(got, {
    policies: [
      // Supplier Build 3 · lane C: the members of a chat read its change asks (migration 20271332041210).
      'booking_change_asks.booking_change_asks_members_read',
      // 🗳 20271338412990: filed messages and polls are read by the chat's members — chat_decision_topics_read copied.
      'chat_decision_messages.chat_decision_messages_read',
      // 20271332497337 (Build 3 lane B): a decision topic is read by the chat's members (and the shop's team).
      'chat_decision_topics.chat_decision_topics_read',
      // 💬 20271340374819: a group member (a guest included) reads the group's hearts.
      'chat_message_hearts.chat_message_hearts_group_member_read',
      'chat_messages.chat_messages_member_insert',
      'chat_messages.chat_messages_member_read',
      'chat_poll_choices.chat_poll_choices_read',
      'chat_poll_votes.chat_poll_votes_read',
      'chat_polls.chat_polls_read',
      'chat_thread_members.chat_thread_members_read',
      'chat_threads.chat_threads_member_read',
    ],
    functions: [
      // 20271340018194 (Piece 1 · PR-3): the hosts' side answers a supplier's counter or plan only from inside the chat.
      'answer_change_ask',
      'ask_for_a_change', // lane C: only a member of the chat may ask (migration 20271332041210)
      // 20271340018194: the chat's asks, for a member of the thread only; a masked coordinator's money is withheld.
      'change_asks_read',
      'chat_blocker_shown',
      // 👈 20271342335343: only a member who can still read the chat asks what may be removed of their own file.
      'chat_file_removal_options',
      // 20271332497337 (Build 3 lane B): the decision topics' membership check — a member of the chat (this helper)
      // or the shop's team; chat_decision_open / _set_closed / the topics' read policy all ask it.
      'chat_is_in_thread',
      'chat_thread_add_host',
      'chat_thread_leave',
      'count_unread_message_threads',
      // 👈 20271342335343 (2026-11-13 undo ring + swipe): only a member who can still read the chat removes their own file.
      'remove_my_chat_file',
      // 20271333348826 (Build 3 lane B, round 3): coordinators post like hosts — the sender trigger's coordinator
      // branch admits an event_members coordinator only for a thread this helper already lets them read.
      'tg_chat_messages_derive_sender',
      'unread_message_threads_by_event',
    ],
  });
});

test('the backfill seats every host of every existing thread, and re-running it changes nothing else', async () => {
  const w = await newWorld();
  const hostC = await newUser('Cid');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [w.eventId, hostC]);
  await db.query(`DELETE FROM public.chat_thread_members WHERE thread_id = $1`, [w.threadId]);
  // Re-run the membership file (its backfill is idempotent), then the file
  // that refines it, so the schema ends exactly as the replay left it.
  for (const f of [MEMBERS_FILE, LEFT_NOTE_FILE]) {
    await db.exec(readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'supabase', 'migrations', f), 'utf8'));
  }
  const after = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.chat_thread_members WHERE thread_id = $1 AND left_at IS NULL ORDER BY user_id`, [w.threadId]);
  assert.deepEqual(after.rows.map((r) => r.user_id), [w.hostA, w.hostB, hostC].sort());
  const missing = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.chat_threads t
       JOIN public.event_members em ON em.event_id = t.event_id AND em.member_type = 'couple'
       JOIN public.users u ON u.user_id = em.user_id
      WHERE NOT EXISTS (SELECT 1 FROM public.chat_thread_members m WHERE m.thread_id = t.thread_id AND m.user_id = em.user_id)`);
  assert.equal(missing.rows[0]!.n, 0, 'every thread × host pair that existed has a membership row');
});

// ── a blocker remembers how often it was shown (20271331503438) ─────────────

test('a blocker counts its shows per person, server side; strangers and a host who left get nothing', async () => {
  const w = await newWorld();
  await call(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.threadId, w.hostB]);
  const shown = (uid: string, kind = 'booking_ask', key = 'booking-1') =>
    call(uid, `SELECT public.chat_blocker_shown($1,$2,$3)::text AS r`, [w.threadId, kind, key]);
  assert.equal(await shown(w.hostA), '1');
  assert.equal(await shown(w.hostA), '2');
  assert.equal(await shown(w.hostA), '3');
  assert.equal(await shown(w.hostA), '4', 'the 60 s hold applies from the third show on — the count keeps going');
  assert.equal(await shown(w.supplier), '1', 'one person\'s count never shortens another\'s hold');
  assert.equal(await shown(w.hostA, 'booking_ask', 'booking-2'), '1', 'counted per blocker');
  assert.equal(await shown(w.coordinator, 'coordinator_agree', 'proof-1'), '1');
  assert.equal(await shown(w.stranger), null);
  assert.equal(await shown(w.hostA, 'not_a_kind'), null);
  assert.equal(await call(w.hostB, `SELECT public.chat_thread_leave($1) AS r`, [w.threadId]), 'left');
  assert.equal(await shown(w.hostB), null, 'a host who left is not in the conversation');

  // Each reads only their own counts, and nobody can write (or reset) one directly.
  const mine = await as(w.hostA, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_blocker_shows`)).rows[0]!.n);
  assert.equal(mine, 2);
  const theirs = await as(w.supplier, async () =>
    (await db.query<{ c: number }>(`SELECT shown_count AS c FROM public.chat_blocker_shows`)).rows.map((r) => r.c));
  assert.deepEqual(theirs, [1]);
  for (const sql of [
    `UPDATE public.chat_blocker_shows SET shown_count = 0`,
    `DELETE FROM public.chat_blocker_shows`,
    `INSERT INTO public.chat_blocker_shows (user_id, thread_id, blocker_kind, subject_key) VALUES ('${w.hostA}','${w.threadId}','quote_expired','q')`,
  ]) {
    const err = await attempt(w.hostA, () => db.query(sql));
    assert.match(err ?? '', /permission denied/i, sql);
  }
});

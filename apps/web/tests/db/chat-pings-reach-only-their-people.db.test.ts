/**
 * ⚡ CHAT ARRIVES INSTANTLY — the database half, executed (not prose).
 *
 * Migration 20271296339552 adds an AFTER INSERT trigger on chat_messages that sends one content-free ping
 * (`realtime.send`) to each recipient's PRIVATE topic `user:<uid>`, and a policy on realtime.messages that lets a
 * person listen to their OWN topic and nobody else's. What this file proves:
 *
 *   1 · THE RIGHT PEOPLE, AND ONLY THEM. A couple's message pings the shop owner, the shop's admin team member and the
 *       couple's partner — never the sender, never a shop VIEWER or AGENT (their badge does not count the thread),
 *       never a guest of the event, never a stranger. Read backwards from `count_unread_message_threads`, so the
 *       people pinged are exactly the people whose count can move.
 *   2 · NO CONTENT. The payload carries thread_id · message_id · at — not the body.
 *   3 · A PING NEVER COSTS A MESSAGE. With `realtime.send` raising, the INSERT still lands. With no realtime schema at
 *       all (the shape of this replay before the stub), the INSERT lands and nothing is sent.
 *   4 · O(RECIPIENTS), NEVER A SCAN. Each lookup is keyed on an index whose leading column is the key it filters on —
 *       including the PARTIAL couple index, so an event's hundreds of guest rows are never walked.
 *   5 · A USER ONLY RECEIVES THEIR OWN TOPIC. `user_topic_is_mine` is TRUE for `user:<me>` and FALSE for another
 *       person's uid, anon, NULL, a lookalike prefix — and never raises. The policy is READ only (no INSERT policy:
 *       a browser cannot send into anyone's topic).
 *   6 · NOT CALLABLE BY A CLIENT. Neither the recipient list nor the trigger function is executable by anon or
 *       authenticated; the topic predicate IS executable by authenticated (the grant every private channel needs —
 *       see realtime-policy-predicates-are-callable.db.test.ts).
 *
 * The replay has no `realtime` schema, so a stub `realtime.send` that records its calls is created HERE, in this
 * file's own database, after the replay — the trigger's `to_regprocedure` check then finds it exactly as it finds the
 * real one in production.
 *
 * Run: (cd apps/web && npx tsx --test tests/db/chat-pings-reach-only-their-people.db.test.ts)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, MIGRATIONS_DIR, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  bride: '',
  groom: '',
  guest: '',
  shopOwner: '',
  shopAdmin: '',
  shopAgent: '',
  shopViewer: '',
  stranger: '',
  vendorId: '',
  eventId: '',
  threadId: '',
};

async function createUser(email: string, accountType: 'customer' | 'vendor') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

/** Insert a message AS `uid` — the shipped send path's shape — and return its id. */
async function sendAs(uid: string, body: string): Promise<string> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
       VALUES ($1,$2,$3,$4) RETURNING message_id`,
      [F.threadId, F.eventId, F.vendorId, body],
    );
    return r.rows[0]!.message_id;
  } finally {
    await reset();
  }
}

async function stubRealtime(mode: 'record' | 'raise' | 'absent'): Promise<void> {
  await db.exec(`DROP SCHEMA IF EXISTS realtime CASCADE`);
  if (mode === 'absent') return;
  await db.exec(`
    CREATE SCHEMA realtime;
    CREATE TABLE realtime.sent (n BIGSERIAL PRIMARY KEY, topic TEXT, event TEXT, payload JSONB, private BOOLEAN);
    CREATE FUNCTION realtime.send(payload JSONB, event TEXT, topic TEXT, private BOOLEAN DEFAULT TRUE)
    RETURNS VOID LANGUAGE plpgsql AS $$
    BEGIN
      ${mode === 'raise' ? `RAISE EXCEPTION 'realtime is down';` : `INSERT INTO realtime.sent (topic, event, payload, private) VALUES (topic, event, payload, private);`}
    END $$;
  `);
}

async function sentSince(n: number) {
  const r = await db.query<{ n: number; topic: string; event: string; payload: Record<string, unknown>; private: boolean }>(
    `SELECT n, topic, event, payload, private FROM realtime.sent WHERE n > $1 ORDER BY n`,
    [n],
  );
  return r.rows;
}

async function lastSent(): Promise<number> {
  const r = await db.query<{ n: number | null }>(`SELECT max(n)::int AS n FROM realtime.sent`);
  return r.rows[0]?.n ?? 0;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.bride = await createUser('ping-bride@chat.test', 'customer');
  F.groom = await createUser('ping-groom@chat.test', 'customer');
  F.guest = await createUser('ping-guest@chat.test', 'customer');
  F.shopOwner = await createUser('ping-owner@chat.test', 'vendor');
  F.shopAdmin = await createUser('ping-admin@chat.test', 'vendor');
  F.shopAgent = await createUser('ping-agent@chat.test', 'vendor');
  F.shopViewer = await createUser('ping-viewer@chat.test', 'vendor');
  F.stranger = await createUser('ping-stranger@chat.test', 'customer');

  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name)
     VALUES ($1, 'Ping Test Studio')
     ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
     RETURNING vendor_profile_id`,
    [F.shopOwner],
  );
  F.vendorId = vp.rows[0]!.vendor_profile_id;
  for (const [uid, role] of [
    [F.shopAdmin, 'admin'],
    [F.shopAgent, 'agent'],
    [F.shopViewer, 'viewer'],
  ] as const) {
    await db.query(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
       VALUES ($1, $2, $3::public.vendor_team_role)
       ON CONFLICT (vendor_profile_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [F.vendorId, uid, role],
    );
  }

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Ping Test Event', 'birthday') RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  for (const [uid, type] of [
    [F.bride, 'couple'],
    [F.groom, 'couple'],
    [F.guest, 'guest'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3::public.member_type)`,
      [F.eventId, uid, type],
    );
  }

  const th = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id)
     VALUES ($1, $2, $3) RETURNING thread_id`,
    [F.eventId, F.vendorId, F.bride],
  );
  F.threadId = th.rows[0]!.thread_id;
});

after(async () => {
  await replay?.db?.close?.();
});

const topicOf = (uid: string) => `user:${uid}`;

test('the fixture is real — a blank cannot pass', async () => {
  for (const [k, v] of Object.entries(F)) assert.ok(v, `fixture ${k} was not created`);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'chat_messages_ping_recipients' AND NOT tgisinternal`,
  );
  assert.equal(r.rows[0]!.n, 1, 'the ping trigger is not on chat_messages');
});

test('a couple message pings exactly the people whose unread count it moves — and nobody else', async () => {
  await stubRealtime('record');
  const mark = await lastSent();
  const messageId = await sendAs(F.bride, 'Hello from the bride — a body that must never ride in a ping');
  const sent = await sentSince(mark);
  const topics = sent.map((s) => s.topic).sort();
  assert.ok(sent.length > 0, 'nothing was pinged — the trigger did not fire');
  assert.deepEqual(
    topics,
    [F.groom, F.shopAdmin, F.shopOwner].map(topicOf).sort(),
    'the pinged set must be the partner + the shop owner + the shop ADMIN — never the sender, an agent, a viewer, a guest or a stranger',
  );
  for (const s of sent) {
    assert.equal(s.event, 'chat_message');
    assert.equal(s.private, true, 'a ping must go to a PRIVATE topic — a public one would be readable by anyone who names it');
    assert.deepEqual(Object.keys(s.payload).sort(), ['at', 'message_id', 'thread_id'], 'the ping carries ids, never content');
    assert.equal(s.payload.message_id, messageId);
    assert.equal(s.payload.thread_id, F.threadId);
    assert.doesNotMatch(JSON.stringify(s.payload), /bride/, 'the body leaked into the ping');
  }
});

test('the recipient list is the unread count read backwards — each pinged person can now count the thread', async () => {
  // Property, not a list: for EVERY user in the fixture, "was pinged" ⇔ "their count_unread_message_threads() rose".
  await stubRealtime('record');
  const everyone = [F.bride, F.groom, F.guest, F.shopOwner, F.shopAdmin, F.shopAgent, F.shopViewer, F.stranger];
  const countFor = async (uid: string) => {
    await setAuthUid(db, uid);
    try {
      const r = await db.query<{ n: number }>(`SELECT public.count_unread_message_threads() AS n`);
      return r.rows[0]!.n;
    } finally {
      await reset();
    }
  };
  // Everyone reads the thread first, so the next message is the only unread one.
  for (const uid of everyone) {
    await db.query(
      `INSERT INTO public.chat_thread_reads (thread_id, user_id, last_read_at) VALUES ($1, $2, now() + interval '1 second')
       ON CONFLICT (thread_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [F.threadId, uid],
    );
  }
  const before = new Map<string, number>();
  for (const uid of everyone) before.set(uid, await countFor(uid));
  await db.exec(`SELECT pg_sleep(1.1)`);
  const mark = await lastSent();
  await sendAs(F.shopOwner, 'A reply from the shop');
  const pinged = new Set((await sentSince(mark)).map((s) => s.topic));
  let rose = 0;
  for (const uid of everyone) {
    const after = await countFor(uid);
    const moved = after > before.get(uid)!;
    if (moved) rose += 1;
    assert.equal(
      pinged.has(topicOf(uid)),
      moved,
      `user ${uid}: pinged=${pinged.has(topicOf(uid))} but their unread count ${moved ? 'rose' : 'did not move'} — the ping set and the count disagree`,
    );
  }
  assert.ok(rose >= 3, `only ${rose} counts rose — the comparison proves nothing`);
});

test('a ping never costs a message — Realtime raising, or absent, the INSERT still lands', async () => {
  await stubRealtime('raise');
  const id1 = await sendAs(F.groom, 'sent while Realtime is down');
  assert.ok(id1, 'a raising realtime.send blocked the message');

  await stubRealtime('absent');
  const id2 = await sendAs(F.groom, 'sent with no realtime schema at all');
  assert.ok(id2, 'a missing realtime schema blocked the message');

  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.chat_messages WHERE message_id IN ($1, $2)`,
    [id1, id2],
  );
  assert.equal(r.rows[0]!.n, 2, 'both messages must be stored');
});

test('O(recipients), never a scan — every lookup has an index led by its key', async () => {
  const idx = async (table: string) =>
    (
      await db.query<{ def: string }>(
        `SELECT pg_get_indexdef(i.indexrelid) AS def
           FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = $1`,
        [table],
      )
    ).rows.map((r) => r.def);
  const em = await idx('event_members');
  assert.ok(
    em.some((d) => /\(event_id\)\s+WHERE\s+\(?member_type\s*=\s*'couple'/i.test(d)),
    `the couple lookup must use a PARTIAL index on (event_id) WHERE member_type = 'couple' — otherwise a big event's guest rows are walked. Found: ${em.join(' | ')}`,
  );
  const vp = await idx('vendor_profiles');
  assert.ok(vp.some((d) => /UNIQUE INDEX .* \(vendor_profile_id\)/i.test(d)), 'vendor_profiles must be keyed on vendor_profile_id');
  const vtm = await idx('vendor_team_members');
  assert.ok(vtm.some((d) => /\(vendor_profile_id(\)|,)/i.test(d)), 'vendor_team_members must have an index led by vendor_profile_id');

  // And the function filters on exactly those keys — the message's own columns, no chat_threads read.
  const src = (
    await db.query<{ src: string }>(`SELECT prosrc AS src FROM pg_proc WHERE proname = 'chat_message_recipient_ids'`)
  ).rows[0]!.src;
  assert.match(src, /em\.event_id\s*=\s*p_event_id[\s\S]*member_type\s*=\s*'couple'/);
  assert.match(src, /vp\.vendor_profile_id\s*=\s*p_vendor_profile_id/);
  assert.match(src, /vtm\.vendor_profile_id\s*=\s*p_vendor_profile_id/);
  assert.doesNotMatch(src, /chat_threads|chat_messages/, 'the recipient lookup must not read the chat tables — the message already carries its keys');
});

test('a user only receives their own topic — and the predicate never raises', async () => {
  const is = async (uid: string | null, topic: string | null) => {
    await setAuthUid(db, uid);
    try {
      const r = await (topic === null
        ? db.query<{ ok: boolean }>(`SELECT public.user_topic_is_mine(NULL) AS ok`)
        : db.query<{ ok: boolean }>(`SELECT public.user_topic_is_mine($1) AS ok`, [topic]));
      return r.rows[0]!.ok;
    } finally {
      await reset();
    }
  };
  assert.equal(await is(F.bride, topicOf(F.bride)), true, 'my own topic');
  assert.equal(await is(F.bride, topicOf(F.groom)), false, "another person's topic — even my partner's");
  assert.equal(await is(F.stranger, topicOf(F.shopOwner)), false, "a stranger on the shop's topic");
  assert.equal(await is(null, topicOf(F.bride)), false, 'anon');
  assert.equal(await is(F.bride, null), false, 'NULL topic');
  assert.equal(await is(F.bride, ''), false, 'empty topic');
  assert.equal(await is(F.bride, `xuser:${F.bride}`), false, 'lookalike prefix');
  assert.equal(await is(F.bride, `USER:${F.bride}`), false, 'case variant');
  assert.equal(await is(F.bride, `user:${F.bride}x`), false, 'a suffix');
  assert.equal(await is(F.bride, 'user:not-a-uuid'), false, 'malformed — FALSE, never an error');
  assert.equal(await is(F.bride, `call:${F.threadId}`), false, "another transport's topic");
});

test('no client role can run the recipient list or the trigger; authenticated CAN run the topic predicate', async () => {
  const can = async (role: string, fn: string) =>
    (await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn])).rows[0]!.ok;
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await can(role, 'public.chat_message_recipient_ids(uuid,uuid,uuid)'), false, `${role} can enumerate a thread's people`);
    assert.equal(await can(role, 'public.chat_messages_ping_recipients()'), false, `${role} can execute the ping trigger function`);
  }
  assert.equal(await can('anon', 'public.user_topic_is_mine(text)'), false, 'anon can run the topic predicate');
  assert.equal(
    await can('authenticated', 'public.user_topic_is_mine(text)'),
    true,
    'authenticated MUST run the topic predicate — realtime.messages policies are OR-evaluated, so a refused predicate refuses EVERY private channel',
  );
});

test('the policy is READ-only on user: topics, and the client opens the channel private', () => {
  const file = fs.readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith('_chat_messages_ping_their_people.sql'));
  assert.ok(file, 'the migration moved');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file!), 'utf8').replace(/--[^\n]*/g, '');
  assert.match(sql, /CREATE POLICY user_topic_owner_can_read\s+ON realtime\.messages\s+FOR SELECT\s+TO authenticated/);
  assert.equal((sql.match(/public\.user_topic_is_mine\(realtime\.topic\(\)\)/g) ?? []).length, 1, 'exactly one policy names the predicate');
  assert.doesNotMatch(sql, /FOR INSERT/, 'an INSERT policy on user: topics would let a browser send pings into anyone’s channel');

  const client = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'lib', 'user-live-channel.ts'), 'utf8');
  assert.match(client, /\.channel\(`user:\$\{userId\}`,\s*\{\s*config:\s*\{\s*private:\s*true/, 'the client must open `user:{uid}` PRIVATE — a public channel bypasses the policy entirely');
  assert.match(client, /'broadcast',\s*\{\s*event:\s*'chat_message'\s*\}/, "the client listens for the event the trigger sends ('chat_message')");
  assert.match(sql, /realtime\.send\(v_payload, 'chat_message', 'user:' \|\| v_uid::text, true\)/, 'the trigger sends the event + topic the client listens on');
});

/**
 * AN ADMIN READS A CHAT ONLY INSIDE AN OPEN DISPUTE — task 6119 · migration 20271341658320.
 *
 * Every chat-content read used to admit any admin session through a bare `OR is_admin()` arm. The migration narrows
 * that arm to `thread_id IN admin_disputed_thread_ids()` — the threads an OPEN vendor_disputes row ties to (the same
 * link as chat_private_in_dispute). This file signs in as each person and reads every narrowed table, plus the one
 * SECURITY DEFINER reader that restates a table's admission (change_asks_read):
 *
 *   · an admin who is NOT in the chat reads NOTHING from it while no dispute is open,
 *   · reads all of it while an open dispute ties the event to the shop,
 *   · and nothing again once the dispute is resolved;
 *   · the host and the shop read exactly the same rows in all three states (no other arm moved);
 *   · a stranger reads nothing in all three states.
 *
 * Run (from apps/web): tsx --test tests/db/an-admin-reads-a-chat-only-inside-an-open-dispute.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const FILE = '20271341658320_an_admin_reads_a_chat_only_inside_an_open_dispute.sql';

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

let seq = 0;
const uniq = () => `adc-${++seq}`;

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

type World = { eventId: string; host: string; supplier: string; admin: string; stranger: string; shop: string; thread: string };

async function newWorld(): Promise<World> {
  const host = await newUser('Ana');
  const supplier = await newUser('Rosa');
  const admin = await newUser('Ops');
  const stranger = await newUser('Xia');
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [admin]);
  const shop = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW()) RETURNING vendor_profile_id AS v`,
      [supplier, `Rosa's Catering ${uniq()}`],
    )
  ).rows[0]!.v;
  const eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('Ana & Miguel', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  const thread = (
    await db.query<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id AS t`,
      [eventId, shop, host],
    )
  ).rows[0]!.t;
  // The host is IN the chat (the shipped membership row); an idempotent insert in case a trigger already wrote it.
  await db.query(
    `INSERT INTO public.chat_thread_members (thread_id, user_id)
     SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2)`,
    [thread, host],
  );

  // One row in every narrowed table (seeded as the table owner — RLS is what is under test, not the writers).
  // The message is the host's own browser write (its triggers fill the sender's side).
  const msg = await as(host, async () =>
    (
      await db.query<{ m: string }>(
        `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
         VALUES ($1,$2,$3,'Can we move the tasting?') RETURNING message_id AS m`,
        [thread, eventId, shop],
      )
    ).rows[0]!.m,
  );
  const topic = (
    await db.query<{ t: string }>(
      `INSERT INTO public.chat_decision_topics (thread_id, title, opened_by_user_id) VALUES ($1,'Tasting day',$2) RETURNING topic_id AS t`,
      [thread, host],
    )
  ).rows[0]!.t;
  await db.query(
    `INSERT INTO public.chat_decision_messages (topic_id, message_id, thread_id, added_by_user_id) VALUES ($1,$2,$3,$4)`,
    [topic, msg, thread, host],
  );
  const poll = (
    await db.query<{ p: string }>(
      `INSERT INTO public.chat_polls (thread_id, question, asked_by_user_id) VALUES ($1,'Which Saturday?',$2) RETURNING poll_id AS p`,
      [thread, host],
    )
  ).rows[0]!.p;
  const choice = (
    await db.query<{ c: string }>(
      `INSERT INTO public.chat_poll_choices (poll_id, thread_id, position, label) VALUES ($1,$2,1,'The 5th') RETURNING choice_id AS c`,
      [poll, thread],
    )
  ).rows[0]!.c;
  await db.query(
    `INSERT INTO public.chat_poll_votes (poll_id, voter_user_id, choice_id, thread_id) VALUES ($1,$2,$3,$4)`,
    [poll, host, choice, thread],
  );
  await db.query(
    `INSERT INTO public.thread_calls (thread_id, event_id, vendor_profile_id, kind, started_by_user_id) VALUES ($1,$2,$3,'voice',$4)`,
    [thread, eventId, shop, host],
  );
  await db.query(
    `INSERT INTO public.booking_change_asks (thread_id, event_id, vendor_profile_id, subject, note) VALUES ($1,$2,$3,'quote','Fewer desserts please')`,
    [thread, eventId, shop],
  );
  return { eventId, host, supplier, admin, stranger, shop, thread };
}

const TABLES = [
  'chat_decision_topics',
  'chat_decision_messages',
  'chat_polls',
  'chat_poll_choices',
  'chat_poll_votes',
  'chat_thread_members',
  'thread_calls',
  'booking_change_asks',
] as const;

/** How many rows of THIS thread each narrowed table (and the change-asks reader) hands the caller. */
async function counts(uid: string, thread: string): Promise<Record<string, number>> {
  return as(uid, async () => {
    const out: Record<string, number> = {};
    for (const t of TABLES) {
      const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.${t} WHERE thread_id = $1`, [thread]);
      out[t] = r.rows[0]!.n;
    }
    out.change_asks_read = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.change_asks_read($1)`, [thread])).rows[0]!.n;
    return out;
  });
}
const none = Object.fromEntries([...TABLES, 'change_asks_read'].map((t) => [t, 0]));

async function openDispute(w: World): Promise<string> {
  const order = (
    await db.query<{ o: string }>(
      `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code)
       VALUES ($1,$2,'Catering', 1000, $3) RETURNING order_id AS o`,
      [w.host, w.eventId, `GC${++seq}REF`],
    )
  ).rows[0]!.o;
  return (
    await db.query<{ d: string }>(
      `INSERT INTO public.vendor_disputes (vendor_profile_id, order_id, opened_by_user_id, category, description)
       VALUES ($1,$2,$3,'no_show','They did not come') RETURNING dispute_id AS d`,
      [w.shop, order, w.host],
    )
  ).rows[0]!.d;
}
async function resolve(dispute: string): Promise<void> {
  // The neutral team closes it (the service role — guard_vendor_dispute_contest_columns reverts anyone else).
  await setClaimRole('service_role');
  await db.query(`UPDATE public.vendor_disputes SET status = 'resolved_for_couple' WHERE dispute_id = $1`, [dispute]);
  await reset();
}

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === FILE), `${FILE} was skipped during replay`);
});

test('no bare is_admin() arm is left on any chat-content SELECT policy', async () => {
  const r = await db.query<{ t: string; p: string }>(
    `SELECT tablename AS t, policyname AS p FROM pg_policies
      WHERE schemaname = 'public' AND cmd IN ('SELECT','ALL')
        AND tablename = ANY($1::text[])
        AND qual ~ 'is_admin\\(\\)' AND qual !~ 'chat_private_in_dispute'`,
    [[...TABLES, 'chat_messages', 'chat_threads']],
  );
  assert.deepEqual(r.rows, [], 'an admin arm that is not tied to an open dispute');
});

test('an admin reads a chat only while an open dispute ties the event to the shop; host and shop never change', async () => {
  const w = await newWorld();
  const hostBefore = await counts(w.host, w.thread);
  const shopBefore = await counts(w.supplier, w.thread);
  for (const t of TABLES) assert.ok(hostBefore[t]! >= 1, `the host reads ${t}`);
  for (const t of TABLES.filter((x) => x !== 'chat_thread_members')) assert.ok(shopBefore[t]! >= 1, `the shop reads ${t}`);

  assert.deepEqual(await counts(w.admin, w.thread), none, 'no dispute → an admin reads nothing from the chat');
  assert.deepEqual(await counts(w.stranger, w.thread), none, 'a stranger reads nothing');

  const d = await openDispute(w);
  const adminOpen = await counts(w.admin, w.thread);
  for (const t of [...TABLES, 'change_asks_read']) assert.ok(adminOpen[t]! >= 1, `inside an open dispute the admin reads ${t}`);
  assert.deepEqual(await counts(w.host, w.thread), hostBefore, 'the host reads the same rows during a dispute');
  assert.deepEqual(await counts(w.supplier, w.thread), shopBefore, 'the shop reads the same rows during a dispute');
  assert.deepEqual(await counts(w.stranger, w.thread), none, 'a dispute admits no stranger');

  await resolve(d);
  assert.deepEqual(await counts(w.admin, w.thread), none, 'once the dispute is resolved the chat closes to the admin again');
  assert.deepEqual(await counts(w.host, w.thread), hostBefore);
  assert.deepEqual(await counts(w.supplier, w.thread), shopBefore);
});

test("a dispute on ANOTHER shop of the same event opens nothing of this shop's chat", async () => {
  const w = await newWorld();
  const other = await newWorld(); // a different shop and event
  // A dispute between this event and the OTHER shop.
  const order = (
    await db.query<{ o: string }>(
      `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code)
       VALUES ($1,$2,'Flowers', 1000, $3) RETURNING order_id AS o`,
      [w.host, w.eventId, `GC${++seq}REF`],
    )
  ).rows[0]!.o;
  await db.query(
    `INSERT INTO public.vendor_disputes (vendor_profile_id, order_id, opened_by_user_id, category, description)
     VALUES ($1,$2,$3,'no_show','Someone else')`,
    [other.shop, order, w.host],
  );
  assert.deepEqual(await counts(w.admin, w.thread), none);
  assert.deepEqual(await counts(w.admin, other.thread), none, 'nor the other shop’s chat on a different event');
});

test('admin_disputed_thread_ids() is empty for anyone who is not an admin, even inside a dispute', async () => {
  const w = await newWorld();
  await openDispute(w);
  for (const uid of [w.host, w.supplier, w.stranger]) {
    const r = await as(uid, async () =>
      (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.admin_disputed_thread_ids()`)).rows[0]!.n);
    assert.equal(r, 0);
  }
  const a = await as(w.admin, async () =>
    (await db.query<{ t: string }>(`SELECT t AS t FROM public.admin_disputed_thread_ids() t`)).rows.map((r) => r.t));
  assert.ok(a.includes(w.thread));
});

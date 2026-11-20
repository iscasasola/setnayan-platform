/**
 * A REMOVED MEMBER READS NOTHING — whispers OR shared lines (migration 20271354552883), and A COORDINATOR POSTS LIKE A
 * HOST. Controller, under owner delegation 20 Nov: "Removed or deactivated reads nothing, whispers OR shared" ·
 * "Coordinators post normal messages like hosts (the 9 Nov ruling stands)."
 *
 *   1 · DEACTIVATED — a shop team member (admin) reads the shop's SHARED lines and its threads while live; once
 *                     deactivated they read none of either and cannot write as the shop. The owner and the hosts keep
 *                     reading.
 *   2 · REMOVED HOSTS' SIDE — a co-host and a coordinator taken off the event read no shared line either (F1, pinned
 *                     here beside the shop side so the rule is whole).
 *   3 · STILL SOMEONE ELSE HERE — a deactivated team member who is ALSO a host seated in the chat keeps reading it
 *                     as a host: the rule takes away the shop seat, never a seat they hold another way.
 *   4 · THE COORDINATOR POSTS — a coordinator's shared line is written, stamped 'coordinator', and read by the hosts
 *                     AND the shop; a coordinator removed from the event cannot write one.
 *   5 · SABOTAGE    — with the new RESTRICTIVE policies dropped (the schema before 20271354552883), the deactivated
 *                     member DOES read the shared line and the thread and DOES write as the shop: this file fails
 *                     without the fix.
 *
 * Run (from apps/web): tsx --test tests/db/a-removed-member-reads-nothing.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

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
/** Run `fn` as `uid` (authenticated). Ends with `reset`, which ROLLS BACK an open transaction. */
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
const uniq = () => `rm-${++seq}`;

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

type World = { eventId: string; threadId: string; shop: string; hostA: string; hostB: string; coordinator: string; supplier: string; teammate: string };

async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const coordinator = await newUser('Liza');
  const supplier = await newUser('Sol');
  const teammate = await newUser('Mara');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier, `Shop ${uniq()}`],
  );
  const shop = v.rows[0]!.vendor_profile_id;
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`, [shop, teammate]);
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
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, hostA],
  );
  const threadId = t.rows[0]!.thread_id;
  const added = await as(hostA, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1,$2) AS r`, [threadId, hostB])).rows[0]!.r);
  assert.equal(added, 'added');
  return { eventId, threadId, shop, hostA, hostB, coordinator, supplier, teammate };
}

/** A shared line, written by `who` through the browser's own path (RLS + every trigger). */
async function post(w: World, who: string, body: string, sentAs: 'vendor' | null = null): Promise<string> {
  return as(who, async () => {
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, sent_as)
       VALUES ($1,$2,$3,$4,$5) RETURNING message_id`,
      [w.threadId, w.eventId, w.shop, body, sentAs],
    );
    return r.rows[0]!.message_id;
  });
}
async function refusedPost(w: World, who: string, body: string, sentAs: 'vendor' | null = null): Promise<string> {
  try {
    await post(w, who, body, sentAs);
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}
const READ_SQL = `SELECT (SELECT count(*)::int FROM public.chat_messages WHERE message_id = $1) AS lines,
                         (SELECT count(*)::int FROM public.chat_threads WHERE thread_id = $2) AS threads`;
async function sees(uid: string, w: World, messageId: string): Promise<{ lines: number; threads: number }> {
  return as(uid, async () => (await db.query<{ lines: number; threads: number }>(READ_SQL, [messageId, w.threadId])).rows[0]!);
}
const deactivate = (w: World, uid: string) =>
  db.query(`UPDATE public.vendor_team_members SET deactivated_at = NOW() WHERE vendor_profile_id = $1 AND user_id = $2`, [w.shop, uid]);

test('DEACTIVATED: a team member reads the shared lines and the thread while live, and none of either — nor writes — once deactivated', async () => {
  const w = await newWorld();
  const fromHost = await post(w, w.hostA, 'Can you do the 12th?');
  const fromShop = await post(w, w.supplier, 'Yes, the 12th works.', 'vendor');
  assert.deepEqual(await sees(w.teammate, w, fromHost), { lines: 1, threads: 1 }, 'a live team member cannot read the shop’s chat');
  assert.deepEqual(await sees(w.teammate, w, fromShop), { lines: 1, threads: 1 });
  assert.ok((await post(w, w.teammate, 'Noted.', 'vendor')).length > 0, 'a live team member cannot write as the shop');

  await deactivate(w, w.teammate);

  assert.deepEqual(await sees(w.teammate, w, fromHost), { lines: 0, threads: 0 }, 'a deactivated member still reads a host’s shared line');
  assert.deepEqual(await sees(w.teammate, w, fromShop), { lines: 0, threads: 0 }, 'a deactivated member still reads the shop’s shared line');
  assert.match(await refusedPost(w, w.teammate, 'Still here.', 'vendor'), /row-level security|not stand on the shop side|not a party/i, 'a deactivated member still writes as the shop');
  // Everyone still in the chat keeps reading it.
  for (const [who, uid] of [['the owner', w.supplier], ['host A', w.hostA], ['host B', w.hostB], ['the coordinator', w.coordinator]] as const) {
    assert.deepEqual(await sees(uid, w, fromHost), { lines: 1, threads: 1 }, `${who} lost the chat`);
  }
});

test('REMOVED HOSTS’ SIDE: a co-host and a coordinator taken off the event read no shared line', async () => {
  const w = await newWorld();
  const line = await post(w, w.supplier, 'Your quote is ready.', 'vendor');
  assert.equal((await sees(w.hostB, w, line)).lines, 1);
  assert.equal((await sees(w.coordinator, w, line)).lines, 1);
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = ANY($2::uuid[])`, [w.eventId, [w.hostB, w.coordinator]]);
  assert.equal((await sees(w.hostB, w, line)).lines, 0, 'a removed co-host reads a shared line');
  assert.equal((await sees(w.coordinator, w, line)).lines, 0, 'a removed coordinator reads a shared line');
});

test('STILL SOMEONE ELSE HERE: a deactivated team member who is also a seated host keeps reading as a host', async () => {
  const w = await newWorld();
  // Ben hosts the event AND sits on the shop's team; the shop seat is taken away.
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`, [w.shop, w.hostB]);
  const line = await post(w, w.hostA, 'Ben, can you check this?');
  await deactivate(w, w.hostB);
  assert.deepEqual(await sees(w.hostB, w, line), { lines: 1, threads: 1 }, 'losing a shop seat took away a host seat too');
  // …but not as the shop.
  assert.match(await refusedPost(w, w.hostB, 'As the shop.', 'vendor'), /row-level security|not stand on the shop side|not a party/i);
});

test('THE COORDINATOR POSTS: a shared line, stamped coordinator, read by the hosts and the shop; a removed coordinator cannot', async () => {
  const w = await newWorld();
  const id = await post(w, w.coordinator, 'Load-in is at 2 PM, please confirm.');
  const row = await db.query<{ sender_role: string; sender_user_id: string; recipient_user_ids: string[] | null }>(
    `SELECT sender_role::text, sender_user_id, recipient_user_ids FROM public.chat_messages WHERE message_id = $1`, [id]);
  assert.deepEqual(row.rows[0], { sender_role: 'coordinator', sender_user_id: w.coordinator, recipient_user_ids: null });
  for (const [who, uid] of [['host A', w.hostA], ['host B', w.hostB], ['the owner', w.supplier], ['the team member', w.teammate]] as const) {
    assert.equal((await sees(uid, w, id)).lines, 1, `${who} cannot read the coordinator’s line`);
  }
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [w.eventId, w.coordinator]);
  assert.match(await refusedPost(w, w.coordinator, 'Still planning.'), /row-level security|not a party/i, 'a removed coordinator still posts');
});

test('SABOTAGE: without 20271354552883’s policies a deactivated member reads the shared line and the thread, and writes as the shop', async () => {
  const w = await newWorld();
  const line = await post(w, w.hostA, 'Shared with the shop.');
  await deactivate(w, w.teammate);
  assert.deepEqual(await sees(w.teammate, w, line), { lines: 0, threads: 0 });
  // The schema BEFORE the fix: drop its three RESTRICTIVE policies inside one transaction; `as` → `reset` rolls back.
  await db.exec(`BEGIN`);
  await db.exec(`DROP POLICY chat_messages_a_removed_member_reads_nothing ON public.chat_messages`);
  await db.exec(`DROP POLICY chat_messages_a_removed_member_writes_nothing ON public.chat_messages`);
  await db.exec(`DROP POLICY chat_threads_a_removed_member_reads_nothing ON public.chat_threads`);
  const before = await as(w.teammate, async () => {
    const seen = (await db.query<{ lines: number; threads: number }>(READ_SQL, [line, w.threadId])).rows[0]!;
    let wrote = false;
    try {
      await db.query(
        `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, sent_as) VALUES ($1,$2,$3,'Still here.','vendor')`,
        [w.threadId, w.eventId, w.shop],
      );
      wrote = true;
    } catch {
      wrote = false;
    }
    return { ...seen, wrote };
  });
  assert.deepEqual(before, { lines: 1, threads: 1, wrote: true }, 'without the fix the deactivated member is ALREADY out — the test cannot see what the fix closes');
  const kept = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies WHERE policyname IN ('chat_messages_a_removed_member_reads_nothing','chat_messages_a_removed_member_writes_nothing','chat_threads_a_removed_member_reads_nothing')`);
  assert.equal(kept.rows[0]!.n, 3, 'the sabotage was not rolled back');
});

/**
 * A LINE NOBODY WROTE IS NEVER UNREAD · A SHOP'S TEAM MAY CHAT WHERE RLS ALREADY LETS THEM
 * Chat gaps (owner 8 Nov 2026, "yes build them") · migration 20271336137492.
 *
 *   · Gap 1 — a Setnayan line or the auto-reply (sender_user_id NULL) raises NO unread count for anybody, on all three
 *     counters; a person's message still does, for everyone but its writer — a co-host included.
 *   · Gap 4 — what `lib/chat-shop-people.server.ts` mirrors, measured on the real policy (unchanged, never widened):
 *     an admin team member may post and is stamped 'vendor' with their own uid; an agent may post only on an event
 *     their assigned service serves; a viewer with no assignment is refused.
 *
 * Run (from apps/web): tsx --test tests/db/a-line-nobody-wrote-is-never-unread.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const FILE = '20271336137492_a_line_nobody_wrote_is_never_unread.sql';

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
const uniq = () => `ln-${++seq}`;

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

type World = {
  eventId: string;
  hostA: string;
  hostB: string;
  supplier: string;
  admin: string;
  agent: string;
  viewer: string;
  shop: string;
  threadId: string;
};

async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const supplier = await newUser('Sol');
  const admin = await newUser('Ada');
  const agent = await newUser('Gus');
  const viewer = await newUser('Vic');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier, `Shop ${uniq()}`],
  );
  const shop = v.rows[0]!.vendor_profile_id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple'), ($1,$3,'couple')`,
    [eventId, hostA, hostB],
  );
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, hostA],
  );
  const threadId = t.rows[0]!.thread_id;
  // Both hosts are in this conversation.
  await db.query(
    `INSERT INTO public.chat_thread_members (thread_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [threadId, hostB],
  );
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1,$2,'admin'), ($1,$3,'agent'), ($1,$4,'viewer')`,
    [shop, admin, agent, viewer],
  );
  return { eventId, hostA, hostB, supplier, admin, agent, viewer, shop, threadId };
}

async function systemLine(w: World, body: string): Promise<void> {
  // The service role / owner session — exactly how chat_record_post_line and the auto-reply write.
  await db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body)
     VALUES ($1,$2,$3,NULL,'system',$4)`,
    [w.threadId, w.eventId, w.shop, body],
  );
}
async function send(w: World, uid: string, body: string): Promise<{ role: string; sender: string }> {
  return as(uid, async () => {
    const r = await db.query<{ role: string; sender: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
       VALUES ($1,$2,$3,$4) RETURNING sender_role::text AS role, sender_user_id::text AS sender`,
      [w.threadId, w.eventId, w.shop, body],
    );
    return r.rows[0]!;
  });
}
async function unread(uid: string): Promise<number> {
  return as(uid, async () => (await db.query<{ n: number }>(`SELECT public.count_unread_message_threads() AS n`)).rows[0]!.n);
}
async function unreadByEvent(uid: string, eventId: string): Promise<number> {
  return as(uid, async () => {
    const r = await db.query<{ unread_count: number }>(
      `SELECT unread_count FROM public.unread_message_threads_by_event() WHERE event_id = $1`,
      [eventId],
    );
    return r.rows[0]?.unread_count ?? 0;
  });
}
async function unreadByShop(uid: string, shop: string): Promise<number> {
  return as(uid, async () => {
    const r = await db.query<{ unread_count: number }>(
      `SELECT unread_count FROM public.unread_message_threads_by_vendor() WHERE vendor_profile_id = $1`,
      [shop],
    );
    return r.rows[0]?.unread_count ?? 0;
  });
}

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === FILE), `${FILE} was skipped during replay`);
});

test('gap 1 · a Setnayan line raises no unread count — for a host, a co-host or the shop, on all three counters', async () => {
  const w = await newWorld();
  await systemLine(w, 'First payment confirmed · ₱5,000');
  for (const who of [w.hostA, w.hostB, w.supplier, w.admin]) {
    assert.equal(await unread(who), 0, 'count_unread_message_threads counted a line nobody wrote');
  }
  assert.equal(await unreadByEvent(w.hostA, w.eventId), 0, 'unread_message_threads_by_event counted a system line');
  assert.equal(await unreadByShop(w.supplier, w.shop), 0, 'unread_message_threads_by_vendor counted a system line');
});

test('gap 1 · a person’s message is unread for everyone but its writer — a co-host included', async () => {
  const w = await newWorld();
  await send(w, w.hostA, 'Hi! Is 12 Dec still open?');
  assert.equal(await unread(w.hostA), 0, 'the writer was told about their own message');
  assert.equal(await unread(w.hostB), 1, 'the co-host was not told');
  assert.equal(await unread(w.supplier), 1, 'the shop was not told');
  assert.equal(await unreadByEvent(w.hostB, w.eventId), 1);
  assert.equal(await unreadByShop(w.supplier, w.shop), 1);
});

test('gap 4 · an admin team member may post, and speaks as the shop under their own uid', async () => {
  const w = await newWorld();
  const row = await send(w, w.admin, 'Yes — we have the 12th.');
  assert.equal(row.role, 'vendor');
  assert.equal(row.sender, w.admin);
  // …and the owner is told (their unread), the admin is not told about their own words.
  assert.equal(await unread(w.supplier), 1);
  assert.equal(await unread(w.admin), 0);
});

test('gap 4 · an agent posts only where an assigned service serves the event; a viewer with none is refused', async () => {
  const w = await newWorld();
  const refusedViewer = await send(w, w.viewer, 'hello').then(
    () => null,
    (e: Error) => e.message,
  );
  assert.ok(refusedViewer, 'a viewer with no assignment on this event could post');

  const refusedAgent = await send(w, w.agent, 'hello').then(
    () => null,
    (e: Error) => e.message,
  );
  assert.ok(refusedAgent, 'an agent with no assignment on this event could post');

  // Assign the agent to a service this event booked → now admitted, by the unchanged policy.
  const svc = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active)
     VALUES ($1, 'photography', 'Coverage', FALSE) RETURNING vendor_service_id`,
    [w.shop],
  );
  const serviceId = svc.rows[0]!.vendor_service_id;
  const member = await db.query<{ vendor_team_member_id: string }>(
    `SELECT vendor_team_member_id FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND user_id = $2`,
    [w.shop, w.agent],
  );
  await db.query(`INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id) VALUES ($1,$2)`, [
    serviceId,
    member.rows[0]!.vendor_team_member_id,
  ]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1, 'photographer', 'Coverage', 'contracted', $2, $3)`,
    [w.eventId, w.shop, serviceId],
  );
  const row = await send(w, w.agent, 'I will be your photographer on the day.');
  assert.equal(row.role, 'vendor');
  assert.equal(row.sender, w.agent);
});

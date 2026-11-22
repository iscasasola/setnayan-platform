/**
 * A HOST ON THE SHOP'S TEAM WHISPERS AS A HOST — one definition of "team" (migration 20271355512715; controller
 * ruling on the #8060 review, 20 Nov, under owner delegation).
 *
 * Before this, the database counted "team" as ANY live team member and let the shop win over a host seat, while the
 * app counted owner/admin plus members serving THIS event. A host who was also a junior member of the shop was a
 * host to the app and 'team' to the database — so every whisper they sent with their co-hosts was refused, and so was
 * every co-host whisper that named them.
 *
 *   1 · THE BUG     — a host who is a junior (agent) member of the shop whispers with the co-host and the
 *                     coordinator; the co-host whispers back naming them; the shop reads neither.
 *   2 · ONE RULE    — chat_shop_team_user_ids(shop, event) is the owner · live owner/admin · a live member below admin
 *                     whose assigned service this event booked; never a deactivated member or an unassigned agent.
 *   3 · HOST FIRST  — even a SERVING junior member who hosts the event is on the hosts' side here; a team whisper can
 *                     not reach them, and they cannot claim the team's side.
 *
 * Failing-first: run against the tree WITHOUT 20271355512715 (move it aside) — 1 fails with WHISPER_NOT_YOUR_SIDE,
 * 2 fails with "function chat_shop_team_user_ids does not exist", 3 fails on the side.
 *
 * Run (from apps/web): tsx --test tests/db/a-host-on-the-shops-team-whispers-as-a-host.db.test.ts
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
const uniq = () => `ht-${++seq}`;

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
  threadId: string;
  shop: string;
  serviceId: string;
  supplier: string;
  admin: string;
  /** Host A — ALSO a junior (agent) member of the shop, assigned nothing this event booked. */
  hostAgent: string;
  hostB: string;
  coordinator: string;
};

async function newWorld(): Promise<World> {
  const supplier = await newUser('Sol');
  const admin = await newUser('Mara');
  const hostAgent = await newUser('Ana');
  const hostB = await newUser('Ben');
  const coordinator = await newUser('Liza');
  const shop = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at)
       VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW())
       RETURNING vendor_profile_id AS v`,
      [supplier, `Shop ${uniq()}`],
    )
  ).rows[0]!.v;
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`, [shop, admin]);
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent')`, [shop, hostAgent]);
  const serviceId = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
       VALUES ($1, 'photography', 40000, 'Free extra hour', FALSE, 'vendor-media/ht/cover.jpg') RETURNING vendor_service_id AS s`,
      [shop],
    )
  ).rows[0]!.s;
  const eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple'), ($1,$3,'couple'), ($1,$4,'coordinator')`,
    [eventId, hostAgent, hostB, coordinator],
  );
  const threadId = (
    await db.query<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id AS t`,
      [eventId, shop, hostAgent],
    )
  ).rows[0]!.t;
  const added = await as(hostAgent, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1,$2) AS r`, [threadId, hostB])).rows[0]!.r);
  assert.equal(added, 'added');
  return { eventId, threadId, shop, serviceId, supplier, admin, hostAgent, hostB, coordinator };
}

/** Assign `who`'s team seat to the service and have THIS event book it — the "serving" arm of the team rule. */
async function serve(w: World, who: string): Promise<void> {
  const m = (
    await db.query<{ m: string }>(
      `SELECT vendor_team_member_id AS m FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND user_id = $2`,
      [w.shop, who],
    )
  ).rows[0]!.m;
  await db.query(`INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id) VALUES ($1, $2)`, [w.serviceId, m]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1, 'misc', 'Shop', 'shortlisted', $2, $3)`,
    [w.eventId, w.shop, w.serviceId],
  );
}

async function whisper(w: World, who: string, side: 'hosts' | 'team', to: string[], body = 'between us'): Promise<string> {
  return as(who, async () => {
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_ids, whisper_side)
       VALUES ($1,$2,$3,$4,$5::uuid[],$6) RETURNING message_id`,
      [w.threadId, w.eventId, w.shop, body, to, side],
    );
    return r.rows[0]!.message_id;
  });
}
async function refused(w: World, who: string, side: 'hosts' | 'team', to: string[]): Promise<string> {
  try {
    await whisper(w, who, side, to);
  } catch (e) {
    return (e as Error).message;
  }
  return '';
}
async function reads(uid: string, messageId: string): Promise<number> {
  return as(uid, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE message_id = $1`, [messageId])).rows[0]!.n);
}
async function sideOf(w: World, uid: string): Promise<string | null> {
  return (await db.query<{ s: string | null }>(`SELECT public.chat_whisper_side_of($1,$2) AS s`, [w.threadId, uid])).rows[0]!.s;
}
async function team(w: World): Promise<string[]> {
  return (
    await db.query<{ u: string }>(`SELECT u::text AS u FROM public.chat_shop_team_user_ids($1,$2) AS u`, [w.shop, w.eventId])
  ).rows.map((r) => r.u).sort();
}

test('1 · THE BUG: a host who is a junior member of the shop whispers with the co-host and the coordinator', async () => {
  const w = await newWorld();
  assert.equal(await sideOf(w, w.hostAgent), 'hosts', 'a host on the shop’s team is not on the hosts’ side');
  const id = await whisper(w, w.hostAgent, 'hosts', [w.hostB, w.coordinator]);
  assert.equal(await reads(w.hostB, id), 1, 'the co-host cannot read it');
  assert.equal(await reads(w.coordinator, id), 1, 'the coordinator cannot read it');
  for (const [who, uid] of [['the supplier', w.supplier], ['the shop admin', w.admin]] as const) {
    assert.equal(await reads(uid, id), 0, `${who} reads the hosts’ whisper`);
  }
  // The co-host whispers back, naming them.
  const back = await whisper(w, w.hostB, 'hosts', [w.hostAgent, w.coordinator], 'Agreed.');
  assert.equal(await reads(w.hostAgent, back), 1, 'the host on the shop’s team cannot read the co-host’s whisper');
  assert.equal(await reads(w.supplier, back), 0);
});

test('2 · ONE RULE: the team is the owner, live owner/admin, and members serving THIS event — nobody else', async () => {
  const w = await newWorld();
  const outsider = await newUser('Gus');
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent')`, [w.shop, outsider]);
  const gone = await newUser('Old');
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, deactivated_at) VALUES ($1, $2, 'admin', NOW())`,
    [w.shop, gone],
  );
  assert.deepEqual(await team(w), [w.supplier, w.admin].sort(), 'an unassigned agent or a deactivated admin is on the team');
  await serve(w, outsider);
  assert.deepEqual(await team(w), [w.supplier, w.admin, outsider].sort(), 'a member serving this event is not on the team');
  // The boolean is derived from the same set — never a second rule.
  for (const [uid, want] of [[w.supplier, true], [w.admin, true], [outsider, true], [gone, false], [w.hostB, false]] as const) {
    const r = await db.query<{ b: boolean }>(`SELECT public.chat_is_shop_team($1,$2,$3) AS b`, [w.shop, w.eventId, uid]);
    assert.equal(r.rows[0]!.b, want);
  }
  // A shop's team whisper reaches the serving member.
  const id = await whisper(w, w.supplier, 'team', [w.admin, outsider], 'Okay to go down?');
  assert.equal(await reads(outsider, id), 1);
  assert.equal(await reads(w.hostB, id), 0);
});

test('3 · HOST FIRST: a host who SERVES this event for the shop is still on the hosts’ side here', async () => {
  const w = await newWorld();
  await serve(w, w.hostAgent);
  assert.ok((await team(w)).includes(w.hostAgent), 'the serving host is not in the shop’s team set');
  assert.equal(await sideOf(w, w.hostAgent), 'hosts', 'the shop’s role beat the host seat');
  assert.match(await refused(w, w.supplier, 'team', [w.admin, w.hostAgent]), /WHISPER_CROSSES_SIDES/, 'a team whisper reached a host');
  assert.match(await refused(w, w.hostAgent, 'team', [w.admin]), /WHISPER_NOT_YOUR_SIDE|row-level security/i, 'a host claimed the team’s side');
  const id = await whisper(w, w.hostAgent, 'hosts', [w.hostB]);
  assert.equal(await reads(w.hostB, id), 1);
  assert.equal(await reads(w.admin, id), 0);
  // A host of the event with no seat in this chat is on NO side — never the shop's team.
  await db.query(`UPDATE public.chat_thread_members SET left_at = NOW() WHERE thread_id = $1 AND user_id = $2`, [w.threadId, w.hostAgent]);
  assert.equal(await sideOf(w, w.hostAgent), null, 'a host with no seat here fell back to the shop’s team');
});

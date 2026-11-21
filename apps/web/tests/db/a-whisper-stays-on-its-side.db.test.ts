/**
 * A WHISPER STAYS ON ITS SIDE — Unichat part E, in the real schema (migration 20271354185201).
 * Owner, 19 Nov: "supplier whispers to co suppliers on the chat. and coordinators and hosts do not see it."
 * Owner, 20 Nov: "host and coordinator can whisper to each other."
 *
 *   1 · HOSTS' SIDE — a host's whisper reaches the other host AND the coordinator; the coordinator can whisper back;
 *                     the shop's owner, its team member and a stranger read nothing.
 *   2 · TEAM SIDE   — a supplier's whisper reaches its own team member; the hosts and the coordinator read nothing,
 *                     and nobody on the hosts' side is told.
 *   3 · F1 STAYS CLOSED — a co-host removed from the event, a coordinator removed from it, and a team member who is
 *                     deactivated each read NEITHER whisper afterwards (the side is judged NOW, not at send).
 *   4 · THE WRITE   — a whisper that crosses sides, claims the other side, or has nobody to hear it is refused.
 *   5 · SABOTAGE    — without the RESTRICTIVE policies the deactivated team member DOES read the team whisper (the
 *                     shop's permissive read never looks at deactivated_at): they are what close it; and a shared
 *                     line IS read by the supplier, so the zeros above are real.
 *
 * Run (from apps/web): tsx --test tests/db/a-whisper-stays-on-its-side.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { teamWhisperRecipients, whisperRecipients } from '../../lib/chat-whisper';

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
const uniq = () => `ws-${++seq}`;

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
  hostA: string;
  hostB: string;
  coordinator: string;
  supplier: string;
  teammate: string;
  stranger: string;
};

async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const coordinator = await newUser('Liza');
  const supplier = await newUser('Sol');
  const teammate = await newUser('Mara');
  const stranger = await newUser('Xia');
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
  return { eventId, threadId, shop, hostA, hostB, coordinator, supplier, teammate, stranger };
}

/** The hosts' list the send core writes — the SAME rows, through the REAL rule (`whisperRecipients`). */
async function hostsList(w: World, sender: string): Promise<string[]> {
  const members = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.chat_thread_members WHERE thread_id = $1 AND left_at IS NULL`, [w.threadId]);
  const coordinators = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.event_members WHERE event_id = $1 AND member_type = 'coordinator'`, [w.eventId]);
  const shop = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1
     UNION SELECT user_id FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND deactivated_at IS NULL`, [w.shop]);
  return whisperRecipients({
    hostMemberIds: members.rows.map((r) => r.user_id),
    coordinatorIds: coordinators.rows.map((r) => r.user_id),
    shopUserIds: shop.rows.map((r) => r.user_id),
    senderUserId: sender,
  });
}
/** The team's list — the shop's live people, through `teamWhisperRecipients`. */
async function teamList(w: World, sender: string): Promise<string[]> {
  const shop = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1
     UNION SELECT user_id FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND deactivated_at IS NULL`, [w.shop]);
  return teamWhisperRecipients({ teamUserIds: shop.rows.map((r) => r.user_id), senderUserId: sender });
}

/** The browser's own write, as `who`. */
async function whisper(w: World, who: string, side: 'hosts' | 'team' | null, to: string[] | null, body = 'between us'): Promise<string> {
  return as(who, async () => {
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_ids, whisper_side)
       VALUES ($1,$2,$3,$4,$5::uuid[],$6) RETURNING message_id`,
      [w.threadId, w.eventId, w.shop, body, to, side],
    );
    return r.rows[0]!.message_id;
  });
}
async function refused(w: World, who: string, side: 'hosts' | 'team', to: string[] | null): Promise<string> {
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

test('HOSTS’ SIDE: a host’s whisper reaches the co-host and the coordinator; the coordinator whispers back; the shop reads none', async () => {
  const w = await newWorld();
  const list = await hostsList(w, w.hostA);
  assert.deepEqual([...list].sort(), [w.hostB, w.coordinator].sort(), 'the hosts’ list is not the co-host + the coordinator');
  const id = await whisper(w, w.hostA, 'hosts', list);
  for (const [who, uid] of [['the whisperer', w.hostA], ['the co-host', w.hostB], ['the coordinator', w.coordinator]] as const) {
    assert.equal(await reads(uid, id), 1, `${who} cannot read the hosts’ whisper`);
  }
  for (const [who, uid] of [['the supplier', w.supplier], ['the team member', w.teammate], ['a stranger', w.stranger]] as const) {
    assert.equal(await reads(uid, id), 0, `${who} reads the hosts’ whisper`);
  }
  // The coordinator whispers too — and the row is stamped as theirs.
  const back = await whisper(w, w.coordinator, 'hosts', await hostsList(w, w.coordinator), 'Their quote is fair.');
  const row = await db.query<{ sender_role: string; whisper_side: string }>(`SELECT sender_role::text, whisper_side FROM public.chat_messages WHERE message_id = $1`, [back]);
  assert.deepEqual(row.rows[0], { sender_role: 'coordinator', whisper_side: 'hosts' });
  assert.equal(await reads(w.hostA, back), 1);
  assert.equal(await reads(w.hostB, back), 1);
  assert.equal(await reads(w.supplier, back), 0, 'the supplier reads the coordinator’s whisper');
});

test('TEAM SIDE: a supplier’s whisper reaches its own team; the hosts and the coordinator read none and are told nothing', async () => {
  const w = await newWorld();
  const list = await teamList(w, w.supplier);
  assert.deepEqual(list, [w.teammate]);
  await db.query(`DELETE FROM public.notifications`);
  const id = await whisper(w, w.supplier, 'team', list, 'Okay to go down to 42,500?');
  assert.equal(await reads(w.supplier, id), 1);
  assert.equal(await reads(w.teammate, id), 1, 'the team member cannot read the team’s whisper');
  for (const [who, uid] of [['host A', w.hostA], ['host B', w.hostB], ['the coordinator', w.coordinator], ['a stranger', w.stranger]] as const) {
    assert.equal(await reads(uid, id), 0, `${who} reads the team’s whisper`);
  }
  const told = (await db.query<{ user_id: string }>(`SELECT user_id FROM public.notifications`)).rows.map((r) => r.user_id);
  for (const uid of [w.hostA, w.hostB, w.coordinator]) assert.ok(!told.includes(uid), 'someone on the hosts’ side was told about a team whisper');
  // The team member answers.
  const back = await whisper(w, w.teammate, 'team', await teamList(w, w.teammate), 'Yes, boss.');
  assert.equal(await reads(w.supplier, back), 1);
  assert.equal(await reads(w.hostA, back), 0);
});

test('F1 STAYS CLOSED: a removed co-host, a removed coordinator and a deactivated team member read neither whisper', async () => {
  const w = await newWorld();
  const hostsId = await whisper(w, w.hostA, 'hosts', await hostsList(w, w.hostA));
  const teamId = await whisper(w, w.supplier, 'team', await teamList(w, w.supplier));
  // Before: each reads their own side's.
  assert.equal(await reads(w.hostB, hostsId), 1);
  assert.equal(await reads(w.coordinator, hostsId), 1);
  assert.equal(await reads(w.teammate, teamId), 1);

  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [w.eventId, w.hostB]);
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [w.eventId, w.coordinator]);
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NOW() WHERE vendor_profile_id = $1 AND user_id = $2`, [w.shop, w.teammate]);

  for (const [who, uid] of [['the removed co-host', w.hostB], ['the removed coordinator', w.coordinator], ['the deactivated team member', w.teammate]] as const) {
    assert.equal(await reads(uid, hostsId), 0, `${who} still reads the hosts’ whisper`);
    assert.equal(await reads(uid, teamId), 0, `${who} still reads the team’s whisper`);
  }
  // The people still on each side keep reading.
  assert.equal(await reads(w.hostA, hostsId), 1);
  assert.equal(await reads(w.supplier, teamId), 1);
  // And none of them can be whispered to any more.
  assert.match(await refused(w, w.hostA, 'hosts', [w.hostB]), /PRIVATE_NOT_A_MEMBER|WHISPER_CROSSES_SIDES/);
  assert.match(await refused(w, w.supplier, 'team', [w.teammate]), /PRIVATE_NOT_A_MEMBER|WHISPER_CROSSES_SIDES/);
  // A deactivated member cannot whisper to the team either.
  assert.match(await refused(w, w.teammate, 'team', [w.supplier]), /WHISPER_NOT_YOUR_SIDE|row-level security|not a party/i);
});

test('THE WRITE: a whisper that crosses sides, claims the other side, or has nobody to hear it is refused', async () => {
  const w = await newWorld();
  assert.match(await refused(w, w.hostA, 'hosts', [w.hostB, w.supplier]), /WHISPER_CROSSES_SIDES/, 'a hosts’ whisper can reach the supplier');
  assert.match(await refused(w, w.hostA, 'hosts', [w.teammate]), /WHISPER_CROSSES_SIDES/, 'a hosts’ whisper can reach the shop’s team');
  assert.match(await refused(w, w.supplier, 'team', [w.teammate, w.hostA]), /WHISPER_CROSSES_SIDES/, 'a team whisper can reach a host');
  assert.match(await refused(w, w.supplier, 'team', [w.coordinator]), /WHISPER_CROSSES_SIDES/, 'a team whisper can reach the coordinator');
  assert.match(await refused(w, w.hostA, 'team', [w.hostB]), /WHISPER_NOT_YOUR_SIDE/, 'a host can claim the team’s side');
  assert.match(await refused(w, w.supplier, 'hosts', [w.teammate]), /WHISPER_NOT_YOUR_SIDE|WHISPER_CROSSES_SIDES/, 'the supplier can claim the hosts’ side');
  assert.match(await refused(w, w.hostA, 'hosts', null), /chat_messages_a_whisper_has_its_people|WHISPER_NEEDS_ITS_PEOPLE/, 'a whisper with nobody becomes a line to everyone');
  assert.match(await refused(w, w.hostA, 'hosts', []), /chat_messages_a_whisper_has_its_people|WHISPER_NEEDS_ITS_PEOPLE/, 'an empty whisper becomes a line to everyone');
});

test('SABOTAGE: without the policy a deactivated team member reads the team whisper; a shared line reaches the supplier', async () => {
  const w = await newWorld();
  const teamId = await whisper(w, w.supplier, 'team', await teamList(w, w.supplier));
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NOW() WHERE vendor_profile_id = $1 AND user_id = $2`, [w.shop, w.teammate]);
  assert.equal(await reads(w.teammate, teamId), 0);
  // Drop the RESTRICTIVE policies that close it inside a transaction; `as` → `reset` rolls them back. Two close it
  // now: the whisper's side, and (20271354552883) a removed member reads nothing at all — proven alone, on a SHARED
  // line, in a-removed-member-reads-nothing.db.test.ts.
  await db.exec(`BEGIN`);
  await db.exec(`DROP POLICY chat_messages_whisper_stays_on_its_side ON public.chat_messages`);
  await db.exec(`DROP POLICY chat_messages_a_removed_member_reads_nothing ON public.chat_messages`);
  const without = await reads(w.teammate, teamId);
  assert.equal(without, 1, 'the deactivated member reads nothing even without the policy — the test cannot see what the policy closes');
  const back = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_policies WHERE policyname = 'chat_messages_whisper_stays_on_its_side'`);
  assert.equal(back.rows[0]!.n, 1, 'the sabotage was not rolled back');
  // A shared line IS read by the supplier — so every zero above is the fence, not the harness.
  const shared = await whisper(w, w.hostA, null, null, 'For everyone.');
  assert.equal(await reads(w.supplier, shared), 1);
});

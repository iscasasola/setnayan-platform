/**
 * A WHISPER NEVER REACHES THE SUPPLIER — the read, the notice and the typing channel, in the real schema.
 * DECISION_LOG 2026-11-19 "MESSAGE ⇄ WHISPER APPROVED" · "MIS-SEND REMINDER + WHISPER TYPING" · "WHISPER UN-PARKED".
 *
 * A whisper adds NO column and NO policy: it is the shipped private line (`recipient_user_ids`, migration
 * 20271340374819) written to the co-hosts in the chat. So what has to be proven is that the LIST the app writes
 * (`whisperRecipients`, lib/chat-whisper.ts — the real function, fed from the real rows the send core reads) can never
 * hold a shop login, and that with that list the database gives the supplier's side NOTHING:
 *
 *   1 · READ    — the shop's owner, its team member, the coordinator and a stranger select zero whisper rows; the
 *                 sender and every co-host in the chat select it. A host who LEFT, and a host who is ALSO on the shop's
 *                 team, are not on the list and read nothing.
 *   2 · NOTICE  — the whisper writes a notification for each co-host on the list and for nobody on the shop's side.
 *   3 · TYPING  — the one channel "X is whispering…" rides (`event-team:<event>`) admits the hosts and refuses the
 *                 shop's owner, its team member and a stranger (`event_team_presence_can_access`).
 *   4 · SABOTAGE — the same row written to EVERYONE (no list) IS read by the supplier: the list is the whole fence, so
 *                 the app must never fall back to "no list" for a whisper (the unit guard pins that it refuses).
 *
 * Run (from apps/web): tsx --test tests/db/a-whisper-never-reaches-the-supplier.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { whisperRecipients } from '../../lib/chat-whisper';

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
const uniq = () => `wh-${++seq}`;

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
  hostA: string; // the whisperer — the thread's opener
  hostB: string; // a co-host in the chat
  hostC: string; // a co-host in the chat
  hostLeft: string; // a host who was added, then left
  hostOnShopTeam: string; // a host of the event who is ALSO on the shop's team
  coordinator: string;
  supplier: string;
  teammate: string;
  stranger: string;
  shop: string;
  threadId: string;
};

async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Ben');
  const hostC = await newUser('Cai');
  const hostLeft = await newUser('Lia');
  const hostOnShopTeam = await newUser('Dua');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const teammate = await newUser('Tess');
  const stranger = await newUser('Xia');
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['catering']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [supplier, `Shop ${uniq()}`],
  );
  const shop = v.rows[0]!.vendor_profile_id;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin'), ($1, $3, 'admin')`,
    [shop, teammate, hostOnShopTeam],
  );
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple'), ($1,$3,'couple'), ($1,$4,'couple'), ($1,$5,'couple'), ($1,$6,'couple'), ($1,$7,'coordinator')`,
    [eventId, hostA, hostB, hostC, hostLeft, hostOnShopTeam, coordinator],
  );
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, hostA],
  );
  const threadId = t.rows[0]!.thread_id;
  for (const who of [hostB, hostC, hostLeft, hostOnShopTeam]) {
    const added = await as(hostA, async () =>
      (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1,$2) AS r`, [threadId, who])).rows[0]!.r);
    assert.equal(added, 'added');
  }
  await as(hostLeft, async () => {
    await db.query(`SELECT public.chat_thread_leave($1)`, [threadId]);
  });
  return { eventId, hostA, hostB, hostC, hostLeft, hostOnShopTeam, coordinator, supplier, teammate, stranger, shop, threadId };
}

/**
 * The list the send core writes: the SAME rows it reads (`readThreadHostPeople` → `chat_thread_members` with no
 * `left_at`; `readShopChatPeople` → the owner and the team), through the service role, into the REAL rule.
 */
async function whisperList(w: World, sender: string): Promise<string[]> {
  const members = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.chat_thread_members WHERE thread_id = $1 AND left_at IS NULL`,
    [w.threadId],
  );
  const team = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.vendor_profiles WHERE vendor_profile_id = $1
     UNION SELECT user_id FROM public.vendor_team_members WHERE vendor_profile_id = $1 AND deactivated_at IS NULL`,
    [w.shop],
  );
  return whisperRecipients({
    hostMemberIds: members.rows.map((r) => r.user_id),
    shopUserIds: team.rows.map((r) => r.user_id),
    senderUserId: sender,
  });
}

/** The browser's own write, as the whisperer. `to = null` writes the line to everyone (the sabotage). */
async function write(w: World, body: string, to: string[] | null): Promise<string> {
  return as(w.hostA, async () => {
    const r = to
      ? await db.query<{ message_id: string }>(
          `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_ids)
           VALUES ($1,$2,$3,$4,$5::uuid[]) RETURNING message_id`,
          [w.threadId, w.eventId, w.shop, body, to],
        )
      : await db.query<{ message_id: string }>(
          `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body)
           VALUES ($1,$2,$3,$4) RETURNING message_id`,
          [w.threadId, w.eventId, w.shop, body],
        );
    return r.rows[0]!.message_id;
  });
}

async function reads(uid: string, messageId: string): Promise<number> {
  return as(uid, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE message_id = $1`, [messageId])).rows[0]!.n);
}

test('the list is the co-hosts in the chat — never a shop login, a host who left, or the whisperer', async () => {
  const w = await newWorld();
  const list = await whisperList(w, w.hostA);
  assert.deepEqual([...list].sort(), [w.hostB, w.hostC].sort());
  for (const [who, id] of [['the supplier', w.supplier], ['the shop team member', w.teammate], ['a host on the shop team', w.hostOnShopTeam], ['a host who left', w.hostLeft], ['the coordinator', w.coordinator], ['the whisperer', w.hostA]] as const) {
    assert.ok(!list.includes(id), `${who} is on the whisper list`);
  }
});

test('READ: the supplier side selects no whisper row; the co-hosts in the chat do', async () => {
  const w = await newWorld();
  const id = await write(w, 'Can we push it to 4? Mama lands at 2.', await whisperList(w, w.hostA));
  for (const [who, uid] of [['the supplier', w.supplier], ['the shop team member', w.teammate], ['a host on the shop team', w.hostOnShopTeam], ['a host who left', w.hostLeft], ['the coordinator', w.coordinator], ['a stranger', w.stranger]] as const) {
    assert.equal(await reads(uid, id), 0, `${who} can read a whisper`);
  }
  for (const [who, uid] of [['the whisperer', w.hostA], ['co-host B', w.hostB], ['co-host C', w.hostC]] as const) {
    assert.equal(await reads(uid, id), 1, `${who} cannot read the whisper`);
  }
  // …and the supplier's whole view of the thread carries no private line at all.
  const supplierSees = await as(w.supplier, async () =>
    (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages WHERE thread_id = $1 AND recipient_user_ids IS NOT NULL`, [w.threadId])).rows[0]!.n);
  assert.equal(supplierSees, 0, 'a supplier read of the thread returned a whisper row');
});

test('NOTICE: only the co-hosts on the list are told — nobody on the shop side', async () => {
  const w = await newWorld();
  await db.query(`DELETE FROM public.notifications`);
  await write(w, 'Between us.', await whisperList(w, w.hostA));
  const told = await db.query<{ user_id: string }>(`SELECT user_id FROM public.notifications`);
  const ids = told.rows.map((r) => r.user_id);
  assert.deepEqual([...new Set(ids)].sort(), [w.hostB, w.hostC].sort(), 'the whisper told somebody off the list, or missed a co-host');
  for (const uid of [w.supplier, w.teammate, w.hostOnShopTeam]) assert.ok(!ids.includes(uid), 'a shop login was told about a whisper');
});

test('TYPING: the channel "is whispering…" rides admits the hosts and refuses the shop', async () => {
  const w = await newWorld();
  const can = async (uid: string) =>
    as(uid, async () =>
      (await db.query<{ ok: boolean }>(`SELECT public.event_team_presence_can_access($1) AS ok`, [`event-team:${w.eventId}`])).rows[0]!.ok);
  assert.equal(await can(w.hostA), true);
  assert.equal(await can(w.hostB), true);
  for (const [who, uid] of [['the supplier', w.supplier], ['the shop team member', w.teammate], ['a stranger', w.stranger]] as const) {
    assert.equal(await can(uid), false, `${who} can join the channel whispered typing rides`);
  }
});

test('SABOTAGE: the same line with NO list is read by the supplier — the list is the whole fence', async () => {
  const w = await newWorld();
  const id = await write(w, 'This one went to everyone.', null);
  assert.equal(await reads(w.supplier, id), 1, 'the harness cannot see a shared line as the supplier — its zeros above prove nothing');
});

/**
 * EVENT GROUP CHATS · A PRIVATE LINE TO SEVERAL PEOPLE
 * Migrations 20271339978803 (the 'guest' side) + 20271340374819.
 *
 * ⚖ specs DECISION_LOG 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN":
 *   General = the hosts + every attending guest, NO suppliers · one group per
 *   role from the guest list · a host makes more groups (suppliers and guests
 *   may be in them) · quotes, payments and forms never go inside a group ·
 *   hosts + the coordinator add, hosts may leave, a supplier never adds/leaves.
 * ⚖ 2026-11-12 "PRIVATE MESSAGES — TWO DOORS, SEVERAL PEOPLE": a private line
 *   may go to several people; a guest may send one in General.
 * ⚖ 2026-11-12 "FIVE GUARDS APPROVED": (1) a private line's alert reaches only
 *   its recipients and never carries the words; (2) admin/support read a
 *   private line ONLY inside a dispute, never event helpers/moderators.
 *
 * Every rule below was checked by sabotage (see the PR body for each run):
 * the rule's SQL was weakened in the migration, the file went red on the
 * named test, and was restored.
 *
 * Run (from apps/web): tsx --test tests/db/event-group-chats-and-a-private-line-to-several.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const GUEST_FILE = '20271339978803_a_guest_can_speak_in_a_group_chat.sql';
const GROUPS_FILE = '20271340374819_event_group_chats_and_a_private_line_to_several_people.sql';

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
async function attempt(uid: string, fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await as(uid, fn);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

let seq = 0;
const uniq = () => `gc-${++seq}`;

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
  coordinator: string;
  supplier: string;
  shop: string;
  supplierThread: string;
  attending: string; // a guest who said yes · a principal sponsor
  attending2: string; // a guest who said yes · in the entourage
  pending: string; // a guest who has not answered · a principal sponsor
  declined: string;
  moderator: string; // an event helper (event_moderators) — never a reader of private lines
  stranger: string;
};

async function guest(eventId: string, uid: string, name: string, rsvp: string, role: string): Promise<void> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status, role)
     VALUES ($1, $2, 'Guest', 'both', 'friends', $3::public.rsvp_status, $4::public.guest_role) RETURNING guest_id`,
    [eventId, name, rsvp, role],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES ($1, $2, 'guest', $3)`,
    [eventId, uid, g.rows[0]!.guest_id],
  );
}

async function newWorld(): Promise<World> {
  const hostA = await newUser('Ana');
  const hostB = await newUser('Miguel');
  const coordinator = await newUser('Lu');
  const supplier = await newUser('Rosa');
  const attending = await newUser('Paolo');
  const attending2 = await newUser('Carlo');
  const pending = await newUser('Nena');
  const declined = await newUser('Dan');
  const moderator = await newUser('Tess');
  const stranger = await newUser('Xia');
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
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1,$2,'couple'), ($1,$3,'couple'), ($1,$4,'coordinator'), ($1,$5,'couple')`,
    [eventId, hostA, hostB, coordinator, moderator],
  );
  // The helper is an event moderator (family_helper) — a host-side login with
  // a moderator role row. She is a host of the event, so she is in General.
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'family_helper', '{"edit_all":false}'::jsonb, NOW())
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, moderator],
  );
  await guest(eventId, attending, 'Paolo', 'attending', 'principal_sponsor');
  await guest(eventId, attending2, 'Carlo', 'attending', 'groomsman');
  await guest(eventId, pending, 'Nena', 'pending', 'principal_sponsor');
  await guest(eventId, declined, 'Dan', 'declined', 'guest');
  const supplierThread = (
    await db.query<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id AS t`,
      [eventId, shop, hostA],
    )
  ).rows[0]!.t;
  return {
    eventId, hostA, hostB, coordinator, supplier, shop, supplierThread,
    attending, attending2, pending, declined, moderator, stranger,
  };
}

async function rpc<T = string>(uid: string, sql: string, params: unknown[]): Promise<T> {
  return as(uid, async () => (await db.query<{ r: T }>(sql, params)).rows[0]!.r);
}
async function openGeneral(w: World): Promise<string> {
  return rpc(w.hostA, `SELECT public.chat_group_open($1) AS r`, [w.eventId]);
}
async function say(uid: string, thread: string, eventId: string, body: string, opts: { to?: string[]; shop?: string | null } = {}): Promise<string> {
  return as(uid, async () => {
    const r = await db.query<{ message_id: string }>(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_ids)
       VALUES ($1,$2,$3,$4,$5) RETURNING message_id`,
      [thread, eventId, opts.shop ?? null, body, opts.to ?? null],
    );
    return r.rows[0]!.message_id;
  });
}
async function bodies(uid: string, thread: string): Promise<string[]> {
  return as(uid, async () =>
    (await db.query<{ body: string }>(
      `SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system' ORDER BY created_at, message_id`,
      [thread],
    )).rows.map((r) => r.body),
  );
}

test('both migrations applied on top of the full corpus (not skipped)', () => {
  for (const f of [GUEST_FILE, GROUPS_FILE]) {
    assert.ok(!replay.skipped.some((s) => s.file === f), `${f} was skipped during replay`);
  }
});

// ── who is in General ───────────────────────────────────────────────────────

test('General = the hosts + the attending guests; no supplier, no coordinator, no pending or declined guest', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  assert.equal(await openGeneral(w), g, 'opening General twice returns the same group');

  await say(w.hostA, g, w.eventId, 'Welcome everyone!');
  await say(w.attending, g, w.eventId, 'See you all Saturday!');
  for (const reader of [w.hostA, w.hostB, w.attending, w.attending2]) {
    assert.deepEqual(await bodies(reader, g), ['Welcome everyone!', 'See you all Saturday!']);
  }
  for (const outsider of [w.supplier, w.coordinator, w.pending, w.declined, w.stranger]) {
    assert.deepEqual(await bodies(outsider, g), [], 'an outsider of General reads nothing');
    const err = await attempt(outsider, () =>
      db.query(`INSERT INTO public.chat_messages (thread_id, event_id, body) VALUES ($1,$2,'let me in')`, [g, w.eventId]));
    assert.ok(err, 'an outsider of General cannot post into it');
  }
  const roles = await db.query<{ sender_role: string; body: string }>(
    `SELECT sender_role::text, body FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system' ORDER BY created_at`, [g]);
  assert.deepEqual(roles.rows.map((r) => r.sender_role), ['couple', 'guest'], 'a guest speaks as a guest');
});

test('a guest who starts attending is in General at once; one who stops is out', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  await say(w.hostA, g, w.eventId, 'Hello');
  assert.deepEqual(await bodies(w.pending, g), []);
  await db.query(
    `UPDATE public.guests SET rsvp_status = 'attending' WHERE guest_id = (SELECT guest_id FROM public.event_members WHERE user_id = $1)`,
    [w.pending]);
  assert.deepEqual(await bodies(w.pending, g), ['Hello']);
});

test('a role group gathers the hosts and the guests holding its roles', async () => {
  const w = await newWorld();
  const r = await rpc(w.hostA, `SELECT public.chat_group_open_role($1,'principal_sponsors','Principal sponsors',
    ARRAY['principal_sponsor','principal_sponsor_ninong','principal_sponsor_ninang']::public.guest_role[]) AS r`, [w.eventId]);
  await say(w.hostA, r, w.eventId, 'Thank you po for saying yes');
  assert.deepEqual(await bodies(w.attending, r), ['Thank you po for saying yes']);
  assert.deepEqual(await bodies(w.pending, r), ['Thank you po for saying yes'], 'a role group is the guest list, not the RSVP');
  assert.deepEqual(await bodies(w.attending2, r), [], 'a groomsman is not a sponsor');
  assert.deepEqual(await bodies(w.supplier, r), []);
  const err = await attempt(w.attending, () =>
    db.query(`SELECT public.chat_group_open_role($1,'x','X',ARRAY['guest']::public.guest_role[])`, [w.eventId]));
  assert.match(err ?? '', /only the hosts and the coordinator/);
});

// ── who adds · who leaves ───────────────────────────────────────────────────

test('General never takes a supplier; a host adds the coordinator; a guest and a supplier add nobody', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  assert.equal(await rpc(w.hostA, `SELECT public.chat_group_add($1,$2) AS r`, [g, [w.supplier]]), 'no_suppliers_in_general');
  assert.equal(await rpc(w.attending, `SELECT public.chat_group_add($1,$2) AS r`, [g, [w.coordinator]]), 'not_allowed',
    'a guest cannot add');
  assert.equal(await rpc(w.hostA, `SELECT public.chat_group_add($1,$2) AS r`, [g, [w.stranger]]), 'not_a_person_here');
  assert.equal(await rpc(w.hostA, `SELECT public.chat_group_add($1,$2) AS r`, [g, [w.coordinator]]), 'added');
  await say(w.hostA, g, w.eventId, 'Tita Lu is here');
  assert.deepEqual(await bodies(w.coordinator, g), ['Tita Lu is here']);
});

test('a host makes a group with suppliers and guests; only hosts make one', async () => {
  const w = await newWorld();
  const err = await attempt(w.coordinator, () =>
    db.query(`SELECT public.chat_group_create($1,'Crew',$2)`, [w.eventId, [w.supplier]]));
  assert.match(err ?? '', /only a host makes a group/);
  const err2 = await attempt(w.hostA, () =>
    db.query(`SELECT public.chat_group_create($1,'Crew',$2)`, [w.eventId, [w.stranger]]));
  assert.match(err2 ?? '', /GROUP_NOT_A_PERSON_HERE/);

  const crew = await rpc(w.hostA, `SELECT public.chat_group_create($1,'Day-of crew',$2) AS r`,
    [w.eventId, [w.hostB, w.coordinator, w.supplier, w.attending2]]);
  await say(w.supplier, crew, w.eventId, 'Load-in at 2 PM works for us');
  for (const reader of [w.hostA, w.hostB, w.coordinator, w.supplier, w.attending2]) {
    assert.deepEqual(await bodies(reader, crew), ['Load-in at 2 PM works for us']);
  }
  assert.deepEqual(await bodies(w.attending, crew), [], 'a guest not ticked is not in it');
  const sys = await db.query<{ body: string }>(
    `SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role = 'system'`, [crew]);
  assert.match(sys.rows[0]!.body, /^Ana made the group · /);
  // The supplier writes as the supplier, with no shop on the line.
  const line = await db.query<{ sender_role: string; vendor_profile_id: string | null }>(
    `SELECT sender_role::text, vendor_profile_id FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system'`, [crew]);
  assert.deepEqual(line.rows[0], { sender_role: 'vendor', vendor_profile_id: null });
});

test('a supplier never adds and never leaves — through either door; a host leaves and comes back', async () => {
  const w = await newWorld();
  const crew = await rpc(w.hostA, `SELECT public.chat_group_create($1,'Day-of crew',$2) AS r`,
    [w.eventId, [w.hostB, w.supplier]]);
  assert.equal(await rpc(w.supplier, `SELECT public.chat_group_add($1,$2) AS r`, [crew, [w.coordinator]]), 'not_allowed');
  assert.equal(await rpc(w.supplier, `SELECT public.chat_group_leave($1,NULL) AS r`, [crew]), 'cannot_leave');
  assert.equal(await rpc(w.supplier, `SELECT public.chat_thread_leave($1,NULL) AS r`, [crew]), 'not_found',
    'the supplier-chat door refuses a group');
  assert.equal(await rpc(w.hostB, `SELECT public.chat_thread_add_host($1,$2) AS r`, [crew, w.hostA]), 'not_found');

  assert.equal(await rpc(w.hostB, `SELECT public.chat_group_leave($1,'too many pings') AS r`, [crew]), 'left');
  await say(w.hostA, crew, w.eventId, 'After Miguel left');
  assert.deepEqual(await bodies(w.hostB, crew), [], 'a host who left reads nothing');
  assert.equal(await rpc(w.hostB, `SELECT public.chat_group_add($1,$2) AS r`, [crew, [w.hostB]]), 'rejoined');
  assert.deepEqual(await bodies(w.hostB, crew), ['After Miguel left']);
});

test('a host can leave General (derived) and a guest cannot', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  assert.equal(await rpc(w.attending, `SELECT public.chat_group_leave($1,NULL) AS r`, [g]), 'cannot_leave');
  assert.equal(await rpc(w.hostB, `SELECT public.chat_group_leave($1,NULL) AS r`, [g]), 'left');
  await say(w.hostA, g, w.eventId, 'Miguel is out');
  assert.deepEqual(await bodies(w.hostB, g), []);
});

// ── group rows are read through the functions ───────────────────────────────

test('a group row never reaches a table read; the list function answers members only', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  const crew = await rpc(w.hostA, `SELECT public.chat_group_create($1,'Day-of crew',$2) AS r`, [w.eventId, [w.supplier]]);
  const rows = await as(w.hostA, async () =>
    (await db.query<{ thread_id: string }>(`SELECT thread_id FROM public.chat_threads WHERE event_id = $1`, [w.eventId])).rows);
  assert.deepEqual(rows.map((r) => r.thread_id), [w.supplierThread], 'a host listing chat_threads by event sees only supplier chats');

  const list = await as(w.hostB, async () =>
    (await db.query<{ thread_id: string; group_kind: string }>(`SELECT thread_id, group_kind FROM public.chat_group_list($1)`, [w.eventId])).rows);
  assert.deepEqual(list.map((r) => r.thread_id), [g], 'Miguel is in General, not in a group he was never put in');
  const sup = await as(w.supplier, async () =>
    (await db.query<{ thread_id: string }>(`SELECT thread_id FROM public.chat_group_list($1)`, [w.eventId])).rows);
  assert.deepEqual(sup.map((r) => r.thread_id), [crew]);
  const none = await as(w.stranger, async () =>
    (await db.query(`SELECT * FROM public.chat_group_members($1)`, [g])).rows[0] as { chat_group_members: unknown });
  assert.deepEqual(none.chat_group_members, [], 'a stranger is told nobody');
});

test('the event\'s people (for "+ New group" and the ＋) are told to hosts and the coordinator only', async () => {
  const w = await newWorld();
  const people = async (uid: string) =>
    as(uid, async () => (await db.query<{ p: Array<{ user_id: string; kind: string }> }>(`SELECT public.chat_group_people($1) AS p`, [w.eventId])).rows[0]!.p);
  const forHost = await people(w.hostA);
  const kinds = new Map(forHost.map((x) => [x.user_id, x.kind]));
  assert.equal(kinds.get(w.supplier), 'supplier');
  assert.equal(kinds.get(w.coordinator), 'coordinator');
  assert.equal(kinds.get(w.declined), 'guest', 'a guest who declined can still be put in a made group');
  assert.equal(kinds.get(w.hostB), 'host');
  assert.ok(!kinds.has(w.stranger));
  assert.ok((await people(w.coordinator)).length > 0);
  assert.deepEqual(await people(w.attending), [], 'a guest is told nobody');
  assert.deepEqual(await people(w.supplier), [], 'a supplier is told nobody');
});

test('a browser can never open a group or turn a supplier chat into one', async () => {
  const w = await newWorld();
  const ins = await attempt(w.hostA, () => db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, kind, group_kind, group_name)
     VALUES ($1, NULL, $2, 'group', 'made', 'Secret')`, [w.eventId, w.hostA]));
  assert.match(ins ?? '', /GROUP_IS_OPENED_BY_SETNAYAN|row-level security|permission denied/);
  const upd = await attempt(w.hostA, () => db.query(
    `UPDATE public.chat_threads SET group_name = 'Renamed' WHERE thread_id = $1`, [w.supplierThread]));
  assert.match(upd ?? '', /GROUP_IS_OPENED_BY_SETNAYAN/, 'a host wrote a group field on a supplier chat');
  // …and the function door still opens one.
  assert.ok(await openGeneral(w));
});

// ── money never enters a group ──────────────────────────────────────────────

test('a group line names no supplier and carries no money card', async () => {
  const w = await newWorld();
  const crew = await rpc(w.hostA, `SELECT public.chat_group_create($1,'Day-of crew',$2) AS r`, [w.eventId, [w.supplier]]);
  // Even the server (no RLS, no derivation) cannot address a group line to a shop.
  await assert.rejects(
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, sender_user_id, body)
              VALUES ($1,$2,$3,'vendor',$4,'Quote attached')`, [crew, w.eventId, w.shop, w.supplier]),
    /GROUP_HAS_NO_SUPPLIER/);
  const svc = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, name) VALUES ($1, 'Garden buffet') RETURNING vendor_service_id AS s`,
    [w.shop]).catch(() => null);
  if (svc) {
    await assert.rejects(
      db.query(`INSERT INTO public.chat_messages (thread_id, event_id, sender_role, sender_user_id, body, offered_service_id)
                VALUES ($1,$2,'vendor',$3,'Our buffet',$4)`, [crew, w.eventId, w.supplier, svc.rows[0]!.s]),
      /MONEY_NOT_IN_A_GROUP|CARD_NOT_THIS_CONVERSATION/);
  }
  // …and a supplier conversation line still always names its supplier.
  await assert.rejects(
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_role, body)
              VALUES ($1,$2,NULL,'system','x')`, [w.supplierThread, w.eventId]),
    /names its supplier/);
});

// ── a private line to several people ────────────────────────────────────────

test('a private line in a group reaches its sender and its recipients only — a guest may send one to the hosts', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  const id = await say(w.attending, g, w.eventId, 'Can I bring my lola?', { to: [w.hostB, w.hostA] });
  const row = await db.query<{ recipient_user_id: string; recipient_user_ids: string[] }>(
    `SELECT recipient_user_id, recipient_user_ids FROM public.chat_messages WHERE message_id = $1`, [id]);
  const sorted = [w.hostA, w.hostB].sort();
  assert.deepEqual(row.rows[0]!.recipient_user_ids, sorted, 'the list is sorted and de-duplicated');
  assert.equal(row.rows[0]!.recipient_user_id, sorted[0], 'recipient_user_id is the first of the list');

  for (const reader of [w.attending, w.hostA, w.hostB]) {
    assert.deepEqual(await bodies(reader, g), ['Can I bring my lola?']);
  }
  for (const third of [w.attending2, w.moderator]) {
    assert.deepEqual(await bodies(third, g), [], 'a third member of General — a guest, an event helper — reads nothing');
  }
});

test('a reply to the same people reaches the same people', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  await say(w.attending, g, w.eventId, 'Can I bring my lola?', { to: [w.hostA, w.hostB] });
  await say(w.hostA, g, w.eventId, 'Of course po', { to: [w.attending, w.hostB] });
  assert.deepEqual(await bodies(w.hostB, g), ['Can I bring my lola?', 'Of course po']);
  assert.deepEqual(await bodies(w.attending, g), ['Can I bring my lola?', 'Of course po']);
  assert.deepEqual(await bodies(w.attending2, g), []);
});

test('a private line refuses someone outside the chat, the sender, and more than 50; an empty list is shared', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  assert.match(
    (await attempt(w.hostA, () => db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, body, recipient_user_ids) VALUES ($1,$2,'psst',$3)`,
      [g, w.eventId, [w.hostB, w.supplier]]))) ?? '',
    /PRIVATE_NOT_A_MEMBER/, 'the supplier is not in General');
  assert.match(
    (await attempt(w.hostA, () => db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, body, recipient_user_ids) VALUES ($1,$2,'psst',$3)`,
      [g, w.eventId, [w.hostA, w.hostB]]))) ?? '',
    /PRIVATE_NOT_TO_SELF/);
  const id = await say(w.hostA, g, w.eventId, 'For everyone', { to: [] });
  const r = await db.query<{ ids: string[] | null; one: string | null }>(
    `SELECT recipient_user_ids AS ids, recipient_user_id AS one FROM public.chat_messages WHERE message_id = $1`, [id]);
  assert.deepEqual(r.rows[0], { ids: null, one: null });
  assert.deepEqual(await bodies(w.attending2, g), ['For everyone']);
});

test('a private line is words only — in a group too', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  const err = await attempt(w.hostA, () => db.query(
    `INSERT INTO public.chat_messages (thread_id, event_id, body, recipient_user_ids, attachment_r2_key, attachment_name)
     VALUES ($1,$2,'photo',$3,$4,'a.jpg')`,
    [g, w.eventId, [w.hostB], `r2://setnayan-thread-files/chat/${g}/${w.hostA}/a.jpg`]));
  assert.match(err ?? '', /private_is_words_only/);
});

test('several recipients in a SUPPLIER chat: the shipped one-recipient rule still holds, now for each', async () => {
  const w = await newWorld();
  await rpc(w.hostA, `SELECT public.chat_thread_add_host($1,$2) AS r`, [w.supplierThread, w.hostB]);
  await say(w.supplier, w.supplierThread, w.eventId, 'Only for the two hosts', { to: [w.hostA, w.hostB], shop: w.shop });
  const read = async (uid: string) => as(uid, async () =>
    (await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system'`, [w.supplierThread])).rows.map((r) => r.body));
  assert.deepEqual(await read(w.hostA), ['Only for the two hosts']);
  assert.deepEqual(await read(w.hostB), ['Only for the two hosts']);
  assert.deepEqual(await read(w.supplier), ['Only for the two hosts']);
  assert.deepEqual(await read(w.coordinator), [], 'the coordinator sees every chat, never other people\'s private lines');
});

// ── 🛡 guard 2 · admin only inside a dispute; never a helper ────────────────

test('an admin reads a private line only while an open dispute ties the event to the supplier', async () => {
  const w = await newWorld();
  // The coordinator is ALSO a Setnayan admin account: in the chat (a permissive
  // read branch), so only the private rule decides.
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [w.coordinator]);
  await say(w.hostA, w.supplierThread, w.eventId, 'Between Ana and Rosa', { to: [w.supplier], shop: w.shop });
  const read = async () => as(w.coordinator, async () =>
    (await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system'`, [w.supplierThread])).rows.map((r) => r.body));
  assert.deepEqual(await read(), [], 'no dispute → an admin reads no private line');

  const order = (await db.query<{ o: string }>(
    `INSERT INTO public.orders (user_id, event_id, description, requested_total_php, reference_code)
     VALUES ($1,$2,'Catering', 1000, $3) RETURNING order_id AS o`, [w.hostA, w.eventId, `GC${seq}REF`])).rows[0]!.o;
  const d = (await db.query<{ d: string }>(
    `INSERT INTO public.vendor_disputes (vendor_profile_id, order_id, opened_by_user_id, category, description)
     VALUES ($1,$2,$3,'no_show','They did not come') RETURNING dispute_id AS d`, [w.shop, order, w.hostA])).rows[0]!.d;
  assert.deepEqual(await read(), ['Between Ana and Rosa'], 'inside an open dispute the admin reads it');

  // The neutral team closes it (the service role — guard_vendor_dispute_contest_columns reverts anyone else).
  await setClaimRole('service_role');
  await db.query(`UPDATE public.vendor_disputes SET status = 'resolved_for_couple' WHERE dispute_id = $1`, [d]);
  await reset();
  assert.deepEqual(await read(), [], 'once the dispute is closed, the line closes again');
});

test('an event helper (moderator) never reads a private line between other people', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  await say(w.hostA, g, w.eventId, 'Just for Miguel', { to: [w.hostB] });
  assert.deepEqual(await bodies(w.moderator, g), []);
});

// ── 🛡 guard 1 · the alerts reach the recipients only, without the words ────

test('a private line tells each recipient once, never in its own words, and nobody else', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  await db.exec(`DELETE FROM public.notifications`);
  await say(w.attending, g, w.eventId, 'SECRET-WORDS lola', { to: [w.hostA, w.hostB] });
  const n = await db.query<{ user_id: string; title: string; body: string | null; related_url: string }>(
    `SELECT user_id, title, body, related_url FROM public.notifications ORDER BY user_id`);
  assert.deepEqual(n.rows.map((r) => r.user_id), [w.hostA, w.hostB].sort());
  for (const r of n.rows) {
    assert.ok(!`${r.title} ${r.body}`.includes('SECRET-WORDS'), 'the words never reach a notice');
    assert.equal(r.related_url, `/samahan/chat/${g}`);
  }
});

test('the live ping of a private line reaches its recipients; a shared group line its members; the sender never', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  const ids = async (sender: string, to: string[] | null) =>
    (await db.query<{ x: string }>(`SELECT x FROM public.chat_message_reader_ids($1,$2,NULL,$3,$4) AS x ORDER BY 1`,
      [g, w.eventId, sender, to])).rows.map((r) => r.x);
  assert.deepEqual(await ids(w.attending, [w.hostA, w.hostB]), [w.hostA, w.hostB].sort());
  const shared = await ids(w.hostA, null);
  assert.deepEqual(shared, [w.hostB, w.moderator, w.attending, w.attending2].sort());
  assert.ok(!shared.includes(w.supplier) && !shared.includes(w.coordinator) && !shared.includes(w.pending));
});

test('the push webhook (the shop\'s devices) never fires for a group line or a private line', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  await db.query(
    `INSERT INTO vault.secrets (name, secret) VALUES ('notify_webhook_secret', 'test-only-not-a-secret')
     ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret`);
  try {
    await db.exec(`DELETE FROM net._http_calls`);
    await say(w.hostA, g, w.eventId, 'Group news');
    await say(w.hostA, w.supplierThread, w.eventId, 'For Rosa only', { to: [w.supplier], shop: w.shop });
    assert.equal((await db.query(`SELECT 1 FROM net._http_calls`)).rows.length, 0);
    await say(w.hostA, w.supplierThread, w.eventId, 'Shared with the shop', { shop: w.shop });
    assert.equal((await db.query(`SELECT 1 FROM net._http_calls`)).rows.length, 1, 'a shared supplier line still notifies');
  } finally {
    await db.exec(`DELETE FROM vault.secrets WHERE name = 'notify_webhook_secret'`);
  }
});

test('the unread counters: a private line moves only its recipients; the list preview never shows it to a third', async () => {
  const w = await newWorld();
  const g = await openGeneral(w);
  await say(w.attending, g, w.eventId, 'Psst for Ana', { to: [w.hostA] });
  const count = async (uid: string) => rpc<number>(uid, `SELECT public.count_unread_message_threads() AS r`, []);
  assert.equal(await count(w.hostA), 1);
  assert.equal(await count(w.hostB), 0);
  assert.equal(await count(w.attending2), 0);
  const preview = await as(w.hostB, async () =>
    (await db.query<{ last_body: string | null }>(`SELECT last_body FROM public.chat_group_list($1)`, [w.eventId])).rows[0]!.last_body);
  assert.equal(preview, null, 'Miguel\'s preview of General is not Ana\'s private line');
  const own = await as(w.hostA, async () =>
    (await db.query<{ last_body: string | null }>(`SELECT last_body FROM public.chat_group_list($1)`, [w.eventId])).rows[0]!.last_body);
  assert.equal(own, 'Psst for Ana');
});

// ── an add reaches the person added (W1/W3 RW-197, 2026-11-14: "added to its chat gets NO notice") ─────────
test('a person added to a group is told who added them and where — the adder, a rejoin and a refused add are not', async () => {
  const w = await newWorld();
  const notices = async (uid: string) =>
    (await db.query<{ title: string; related_url: string; event_id: string | null }>(
      `SELECT title, related_url, event_id FROM public.notifications WHERE user_id = $1 AND type = 'chat_message' ORDER BY created_at`, [uid])).rows;

  const crew = await rpc(w.hostA, `SELECT public.chat_group_create($1,'Day-of crew',$2) AS r`, [w.eventId, [w.hostB, w.supplier]]);
  for (const added of [w.hostB, w.supplier]) {
    const n = await notices(added);
    assert.equal(n.length, 1, 'one notice for each person ticked');
    assert.match(n[0]!.title, /^Ana added you to Day-of crew$/);
    assert.equal(n[0]!.related_url, `/samahan/chat/${crew}`);
    assert.equal(n[0]!.event_id, w.eventId, 'the notice carries its event, so the bell names its place');
  }
  assert.equal((await notices(w.hostA)).length, 0, 'the person who made the group is not told about it');

  const g = await openGeneral(w);
  assert.equal(await rpc(w.hostA, `SELECT public.chat_group_add($1,$2) AS r`, [g, [w.supplier]]), 'no_suppliers_in_general');
  assert.equal((await notices(w.supplier)).length, 1, 'a refused add tells nobody');
  assert.equal(await rpc(w.hostA, `SELECT public.chat_group_add($1,$2) AS r`, [g, [w.coordinator]]), 'added');
  assert.equal((await notices(w.coordinator)).length, 1);

  assert.equal(await rpc(w.hostB, `SELECT public.chat_group_leave($1,NULL) AS r`, [crew]), 'left');
  assert.equal(await rpc(w.hostB, `SELECT public.chat_group_add($1,$2) AS r`, [crew, [w.hostB]]), 'rejoined');
  assert.equal((await notices(w.hostB)).length, 1, 'coming back by yourself is not news');
});

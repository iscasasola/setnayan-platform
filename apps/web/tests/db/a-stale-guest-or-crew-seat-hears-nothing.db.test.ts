/**
 * A STALE GUEST OR CREW SEAT HEARS NOTHING — migration 20271353093349, the follow-up to 20271352461498
 * (a removed co-host reads no chat). Owner, 20 Nov: "Yes, build it".
 *
 * Before 20271353093349, a shop's crew member deactivated (vendor_team_members.deactivated_at) or taken off the team
 * kept a LIVE seat (left_at IS NULL) in every host-made
 * group they had been put in. current_thread_ids() already read them nothing (chat_seat_is_held), but the live-ping
 * fan-out (chat_message_reader_ids → chat_group_member_ids) and the private-line recipient check read the live row —
 * so they were still pinged about lines in a chat they could not open, and could still be picked for a private line.
 *
 * Proven here against the real replayed schema:
 *   · a deactivated crew member and a crew member taken off the team: seat closed (left_at), out of the group's
 *     member list, not pinged, not addressable by a private line — and read nothing;
 *   · a guest removed from the list (soft delete) — already closed before this file, by 20271261618741 ending the
 *     account link and the 20271352461498 trigger; pinned here as a guard;
 *   · reactivating a crew member does not silently reopen a seat; a host re-adds them;
 *   · the people who stay (the host, the shop's owner, a crew member still on the team) are untouched;
 *   · a crew member deactivated in ONE shop but still the owner of another in the event keeps the seat (the one rule);
 *   · a co-host removed and then ADDED BACK regains the supplier chat: nothing re-closes the seat once they are a host
 *     again, they can rejoin by themselves, and reads come back.
 *
 * Fail-first: with 20271353093349 moved out of supabase/migrations the crew tests go red (left_at stays NULL and the
 * person is still pinged); with it they pass. The guest test passes either way — it guards the shipped path.
 *
 * Run (from apps/web): tsx --test tests/db/a-stale-guest-or-crew-seat-hears-nothing.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const FIX_FILE = '20271353093349_a_stale_guest_or_crew_seat_hears_nothing.sql';

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
const uniq = () => `sg-${++seq}`;

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
async function newGuest(eventId: string, first: string): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role)
     VALUES ($1, $2, 'Test', 'both', 'friends', 'guest'::public.guest_role) RETURNING guest_id`,
    [eventId, first],
  );
  return g.rows[0]!.guest_id;
}
async function membership(eventId: string, uid: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT member_type::text AS t FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, uid],
  );
  return r.rows[0]?.t ?? null;
}
async function supplierChat(eventId: string, shop: string, by: string): Promise<string> {
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [eventId, shop, by],
  );
  return t.rows[0]!.thread_id;
}

type World = {
  eventId: string;
  host: string;
  guest: string; // a linked guest-list account
  guestRow: string;
  owner: string; // the shop's owner
  shop: string;
  crew: string; // a crew member of the shop
  crewRow: string; // their vendor_team_members row
  group: string; // a host-made group: host · guest · owner · crew
};

async function newWorld(): Promise<World> {
  const host = await newUser('Ana');
  const owner = await newUser('Sol');
  const crew = await newUser('Kit');
  const guest = await newUser('Gina');
  const shop = await newShop(owner);
  const tm = await db.query<{ m: string }>(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent')
     RETURNING vendor_team_member_id AS m`,
    [shop, crew],
  );
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2027-06-06', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, host],
  );
  const guestRow = await newGuest(eventId, 'Gina');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, guest, guestRow],
  );
  await supplierChat(eventId, shop, host);
  const group = await as(host, async () =>
    (await db.query<{ t: string }>(`SELECT public.chat_group_create($1, 'Day-of crew', $2::uuid[]) AS t`,
      [eventId, [guest, owner, crew]])).rows[0]!.t);
  const w: World = { eventId, host, guest, guestRow, owner, shop, crew, crewRow: tm.rows[0]!.m, group };
  for (const who of [guest, owner, crew]) {
    assert.ok(await seatIsLive(w.group, who), 'setup: everyone put in the group holds a live seat');
  }
  return w;
}

async function seatIsLive(threadId: string, uid: string): Promise<boolean> {
  const r = await db.query<{ left_at: string | null }>(
    `SELECT left_at FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2`, [threadId, uid]);
  return r.rows.length > 0 && r.rows[0]!.left_at === null;
}
async function members(threadId: string): Promise<string[]> {
  return (await db.query<{ x: string }>(`SELECT x FROM public.chat_group_member_ids($1) AS x`, [threadId])).rows.map((r) => r.x);
}
/** Who the live ping of a shared group line from `sender` reaches. */
async function pinged(w: World, sender: string): Promise<string[]> {
  return (await db.query<{ x: string }>(`SELECT x FROM public.chat_message_reader_ids($1,$2,NULL,$3,NULL) AS x`,
    [w.group, w.eventId, sender])).rows.map((r) => r.x);
}
async function myThreads(uid: string): Promise<string[]> {
  return as(uid, async () =>
    (await db.query<{ t: string }>(`SELECT public.current_thread_ids() AS t`)).rows.map((r) => r.t));
}
async function privateTo(w: World, to: string): Promise<string | null> {
  return attempt(w.host, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, body, recipient_user_ids) VALUES ($1,$2,'psst',$3)`,
      [w.group, w.eventId, [to]]));
}

/** Everything a person out of the group must be: closed, not a member, not pinged, not addressable, reads nothing. */
async function assertOut(w: World, who: string, label: string): Promise<void> {
  assert.ok(!(await pinged(w, w.host)).includes(who), `${label}: not pinged about a new line`);
  assert.ok(!(await members(w.group)).includes(who), `${label}: not in the group's member list`);
  assert.equal(await seatIsLive(w.group, who), false, `${label}: their group seat is closed (left_at)`);
  assert.match((await privateTo(w, who)) ?? '', /PRIVATE_NOT_A_MEMBER/, `${label}: a private line can't be addressed to them`);
  assert.ok(!(await myThreads(who)).includes(w.group), `${label}: reads nothing`);
  const note = await db.query<{ left_note: string | null }>(
    `SELECT left_note FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2`, [w.group, who]);
  assert.equal(note.rows[0]!.left_note, null, `${label}: left_note is the person's own words — never written for them`);
}
async function assertIn(w: World, who: string, label: string): Promise<void> {
  assert.ok(await seatIsLive(w.group, who), `${label}: keeps a live seat`);
  assert.ok((await members(w.group)).includes(who), `${label}: still a member`);
  assert.ok((await pinged(w, w.host)).includes(who), `${label}: still pinged`);
  assert.ok((await myThreads(who)).includes(w.group), `${label}: still reads the group`);
}

test('the fix migration applied on top of the full corpus (not skipped)', async () => {
  assert.ok(!replay.skipped.some((s) => s.file === FIX_FILE), `${FIX_FILE} was skipped during replay`);
  const fn = await db.query<{ r: string | null }>(`SELECT to_regproc('public.chat_close_unheld_seats')::text AS r`);
  assert.ok(fn.rows[0]!.r, `${FIX_FILE} did not land: chat_close_unheld_seats is missing`);
});

test('a guest removed from the list (soft delete) loses the group seat and is pinged no more', async () => {
  const w = await newWorld();
  const lines = async () => (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.chat_messages WHERE thread_id = $1`, [w.group])).rows[0]!.n;
  const before = await lines();
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [w.guestRow]);
  // Already closed before this file, measured: the soft delete ends the account link (20271261618741), and that
  // DELETE fires the 20271352461498 event_members trigger. This pins it — a guard, not a fix.
  assert.equal(await membership(w.eventId, w.guest), null, 'the soft delete ends the event_members link (20271261618741)');
  await assertOut(w, w.guest, 'the removed guest');
  assert.equal(await lines(), before, 'no line is posted for it');
  for (const [who, uid] of [['the owner', w.owner], ['the crew member', w.crew]] as const) await assertIn(w, uid, who);
});

test('a crew member DEACTIVATED loses the group seat; the shop\'s owner keeps theirs', async () => {
  const w = await newWorld();
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_team_member_id = $1`, [w.crewRow]);
  await assertOut(w, w.crew, 'the deactivated crew member');
  for (const [who, uid] of [['the owner', w.owner], ['the guest', w.guest]] as const) await assertIn(w, uid, who);
});

test('a crew member TAKEN OFF the team (row deleted) loses the group seat too', async () => {
  const w = await newWorld();
  await db.query(`DELETE FROM public.vendor_team_members WHERE vendor_team_member_id = $1`, [w.crewRow]);
  await assertOut(w, w.crew, 'the crew member taken off the team');
  await assertIn(w, w.owner, 'the owner');
});

test('a crew member deactivated in ONE shop but still someone here another way keeps the seat (one rule decides)', async () => {
  const w = await newWorld();
  // The crew member also owns a second shop with a supplier chat on this event — still a supplier here.
  const second = await newShop(w.crew);
  await supplierChat(w.eventId, second, w.host);
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_team_member_id = $1`, [w.crewRow]);
  await assertIn(w, w.crew, 'a person still on the event as another shop\'s owner');
});

test('a crew member REACTIVATED is not silently put back: a host re-adds them, and the seat revives', async () => {
  const w = await newWorld();
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_team_member_id = $1`, [w.crewRow]);
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NULL WHERE vendor_team_member_id = $1`, [w.crewRow]);
  assert.equal(await seatIsLive(w.group, w.crew), false, 'reactivating does not reopen a closed seat by itself');
  assert.ok(!(await pinged(w, w.host)).includes(w.crew));
  const r = await as(w.host, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_group_add($1, $2::uuid[]) AS r`, [w.group, [w.crew]])).rows[0]!.r);
  assert.equal(r, 'added');
  await assertIn(w, w.crew, 'the crew member put back by a host');
});

test('a co-host removed and then ADDED BACK regains the supplier chat — nothing leaves them stuck', async () => {
  const host = await newUser('Ana');
  const supplier = await newUser('Sol');
  const shop = await newShop(supplier);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2027-06-06', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, host],
  );
  // A co-host the real way: a guest who linked, said YES, and was picked as Co-host.
  const rita = await newUser('Rita');
  const guestRow = await newGuest(eventId, 'Rita');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, rita, guestRow],
  );
  await db.query(`UPDATE public.guests SET rsvp_status = 'attending' WHERE guest_id = $1`, [guestRow]);
  const s = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, guest_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, 'co_host', '{}'::jsonb, $3, NULL, NULL) RETURNING moderator_id`,
    [eventId, guestRow, host],
  );
  const seat = s.rows[0]!.moderator_id;
  assert.equal(await membership(eventId, rita), 'couple', 'setup: a live co-host');
  const threadId = await supplierChat(eventId, shop, host);
  const addHost = (by: string) => as(by, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1, $2) AS r`, [threadId, rita])).rows[0]!.r);
  assert.equal(await addHost(host), 'added');
  const say = (body: string) => as(supplier, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,$4)`,
      [threadId, eventId, shop, body]));
  const readable = () => as(rita, async () =>
    (await db.query<{ body: string }>(
      `SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system' ORDER BY created_at, message_id`,
      [threadId])).rows.map((r) => r.body));
  const leftAt = async () => (await db.query<{ left_at: string | null }>(
    `SELECT left_at FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2`, [threadId, rita])).rows[0]!.left_at;

  await say('Before');
  assert.deepEqual(await readable(), ['Before']);

  // Removed: back to guest, seat closed, reads nothing.
  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [seat]);
  assert.equal(await membership(eventId, rita), 'guest');
  assert.ok(await leftAt(), 'removal closes the seat');
  await say('While away');
  assert.deepEqual(await readable(), []);

  // Picked again: the seat row revives (UNIQUE event_id, user_id), and they are a host again.
  await db.query(`UPDATE public.event_moderators SET removed_at = NULL WHERE moderator_id = $1`, [seat]);
  assert.equal(await membership(eventId, rita), 'couple', 'the revived pick makes them a host again');

  // Nothing re-closes or strands a seat they can rejoin: the 20271352461498 trigger and this file's backfill close
  // ONLY seats chat_seat_is_held() no longer holds — and a host's is held.
  await db.query(
    `UPDATE public.chat_thread_members SET left_at = clock_timestamp()
      WHERE left_at IS NULL AND NOT public.chat_seat_is_held(thread_id, user_id)`);
  assert.equal(await as(rita, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1, $2) AS r`, [threadId, rita])).rows[0]!.r),
  'rejoined', 'a co-host made host again rejoins the chat by themselves, as any host who left');
  assert.equal(await leftAt(), null, 'their seat is live again');

  // The backfill again — the whole of this file's step 4 — does not close a held seat.
  await db.query(
    `UPDATE public.chat_thread_members SET left_at = clock_timestamp()
      WHERE left_at IS NULL AND NOT public.chat_seat_is_held(thread_id, user_id)`);
  assert.equal(await leftAt(), null, 'a re-run of the backfill leaves a held seat alone');

  await say('Welcome back');
  assert.deepEqual(await readable(), ['Before', 'While away', 'Welcome back'], 'reads come back — the whole chat');
  assert.ok((await myThreads(rita)).includes(threadId));
});

test('a co-host added back can also be re-seated by the host who created the event', async () => {
  const host = await newUser('Ana');
  const supplier = await newUser('Sol');
  const shop = await newShop(supplier);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2027-06-06', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, host],
  );
  const pal = await newUser('Pia');
  const s = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, 'co_host', '{}'::jsonb, $2, $3, now()) RETURNING moderator_id`,
    [eventId, host, pal],
  );
  assert.equal(await membership(eventId, pal), 'couple');
  const threadId = await supplierChat(eventId, shop, host);
  const add = () => as(host, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1, $2) AS r`, [threadId, pal])).rows[0]!.r);
  assert.equal(await add(), 'added');

  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [s.rows[0]!.moderator_id]);
  assert.equal(await membership(eventId, pal), null, 'no guest row → the membership is deleted');
  assert.ok(!(await myThreads(pal)).includes(threadId));

  await db.query(`UPDATE public.event_moderators SET removed_at = NULL WHERE moderator_id = $1`, [s.rows[0]!.moderator_id]);
  assert.equal(await membership(eventId, pal), 'couple', 'picked again → a host again');
  assert.equal(await add(), 'added', 'the host re-seats them');
  assert.ok((await myThreads(pal)).includes(threadId), 'and they read the chat again');
});

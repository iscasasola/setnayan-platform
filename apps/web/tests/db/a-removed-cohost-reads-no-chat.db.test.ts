/**
 * A REMOVED CO-HOST READS NO CHAT — migration 20271352461498.
 *
 * Owner, 19 Nov: "yes fix the co-host leak today". Before this file a co-host removed from the event kept a live
 * chat_thread_members row, and current_thread_ids() admitted any live row without asking whether the person was still
 * on the event — so they kept reading the supplier conversation, quotes and payments included.
 *
 * Proven here against the real replayed schema, through the real removal path (event_moderators.removed_at →
 * sync_delegate_membership → 'couple' becomes 'guest', or the row is deleted):
 *   · the removed co-host reads zero threads and zero messages, cannot post, and cannot be picked for a private line;
 *   · the creator, a current co-host, the coordinator and the supplier still read everything;
 *   · the read check holds on its own (an orphaned seat with no membership change behind it reads nothing);
 *   · a supplier in a host-made group — a seat with NO event_members row — keeps it.
 *
 * Run (from apps/web): tsx --test tests/db/a-removed-cohost-reads-no-chat.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const FIX_FILE = '20271352461498_a_removed_cohost_reads_no_chat.sql';

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
const uniq = () => `rc-${++seq}`;

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

type World = {
  eventId: string;
  creator: string;
  removed: string; // a co-host from the guest list, removed during the test
  removedSeat: string; // their event_moderators row
  current: string; // a co-host who stays
  coordinator: string;
  supplier: string;
  shop: string;
  threadId: string;
};

/** A co-host the real way: a guest who linked, said YES, and was picked as Co-host. */
async function cohostFromTheGuestList(eventId: string, by: string, first: string): Promise<{ uid: string; seat: string }> {
  const uid = await newUser(first);
  const guest = await newGuest(eventId, first);
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, uid, guest],
  );
  await db.query(`UPDATE public.guests SET rsvp_status = 'attending' WHERE guest_id = $1`, [guest]);
  const s = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, guest_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, 'co_host', '{}'::jsonb, $3, NULL, NULL) RETURNING moderator_id`,
    [eventId, guest, by],
  );
  assert.equal(await membership(eventId, uid), 'couple', 'setup: the picked guest is a live co-host');
  return { uid, seat: s.rows[0]!.moderator_id };
}

async function newWorld(): Promise<World> {
  const creator = await newUser('Ana');
  const coordinator = await newUser('Cora');
  const supplier = await newUser('Sol');
  const shop = await newShop(supplier);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ('A celebration', 'birthday', DATE '2027-06-06', 'day') RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event'), ($1, $3, 'coordinator', 'invited')`,
    [eventId, creator, coordinator],
  );
  const removed = await cohostFromTheGuestList(eventId, creator, 'Rita');
  const current = await cohostFromTheGuestList(eventId, creator, 'Carla');
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1, $2, $3, 'accepted') RETURNING thread_id`,
    [eventId, shop, creator],
  );
  const threadId = t.rows[0]!.thread_id;
  const w: World = {
    eventId, creator, removed: removed.uid, removedSeat: removed.seat, current: current.uid,
    coordinator, supplier, shop, threadId,
  };
  for (const who of [w.removed, w.current]) {
    const r = await as(creator, async () =>
      (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1, $2) AS r`, [threadId, who])).rows[0]!.r);
    assert.equal(r, 'added', 'setup: the creator seats the co-host in the supplier chat');
  }
  return w;
}

async function send(w: World, uid: string, body: string, recipient?: string): Promise<void> {
  await as(uid, async () => {
    if (recipient) {
      await db.query(
        `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_id)
         VALUES ($1,$2,$3,$4,$5)`,
        [w.threadId, w.eventId, w.shop, body, recipient],
      );
    } else {
      await db.query(
        `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,$4)`,
        [w.threadId, w.eventId, w.shop, body],
      );
    }
  });
}
async function readable(threadId: string, uid: string): Promise<string[]> {
  return as(uid, async () =>
    (await db.query<{ body: string }>(
      `SELECT body FROM public.chat_messages WHERE thread_id = $1 AND sender_role <> 'system' ORDER BY created_at, message_id`,
      [threadId],
    )).rows.map((r) => r.body),
  );
}
async function myThreads(uid: string): Promise<string[]> {
  return as(uid, async () =>
    (await db.query<{ t: string }>(`SELECT public.current_thread_ids() AS t`)).rows.map((r) => r.t),
  );
}
async function visibleThreadRows(threadId: string, uid: string): Promise<number> {
  return as(uid, async () =>
    (await db.query(`SELECT 1 FROM public.chat_threads WHERE thread_id = $1`, [threadId])).rows.length,
  );
}

test('the fix migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === FIX_FILE), `${FIX_FILE} was skipped during replay`);
});

test('a co-host removed through the real door (back to guest) reads zero threads and zero messages', async () => {
  const w = await newWorld();
  await send(w, w.creator, 'Can you do the 6th?');
  await send(w, w.supplier, 'Yes — we are free that day.');
  assert.deepEqual(await readable(w.threadId, w.removed), ['Can you do the 6th?', 'Yes — we are free that day.'],
    'setup: while a co-host, they read the chat');

  const lines = async () => (await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.chat_messages WHERE thread_id = $1`, [w.threadId])).rows[0]!.n;
  const linesBefore = await lines();
  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [w.removedSeat]);
  assert.equal(await membership(w.eventId, w.removed), 'guest', 'removal returns them to guest');
  assert.equal(await lines(), linesBefore, 'the removal posts no line in the chat');

  await send(w, w.supplier, 'Deposit is due Friday.');

  assert.deepEqual(await myThreads(w.removed), [], 'current_thread_ids() names no thread for them');
  assert.deepEqual(await readable(w.threadId, w.removed), [], 'they read no message — not the old ones, not the new');
  assert.equal(await visibleThreadRows(w.threadId, w.removed), 0, 'they do not even see the thread row');

  const err = await attempt(w.removed, () =>
    db.query(`INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body) VALUES ($1,$2,$3,'still here?')`,
      [w.threadId, w.eventId, w.shop]));
  assert.match(err ?? '', /row-level security|permission denied|not a party/i, 'and cannot post');

  const priv = await attempt(w.supplier, () =>
    db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, body, recipient_user_id)
       VALUES ($1,$2,$3,'just for you',$4)`,
      [w.threadId, w.eventId, w.shop, w.removed]));
  assert.match(priv ?? '', /PRIVATE_NOT_A_MEMBER/, 'a private line can no longer be addressed to them');

  const seat = await db.query<{ left_at: string | null; left_note: string | null }>(
    `SELECT left_at, left_note FROM public.chat_thread_members WHERE thread_id = $1 AND user_id = $2`,
    [w.threadId, w.removed]);
  assert.ok(seat.rows[0]!.left_at, 'their seat is closed');
  assert.equal(seat.rows[0]!.left_note, null, 'left_note is the person\'s own words — never written for them');


  const all = ['Can you do the 6th?', 'Yes — we are free that day.', 'Deposit is due Friday.'];
  for (const [who, uid] of [['the creator', w.creator], ['a current co-host', w.current],
    ['the coordinator', w.coordinator], ['the supplier', w.supplier]] as const) {
    assert.deepEqual(await readable(w.threadId, uid), all, `${who} still reads the whole chat`);
  }
  assert.ok((await myThreads(w.current)).includes(w.threadId));
  assert.ok((await myThreads(w.coordinator)).includes(w.threadId));
});

test('a co-host whose membership is DELETED (no guest row behind it) reads nothing either', async () => {
  const w = await newWorld();
  const pal = await newUser('Pia');
  const s = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, 'co_host', '{}'::jsonb, $2, $3, now()) RETURNING moderator_id`,
    [w.eventId, w.creator, pal],
  );
  assert.equal(await membership(w.eventId, pal), 'couple');
  assert.equal(await as(w.creator, async () =>
    (await db.query<{ r: string }>(`SELECT public.chat_thread_add_host($1, $2) AS r`, [w.threadId, pal])).rows[0]!.r), 'added');
  await send(w, w.supplier, 'Hello Pia');
  assert.deepEqual(await readable(w.threadId, pal), ['Hello Pia']);

  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [s.rows[0]!.moderator_id]);
  assert.equal(await membership(w.eventId, pal), null, 'no guest row → the membership is deleted');
  assert.deepEqual(await myThreads(pal), []);
  assert.deepEqual(await readable(w.threadId, pal), []);
  assert.deepEqual(await readable(w.threadId, w.creator), ['Hello Pia'], 'the creator is untouched');
});

test('the read check holds on its own: an orphaned seat with no membership change behind it reads nothing', async () => {
  const w = await newWorld();
  await send(w, w.supplier, 'A private quote');
  // A seat left behind by a removal that happened before the fix (the trigger never saw it).
  const ghost = await newUser('Gus');
  await db.query(`INSERT INTO public.chat_thread_members (thread_id, user_id) VALUES ($1, $2)`, [w.threadId, ghost]);
  assert.deepEqual(await myThreads(ghost), []);
  assert.deepEqual(await readable(w.threadId, ghost), []);
});

test('a supplier in a host-made group — a seat with NO event_members row — keeps it', async () => {
  const w = await newWorld();
  const g = await as(w.creator, async () =>
    (await db.query<{ t: string }>(`SELECT public.chat_group_create($1, 'Day-of crew', $2::uuid[]) AS t`,
      [w.eventId, [w.supplier, w.removed]])).rows[0]!.t);
  assert.equal(await membership(w.eventId, w.supplier), null, 'the supplier is not an event member');
  assert.ok((await myThreads(w.supplier)).includes(g), 'the supplier is in the group they were put in');
  assert.ok((await myThreads(w.removed)).includes(g), 'setup: the co-host is in it too');

  // Removed as co-host but still a guest of the event: still someone here, so a group they were put in keeps them.
  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [w.removedSeat]);
  assert.ok((await myThreads(w.supplier)).includes(g), 'the supplier keeps the group seat');
  assert.ok((await myThreads(w.removed)).includes(g), 'a person still on the guest list keeps a group seat');
  assert.ok(!(await myThreads(w.removed)).includes(w.threadId), '…but not the supplier chat');

  // Gone from the event entirely: out of the group too.
  await db.query(`DELETE FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [w.eventId, w.removed]);
  assert.ok(!(await myThreads(w.removed)).includes(g), 'off the event → out of the group');
  assert.ok((await myThreads(w.supplier)).includes(g), 'the supplier is untouched');
});

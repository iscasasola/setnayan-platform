/**
 * INCOMING REQUESTS — an invitation reaches the account (owner 2026-09-28;
 * approved prototype incoming-requests-delta.html; migrations 20271252186265 +
 * 20271252896804).
 *
 *   "You are invited to {user name}'s {event name} {event type} event."
 *   YES → joined + attending ("accepting means they are also going
 *   automatically") · NO → declined · "Don't show me invites from this person".
 *
 * The request is COMPUTED (incoming_requests_for_me), never stored — so an
 * account made later with the same email sees it at once, and an answered one
 * is gone. These tests drive it the way the page and its actions do.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

async function newUser(email: string, opts: { confirmed?: boolean; name?: string } = {}): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), $2) RETURNING id`,
    [email, opts.confirmed === false ? null : new Date().toISOString()],
  );
  const id = u.rows[0]!.id;
  if (opts.name) await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [id, opts.name]);
  return id;
}

async function newEvent(label: string, creatorName = 'Ice Casasola'): Promise<{ eventId: string; creator: string }> {
  const creator = await newUser(`creator-${label}@inreq.test`, { name: creatorName });
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
    [`Party ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, creator],
  );
  return { eventId, creator };
}

async function invite(eventId: string, email: string, first = 'Ana'): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, email)
     VALUES ($1, $2, 'Reyes', 'both', 'friends', $3) RETURNING guest_id`,
    [eventId, first, email],
  );
  return g.rows[0]!.guest_id;
}

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

async function myRequests(uid: string) {
  return asUser(uid, async () =>
    (await db.query<{ guest_id: string; owner_name: string | null; event_name: string; event_type: string }>(
      `SELECT guest_id, owner_name, event_name, event_type FROM public.incoming_requests_for_me()`,
    )).rows,
  );
}

test('an invitation to my confirmed email shows as an incoming request, in the owner’s words', async () => {
  const { eventId } = await newEvent('shows');
  const ana = await newUser('ana-shows@inreq.test');
  const guest = await invite(eventId, 'ANA-SHOWS@inreq.test ');
  const rows = await myRequests(ana);
  assert.equal(rows.length, 1, 'matched case- and space-insensitively');
  assert.equal(rows[0]!.guest_id, guest);
  assert.equal(rows[0]!.owner_name, 'Ice Casasola', '{user name} is the event’s creator');

  const bell = await db.query<{ title: string }>(
    `SELECT title FROM public.notifications WHERE user_id = $1 AND type = 'event_invitation'`, [ana],
  );
  assert.equal(bell.rows.length, 1, 'and one bell notice');
  assert.match(bell.rows[0]!.title, /^You are invited to Ice Casasola's Party shows birthday event\.$/);
});

test('an unconfirmed email proves nothing — no request', async () => {
  const { eventId } = await newEvent('unconfirmed');
  const u = await newUser('unconfirmed@inreq.test', { confirmed: false });
  await invite(eventId, 'unconfirmed@inreq.test');
  assert.equal((await myRequests(u)).length, 0);
});

test('an account made LATER with that email sees the request at once', async () => {
  const { eventId } = await newEvent('later');
  await invite(eventId, 'later@inreq.test');
  const late = await newUser('later@inreq.test');
  assert.equal((await myRequests(late)).length, 1, '"when they get an account, the event syncs"');
});

test('"Don’t show me invites from this person" hides them; a chat block does too', async () => {
  const { eventId, creator } = await newEvent('mute');
  const u = await newUser('muter@inreq.test');
  await invite(eventId, 'muter@inreq.test');
  await asUser(u, () => db.query(`INSERT INTO public.invite_mutes (user_id, muted_user_id) VALUES ($1, $2)`, [u, creator]));
  assert.equal((await myRequests(u)).length, 0, 'muted');
  await db.query(`DELETE FROM public.invite_mutes WHERE user_id = $1`, [u]);
  assert.equal((await myRequests(u)).length, 1, 'unmuted');
  await db.query(`INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id) VALUES ($1, $2)`, [u, creator]);
  assert.equal((await myRequests(u)).length, 0, 'somebody you blocked cannot invite you either');
});

test('a mute is private — the muted person cannot read it', async () => {
  const { creator } = await newEvent('private-mute');
  const u = await newUser('private-muter@inreq.test');
  await asUser(u, () => db.query(`INSERT INTO public.invite_mutes (user_id, muted_user_id) VALUES ($1, $2)`, [u, creator]));
  const seen = await asUser(creator, async () =>
    (await db.query(`SELECT 1 FROM public.invite_mutes WHERE muted_user_id = $1`, [creator])).rows.length,
  );
  assert.equal(seen, 0, 'the inviter is never told');
});

test('YES → joined and attending; follows the co-hosts; a waiting co-host pick goes live; request gone', async () => {
  const { eventId, creator } = await newEvent('yes');
  const u = await newUser('yes@inreq.test');
  const guest = await invite(eventId, 'yes@inreq.test');
  await db.query(
    `INSERT INTO public.event_moderators (event_id, guest_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, 'co_host', '{}'::jsonb, $3, NULL, NULL)`,
    [eventId, guest, creator],
  );
  await asUser(u, () => db.query(`SELECT * FROM public.answer_incoming_request($1, true)`, [guest]));
  const g = await db.query<{ rsvp_status: string }>(`SELECT rsvp_status::text FROM public.guests WHERE guest_id = $1`, [guest]);
  assert.equal(g.rows[0]!.rsvp_status, 'attending', '"accepting means they are also going"');
  const m = await db.query<{ t: string; gid: string }>(
    `SELECT member_type::text AS t, guest_id AS gid FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, u],
  );
  assert.equal(m.rows[0]!.gid, guest, 'linked to their own guest row');
  assert.equal(m.rows[0]!.t, 'couple', 'the co-host pick made before they joined is live now');
  const f = await db.query(`SELECT 1 FROM public.user_follows WHERE follower_user_id = $1 AND followed_user_id = $2`, [u, creator]);
  assert.equal(f.rows.length, 1, 'accepted guests follow the co-hosts');
  assert.equal((await myRequests(u)).length, 0, 'answered → gone');
});

test('NO → declined, not linked, gone — the only No in the flow', async () => {
  const { eventId } = await newEvent('no');
  const u = await newUser('no@inreq.test');
  const guest = await invite(eventId, 'no@inreq.test');
  await asUser(u, () => db.query(`SELECT * FROM public.answer_incoming_request($1, false)`, [guest]));
  const g = await db.query<{ s: string }>(`SELECT rsvp_status::text AS s FROM public.guests WHERE guest_id = $1`, [guest]);
  assert.equal(g.rows[0]!.s, 'declined');
  const m = await db.query(`SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [eventId, u]);
  assert.equal(m.rows.length, 0, 'a No does not join');
  assert.equal((await myRequests(u)).length, 0);
});

test('nobody can answer a request that is not theirs', async () => {
  const { eventId } = await newEvent('not-yours');
  await newUser('owner-of-request@inreq.test');
  const guest = await invite(eventId, 'owner-of-request@inreq.test');
  const stranger = await newUser('stranger@inreq.test');
  await assert.rejects(
    () => asUser(stranger, () => db.query(`SELECT * FROM public.answer_incoming_request($1, true)`, [guest])),
    /not_your_request/,
  );
});

test('one bell notice per person per event, and a guest import never fails because of it', async () => {
  const { eventId, creator } = await newEvent('bell');
  const u = await newUser('bell@inreq.test');
  await invite(eventId, 'bell@inreq.test', 'First');
  await invite(eventId, 'bell@inreq.test', 'Second');
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.notifications WHERE user_id = $1 AND type = 'event_invitation'`, [u],
  );
  assert.equal(n.rows[0]!.c, '1', 'never a second notice for the same event');
  // The creator's own email on their own list tells nobody anything.
  const own = await db.query<{ email: string }>(`SELECT email FROM auth.users WHERE id = $1`, [creator]);
  await invite(eventId, own.rows[0]!.email, 'Self');
  const self = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.notifications WHERE user_id = $1 AND type = 'event_invitation'`, [creator],
  );
  assert.equal(self.rows[0]!.c, '0');
});

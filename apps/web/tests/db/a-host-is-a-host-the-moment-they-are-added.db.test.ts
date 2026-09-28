/**
 * A HOST IS A HOST THE MOMENT THEY ARE ADDED — whatever their role.
 * Owner, 2026-09-28: "creating someone a host needs no approval from their
 * side. they will be auto accepted" · "regardless of their role" · "she can
 * also be a bride but not a host" · "she is not a coordinator".
 *
 * ── THE LIVE DEFECT ─────────────────────────────────────────────────────────
 * His bride's host invite existed only as a link nobody sent; it expired
 * unseen. She then signed up through her guest invitation and was linked as a
 * GUEST. Made a host by hand, she stayed a guest to every table, because the
 * membership trigger inserted with ON CONFLICT DO NOTHING and a guest row is a
 * conflict. A bride or groom is almost always on their own guest list, so this
 * is the ordinary shape, not a corner.
 *
 * ── WHY THESE DRIVE THE TABLES, NOT THE ACTION ─────────────────────────────
 * Every behaviour lives in triggers (migration 20271251336140) so every door —
 * the Hosts form, the access-request approval, a SQL seed, a sign-up from any
 * page — gets it. So each test writes rows the way a door would and reads the
 * membership back, under RLS where that is the claim.
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

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newEvent(label: string): Promise<{ eventId: string; creator: string }> {
  const creator = await newUser(`creator-${label}@host.test`);
  // 'birthday', not 'wedding': a wedding row must carry its wedding fields
  // (events_wedding_fields_consistency). Host seats do not depend on the type.
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR')
     RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via)
     VALUES ($1, $2, 'couple', 'created_event')`,
    [eventId, creator],
  );
  return { eventId, creator };
}

/** A host seat added by email — exactly what the Hosts form inserts. */
async function addHost(eventId: string, email: string, role = 'bride'): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, permissions_json, invitation_email,
        invitation_token, accepted_at)
     VALUES ($1, NULL, $2, '{}'::jsonb, $3, md5(random()::text) || md5(random()::text), NULL)
     RETURNING moderator_id`,
    [eventId, role, email],
  );
  return r.rows[0]!.moderator_id;
}

async function seat(moderatorId: string) {
  const r = await db.query<{ user_id: string | null; accepted_at: string | null; invitation_token: string | null }>(
    `SELECT user_id, accepted_at, invitation_token FROM public.event_moderators WHERE moderator_id = $1`,
    [moderatorId],
  );
  return r.rows[0]!;
}

async function membership(eventId: string, uid: string) {
  const r = await db.query<{ member_type: string; guest_id: string | null }>(
    `SELECT member_type::text AS member_type, guest_id FROM public.event_members
     WHERE event_id = $1 AND user_id = $2`,
    [eventId, uid],
  );
  return r.rows[0] ?? null;
}

test('added with an account → a host at once, as couple, nothing to accept', async () => {
  const { eventId } = await newEvent('has-account');
  const bride = await newUser('bride-has-account@host.test');
  const modId = await addHost(eventId, 'Bride-Has-Account@Host.test ');
  const s = await seat(modId);
  assert.equal(s.user_id, bride, 'the seat is claimed by the account holding that email (case/space-insensitive)');
  assert.ok(s.accepted_at, 'accepted at insert — the owner: "needs no approval from their side"');
  assert.equal(s.invitation_token, null, 'no link left to share or leak');
  assert.equal(
    (await membership(eventId, bride))?.member_type,
    'couple',
    'a host is a host — the bride is "not a coordinator"',
  );
});

test('any host role is couple — the role is a label, being a host is the access', async () => {
  const { eventId } = await newEvent('any-role');
  const parent = await newUser('parent-any-role@host.test');
  await addHost(eventId, 'parent-any-role@host.test', 'parent_of_bride');
  assert.equal((await membership(eventId, parent))?.member_type, 'couple');
});

test('added before they had an account → a host the moment they sign up', async () => {
  const { eventId } = await newEvent('no-account');
  const modId = await addHost(eventId, 'later-bride@host.test');
  assert.equal((await seat(modId)).user_id, null, 'no account yet → the seat waits');
  const bride = await newUser('LATER-bride@host.test');
  const s = await seat(modId);
  assert.equal(s.user_id, bride, 'signing up claims the waiting seat — no link, no accept');
  assert.ok(s.accepted_at);
  assert.equal((await membership(eventId, bride))?.member_type, 'couple');
});

test('THE LIVE CASE: a guest made a host is upgraded, keeps her guest row, and sees the plan', async () => {
  const { eventId } = await newEvent('guest-bride');
  await db.query(
    `INSERT INTO public.event_checklist_items (event_id, title, sort_order)
     VALUES ($1, 'Book the church', 1)`,
    [eventId],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Claire', 'Bride', 'both', 'family') RETURNING guest_id`,
    [eventId],
  );
  const guestId = g.rows[0]!.guest_id;
  const bride = await newUser('guest-bride@host.test');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, bride, guestId],
  );

  const modId = await addHost(eventId, 'guest-bride@host.test');
  const m = await membership(eventId, bride);
  assert.equal(
    m?.member_type,
    'couple',
    'ON CONFLICT DO NOTHING left her a guest to every table — a host on paper only',
  );
  assert.equal(m?.guest_id, guestId, 'still on her own guest list — her seat and RSVP stay hers');

  await db.exec(`SET ROLE authenticated`);
  await setAuthUid(db, bride);
  const r = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.event_checklist_items WHERE event_id = $1`,
    [eventId],
  );
  await db.exec('RESET ROLE');
  assert.equal(r.rows[0]!.c, '1', 'a guest reads an EMPTY checklist; a host reads the plan');

  await db.query(`UPDATE public.event_moderators SET removed_at = NOW() WHERE moderator_id = $1`, [modId]);
  assert.equal(
    (await membership(eventId, bride))?.member_type,
    'guest',
    'removing a host must not also remove them from their own guest list',
  );
});

test('removal of a host with no guest row ends their membership', async () => {
  const { eventId } = await newEvent('remove-plain');
  const helper = await newUser('helper-remove@host.test');
  const modId = await addHost(eventId, 'helper-remove@host.test', 'family_helper');
  assert.equal((await membership(eventId, helper))?.member_type, 'couple');
  await db.query(`UPDATE public.event_moderators SET removed_at = NOW() WHERE moderator_id = $1`, [modId]);
  assert.equal(await membership(eventId, helper), null);
});

test('the creator is never touched — removing their own host seat keeps them the couple', async () => {
  const { eventId, creator } = await newEvent('creator-safe');
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'groom', '{}'::jsonb, NOW()) RETURNING moderator_id`,
    [eventId, creator],
  );
  await db.query(`UPDATE public.event_moderators SET removed_at = NOW() WHERE moderator_id = $1`, [
    r.rows[0]!.moderator_id,
  ]);
  assert.equal((await membership(eventId, creator))?.member_type, 'couple');
});

test('a hired planner keeps the consent-gated accept step', async () => {
  const { eventId } = await newEvent('planner');
  const planner = await newUser('planner-kept@host.test');
  const modId = await addHost(eventId, 'planner-kept@host.test', 'wedding_planner_external');
  const s = await seat(modId);
  assert.equal(s.user_id, null, 'the coordinator comes in through the RA 10173 consent door');
  assert.equal(s.accepted_at, null);
  assert.equal(await membership(eventId, planner), null);
});

test('someone who already holds a seat on the event does not break the insert', async () => {
  const { eventId } = await newEvent('already-seated');
  const bride = await newUser('seated-twice@host.test');
  const first = await addHost(eventId, 'seated-twice@host.test');
  assert.equal((await seat(first)).user_id, bride);
  // A second add for the same person must not throw on UNIQUE (event_id, user_id).
  const second = await addHost(eventId, 'seated-twice@host.test', 'co_host');
  assert.equal((await seat(second)).user_id, null, 'left pending rather than failing the insert');
});

test('two waiting seats for one email on one event → sign-up still succeeds', async () => {
  const { eventId } = await newEvent('double-pending');
  await addHost(eventId, 'double@host.test');
  await addHost(eventId, 'double@host.test', 'co_host');
  // Would violate UNIQUE (event_id, user_id) if both were claimed — and a
  // sign-up must never fail because of a host seat.
  const uid = await newUser('double@host.test');
  const n = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.event_moderators WHERE event_id = $1 AND user_id = $2`,
    [eventId, uid],
  );
  assert.equal(n.rows[0]!.c, '1', 'exactly one seat claimed');
  assert.equal((await membership(eventId, uid))?.member_type, 'couple');
});

test('a removed planner who is also a guest goes back to guest AND loses their colour grants', async () => {
  // event_colour_grants_coordinator CASCADEs off the membership only on DELETE.
  // The back-to-guest branch keeps the row, so it must drop the grants itself.
  const { eventId } = await newEvent('planner-guest');
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Pat', 'Planner', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  const planner = await newUser('planner-guest@host.test');
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, planner, g.rows[0]!.guest_id],
  );
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external', '{}'::jsonb, NOW()) RETURNING moderator_id`,
    [eventId, planner],
  );
  assert.equal((await membership(eventId, planner))?.member_type, 'coordinator');
  await db.query(
    `INSERT INTO public.event_colour_grants_coordinator (event_id, user_id, domain) VALUES ($1, $2, 'decor')`,
    [eventId, planner],
  );

  await db.query(`UPDATE public.event_moderators SET removed_at = NOW() WHERE moderator_id = $1`, [
    r.rows[0]!.moderator_id,
  ]);
  assert.equal((await membership(eventId, planner))?.member_type, 'guest');
  const left = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.event_colour_grants_coordinator WHERE event_id = $1 AND user_id = $2`,
    [eventId, planner],
  );
  assert.equal(left.rows[0]!.c, '0', 'a removed coordinator must not keep editing the colours');
});

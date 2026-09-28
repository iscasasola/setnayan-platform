/**
 * CO-HOSTS COME FROM THE GUEST LIST — the database half, driven the way every
 * door drives it (owner 2026-09-28, DECISION_LOG "CO-HOSTS COME FROM THE GUEST
 * LIST — FINAL MODEL" and the rows after it; migration 20271251336140).
 *
 *   · a co-host picks a guest's Access → a WAITING seat; it goes live the
 *     moment that guest has JOINED (Attending + account linked) — no accept;
 *   · co-host = 'couple' (equal to the creator); limited helper = view only,
 *     refused at the database on every coordinator-writable table;
 *   · a celebrant co-host cannot be removed or narrowed; only a celebrant
 *     changes a celebrant's role;
 *   · joined guests follow the co-hosts; co-hosts follow each other; a
 *     confirmed connection follows both ways.
 *
 * The live bug this closes: the bride joined as a GUEST, was made a host, and
 * stayed a guest to every table (ON CONFLICT DO NOTHING). And the trap the
 * first dry run fell into: event_moderators.accepted_at is DEFAULT now(), so a
 * waiting seat must be recognised by user_id NULL, never by accepted_at.
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
  const creator = await newUser(`creator-${label}@cohost.test`);
  // 'birthday': a 'wedding' row must carry its wedding fields
  // (events_wedding_fields_consistency). Seats do not depend on the type.
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
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

async function newGuest(eventId: string, first: string, role = 'guest'): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, role)
     VALUES ($1, $2, 'Test', 'both', 'friends', $3::public.guest_role) RETURNING guest_id`,
    [eventId, first, role],
  );
  return g.rows[0]!.guest_id;
}

/** The guest links their account (Save to my account / signed-in key). */
async function link(eventId: string, guestId: string, uid: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, uid, guestId],
  );
}
async function sayYes(guestId: string): Promise<void> {
  await db.query(`UPDATE public.guests SET rsvp_status = 'attending' WHERE guest_id = $1`, [guestId]);
}

/** Exactly what setGuestAccess inserts — accepted_at NULL on purpose. */
async function pick(eventId: string, guestId: string, kind: 'co_host' | 'viewer', by: string): Promise<string> {
  const r = await db.query<{ moderator_id: string }>(
    `INSERT INTO public.event_moderators
       (event_id, guest_id, role_subtype, permissions_json, invited_by_user_id, user_id, accepted_at)
     VALUES ($1, $2, $3, '{}'::jsonb, $4, NULL, NULL) RETURNING moderator_id`,
    [eventId, guestId, kind, by],
  );
  return r.rows[0]!.moderator_id;
}

async function membership(eventId: string, uid: string): Promise<string | null> {
  const r = await db.query<{ t: string }>(
    `SELECT member_type::text AS t FROM public.event_members WHERE event_id = $1 AND user_id = $2`,
    [eventId, uid],
  );
  return r.rows[0]?.t ?? null;
}
async function follows(a: string, b: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM public.user_follows WHERE follower_user_id = $1 AND followed_user_id = $2`,
    [a, b],
  );
  return r.rows.length > 0;
}

test('picked BEFORE joining → waiting; YES + account link → live co-host, told, following', async () => {
  const { eventId, creator } = await newEvent('before-join');
  const ana = await newUser('ana@cohost.test');
  const guest = await newGuest(eventId, 'Ana');
  const seat = await pick(eventId, guest, 'co_host', creator);

  const waiting = await db.query<{ user_id: string | null }>(
    `SELECT user_id FROM public.event_moderators WHERE moderator_id = $1`, [seat],
  );
  assert.equal(waiting.rows[0]!.user_id, null, 'not joined → waiting ("they must accept attending first")');

  await link(eventId, guest, ana);
  assert.equal(await membership(eventId, ana), 'guest', 'linked but no YES yet → still a guest');
  await sayYes(guest);

  assert.equal(await membership(eventId, ana), 'couple', 'joined → co-host, equal to the creator');
  const notice = await db.query<{ title: string; body: string }>(
    `SELECT title, body FROM public.notifications WHERE user_id = $1 AND type = 'cohost_added'`, [ana],
  );
  assert.equal(notice.rows.length, 1, 'exactly one "You are now a co-host…" notice');
  assert.match(notice.rows[0]!.title, /^You are now a co-host for .*event\.$/);
  assert.match(notice.rows[0]!.body, /You have access to the following:/);
  assert.ok(await follows(ana, creator), 'a co-host follows the other co-hosts');
  assert.ok(await follows(creator, ana), 'and is followed back — co-hosts follow each other');
});

test('THE LIVE CASE: a joined guest picked later is upgraded at once and keeps their guest row', async () => {
  const { eventId, creator } = await newEvent('live-case');
  const bride = await newUser('bride@cohost.test');
  const guest = await newGuest(eventId, 'Claire', 'bride');
  await link(eventId, guest, bride);
  await sayYes(guest);
  assert.equal(await membership(eventId, bride), 'guest');
  await pick(eventId, guest, 'co_host', creator);
  assert.equal(await membership(eventId, bride), 'couple', 'ON CONFLICT DO NOTHING left her a guest');
  const kept = await db.query(
    `SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2 AND guest_id = $3`,
    [eventId, bride, guest],
  );
  assert.equal(kept.rows.length, 1, 'still tied to her own guest row — seat and RSVP stay hers');
});

test('a seat inserted WITHOUT naming accepted_at still waits and still goes live (DEFAULT now() trap)', async () => {
  const { eventId, creator } = await newEvent('default-trap');
  const u = await newUser('trap@cohost.test');
  const guest = await newGuest(eventId, 'Trap');
  await db.query(
    `INSERT INTO public.event_moderators (event_id, guest_id, role_subtype, permissions_json, invited_by_user_id)
     VALUES ($1, $2, 'co_host', '{}'::jsonb, $3)`,
    [eventId, guest, creator],
  );
  await link(eventId, guest, u);
  await sayYes(guest);
  assert.equal(await membership(eventId, u), 'couple');
});

test('a limited helper can VIEW the plan but cannot WRITE it', async () => {
  const { eventId, creator } = await newEvent('helper');
  await db.query(
    `INSERT INTO public.event_checklist_items (event_id, title, sort_order) VALUES ($1, 'Book the church', 1)`,
    [eventId],
  );
  const h = await newUser('helper@cohost.test');
  const guest = await newGuest(eventId, 'Helper');
  await link(eventId, guest, h);
  await sayYes(guest);
  await pick(eventId, guest, 'viewer', creator);
  assert.equal(await membership(eventId, h), 'coordinator');

  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, h);
  const seen = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.event_checklist_items WHERE event_id = $1`, [eventId],
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.papic_missions (event_id, mission_type, prompt, source)
         VALUES ($1, 'prompt', 'helper write', 'couple')`,
        [eventId],
      ),
    /row-level security/,
    'a limited helper wrote to a coordinator-writable table',
  );
  await db.exec('RESET ROLE');
  assert.equal(seen.rows[0]!.c, '1', 'a limited helper reads the plan — "can see progress"');
});

test('every coordinator-writable table without an area check refuses a limited helper', async () => {
  const r = await db.query<{ t: string; ins: boolean; upd: boolean; del: boolean }>(`
    WITH w AS (
      SELECT p.tablename
      FROM pg_policies p
      JOIN information_schema.columns c
        ON c.table_schema = 'public' AND c.table_name = p.tablename AND c.column_name = 'event_id'
      WHERE p.schemaname = 'public' AND p.permissive = 'PERMISSIVE'
        AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
      GROUP BY p.tablename
      HAVING bool_or((coalesce(p.qual,'') || coalesce(p.with_check,'')) ILIKE '%coordinator%')
         AND NOT bool_or((coalesce(p.qual,'') || coalesce(p.with_check,'')) ILIKE '%moderator_area_level%')
    )
    SELECT w.tablename AS t,
      EXISTS (SELECT 1 FROM pg_policies x WHERE x.tablename = w.tablename AND x.permissive = 'RESTRICTIVE' AND x.cmd = 'INSERT' AND x.with_check ILIKE '%is_limited_helper%') AS ins,
      EXISTS (SELECT 1 FROM pg_policies x WHERE x.tablename = w.tablename AND x.permissive = 'RESTRICTIVE' AND x.cmd = 'UPDATE' AND x.qual ILIKE '%is_limited_helper%') AS upd,
      EXISTS (SELECT 1 FROM pg_policies x WHERE x.tablename = w.tablename AND x.permissive = 'RESTRICTIVE' AND x.cmd = 'DELETE' AND x.qual ILIKE '%is_limited_helper%') AS del
    FROM w`);
  assert.ok(r.rows.length >= 10, `scan floor: only ${r.rows.length} coordinator-writable tables found`);
  const open = r.rows.filter((x) => !(x.ins && x.upd && x.del)).map((x) => x.t);
  assert.deepEqual(
    open,
    [],
    'a new table lets a coordinator write without an area check AND without the limited-helper ' +
      'refusal — add lh_ro_* restrictive policies (see migration 20271251336140 §7) or gate it on ' +
      'moderator_area_level',
  );
});

test('Co-host ⇄ Limited helper moves the membership at once', async () => {
  const { eventId, creator } = await newEvent('switch');
  const u = await newUser('switch@cohost.test');
  const guest = await newGuest(eventId, 'Switch');
  await link(eventId, guest, u);
  await sayYes(guest);
  const seat = await pick(eventId, guest, 'co_host', creator);
  assert.equal(await membership(eventId, u), 'couple');
  await db.query(`UPDATE public.event_moderators SET role_subtype = 'viewer' WHERE moderator_id = $1`, [seat]);
  assert.equal(await membership(eventId, u), 'coordinator');
  await db.query(`UPDATE public.event_moderators SET role_subtype = 'co_host' WHERE moderator_id = $1`, [seat]);
  assert.equal(await membership(eventId, u), 'couple');
});

test('a celebrant co-host cannot be removed or narrowed; a plain co-host can be removed → guest', async () => {
  const { eventId, creator } = await newEvent('celebrant');
  const bride = await newUser('celebrant-bride@cohost.test');
  const bg = await newGuest(eventId, 'Bride', 'bride');
  await link(eventId, bg, bride);
  await sayYes(bg);
  const brideSeat = await pick(eventId, bg, 'co_host', creator);
  await assert.rejects(
    () => db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [brideSeat]),
    /celebrant_cohost_locked/,
  );
  await assert.rejects(
    () => db.query(`UPDATE public.event_moderators SET role_subtype = 'viewer' WHERE moderator_id = $1`, [brideSeat]),
    /celebrant_cohost_locked/,
    'narrowing a celebrant to limited helper is a removal by another name',
  );

  const pal = await newUser('pal@cohost.test');
  const pg = await newGuest(eventId, 'Pal');
  await link(eventId, pg, pal);
  await sayYes(pg);
  const palSeat = await pick(eventId, pg, 'co_host', creator);
  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE moderator_id = $1`, [palSeat]);
  assert.equal(await membership(eventId, pal), 'guest', 'removed → back to guest, still on the list');
  assert.ok(await follows(pal, creator), 'follows are the follower’s own — removal unfollows nobody');

  // Re-adding REVIVES the one seat row this person keeps per event.
  await db.query(
    `UPDATE public.event_moderators SET removed_at = NULL, removal_reason = NULL, user_id = NULL, accepted_at = NULL
     WHERE moderator_id = $1`,
    [palSeat],
  );
  assert.equal(await membership(eventId, pal), 'couple', 'a revived seat on a joined guest goes live again');
});

test('only a celebrant changes a celebrant’s role', async () => {
  const { eventId, creator } = await newEvent('role-lock');
  const bride = await newUser('rl-bride@cohost.test');
  const bg = await newGuest(eventId, 'Bride', 'bride');
  await link(eventId, bg, bride);
  await sayYes(bg);
  await pick(eventId, bg, 'co_host', creator);

  const pal = await newUser('rl-pal@cohost.test');
  const pg = await newGuest(eventId, 'Pal');
  await link(eventId, pg, pal);
  await sayYes(pg);
  await pick(eventId, pg, 'co_host', creator);

  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, pal);
  await assert.rejects(
    () => db.query(`UPDATE public.guests SET role = 'guest' WHERE guest_id = $1`, [bg]),
    /celebrant_role_locked/,
    'a co-host who is not a celebrant demoted the bride — the two-step removal is open',
  );
  await setAuthUid(db, bride);
  const done = await db.query(
    `UPDATE public.guests SET role = 'guest' WHERE guest_id = $1 RETURNING guest_id`, [bg],
  );
  await db.exec('RESET ROLE');
  assert.equal(done.rows.length, 1, 'a celebrant changed it — and a row really changed');
});

test('a joined guest follows every co-host, never the other way round', async () => {
  const { eventId, creator } = await newEvent('follows');
  const g = await newUser('follower@cohost.test');
  const gid = await newGuest(eventId, 'Follower');
  await link(eventId, gid, g);
  assert.equal(await follows(g, creator), false, 'linked but no YES → no follow');
  await sayYes(gid);
  assert.ok(await follows(g, creator), 'YES → follows the co-hosts');
  assert.equal(await follows(creator, g), false, 'a follow is one-way — not a connection');
});

test('a confirmed connection makes both people follow each other', async () => {
  const a = await newUser('conn-a@cohost.test');
  const b = await newUser('conn-b@cohost.test');
  const pa = await db.query<{ person_id: string }>(`SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`, [a]);
  const pb = await db.query<{ person_id: string }>(`SELECT person_id FROM public.people WHERE claimed_by_user_id = $1`, [b]);
  assert.ok(pa.rows[0] && pb.rows[0], 'fixture: both accounts have a person record');
  const c = await db.query<{ connection_id: string }>(
    `INSERT INTO public.person_connections (from_person_id, to_person_id, status, created_by_user_id, relation, layer)
     VALUES ($1, $2, 'pending', $3, 'friend', 'friend') RETURNING connection_id`,
    [pa.rows[0]!.person_id, pb.rows[0]!.person_id, a],
  );
  assert.equal(await follows(a, b), false, 'pending → nothing yet');
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, b);
  await db.query(
    `UPDATE public.person_connections SET status = 'confirmed', confirmed_at = now() WHERE connection_id = $1`,
    [c.rows[0]!.connection_id],
  );
  await db.exec('RESET ROLE');
  assert.ok(await follows(a, b) && await follows(b, a), 'connected people follow each other');
});

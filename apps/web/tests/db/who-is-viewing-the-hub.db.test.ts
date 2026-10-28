/**
 * WHO'S HERE — the database half (migration 20271295895751, owner 2026-10-29: *"which guest is viewing the event
 * hub?"*). Run against the replayed schema:
 *
 *   • a guest's open is recorded once, and a second open within 30 minutes writes NOTHING (the server-side debounce);
 *     an open after 30 minutes moves the row again;
 *   • 🔒 a guest of ANOTHER event, a removed guest, or a guest id that does not exist is refused — the writer cannot be
 *     made to stamp somebody else's row;
 *   • a stranger is a +1 on ONE row per event per quarter-hour — 50 opens are one row;
 *   • 🔒 only the service role may write: anon and a signed-in guest cannot call the writer, and nobody can INSERT;
 *   • 🔒 the team reads it, nobody else: the host and a moderator with the guest list see names; a moderator WITHOUT
 *     the guest list sees no names (and is told so by `may_name`); a guest, another couple and anon see nothing;
 *   • rows older than a day go on the next write (retention without a scheduler);
 *   • the presence channel's predicate admits the team and refuses a guest, another couple and a malformed topic —
 *     and never throws.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(role: 'service_role' | 'anon' | 'authenticated', fn: () => Promise<T>, uid: string | null = null): Promise<T> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
  if (uid) await setAuthUid(db, uid);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function newUser(email: string): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
       VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
      [email],
    )
  ).rows[0]!.id;
}
async function newEvent(label: string, host: string): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, region)
     VALUES ($1, 'birthday', '2027-06-06'::date, 'day', 'NCR') RETURNING event_id`,
    [label],
  );
  const id = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`,
    [id, host],
  );
  return id;
}
async function newGuest(eventId: string, first: string, display: string | null = null): Promise<string> {
  return (
    await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, display_name, side, group_category, role)
       VALUES ($1, $2, 'Reyes', $3, 'both', 'friends', 'guest'::public.guest_role) RETURNING guest_id`,
      [eventId, first, display],
    )
  ).rows[0]!.guest_id;
}
async function record(eventId: string, guestId: string | null): Promise<string> {
  return as('service_role', async () =>
    (await db.query<{ r: string }>(`SELECT public.record_hub_view($1, $2) AS r`, [eventId, guestId])).rows[0]!.r,
  );
}
type Viewers = {
  team: boolean;
  may_name: boolean;
  window_minutes: number;
  guest_total: number;
  visitors: number;
  guests: Array<{ guest_id: string; first_name: string; display_name: string | null }>;
};
async function viewersAs(uid: string | null, eventId: string): Promise<Viewers> {
  return as(uid ? 'authenticated' : 'anon', async () =>
    (await db.query<{ v: Viewers }>(`SELECT public.event_hub_viewers($1) AS v`, [eventId])).rows[0]!.v,
  uid);
}
const seenAt = async (guestId: string) =>
  (await db.query<{ t: string }>(`SELECT last_seen_at::text AS t FROM public.hub_guest_views WHERE guest_id = $1`, [guestId])).rows[0]?.t ?? null;

let host = '';
let otherHost = '';
let guestUser = '';
let coordinator = '';
let helperNoList = '';
let eventId = '';
let otherEvent = '';
let ben = '';
let tess = '';
let outsider = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  host = await newUser('host@whos-here.test');
  otherHost = await newUser('other-host@whos-here.test');
  guestUser = await newUser('guest@whos-here.test');
  coordinator = await newUser('coord@whos-here.test');
  helperNoList = await newUser('helper@whos-here.test');
  eventId = await newEvent('Ana & Miguel', host);
  otherEvent = await newEvent('Someone else', otherHost);
  ben = await newGuest(eventId, 'Benjamin', 'Tito Ben');
  tess = await newGuest(eventId, 'Teresa', 'Ninang Tess');
  outsider = await newGuest(otherEvent, 'Outsider');
  // A guest who signed in and bound their seat — a member, but NOT the team.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id) VALUES ($1, $2, 'guest', 'guest_signup', $3)`,
    [eventId, guestUser, ben],
  );
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', now(), jsonb_build_object('areas', jsonb_build_object('guest_list','view')))`,
    [eventId, coordinator],
  );
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'viewer', now(), jsonb_build_object('areas', jsonb_build_object('budget','view')))`,
    [eventId, helperNoList],
  );
});
beforeEach(reset);
after(async () => {
  await db?.close();
});

test('a guest is recorded once; a second open inside 30 minutes writes nothing; after 30 minutes it moves', async () => {
  assert.equal(await record(eventId, ben), 'guest');
  const first = await seenAt(ben);
  assert.ok(first, 'premise: the open was recorded');
  for (let i = 0; i < 20; i++) assert.equal(await record(eventId, ben), 'debounced', 'a refresh storm is a no-op');
  assert.equal(await seenAt(ben), first, '🔒 the debounce holds: last_seen_at did not move');
  const rows = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.hub_guest_views WHERE guest_id = $1`, [ben]);
  assert.equal(rows.rows[0]!.n, 1, 'one row per guest, however many opens');
  await db.query(`UPDATE public.hub_guest_views SET last_seen_at = now() - INTERVAL '31 minutes' WHERE guest_id = $1`, [ben]);
  assert.equal(await record(eventId, ben), 'guest', 'after 30 minutes the next open is recorded again');
});

test('🔒 the writer cannot stamp another event’s guest, a removed guest, or a made-up id', async () => {
  assert.equal(await record(eventId, outsider), 'refused', 'a guest of another event');
  assert.equal(await seenAt(outsider), null);
  assert.equal(await record(eventId, '00000000-0000-4000-8000-000000000000'), 'refused', 'no such guest');
  const gone = await newGuest(eventId, 'Removed');
  await db.query(`UPDATE public.guests SET deleted_at = now() WHERE guest_id = $1`, [gone]);
  assert.equal(await record(eventId, gone), 'refused', 'a removed guest');
  assert.equal(await seenAt(gone), null);
  assert.equal(await record(eventId, tess), 'guest', 'positive control: this event’s own guest is recorded');
});

test('a stranger is +1 on ONE row per event per quarter-hour — 50 opens, one row', async () => {
  const before = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.hub_visitor_buckets WHERE event_id = $1`, [eventId]);
  for (let i = 0; i < 50; i++) assert.equal(await record(eventId, null), 'visitor');
  const after = await db.query<{ n: number; opens: number }>(
    `SELECT count(*)::int AS n, coalesce(sum(opens),0)::int AS opens FROM public.hub_visitor_buckets WHERE event_id = $1`,
    [eventId],
  );
  assert.ok(after.rows[0]!.n - before.rows[0]!.n <= 1, 'at most one new row (a quarter-hour may tick over mid-test)');
  assert.ok(after.rows[0]!.n <= 2);
  assert.equal(after.rows[0]!.opens, 50);
  const cols = (
    await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='hub_visitor_buckets' ORDER BY 1`,
    )
  ).rows.map((r) => r.column_name);
  assert.deepEqual(cols, ['bucket_start', 'event_id', 'opens'], '🔒 never who: no person, cookie or hash column');
  assert.equal(await record('00000000-0000-4000-8000-000000000001', null), 'refused', 'no such event');
});

test('🔒 only the service role writes — anon and a signed-in guest cannot call the writer or insert', async () => {
  for (const [role, uid] of [['anon', null], ['authenticated', guestUser], ['authenticated', host]] as const) {
    await assert.rejects(
      as(role, () => db.query(`SELECT public.record_hub_view($1, $2)`, [eventId, tess]), uid),
      /permission denied/,
      `${role} ${uid ?? ''} must not call record_hub_view`,
    );
    await assert.rejects(
      as(role, () => db.query(`INSERT INTO public.hub_guest_views (guest_id, event_id) VALUES ($1, $2)`, [tess, eventId]), uid),
      /permission denied/,
      `${role} must not insert a guest view`,
    );
    await assert.rejects(
      as(role, () => db.query(`INSERT INTO public.hub_visitor_buckets (event_id, bucket_start, opens) VALUES ($1, date_bin('15 minutes', now(), TIMESTAMPTZ '2000-01-01 00:00:00+00'), 999)`, [eventId]), uid),
      /permission denied/,
      `${role} must not insert a visitor count`,
    );
  }
});

test('🔒 the team reads it, nobody else — and a helper without the guest list sees no names', async () => {
  await db.query(`UPDATE public.hub_guest_views SET last_seen_at = now() WHERE event_id = $1`, [eventId]);
  const mine = await viewersAs(host, eventId);
  assert.equal(mine.team, true);
  assert.equal(mine.may_name, true);
  assert.equal(mine.window_minutes, 30);
  assert.ok(mine.guest_total >= 2, `the host sees the guests who opened it (saw ${mine.guest_total})`);
  assert.deepEqual(new Set(mine.guests.map((g) => g.display_name)), new Set(['Tito Ben', 'Ninang Tess']));
  assert.ok(mine.visitors >= 50, 'and the visitors as a count');

  const coord = await viewersAs(coordinator, eventId);
  assert.equal(coord.team, true);
  assert.equal(coord.may_name, true);
  assert.equal(coord.guest_total, mine.guest_total, 'a coordinator granted the guest list sees the same names');

  const helper = await viewersAs(helperNoList, eventId);
  assert.equal(helper.team, true);
  assert.equal(helper.may_name, false, 'told it may not name — never drawn as "no guests"');
  assert.equal(helper.guest_total, 0, '🔒 no guest row is visible without the guest list');
  assert.ok(helper.visitors >= 50, 'the stranger count is the team’s');

  await assert.rejects(viewersAs(null, eventId), /permission denied/, '🔒 anon cannot even call the read');
  for (const [who, uid] of [['a guest who signed in', guestUser], ['another couple', otherHost]] as const) {
    const v = await viewersAs(uid, eventId);
    assert.equal(v.team, false, `${who} is not the team`);
    assert.equal(v.guest_total, 0, `🔒 ${who} reads no guest view`);
    assert.equal(v.guests.length, 0);
    assert.equal(v.visitors, 0, `🔒 ${who} reads no visitor count`);
  }
  const direct = await as('authenticated', () => db.query(`SELECT * FROM public.hub_guest_views`), otherHost);
  assert.equal(direct.rows.length, 0, '🔒 another couple reads no row directly either');
});

test('rows older than a day go on the next write — retention without a scheduler', async () => {
  await db.query(`UPDATE public.hub_guest_views SET last_seen_at = now() - INTERVAL '2 days' WHERE guest_id = $1`, [tess]);
  await db.query(
    `INSERT INTO public.hub_visitor_buckets (event_id, bucket_start, opens)
     VALUES ($1, date_bin('15 minutes', now() - INTERVAL '3 days', TIMESTAMPTZ '2000-01-01 00:00:00+00'), 7)`,
    [eventId],
  );
  await db.query(`UPDATE public.hub_guest_views SET last_seen_at = now() - INTERVAL '40 minutes' WHERE guest_id = $1`, [ben]);
  assert.equal(await record(eventId, ben), 'guest');
  assert.equal(await seenAt(tess), null, 'the two-day-old guest row is gone');
  assert.equal(await record(eventId, null), 'visitor');
  const old = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.hub_visitor_buckets WHERE event_id = $1 AND bucket_start < now() - INTERVAL '1 day'`,
    [eventId],
  );
  assert.equal(old.rows[0]!.n, 0, 'the three-day-old count is gone');
});

test('the presence channel admits the team, refuses everyone else, and never throws', async () => {
  const can = (uid: string | null, topic: string) =>
    as(uid ? 'authenticated' : 'anon', async () =>
      (await db.query<{ ok: boolean }>(`SELECT public.event_team_presence_can_access($1) AS ok`, [topic])).rows[0]!.ok,
    uid);
  const topic = `event-team:${eventId}`;
  assert.equal(await can(host, topic), true, 'the host');
  assert.equal(await can(coordinator, topic), true, 'a coordinator');
  assert.equal(await can(helperNoList, topic), true, 'a helper (the dashboard is theirs too)');
  assert.equal(await can(guestUser, topic), false, '🔒 a guest is not the team');
  assert.equal(await can(otherHost, topic), false, '🔒 another couple');
  assert.equal(await can(host, `seating-presence:${eventId}`), false, 'another topic family');
  assert.equal(await can(host, 'event-team:not-a-uuid'), false, 'a malformed topic is refused, not raised');
  await assert.rejects(can(null, topic), /permission denied/, '🔒 anon cannot even call it');
});

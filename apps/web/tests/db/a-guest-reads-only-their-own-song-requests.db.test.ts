/**
 * A SONG REQUEST IS READ BY THE PEOPLE IT IS FOR — asserted against the
 * REPLAYED schema (migration 20271263627893_song_requests_read_only_what_is_yours).
 *
 * ── THE HOLE ───────────────────────────────────────────────────────────────
 * `event_song_requests_read` admitted `current_event_ids()` — EVERY member of
 * the event, an ordinary invited guest included (no member_type filter) — and
 * `authenticated` held table-level SELECT. So a guest with an account could read
 * every request on the event through PostgREST: other guests' `guest_id` and
 * `requester_name`, and every walk-in's `anon_key` (a stable per-device key; it
 * authorises nothing, but it links one phone across events and is the handle a
 * device mute would use).
 *
 * ── WHAT IS PINNED (each through a real `authenticated` session) ───────────
 *   1. a GUEST member reads only their own request — not another guest's, not a
 *      walk-in's;
 *   2. NO browser role can read `anon_key` — not even the hosts — and the
 *      table-level SELECT is gone (a column added later is closed by default);
 *   3. the HOSTS read every request on their event (the guest-list search's
 *      exact select still works);
 *   4. a DELEGATE reads them only where the host left The Day (`schedule`) at
 *      View or Edit — Off (or never granted) reads nothing;
 *   5. a signed-in NON-member reads nothing; ADMIN reads everything.
 *
 * 🛡 Sabotaged, each red then restored to green:
 *   • restore the broad `current_event_ids()` policy → 1 (guest sees 3), 4 (Off
 *     delegate sees rows) and 5's policy-text check go red;
 *   • re-GRANT SELECT (anon_key) to authenticated → 2 goes red;
 *   • drop the delegate leg → 4 (View/Edit delegate sees 0) goes red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let OTHER_EVENT = '';
let COUPLE = '';
let GUEST_A_USER = '';
let GUEST_B_USER = '';
let STRANGER = '';
let ADMIN = '';
let DELEGATE_VIEW = '';
let DELEGATE_EDIT = '';
let DELEGATE_OFF = '';
let DELEGATE_UNGRANTED = '';

let REQ_A = ''; // guest A's request on EVENT
let REQ_B = ''; // guest B's request on EVENT
let REQ_OPEN = ''; // a walk-in's request on EVENT (carries anon_key)
let REQ_ELSEWHERE = ''; // a request on OTHER_EVENT

let n = 0;
async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@song-read.test`],
  );
  return u.rows[0]!.id;
}

async function newEvent(name: string, token: string): Promise<string> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, master_qr_token)
     VALUES ($1, 'gala_night', $2) RETURNING event_id`,
    [name, token],
  );
  return ev.rows[0]!.event_id;
}

async function newGuest(eventId: string, first: string): Promise<string> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, $2, 'Reyes', 'both', 'friends') RETURNING guest_id`,
    [eventId, first],
  );
  return g.rows[0]!.guest_id;
}

async function songId(title: string): Promise<number> {
  const s = await db.query<{ id: string }>(`SELECT public.resolve_song_id($1, 'The Band')::text AS id`, [title]);
  return Number(s.rows[0]!.id);
}

async function guestRequest(eventId: string, guestId: string, title: string, name: string): Promise<string> {
  const r = await db.query<{ request_id: string }>(
    `INSERT INTO public.event_song_requests (event_id, song_id, origin, guest_id, requester_name)
     VALUES ($1, $2, 'guest', $3, $4) RETURNING request_id`,
    [eventId, await songId(title), guestId, name],
  );
  return r.rows[0]!.request_id;
}

async function delegate(uid: string, areas: Record<string, string | null>): Promise<void> {
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', now(), jsonb_build_object('areas', $3::jsonb))`,
    [EVENT, uid, JSON.stringify(areas)],
  );
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec('SET ROLE authenticated');
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
}

/** The request ids a user can see — the columns every legitimate reader selects. */
async function visibleTo(uid: string): Promise<string[]> {
  const r = await as(uid, () =>
    db.query<{ request_id: string }>(
      `SELECT request_id, event_id, guest_id, requester_name, origin, status
         FROM public.event_song_requests ORDER BY request_id`,
    ),
  );
  return r.rows.map((x) => x.request_id).sort();
}

/** Resolves to the SQLSTATE a statement failed with, or 'ok'. */
async function outcome(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'ok';
  } catch (e) {
    return (e as { code?: string }).code ?? String((e as Error).message);
  }
}

const sorted = (...ids: string[]) => [...ids].sort();

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  EVENT = await newEvent('Song Night', 'song-read-master-token');
  OTHER_EVENT = await newEvent('Elsewhere Night', 'song-read-other-token');

  COUPLE = await newUser();
  GUEST_A_USER = await newUser();
  GUEST_B_USER = await newUser();
  STRANGER = await newUser();
  ADMIN = await newUser();
  DELEGATE_VIEW = await newUser();
  DELEGATE_EDIT = await newUser();
  DELEGATE_OFF = await newUser();
  DELEGATE_UNGRANTED = await newUser();

  const guestA = await newGuest(EVENT, 'Ana');
  const guestB = await newGuest(EVENT, 'Ben');
  const guestElsewhere = await newGuest(OTHER_EVENT, 'Cora');

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, guest_id)
     VALUES ($1, $2, 'couple', NULL), ($1, $3, 'guest', $4), ($1, $5, 'guest', $6)`,
    [EVENT, COUPLE, GUEST_A_USER, guestA, GUEST_B_USER, guestB],
  );
  await db.query(`UPDATE public.users SET account_type = 'admin' WHERE user_id = $1`, [ADMIN]);

  await delegate(DELEGATE_VIEW, { schedule: 'view' });
  await delegate(DELEGATE_EDIT, { schedule: 'edit' });
  await delegate(DELEGATE_OFF, { schedule: null, guest_list: 'edit' });
  await delegate(DELEGATE_UNGRANTED, { seat_plan: 'view' });

  REQ_A = await guestRequest(EVENT, guestA, 'Kiss the Rain', 'Ana');
  REQ_B = await guestRequest(EVENT, guestB, 'Anak', 'Ben');
  const open = await db.query<{ request_id: string }>(
    `INSERT INTO public.event_song_requests (event_id, song_id, origin, anon_key, requester_name)
     VALUES ($1, $2, 'open', $3, 'Walk-in') RETURNING request_id`,
    [EVENT, await songId('Buwan'), 'w'.repeat(32)],
  );
  REQ_OPEN = open.rows[0]!.request_id;
  REQ_ELSEWHERE = await guestRequest(OTHER_EVENT, guestElsewhere, 'Tadhana', 'Cora');
});

after(async () => {
  await replay?.db?.close?.();
});

// ── 0 · the fixture is not vacuous ─────────────────────────────────────────

test('fixture: every delegate is an accepted coordinator member, and the admin is admin', async () => {
  for (const uid of [DELEGATE_VIEW, DELEGATE_EDIT, DELEGATE_OFF, DELEGATE_UNGRANTED]) {
    const m = await db.query(
      `SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2 AND member_type = 'coordinator'`,
      [EVENT, uid],
    );
    assert.equal(m.rows.length, 1, 'an accepted delegate must hold a coordinator member row (the door this test narrows)');
  }
  const a = await as(ADMIN, () => db.query<{ ok: boolean }>(`SELECT public.is_admin() AS ok`));
  assert.equal(a.rows[0]!.ok, true);
  const all = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_song_requests`);
  assert.equal(all.rows[0]!.n, 4);
});

// ── 1 · a guest reads only their own ───────────────────────────────────────

test('a GUEST member reads their own request and nobody else\'s', async () => {
  assert.deepEqual(await visibleTo(GUEST_A_USER), [REQ_A], 'guest A sees exactly their own request');
  assert.deepEqual(await visibleTo(GUEST_B_USER), [REQ_B], 'guest B sees exactly their own request');
});

test('a GUEST member cannot reach another guest\'s request even by id', async () => {
  const r = await as(GUEST_A_USER, () =>
    db.query(`SELECT requester_name FROM public.event_song_requests WHERE request_id = ANY($1::uuid[])`, [
      [REQ_B, REQ_OPEN, REQ_ELSEWHERE],
    ]),
  );
  assert.equal(r.rows.length, 0);
});

// ── 2 · anon_key is readable by no browser role ────────────────────────────

test('NO browser role holds SELECT on anon_key, and table-level SELECT is gone', async () => {
  for (const role of ['anon', 'authenticated']) {
    const c = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege($1, 'public.event_song_requests', 'anon_key', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(c.rows[0]!.ok, false, `${role} must not read anon_key`);
    const t = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.event_song_requests', 'SELECT') AS ok`,
      [role],
    );
    assert.equal(t.rows[0]!.ok, false, `${role} must not hold table-level SELECT (it would include anon_key)`);
  }
});

test('anon_key is refused to a guest AND to the hosts — through a real session', async () => {
  for (const uid of [GUEST_A_USER, COUPLE, DELEGATE_EDIT]) {
    assert.equal(
      await outcome(() => as(uid, () => db.query(`SELECT anon_key FROM public.event_song_requests`))),
      '42501',
      'reading anon_key must be a permission error',
    );
    assert.equal(
      await outcome(() => as(uid, () => db.query(`SELECT * FROM public.event_song_requests`))),
      '42501',
      'SELECT * includes anon_key and must be refused',
    );
  }
});

// ── 3 · the hosts read their whole room ────────────────────────────────────

test('the HOSTS read every request on their event — and only their event', async () => {
  assert.deepEqual(await visibleTo(COUPLE), sorted(REQ_A, REQ_B, REQ_OPEN));
});

test('the guest-list search\'s exact read still works for the hosts', async () => {
  // dashboard/[eventId]/guests/page.tsx: .select('guest_id, songs(title, artist)')
  //   .eq('event_id', eventId).eq('origin', 'guest')
  const r = await as(COUPLE, () =>
    db.query<{ guest_id: string }>(
      `SELECT guest_id FROM public.event_song_requests WHERE event_id = $1 AND origin = 'guest'`,
      [EVENT],
    ),
  );
  assert.equal(r.rows.length, 2);
});

// ── 4 · a delegate, per The Day ────────────────────────────────────────────

test('a DELEGATE with The Day at View or Edit reads every request on the event', async () => {
  assert.deepEqual(await visibleTo(DELEGATE_VIEW), sorted(REQ_A, REQ_B, REQ_OPEN));
  assert.deepEqual(await visibleTo(DELEGATE_EDIT), sorted(REQ_A, REQ_B, REQ_OPEN));
});

test('a DELEGATE with The Day Off — or never granted it — reads nothing', async () => {
  assert.deepEqual(await visibleTo(DELEGATE_OFF), []);
  assert.deepEqual(await visibleTo(DELEGATE_UNGRANTED), []);
});

// ── 5 · a non-member reads nothing; admin oversees ─────────────────────────

test('a signed-in NON-member reads nothing', async () => {
  assert.deepEqual(await visibleTo(STRANGER), []);
});

test('ADMIN reads every request', async () => {
  assert.deepEqual(await visibleTo(ADMIN), sorted(REQ_A, REQ_B, REQ_OPEN, REQ_ELSEWHERE));
});

test('the read policy no longer admits every member (current_event_ids)', async () => {
  const r = await db.query<{ qual: string }>(
    `SELECT qual FROM pg_policies
      WHERE schemaname='public' AND tablename='event_song_requests' AND cmd = 'SELECT'`,
  );
  assert.ok(r.rows.length >= 1);
  for (const row of r.rows) {
    assert.ok(!row.qual.includes('current_event_ids()'), `a SELECT policy still admits every member: ${row.qual}`);
  }
});

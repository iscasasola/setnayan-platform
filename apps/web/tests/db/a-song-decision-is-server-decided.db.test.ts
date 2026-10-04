/**
 * WHO DECIDED A SONG REQUEST IS SET BY THE SERVER, NEVER BY THE CALLER —
 * asserted against the REPLAYED schema (migration
 * 20271263384666_song_request_decisions_are_server_decided).
 *
 * ── THE HOLE ───────────────────────────────────────────────────────────────
 * `authenticated` held table UPDATE on `event_song_requests` and the only
 * UPDATE policy admitted `current_event_ids()` — EVERY member of the event,
 * invited guests included (no member_type filter). So any member could PATCH
 * `status` / `decided_by_vendor_profile_id` / `decided_at` straight through
 * PostgREST: claim a supplier decided a request it never saw. RLS is row-level,
 * never value-level — no policy can stop a member choosing the VALUE.
 *
 * ── WHAT IS PINNED ─────────────────────────────────────────────────────────
 *   1. no browser role holds UPDATE on the table or on a decision column, and
 *      no UPDATE policy survives for a re-grant to resurrect;
 *   2. a GUEST member and the COUPLE are both refused a direct write of the
 *      decision columns — the row is unchanged afterwards;
 *   3. `decide_song_request` is not callable by anon or authenticated;
 *   4. the legitimate flow (the service-role writer behind the song_desk gate)
 *      records the shop it was given and the DATABASE clock — there is no
 *      parameter through which a caller could choose `decided_at`;
 *   5. a shop with no booking on the event, a NULL shop, a NULL decision and a
 *      request from another event are each REFUSED, never a silent success;
 *   6. the server action takes no profile from the browser: its only
 *      attribution is the profile its own gate resolved from the session.
 *
 * 🛡 Sabotaged, each red then restored to green:
 *   • re-GRANT UPDATE (decided_by_vendor_profile_id) + re-create the old
 *     `_decide` policy → 1, 2 (guest), 2 (couple) and the policy test go red;
 *   • drop the `coalesce` around the decision check → the NULL-decision test
 *     goes red (a NULL is "not refused" and the write dies on NOT NULL, 23502,
 *     instead of the vocabulary refusal, 22023);
 *   • make the booking backstop `OR TRUE` → the stranger-shop test goes red;
 *   • give the server action a browser-supplied profile → the source guard
 *     goes red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let EVENT = '';
let OTHER_EVENT = '';
let COUPLE = '';
let GUEST_USER = '';
let BAND = ''; // booked on EVENT (event_vendors row naming it)
let STRANGER_SHOP = ''; // a real shop with no booking on EVENT
let n = 0;

async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, jsonb_build_object('account_type','customer'::text), now()) RETURNING id`,
    [`acct${n}@song-decide.test`],
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

async function shop(name: string): Promise<string> {
  const vp = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (business_name, verification_state, last_verified_at)
     VALUES ($1, 'verified', NOW()) RETURNING vendor_profile_id`,
    [name],
  );
  return vp.rows[0]!.vendor_profile_id;
}

async function pendingRequest(eventId: string, title: string): Promise<string> {
  const s = await db.query<{ id: string }>(`SELECT public.resolve_song_id($1, 'The Band')::text AS id`, [title]);
  const r = await db.query<{ request_id: string }>(
    `INSERT INTO public.event_song_requests (event_id, song_id, origin, anon_key)
     VALUES ($1, $2, 'open', $3) RETURNING request_id`,
    [eventId, Number(s.rows[0]!.id), 'k'.repeat(16) + title.replace(/\W/g, '').padEnd(4, 'x')],
  );
  return r.rows[0]!.request_id;
}

async function row(requestId: string) {
  const r = await db.query<{
    status: string;
    decided_by_vendor_profile_id: string | null;
    decided_at: string | null;
    secs_ago: number | null;
  }>(
    `SELECT status, decided_by_vendor_profile_id, decided_at::text AS decided_at,
            extract(epoch FROM (clock_timestamp() - decided_at))::float AS secs_ago
       FROM public.event_song_requests WHERE request_id = $1`,
    [requestId],
  );
  return r.rows[0]!;
}

async function as<T>(role: 'authenticated' | 'anon' | 'service_role', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  await setAuthUid(db, uid);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
    await setAuthUid(db, null);
  }
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

function decide(eventId: string, requestId: string, decision: string | null, profile: string | null) {
  return db.query(`SELECT public.decide_song_request($1, $2, $3, $4) AS ok`, [eventId, requestId, decision, profile]);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  EVENT = await newEvent('Decide Night', 'decide-night-master-token');
  OTHER_EVENT = await newEvent('Other Night', 'other-night-master-token');
  COUPLE = await newUser();
  GUEST_USER = await newUser();
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'guest')`,
    [EVENT, COUPLE, GUEST_USER],
  );

  BAND = await shop('Saysay Live Band');
  STRANGER_SHOP = await shop('Not On This Event');
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'band_dj', 'Saysay Live Band', 'contracted', $2)`,
    [EVENT, BAND],
  );
});

after(async () => {
  await replay?.db?.close?.();
});

// ── 1 · the grant and the policy are gone ──────────────────────────────────

test('no browser role holds UPDATE on event_song_requests — table or decision column', async () => {
  for (const role of ['anon', 'authenticated']) {
    const t = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.event_song_requests', 'UPDATE') AS ok`,
      [role],
    );
    assert.equal(t.rows[0]!.ok, false, `${role} must not hold table UPDATE`);
    for (const col of ['status', 'decided_by_vendor_profile_id', 'decided_at']) {
      const c = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, 'public.event_song_requests', $2, 'UPDATE') AS ok`,
        [role, col],
      );
      assert.equal(c.rows[0]!.ok, false, `${role} must not hold UPDATE (${col})`);
    }
  }
  // The read the guest list's search uses is untouched. It is a COLUMN grant
  // since 20271263627893 (anon_key is readable by no browser role — asserted in
  // a-guest-reads-only-their-own-song-requests.db.test.ts).
  const sel = await db.query<{ ok: boolean }>(
    `SELECT has_column_privilege('authenticated', 'public.event_song_requests', 'guest_id', 'SELECT') AS ok`,
  );
  assert.equal(sel.rows[0]!.ok, true, 'the couple still reads their own room');
});

test('no UPDATE policy is left for a reflexive re-GRANT to reopen', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname='public' AND tablename='event_song_requests' AND cmd IN ('UPDATE','ALL')`,
  );
  assert.equal(r.rows[0]!.n, 0);
});

// ── 2 · the direct-API door ────────────────────────────────────────────────

test('a GUEST member cannot write who decided a request — refused, row unchanged', async () => {
  const req = await pendingRequest(EVENT, 'Guest Forge');
  for (const set of [
    `status='accepted', decided_by_vendor_profile_id='${BAND}', decided_at='2020-01-01T00:00:00Z'`,
    `decided_by_vendor_profile_id='${BAND}'`,
  ]) {
    const code = await outcome(() =>
      as('authenticated', GUEST_USER, () =>
        db.query(`UPDATE public.event_song_requests SET ${set} WHERE request_id=$1`, [req]),
      ),
    );
    assert.equal(code, '42501', `a guest's "SET ${set}" must get permission denied, not a silent write`);
  }
  const after = await row(req);
  assert.equal(after.status, 'pending');
  assert.equal(after.decided_by_vendor_profile_id, null);
  assert.equal(after.decided_at, null);
});

test('the COUPLE cannot write who decided a request either — not even one column', async () => {
  const req = await pendingRequest(EVENT, 'Couple Forge');
  for (const set of [
    `decided_by_vendor_profile_id = '${BAND}'`,
    `decided_at = now()`,
    `status = 'declined', decided_at = now()`,
  ]) {
    const code = await outcome(() =>
      as('authenticated', COUPLE, () =>
        db.query(`UPDATE public.event_song_requests SET ${set} WHERE request_id=$1`, [req]),
      ),
    );
    assert.equal(code, '42501', `the couple's "SET ${set}" must be refused`);
  }
  const after = await row(req);
  assert.equal(after.status, 'pending');
  assert.equal(after.decided_by_vendor_profile_id, null);
});

test('decide_song_request is not callable from a browser role', async () => {
  const req = await pendingRequest(EVENT, 'Browser RPC');
  for (const [role, uid] of [['authenticated', COUPLE], ['authenticated', GUEST_USER], ['anon', null]] as const) {
    const code = await outcome(() => as(role, uid, () => decide(EVENT, req, 'accepted', BAND)));
    assert.equal(code, '42501', `${role} must not EXECUTE decide_song_request`);
  }
  assert.equal((await row(req)).status, 'pending');
});

// ── 4 · the legitimate flow ────────────────────────────────────────────────

test('the service-role writer records the shop and the DATABASE clock', async () => {
  const req = await pendingRequest(EVENT, 'Real Accept');
  await as('service_role', null, () => decide(EVENT, req, 'accepted', BAND));
  const a = await row(req);
  assert.equal(a.status, 'accepted');
  assert.equal(a.decided_by_vendor_profile_id, BAND);
  assert.ok(a.secs_ago !== null && a.secs_ago >= 0 && a.secs_ago < 60, `decided_at is now(), got ${a.decided_at}`);

  // The act can change its mind — decline after accept still works.
  await as('service_role', null, () => decide(EVENT, req, 'declined', BAND));
  assert.equal((await row(req)).status, 'declined');
});

test('there is no parameter through which a caller could choose decided_at', async () => {
  const req = await pendingRequest(EVENT, 'Clock Forge');
  const code = await outcome(() =>
    as('service_role', null, () =>
      db.query(`SELECT public.decide_song_request($1, $2, 'accepted', $3, '2020-01-01T00:00:00Z'::timestamptz)`, [
        EVENT,
        req,
        BAND,
      ]),
    ),
  );
  assert.equal(code, '42883', 'a five-argument call must not resolve to any function');
  const sig = await db.query<{ args: string }>(
    `SELECT pg_get_function_identity_arguments('public.decide_song_request(uuid,uuid,text,uuid)'::regprocedure) AS args`,
  );
  assert.doesNotMatch(sig.rows[0]!.args, /timestamp|decided_at/i);
});

// ── 5 · fail closed ────────────────────────────────────────────────────────

test('a shop with no booking on the event is refused — attribution needs a connection', async () => {
  const req = await pendingRequest(EVENT, 'Stranger Shop');
  const code = await outcome(() => as('service_role', null, () => decide(EVENT, req, 'accepted', STRANGER_SHOP)));
  assert.equal(code, '42501');
  const nullShop = await outcome(() => as('service_role', null, () => decide(EVENT, req, 'accepted', null)));
  assert.equal(nullShop, '42501', 'a NULL shop is a refusal, not "not refused"');
  assert.equal((await row(req)).status, 'pending');
});

test('a NULL or unknown decision is refused outright', async () => {
  const req = await pendingRequest(EVENT, 'Bad Decision');
  for (const d of [null, 'pending', 'played']) {
    const code = await outcome(() => as('service_role', null, () => decide(EVENT, req, d, BAND)));
    assert.equal(code, '22023', `decision ${String(d)} must be refused by the vocabulary check`);
  }
  assert.equal((await row(req)).status, 'pending');
});

test('a request from another event cannot be decided by id alone — and zero rows raises', async () => {
  const req = await pendingRequest(OTHER_EVENT, 'Other Event');
  const code = await outcome(() => as('service_role', null, () => decide(EVENT, req, 'accepted', BAND)));
  assert.equal(code, 'P0002', 'zero rows touched must raise, never report success');
  assert.equal((await row(req)).status, 'pending');
});

// ── 6 · the server action takes no attribution from the browser ───────────

test('decideActSongRequest takes no profile and writes only through decide_song_request', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../app/vendor-dashboard/on-the-day/actions.ts'),
    'utf8',
  );
  const start = src.indexOf('export async function decideActSongRequest(');
  assert.ok(start >= 0, 'decideActSongRequest moved — re-point this guard');
  const end = src.indexOf('\nexport ', start + 1);
  const body = src.slice(start, end < 0 ? undefined : end);

  const params = body.slice(body.indexOf('(') + 1, body.indexOf(')'));
  assert.doesNotMatch(params, /profile|decided/i, 'the browser must not be able to name the deciding shop');
  assert.match(body, /rpc\('decide_song_request'/, 'the decision must go through the one SQL writer');
  assert.match(body, /p_vendor_profile_id:\s*gate\.profile\.vendor_profile_id/, 'attribution is the gate-resolved profile');
  assert.doesNotMatch(body, /from\('event_song_requests'\)/, 'a direct table write is a second writer');
  assert.doesNotMatch(body, /decided_at/, 'the clock is the database’s, not the server’s');
});

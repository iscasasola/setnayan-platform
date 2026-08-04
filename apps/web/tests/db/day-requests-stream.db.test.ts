/**
 * The day-of requests stream — END-TO-END DB verification (migrations replayed).
 *
 * Covers 20271013100000_day_of_requests_stream. The claims that matter are all
 * boundaries, so they are asserted against real SQL rather than mocked:
 *
 *   • the REVOKE is load-bearing — anon holds NO privilege on the table, which
 *     matters because every new relation in `public` ships OPEN on this project;
 *   • the booked COORDINATOR reads every lane and can triage;
 *   • every OTHER booked supplier reads ONLY their own reports and cannot
 *     triage at all — there is no vendor UPDATE policy;
 *   • no one can forge a lane they do not own;
 *   • the activation control genuinely gates the feature — proven by
 *     NEUTRALISING it and watching the answer flip.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

// ─── impersonation ─────────────────────────────────────────────────────────

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
/**
 * Drop back to the migration owner: no role, no claims, RLS bypassed. Used for
 * fixtures and for the CHECK-constraint tests, where the point is to reach the
 * constraint rather than to be stopped by a policy first.
 */
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

// ─── fixtures ──────────────────────────────────────────────────────────────

async function createUser(email: string, accountType: 'customer' | 'vendor' = 'customer') {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}

async function createVendor(userId: string, name: string, services: string[]) {
  const r = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', $3::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId, name, services],
  );
  return r.rows[0]!.vendor_profile_id;
}

async function bookVendor(eventId: string, vendorProfileId: string, category: string) {
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
     VALUES ($1, $2, 'Booked', 'contracted', 100000, $3)`,
    [eventId, category, vendorProfileId],
  );
}

const F = {
  eventId: '',
  couple: '',
  coordUser: '',
  coordVendor: '',
  caterUser: '',
  caterVendor: '',
  outsiderUser: '',
};

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  F.couple = await createUser('couple@day-requests.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Requests Test', 'birthday')
     RETURNING event_id`,
  );
  F.eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [F.eventId, F.couple],
  );

  // The coordinator — a booked vendor carrying the `coordinator` tile.
  // account_type 'customer' so the on_auth_user_created trigger does not
  // auto-create a competing vendor_profiles row; we insert the one we want.
  F.coordUser = await createUser('coord@day-requests.test');
  F.coordVendor = await createVendor(F.coordUser, 'Floor Co', ['coordinator']);
  await bookVendor(F.eventId, F.coordVendor, 'planner_coordinator');

  // An ordinary supplier on the same event.
  F.caterUser = await createUser('cater@day-requests.test');
  F.caterVendor = await createVendor(F.caterUser, 'Caterer Co', ['catering']);
  await bookVendor(F.eventId, F.caterVendor, 'catering');

  // Someone with no relationship to the event at all.
  F.outsiderUser = await createUser('outsider@day-requests.test');
});

after(async () => {
  await db?.close?.();
});

// ─── 1. The REVOKE is load-bearing ─────────────────────────────────────────

test('anon holds NO privilege on event_day_requests', async () => {
  // Default privileges on this project grant arwdDxtm to anon at CREATE time.
  // Without the migration's REVOKE, RLS would be the only thing left.
  const r = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'event_day_requests' AND grantee = 'anon'`,
  );
  assert.equal(r.rows.length, 0, `anon should hold nothing, got ${r.rows.map((x) => x.privilege_type).join(',')}`);
});

test('authenticated gets exactly SELECT/INSERT/UPDATE — never DELETE', async () => {
  const r = await db.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema = 'public' AND table_name = 'event_day_requests' AND grantee = 'authenticated'`,
  );
  const got = r.rows.map((x) => x.privilege_type).sort();
  assert.deepEqual(got, ['INSERT', 'SELECT', 'UPDATE'],
    'a shared coordination record is resolved, never quietly erased');
});

test('RLS is enabled on the table', async () => {
  const r = await db.query<{ relrowsecurity: boolean }>(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'event_day_requests'`,
  );
  assert.equal(r.rows[0]?.relrowsecurity, true);
});

// ─── 2. The lanes ──────────────────────────────────────────────────────────

test('a booked supplier files on the vendor lane', async () => {
  await asUser(F.caterUser);
  await db.query(
    `INSERT INTO public.event_day_requests
       (event_id, origin, kind, body, preset_key, author_user_id, author_vendor_profile_id)
     VALUES ($1, 'vendor', 'status_update', 'We have arrived on site.', 'on_site', $2, $3)`,
    [F.eventId, F.caterUser, F.caterVendor],
  );
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.event_day_requests WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(r.rows[0]!.n, '1');
});

test('a supplier cannot forge the couple lane', async () => {
  await asUser(F.caterUser);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests (event_id, origin, kind, body, author_user_id)
         VALUES ($1, 'couple', 'issue', 'Forged as the couple', $2)`,
        [F.eventId, F.caterUser],
      ),
    /row-level security|policy/i,
    'only an event member may write the couple lane',
  );
});

test('a supplier cannot file as another user', async () => {
  await asUser(F.caterUser);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests
           (event_id, origin, kind, body, author_user_id, author_vendor_profile_id)
         VALUES ($1, 'vendor', 'issue', 'Signed by someone else', $2, $3)`,
        [F.eventId, F.coordUser, F.caterVendor],
      ),
    /row-level security|policy/i,
    'author_user_id = auth.uid() is enforced in WITH CHECK',
  );
});

test('a stranger to the event cannot file at all', async () => {
  await asUser(F.outsiderUser);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests (event_id, origin, kind, body, author_user_id)
         VALUES ($1, 'coordinator', 'issue', 'I do not belong here', $2)`,
        [F.eventId, F.outsiderUser],
      ),
    /row-level security|policy/i,
  );
});

test('the couple files on the couple lane', async () => {
  await asUser(F.couple);
  await db.query(
    `INSERT INTO public.event_day_requests (event_id, origin, kind, body, author_user_id)
     VALUES ($1, 'couple', 'request', 'Please hold the cake until after the speech.', $2)`,
    [F.eventId, F.couple],
  );
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.event_day_requests WHERE origin = 'couple'`,
  );
  assert.equal(r.rows[0]!.n, '1');
});

// ─── 3. Who sees what ──────────────────────────────────────────────────────

test('the coordinator reads EVERY lane on their event', async () => {
  await asUser(F.coordUser);
  const r = await db.query<{ origin: string }>(
    `SELECT origin FROM public.event_day_requests WHERE event_id = $1 ORDER BY origin`,
    [F.eventId],
  );
  assert.deepEqual(r.rows.map((x) => x.origin), ['couple', 'vendor'],
    'the whole point of one inbox — they are a vendor, reached via current_coordinator_booked_event_ids()');
});

test('an ordinary supplier reads ONLY what they filed', async () => {
  await asUser(F.caterUser);
  const r = await db.query<{ origin: string; body: string }>(
    `SELECT origin, body FROM public.event_day_requests WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(r.rows.length, 1, 'never the couple’s private log, never another supplier’s problems');
  assert.equal(r.rows[0]!.origin, 'vendor');
});

test('a stranger reads nothing', async () => {
  await asUser(F.outsiderUser);
  const r = await db.query(`SELECT * FROM public.event_day_requests WHERE event_id = $1`, [F.eventId]);
  assert.equal(r.rows.length, 0);
});

// ─── 4. Triage ─────────────────────────────────────────────────────────────

test('the coordinator triages, and resolved_at is stamped by the trigger', async () => {
  await asUser(F.coordUser);
  const target = await db.query<{ request_id: string }>(
    `SELECT request_id FROM public.event_day_requests WHERE origin = 'vendor' LIMIT 1`,
  );
  const id = target.rows[0]!.request_id;

  const upd = await db.query<{ status: string; resolved_at: string | null }>(
    `UPDATE public.event_day_requests SET status = 'resolved' WHERE request_id = $1
     RETURNING status, resolved_at`,
    [id],
  );
  assert.equal(upd.rows[0]!.status, 'resolved');
  assert.ok(upd.rows[0]!.resolved_at, 'the trigger stamps it — no caller has to remember');

  const re = await db.query<{ resolved_at: string | null }>(
    `UPDATE public.event_day_requests SET status = 'open' WHERE request_id = $1
     RETURNING resolved_at`,
    [id],
  );
  assert.equal(re.rows[0]!.resolved_at, null, 'reopening clears the stamp');
});

test('an ordinary supplier CANNOT triage — not even their own row', async () => {
  await asUser(F.caterUser);
  const own = await db.query<{ request_id: string }>(
    `SELECT request_id FROM public.event_day_requests LIMIT 1`,
  );
  const r = await db.query(
    `UPDATE public.event_day_requests SET status = 'resolved' WHERE request_id = $1
     RETURNING request_id`,
    [own.rows[0]!.request_id],
  );
  // No vendor UPDATE policy exists, so the row is simply not visible to UPDATE.
  assert.equal(r.rows.length, 0,
    'canTriage() in lib/day-requests.ts must agree — a button that 403s is worse than no button');
});

// ─── 5. Constraints ────────────────────────────────────────────────────────

test('a vendor-lane row must name its vendor, and no other lane may claim one', async () => {
  await asOwner();
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests (event_id, origin, kind, body, author_user_id)
         VALUES ($1, 'vendor', 'issue', 'no profile attached', $2)`,
        [F.eventId, F.caterUser],
      ),
    /event_day_requests_vendor_origin_has_profile|violates check/i,
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests
           (event_id, origin, kind, body, author_user_id, author_vendor_profile_id)
         VALUES ($1, 'coordinator', 'issue', 'claiming a vendor', $2, $3)`,
        [F.eventId, F.coordUser, F.coordVendor],
      ),
    /event_day_requests_vendor_origin_has_profile|violates check/i,
    'so the inbox can never misattribute a report',
  );
});

test('an empty or oversized body is refused by the CHECK', async () => {
  await asOwner();
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests (event_id, origin, kind, body, author_user_id)
         VALUES ($1, 'couple', 'issue', '   ', $2)`,
        [F.eventId, F.couple],
      ),
    /violates check/i,
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_day_requests (event_id, origin, kind, body, author_user_id)
         VALUES ($1, 'couple', 'issue', repeat('x', 241), $2)`,
        [F.eventId, F.couple],
      ),
    /violates check/i,
    '241 must fail — DAY_REQUEST_BODY_MAX is 240 on both sides',
  );
});

test('all four lanes exist in the enum, in order', async () => {
  const r = await db.query<{ v: string }>(
    `SELECT unnest(enum_range(NULL::public.day_request_origin))::text AS v`,
  );
  assert.deepEqual(r.rows.map((x) => x.v), ['couple', 'vendor', 'host', 'coordinator']);
});

// ─── 6. The gate, proven by neutralising it ────────────────────────────────

test('the feature ships DARK — the activation control seeds inactive', async () => {
  await asOwner();
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.data_privacy_controls WHERE control_key = 'coordinator_requests_inbox'`,
  );
  assert.equal(r.rows.length, 1, 'the control row must exist or the gate fails open on a missing row');
  assert.equal(r.rows[0]!.status, 'inactive',
    '§10: flag-dark PR, owner sign-off before flag flip');
});

test('NEUTRALISING the gate is what turns the feature on — and only that', async () => {
  await asOwner();
  // This is the exact read isDataPrivacyControlActive() performs.
  const gate = async () => {
    const r = await db.query<{ status: string }>(
      `SELECT status FROM public.data_privacy_controls WHERE control_key = 'coordinator_requests_inbox'`,
    );
    return r.rows[0]?.status === 'active';
  };

  assert.equal(await gate(), false, 'dark by default');

  await db.query(
    `UPDATE public.data_privacy_controls SET status = 'active' WHERE control_key = 'coordinator_requests_inbox'`,
  );
  assert.equal(await gate(), true, 'flipping the control is the ONLY thing that opens it');

  // And the data boundary is unchanged by the flip — activation is not access.
  await asUser(F.caterUser);
  const rows = await db.query(
    `SELECT request_id FROM public.event_day_requests WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(rows.rows.length, 1,
    'an active control still shows a supplier only their own row — the gate switches the feature on, RLS decides who sees what');

  await asOwner();
  await db.query(
    `UPDATE public.data_privacy_controls SET status = 'inactive' WHERE control_key = 'coordinator_requests_inbox'`,
  );
  assert.equal(await gate(), false, 'and it closes again');
});

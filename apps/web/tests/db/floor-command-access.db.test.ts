/**
 * Floor command — access boundaries, END-TO-END (migrations replayed).
 *
 * Covers 20271013200000 (seat-by-QR) + 20271014200000 (access requests). The
 * one claim everything else rests on: **being booked grants nothing.** A
 * coordinator with a booking and no host grant can look nothing up; the same
 * coordinator, after the host shares the seat plan, can — and the ONLY thing
 * that changed was a row the host wrote.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/**
 * 32 lowercase hex — the shape `guests.qr_token` uses. BUILT rather than
 * written as a literal: a 32-char hex string in source reads as a leaked
 * credential to the secret scanner, and a test fixture must not look like one.
 */
function fakeToken(fill: string): string {
  return fill.repeat(32).slice(0, 32);
}

const F = {
  eventId: '',
  host: '',
  coordUser: '',
  coordVendor: '',
  caterUser: '',
  caterVendor: '',
  guestToken: fakeToken('a1b2'),
  otherToken: fakeToken('f'),
};

/** Give the coordinator a moderator row carrying exactly these areas. */
async function hostShares(areas: Record<string, string | null>): Promise<void> {
  await asOwner();
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external',
             jsonb_build_object('edit_all', false, 'checkout', false,
                                'invite_hosts', false, 'remove_hosts', false,
                                'areas', $3::jsonb),
             NOW())
     ON CONFLICT (event_id, user_id) DO UPDATE
       SET permissions_json = EXCLUDED.permissions_json, removed_at = NULL`,
    [F.eventId, F.coordUser, JSON.stringify(areas)],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  F.host = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ('host@fc.test', jsonb_build_object('account_type','customer')) RETURNING id`,
    )
  ).rows[0]!.id;

  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('FC Test','birthday')
       RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [F.eventId, F.host],
  );

  for (const [key, email, services, category] of [
    ['coord', 'coord@fc.test', ['coordinator'], 'planner_coordinator'],
    ['cater', 'cater@fc.test', ['catering'], 'catering'],
  ] as const) {
    const uid = (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',$3::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, `${key} co`, services as unknown as string[]],
      )
    ).rows[0]!.vendor_profile_id;
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,$2,'Booked','contracted',100000,$3)`,
      [F.eventId, category, vp],
    );
    if (key === 'coord') {
      F.coordUser = uid;
      F.coordVendor = vp;
    } else {
      F.caterUser = uid;
      F.caterVendor = vp;
    }
  }

  // A published floor plan with one seated guest and one unseated guest.
  const t = await db.query<{ table_id: string }>(
    `INSERT INTO public.event_tables (event_id, table_label, table_type, capacity)
     VALUES ($1,'Table 4','round_8',8) RETURNING table_id`,
    [F.eventId],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, qr_token)
     VALUES ($1,'Ana','Cruz','both','friends',$2) RETURNING guest_id`,
    [F.eventId, F.guestToken],
  );
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, qr_token)
     VALUES ($1,'Noa','Reyes','both','friends',$2)`,
    [F.eventId, F.otherToken],
  );
  await db.query(
    `INSERT INTO public.event_seat_assignments (event_id, table_id, guest_id) VALUES ($1,$2,$3)`,
    [F.eventId, t.rows[0]!.table_id, g.rows[0]!.guest_id],
  );
  await db.query(
    `INSERT INTO public.event_floor_plan (event_id, published_at) VALUES ($1, NOW())
     ON CONFLICT (event_id) DO UPDATE SET published_at = NOW()`,
    [F.eventId],
  );
});

after(async () => {
  await db?.close?.();
});

// ─── 1. Privileges ─────────────────────────────────────────────────────────

test('anon holds NO privilege on event_access_requests', async () => {
  const r = await db.query(
    `SELECT 1 FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='event_access_requests' AND grantee='anon'`,
  );
  assert.equal(r.rows.length, 0);
});

test('neither new function is callable by anon', async () => {
  // `FROM PUBLIC` alone would leave anon's own EXECUTE grant intact — the
  // prod-verified 2026-07-26 lesson.
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.role_routine_grants
     WHERE routine_schema='public'
       AND routine_name IN ('coordinator_seat_by_guest_qr','touch_event_access_requests')
       AND grantee IN ('anon','PUBLIC')`,
  );
  assert.equal(r.rows[0]!.n, '0');
});

// ─── 2. BEING BOOKED GRANTS NOTHING ────────────────────────────────────────

test('a booked coordinator with NO host grant cannot look up a seat', async () => {
  await asUser(F.coordUser);
  await assert.rejects(
    () =>
      db.query(`SELECT public.coordinator_seat_by_guest_qr($1,$2)`, [F.eventId, F.guestToken]),
    /seat_plan_not_shared/,
    'the owner ruling: a booking self-grants nothing',
  );
});

test('the SAME coordinator succeeds once the host shares the seat plan', async () => {
  await hostShares({ seat_plan: 'view' });
  await asUser(F.coordUser);
  const r = await db.query<{ out: { found: boolean; table_label: string | null } }>(
    `SELECT public.coordinator_seat_by_guest_qr($1,$2) AS out`,
    [F.eventId, F.guestToken],
  );
  assert.deepEqual(r.rows[0]!.out, { found: true, table_label: 'Table 4' },
    'the ONLY thing that changed is a row the host wrote');
});

test('revoking the area closes it again immediately', async () => {
  await hostShares({ seat_plan: null });
  await asUser(F.coordUser);
  await assert.rejects(
    () => db.query(`SELECT public.coordinator_seat_by_guest_qr($1,$2)`, [F.eventId, F.guestToken]),
    /seat_plan_not_shared/,
  );
  await hostShares({ seat_plan: 'view' }); // restore for later tests
});

test('a non-coordinator supplier is refused even WITH a host grant', async () => {
  await asOwner();
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1,$2,'family_helper',
             jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,
                                'remove_hosts',false,'areas',jsonb_build_object('seat_plan','view')),
             NOW())
     ON CONFLICT (event_id,user_id) DO NOTHING`,
    [F.eventId, F.caterUser],
  );
  await asUser(F.caterUser);
  await assert.rejects(
    () => db.query(`SELECT public.coordinator_seat_by_guest_qr($1,$2)`, [F.eventId, F.guestToken]),
    /not_the_coordinator/,
    'this is the floor coordinator’s tool, not every supplier’s',
  );
});

test('an unpublished plan answers nothing, however well shared', async () => {
  await asOwner();
  await db.query(`UPDATE public.event_floor_plan SET published_at = NULL WHERE event_id = $1`, [F.eventId]);
  await asUser(F.coordUser);
  await assert.rejects(
    () => db.query(`SELECT public.coordinator_seat_by_guest_qr($1,$2)`, [F.eventId, F.guestToken]),
    /not_published/,
  );
  await asOwner();
  await db.query(`UPDATE public.event_floor_plan SET published_at = NOW() WHERE event_id = $1`, [F.eventId]);
});

// ─── 3. What the lookup discloses ──────────────────────────────────────────

test('an unseated guest is found but seatless — distinct from unknown', async () => {
  await asUser(F.coordUser);
  const r = await db.query<{ out: { found: boolean; table_label: string | null } }>(
    `SELECT public.coordinator_seat_by_guest_qr($1,$2) AS out`, [F.eventId, F.otherToken],
  );
  assert.equal(r.rows[0]!.out.found, true);
  assert.equal(r.rows[0]!.out.table_label, null, 'the seating plan fixes this, not the couple');
});

test('a token from another event resolves to nothing', async () => {
  await asOwner();
  const other = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Other','birthday') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  const strayToken = fakeToken('0123456789abcdef');
  await db.query(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, qr_token) VALUES ($1,'X','Y','both','friends',$2)`,
    [other, strayToken],
  );
  await asUser(F.coordUser);
  const r = await db.query<{ out: { found: boolean } }>(
    `SELECT public.coordinator_seat_by_guest_qr($1,$2) AS out`, [F.eventId, strayToken],
  );
  assert.equal(r.rows[0]!.out.found, false);
});

test('a malformed token is rejected without touching a table', async () => {
  await asUser(F.coordUser);
  for (const bad of ['', 'not-a-token', fakeToken('a1b2').toUpperCase(), 'a1b2']) {
    const r = await db.query<{ out: { found: boolean } }>(
      `SELECT public.coordinator_seat_by_guest_qr($1,$2) AS out`, [F.eventId, bad],
    );
    assert.equal(r.rows[0]!.out.found, false, `"${bad}" must not resolve`);
  }
});

// ─── 4. The ask ────────────────────────────────────────────────────────────

test('a booked coordinator can ask, in their own name only', async () => {
  await asUser(F.coordUser);
  await db.query(
    `INSERT INTO public.event_access_requests
       (event_id, requester_user_id, vendor_profile_id, requested_areas, note)
     VALUES ($1,$2,$3, ARRAY['schedule']::text[], 'Need to call the running order')`,
    [F.eventId, F.coordUser, F.coordVendor],
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_access_requests (event_id, requester_user_id, requested_areas)
         VALUES ($1,$2, ARRAY['budget']::text[])`,
        [F.eventId, F.caterUser],
      ),
    /row-level security|policy|violates check/i,
    'nobody may file in someone else’s name',
  );
});

test('only ONE ask can be open at a time', async () => {
  await asUser(F.coordUser);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_access_requests (event_id, requester_user_id, requested_areas)
         VALUES ($1,$2, ARRAY['guest_list']::text[])`,
        [F.eventId, F.coordUser],
      ),
    /duplicate key|unique/i,
    'a coordinator must not be able to drown the host in asks',
  );
});

test('an ask for an area the host cannot grant is refused by the CHECK', async () => {
  await asOwner();
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_access_requests (event_id, requester_user_id, requested_areas)
         VALUES ($1,$2, ARRAY['nuclear_codes']::text[])`,
        [F.eventId, F.caterUser],
      ),
    /violates check/i,
  );
});

test('a supplier cannot read another supplier’s asks', async () => {
  await asUser(F.caterUser);
  const r = await db.query(
    `SELECT request_id FROM public.event_access_requests WHERE event_id = $1`, [F.eventId],
  );
  assert.equal(r.rows.length, 0, 'who asked the couple for what is not other suppliers’ business');
});

test('the host sees the ask on their event', async () => {
  await asUser(F.host);
  const r = await db.query<{ requested_areas: string[] }>(
    `SELECT requested_areas FROM public.event_access_requests WHERE event_id = $1`, [F.eventId],
  );
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.rows[0]!.requested_areas, ['schedule']);
});

test('the asker cannot answer their own ask', async () => {
  // The withdraw policy's USING lets them reach their own pending row, but its
  // WITH CHECK admits only status='withdrawn' — so self-approval is REFUSED
  // outright rather than silently updating nothing. This is the test that would
  // catch a coordinator granting themselves the schedule.
  await asUser(F.coordUser);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.event_access_requests
           SET status='answered', decisions='{"schedule":"granted"}'::jsonb
         WHERE event_id=$1`,
        [F.eventId],
      ),
    /row-level security|policy/i,
    'answering is the host’s alone',
  );
});

test('the asker CAN withdraw their own ask', async () => {
  await asUser(F.coordUser);
  const r = await db.query(
    `UPDATE public.event_access_requests SET status='withdrawn'
     WHERE event_id=$1 AND requester_user_id=$2 RETURNING request_id`,
    [F.eventId, F.coordUser],
  );
  assert.equal(r.rows.length, 1);
});

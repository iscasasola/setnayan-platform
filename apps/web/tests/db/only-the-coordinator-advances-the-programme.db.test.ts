/**
 * ONLY THE COORDINATOR MAY ADVANCE THE PROGRAMME — asserted against the
 * DATABASE, by calling the RPC directly.
 *
 * ## Why this test calls `advance_schedule_block` and not the server action
 *
 * The TypeScript narrowing (`lib/run-of-show-advance.ts`) shipped first and
 * already refuses a caterer. A test that drives the server action would
 * therefore have passed BEFORE migration 20271227867922 existed — it proves the
 * narrowing, not the enforcement. The gap was never in the action: the RPC is
 * SECURITY DEFINER with EXECUTE granted to `authenticated`, so a booked caterer
 * holding a session token could reach it straight over PostgREST, never loading
 * a screen and never calling an action. **A server action is a public HTTP
 * endpoint; the boundary is the function underneath it.** So every test below
 * issues `SELECT public.advance_schedule_block($1)` as the role in question.
 *
 * ## The two ways a refusal here could be success-shaped, and what stops them
 *
 * 1 · **This RPC is single-winner and idempotent by design.** `'already'` and
 *     `'noop_live_in_progress'` are benign successes that return WITHOUT error.
 *     So "the call came back and nothing happened" is a state a permitted
 *     caller reaches routinely. Every refusal test therefore asserts TWO things:
 *     the call RAISED 42501 `not_on_this_event`, and — snapshotted before and
 *     after — **the run-state did not move.**
 * 2 · **A zero-row UPDATE raises nothing.** Had the refusal been expressed as a
 *     predicate that simply matched no rows, "you may not" and "somebody else
 *     already did" would be the same observation. `refused_and_noop_are_not_the
 *     _same_observation` pins them apart: the same block, the same moment, one
 *     caller raises and the other gets a JSON status.
 *
 * ## The fixture is a state production can actually produce
 *
 * The delegate carries an `event_moderators` row and NO `event_members` row —
 * which is not a convenience, it is the real shape: `lib/coordinator-grant.ts`
 * auto-grants the booked planner by writing `event_moderators` ALONE. That is
 * the exact state migration 20270917100000 was written for. Giving the delegate
 * a member row would have made `current_event_ids()` admit them and the delegate
 * arm would never have been exercised at all.
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

const F = {
  eventId: '',
  couple: '',
  admin: '',
  delegateEdit: '',
  delegateView: '',
  coordUser: '',
  caterUser: '',
  guest: '',
  blocks: [] as string[],
};

type StateRow = { label: string; run_state: string; actual_start_at: string | null };

/** The whole observable run-state of the timeline, ordered. */
async function timeline(): Promise<StateRow[]> {
  await asOwner();
  const r = await db.query<StateRow>(
    `SELECT label, run_state::text AS run_state, actual_start_at::text AS actual_start_at
       FROM public.event_schedule_blocks
      WHERE event_id = $1
      ORDER BY sort_order`,
    [F.eventId],
  );
  return r.rows;
}

/** Put every block back to 'upcoming' so each arm starts from the same place. */
async function resetTimeline(): Promise<void> {
  await asOwner();
  await db.query(
    `UPDATE public.event_schedule_blocks
        SET run_state = 'upcoming', actual_start_at = NULL, actual_end_at = NULL
      WHERE event_id = $1`,
    [F.eventId],
  );
}

/** What `moderator_area_level(event,'schedule')` says about this user. */
async function areaLevelAs(uid: string): Promise<string | null> {
  await asUser(uid);
  const r = await db.query<{ lvl: string | null }>(
    `SELECT public.moderator_area_level($1,'schedule') AS lvl`,
    [F.eventId],
  );
  return r.rows[0]!.lvl;
}

/** What arm 1 (`current_event_ids()`) sees for this user. */
async function currentEventIdsAs(uid: string): Promise<string[]> {
  await asUser(uid);
  const r = await db.query<{ event_id: string }>(`SELECT public.current_event_ids() AS event_id`);
  return r.rows.map((x) => x.event_id);
}

/**
 * Run `body` with this user's `event_members` row temporarily removed, then put
 * it back exactly as it was. Used ONLY to isolate an arm that arm 1 would
 * otherwise answer first — never to manufacture a state and then claim it.
 */
async function withoutMemberRow(uid: string, body: () => Promise<void>): Promise<void> {
  await asOwner();
  const saved = await db.query<{ member_type: string }>(
    `DELETE FROM public.event_members WHERE event_id=$1 AND user_id=$2
     RETURNING member_type::text AS member_type`,
    [F.eventId, uid],
  );
  assert.equal(saved.rows.length, 1, 'the row this helper exists to move must actually be there');
  try {
    await body();
  } finally {
    await asOwner();
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type)
       VALUES ($1,$2,$3::public.member_type) ON CONFLICT (event_id,user_id) DO NOTHING`,
      [F.eventId, uid, saved.rows[0]!.member_type],
    );
  }
}

/** Call the RPC AS the given user and return its JSON envelope. */
async function advanceAs(uid: string, blockId: string): Promise<{ status: string }> {
  await asUser(uid);
  const r = await db.query<{ out: { status: string } }>(
    `SELECT public.advance_schedule_block($1) AS out`,
    [blockId],
  );
  return r.rows[0]!.out;
}

/**
 * Assert the RPC refuses this caller AND that nothing moved.
 * Both halves are required — see the docblock's failure shape #1.
 */
async function assertRefusedAndStill(uid: string, blockId: string, who: string): Promise<void> {
  const before = await timeline();
  await asUser(uid);
  await assert.rejects(
    () => db.query(`SELECT public.advance_schedule_block($1)`, [blockId]),
    /not_on_this_event/,
    `${who} must be refused BY THE DATABASE, explicitly`,
  );
  const after = await timeline();
  assert.deepEqual(
    after,
    before,
    `${who} was refused but the timeline moved anyway — the refusal did not hold`,
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;

  F.couple = await mkUser('couple@ros.test');
  F.admin = await mkUser('admin@ros.test');
  F.delegateEdit = await mkUser('delegate-edit@ros.test');
  F.delegateView = await mkUser('delegate-view@ros.test');

  F.eventId = (
    await db.query<{ event_id: string }>(
      // A WEDDING, not a generic event: `events_wedding_fields_consistency` is a
      // biconditional, so ceremony_type + venue_setting are required here and
      // forbidden elsewhere. This row is the thing the gate protects.
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
       VALUES ('Run of Show','wedding','catholic','banquet_hall')
       RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [F.eventId, F.couple],
  );

  // An admin the way is_admin() ACTUALLY reads it: public.users.account_type.
  await db.query(
    `INSERT INTO public.users (user_id, email, account_type) VALUES ($1,$2,'admin')
     ON CONFLICT (user_id) DO UPDATE SET account_type = 'admin'`,
    [F.admin, 'admin@ros.test'],
  );

  // Two delegates, NEITHER with an event_members row (see docblock): one with
  // schedule:'edit', one with schedule:'view'. The second exists so the arm is
  // shown to be level-sensitive rather than "any accepted delegate".
  for (const [uid, level] of [
    [F.delegateEdit, 'edit'],
    [F.delegateView, 'view'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_moderators
         (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1,$2,'wedding_planner_external',
               jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,
                                  'remove_hosts',false,
                                  'areas', jsonb_build_object('schedule',$3::text)),
               NOW())
       ON CONFLICT (event_id,user_id) DO UPDATE
         SET permissions_json = EXCLUDED.permissions_json, removed_at = NULL`,
      [F.eventId, uid, level],
    );
  }

  // Two BOOKED marketplace suppliers on the same wedding, identical in every
  // way the old gate could see: same 'contracted' status, same reach. The ONLY
  // difference is the coordinator tile in `services` — which is precisely the
  // one predicate `current_coordinator_booked_event_ids()` adds.
  for (const [key, email, services, category] of [
    ['coord', 'coord@ros.test', ['coordinator'], 'planner_coordinator'],
    ['cater', 'cater@ros.test', ['catering'], 'catering'],
  ] as const) {
    const uid = await mkUser(email);
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
    if (key === 'coord') F.coordUser = uid;
    else F.caterUser = uid;
  }

  // A wedding GUEST who scanned the QR — `app/join/[eventId]/actions.ts` writes
  // exactly this row. Present for section 4 below, which is a measurement of a
  // gap this row did NOT close, not a claim that it did.
  F.guest = await mkUser('guest@ros.test');
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Ana','Cruz','both','friends') RETURNING guest_id`,
    [F.eventId],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type, joined_via, guest_id)
     VALUES ($1,$2,'guest','qr_scan',$3)`,
    [F.eventId, F.guest, g.rows[0]!.guest_id],
  );

  // Three blocks, all 'upcoming'.
  for (const [i, label] of ['Processional', 'Ceremony', 'First dance'].entries()) {
    const b = await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, sort_order)
       VALUES ($1,$2, NOW() + make_interval(hours => $3::int), $3::int) RETURNING block_id`,
      [F.eventId, label, i + 1],
    );
    F.blocks.push(b.rows[0]!.block_id);
  }
});

after(async () => {
  await db?.close?.();
});

// ─── 0 · Posture ───────────────────────────────────────────────────────────

test('the RPC is reachable by `authenticated` — so its own gate is the boundary', async () => {
  const r = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.role_routine_grants
      WHERE routine_schema='public' AND routine_name='advance_schedule_block'
      ORDER BY grantee`,
  );
  const grantees = r.rows.map((x) => x.grantee);
  assert.ok(
    grantees.includes('authenticated'),
    'the couple and the coordinator need it; this is why the gate cannot live in a screen',
  );
  assert.ok(!grantees.includes('anon'), 'and it must never be reachable signed-out');
  assert.ok(!grantees.includes('PUBLIC'), 'REVOKE FROM PUBLIC alone is not enough — see 2026-07-26');
});

test('the vendor arm in the live catalogue is the COORDINATOR helper', async () => {
  // Secondary to the behavioural tests below, kept because it names the swap in
  // one line when one of them goes red.
  const r = await db.query<{ src: string }>(
    `SELECT p.prosrc AS src FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='advance_schedule_block'`,
  );
  const src = r.rows[0]!.src;
  assert.ok(
    src.includes('current_coordinator_booked_event_ids()'),
    'the narrowed helper must be the one the gate calls',
  );
  assert.ok(
    !src.includes('current_vendor_booked_event_ids()'),
    'EVERY booked supplier must no longer be an arm of this gate',
  );
});

// ─── 1 · THE NARROWING: the arm that moved ─────────────────────────────────

test('a booked CATERER cannot advance the programme', async () => {
  await resetTimeline();
  await assertRefusedAndStill(F.caterUser, F.blocks[0]!, 'a booked caterer');
});

test('a booked caterer cannot finish the block that is already running either', async () => {
  // The refusal must not depend on which branch of the RPC the call would land
  // in. Start the timeline legitimately, then let the caterer try to END it —
  // the ADVANCE branch, not the START branch.
  await resetTimeline();
  assert.equal((await advanceAs(F.coordUser, F.blocks[0]!)).status, 'started');
  await assertRefusedAndStill(F.caterUser, F.blocks[0]!, 'a booked caterer, mid-ceremony');
});

test('the booked COORDINATOR can — and the timeline actually moves', async () => {
  await resetTimeline();
  assert.equal((await advanceAs(F.coordUser, F.blocks[0]!)).status, 'started');

  let now = await timeline();
  assert.equal(now[0]!.run_state, 'live', 'the first block went live');
  assert.ok(now[0]!.actual_start_at, 'and it was stamped');

  assert.equal((await advanceAs(F.coordUser, F.blocks[0]!)).status, 'ok');
  now = await timeline();
  assert.deepEqual(
    now.map((b) => b.run_state),
    ['done', 'live', 'upcoming'],
    'the coordinator finished one block and lit the next',
  );
});

test('refused and no-op are NOT the same observation', async () => {
  // Failure shape #2: had the refusal been a predicate that matched no rows,
  // these two calls would be indistinguishable. Same block, same instant.
  await resetTimeline();
  await advanceAs(F.coordUser, F.blocks[0]!); // block 0 is now live
  await advanceAs(F.coordUser, F.blocks[0]!); // block 0 is now done

  const benign = await advanceAs(F.coordUser, F.blocks[0]!);
  assert.equal(benign.status, 'already', 'a permitted caller re-tapping gets a STATUS, not an error');

  await asUser(F.caterUser);
  await assert.rejects(
    () => db.query(`SELECT public.advance_schedule_block($1)`, [F.blocks[0]!]),
    /not_on_this_event/,
    'a refused caller gets an ERROR on the very same already-done block',
  );
});

test('the 42501 refusal is raised BEFORE any row is touched', async () => {
  await resetTimeline();
  await asUser(F.caterUser);
  const code = await db
    .query(`SELECT public.advance_schedule_block($1)`, [F.blocks[0]!])
    .then(() => null)
    .catch((e: unknown) => (e as { code?: string }).code ?? null);
  assert.equal(code, '42501', 'an authorisation refusal, not an incidental failure');
  assert.deepEqual(
    (await timeline()).map((b) => b.run_state),
    ['upcoming', 'upcoming', 'upcoming'],
  );
});

// ─── 2 · THE THREE ARMS THAT MUST NOT BREAK ────────────────────────────────

test('arm 1 · the couple still advances their own wedding', async () => {
  await resetTimeline();
  assert.equal((await advanceAs(F.couple, F.blocks[0]!)).status, 'started');
  assert.equal((await timeline())[0]!.run_state, 'live');
});

test('arm 2 · a delegate with schedule:edit still advances — through arm 2 ALONE', async () => {
  // The member row is dropped for the duration so this proves the DELEGATE arm
  // and not arm 1. It has to be: `sync_delegate_membership` (20271161203067)
  // mints an `event_members` row for EVERY accepted delegate, so in the
  // production state arm 1 answers first and arm 2 is never reached. Testing
  // the arm means isolating it.
  await resetTimeline();
  await withoutMemberRow(F.delegateEdit, async () => {
    const ids = await currentEventIdsAs(F.delegateEdit);
    assert.deepEqual(ids, [], 'arm 1 is out of the way for this assertion');
    assert.equal(await areaLevelAs(F.delegateEdit), 'edit');
    assert.equal((await advanceAs(F.delegateEdit, F.blocks[0]!)).status, 'started');
  });
  assert.equal((await timeline())[0]!.run_state, 'live');
});

test('arm 2 is level-sensitive · schedule:view is not schedule:edit', async () => {
  await resetTimeline();
  await withoutMemberRow(F.delegateView, async () => {
    assert.equal(await areaLevelAs(F.delegateView), 'view');
    await assertRefusedAndStill(F.delegateView, F.blocks[0]!, 'a view-only delegate');
  });
});

test('arm 4 · an admin still advances', async () => {
  await resetTimeline();
  assert.equal((await advanceAs(F.admin, F.blocks[0]!)).status, 'started');
  assert.equal((await timeline())[0]!.run_state, 'live');
});

// ─── 3 · The narrowing is about the TILE, not about the booking ────────────

test('the caterer IS booked — being booked is exactly what stopped being enough', async () => {
  // Without this, "the caterer was refused" could be explained by a broken
  // fixture rather than by the gate. The caterer's booking is real: the OLD arm
  // would have admitted them.
  await asUser(F.caterUser);
  const wide = await db.query<{ event_id: string }>(
    `SELECT public.current_vendor_booked_event_ids() AS event_id`,
  );
  assert.deepEqual(
    wide.rows.map((x) => x.event_id),
    [F.eventId],
    'the retired arm would have waved this caterer straight through',
  );
  const narrow = await db.query<{ event_id: string }>(
    `SELECT public.current_coordinator_booked_event_ids() AS event_id`,
  );
  assert.equal(narrow.rows.length, 0, 'the arm in force does not');
});

test('and the coordinator is admitted by that same narrow helper', async () => {
  await asUser(F.coordUser);
  const narrow = await db.query<{ event_id: string }>(
    `SELECT public.current_coordinator_booked_event_ids() AS event_id`,
  );
  assert.deepEqual(narrow.rows.map((x) => x.event_id), [F.eventId]);
});

// ─── 4 · ⚠ THE GAP THIS ROW DID NOT CLOSE — measured, not assumed ──────────
//
// 🚨 ARM 1 IS `current_event_ids()`, WHICH IS *ANY* `event_members` ROW.
// Narrowing the vendor arm closed the caterer's door and left this one open:
// membership is not a permission grid, and three kinds of caller hold a row —
//   · the couple (correct — this is the arm's purpose),
//   · EVERY accepted delegate, at ANY permission level, because
//     `sync_delegate_membership` (20271161203067) mints member_type
//     'coordinator' on accept regardless of what the host granted,
//   · EVERY GUEST WHO SCANNED THE EVENT QR — `app/join/[eventId]/actions.ts`
//     inserts member_type 'guest'.
//
// So a wedding guest with a session token can still advance the programme over
// PostgREST. `decideMayAdvance` (lib/run-of-show-advance-gate.ts) already
// refuses both — it requires member_type === 'couple' and says so in its own
// docblock — so NOTHING reaches this through the app. It is the same shape as
// the caterer gap: the screen and the action are narrow, the function granted
// to `authenticated` underneath them is not.
//
// The tests below assert what the database ACTUALLY does today. They are
// deliberately not written as "must be refused": that would be a red test
// describing work nobody has scheduled. They will go RED the moment arm 1 is
// narrowed — at which point delete them and this comment, because the gap is
// gone. That is the intended failure mode: this is the marker, and it is
// greppable.

test('⚠ KNOWN GAP · a QR-scanned GUEST can advance the programme over the RPC', async () => {
  await resetTimeline();
  assert.deepEqual(
    await currentEventIdsAs(F.guest),
    [F.eventId],
    'arm 1 admits them: a guest membership row is a membership row',
  );
  const res = await advanceAs(F.guest, F.blocks[0]!);
  assert.equal(res.status, 'started', 'MEASURED, not endorsed — see the section comment');
  assert.equal((await timeline())[0]!.run_state, 'live', 'a guest moved somebody’s wedding');
});

test('⚠ KNOWN GAP · a view-only delegate gets in through arm 1, not arm 2', async () => {
  await resetTimeline();
  assert.equal(await areaLevelAs(F.delegateView), 'view', 'the grid says view');
  assert.deepEqual(
    await currentEventIdsAs(F.delegateView),
    [F.eventId],
    'but accepting minted a coordinator MEMBER row, and arm 1 asks nothing else',
  );
  assert.equal((await advanceAs(F.delegateView, F.blocks[0]!)).status, 'started');
});

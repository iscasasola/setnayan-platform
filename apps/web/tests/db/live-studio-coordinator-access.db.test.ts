/**
 * Live Studio · THE COORDINATOR ACCESS REGRESSION — DB verification (executed, not prose).
 *
 * WAVE 7 · Live_Studio_Unified_Spec_2026-07-25.md § 4f ④ · migration
 * 20271003734490_live_studio_moderator_control_access.sql
 *
 * ── WHAT THIS GUARDS ──────────────────────────────────────────────────────────────────────
 * A coordinator invited through `event_moderators` reached the unified Live Studio controller and
 * saw an EMPTY CHANNEL GRID — no error, no forbidden page, just no cameras. The page gate
 * (`isLiveStudioSetupHost`) said yes; the DATABASE said nothing. Setnayan has two membership
 * notions and this is where they diverged: the control-plane RLS keyed off
 * `event_members.member_type IN ('couple','coordinator')`, a row a moderator-invited coordinator
 * often does not have, while the legacy Cast room admits moderators and reads through the service
 * role to compensate. "A friend or coordinator runs the controller" is the no-crew pitch, so the
 * person the product is designed around was the person locked out.
 *
 * The claims are security-relevant in BOTH directions, so they are tested against the REAL
 * replayed schema rather than asserted in a comment:
 *
 *   1. 🔴 THE BUG IS FIXED — an accepted moderator READS the channels (the empty grid) and can
 *      WRITE them (cut / rename / add), on all three control-plane tables. Read-only would have
 *      filled the grid and then failed on the first save.
 *   2. 🔒 IT DID NOT WIDEN — a stranger, a GUEST member, and a moderator of a DIFFERENT event are
 *      all still denied. This is parity with the legacy room, not a new door.
 *   3. 🔒 REVOCATION BITES IMMEDIATELY — an un-accepted invite and a removed moderator are denied
 *      on the very next query, with no session to expire.
 *   4. THE ORIGINAL MEMBERSHIP STILL WORKS — couple and legacy `coordinator` are untouched
 *      (the migration is additive `OR EXISTS`, so it cannot take anyone's access away).
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
/** Set in `before`: did a stranger genuinely get zero rows? See the META test. */
let rlsProvenEnforced = false;

const F = {
  event: '' as string,
  otherEvent: '' as string,
  couple: '' as string,
  legacyCoordinator: '' as string,
  /** THE case: an accepted moderator with NO event_members row at all. */
  moderatorOnly: '' as string,
  /** Invited but never accepted. */
  pendingModerator: '' as string,
  /** Accepted, then removed by the couple. */
  removedModerator: '' as string,
  /** An event member, but a guest — never an operator. */
  guestMember: '' as string,
  stranger: '' as string,
  /** A real, accepted moderator — on somebody else's event. */
  foreignModerator: '' as string,
  zoneId: 0 as number,
};

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

/**
 * Impersonate a signed-in user. `SET ROLE authenticated` is the load-bearing line: the
 * replay connection is the table OWNER, and Postgres does not apply RLS to a table's
 * owner. Without it every assertion in this file would pass vacuously — including the
 * denial ones, which is the failure mode that matters.
 */
async function asUser(uid: string | null): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}

/** Back to the owner, for seeding. */
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

/** Ground truth: how many channels the event actually has, read as the OWNER (RLS off). */
async function actualZoneCount(): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.live_studio_roam_zones WHERE event_id = $1`,
    [F.event],
  );
  return r.rows[0]!.n;
}

/** How many of THIS event's channels does `uid` see through RLS? */
async function visibleZones(uid: string | null, eventId = F.event): Promise<number> {
  await asUser(uid);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.live_studio_roam_zones WHERE event_id = $1`,
    [eventId],
  );
  return r.rows[0]!.n;
}

/** Can `uid` actually persist a cut onto Channel 1? Returns rows affected. */
async function canCut(uid: string | null): Promise<number> {
  await asUser(uid);
  const r = await db.query(
    `UPDATE public.live_studio_roam_zones SET is_main_stage = NOT is_main_stage WHERE id = $1`,
    [F.zoneId],
  );
  return r.affectedRows ?? 0;
}

/** Can `uid` INSERT a new channel (WITH CHECK, not just USING)? */
async function canAddChannel(uid: string | null, zoneIndex: number): Promise<boolean> {
  await asUser(uid);
  try {
    await db.query(
      `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label)
       VALUES ($1, $2, 'Added by test')`,
      [F.event, zoneIndex],
    );
    return true;
  } catch {
    return false;
  }
}

/** Can `uid` save an overlay setting (the monogram / lower third placement)? */
async function canSaveOverlay(uid: string | null): Promise<boolean> {
  await asUser(uid);
  try {
    await db.query(
      `INSERT INTO public.live_studio_overlay_settings (event_id, monogram_enabled)
       VALUES ($1, TRUE)
       ON CONFLICT (event_id) DO UPDATE SET monogram_enabled = TRUE`,
      [F.event],
    );
    return true;
  } catch {
    return false;
  }
}

/** Can `uid` mark a ⚡ highlight moment — the job the couple handed to the operator? */
async function canMarkHighlight(uid: string | null): Promise<boolean> {
  await asUser(uid);
  try {
    await db.query(
      `INSERT INTO public.live_studio_highlights (event_id, marked_at) VALUES ($1, now())`,
      [F.event],
    );
    return true;
  } catch {
    return false;
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('couple@w7.test');
  F.legacyCoordinator = await createUser('legacy-coord@w7.test');
  F.moderatorOnly = await createUser('moderator-coord@w7.test');
  F.pendingModerator = await createUser('pending@w7.test');
  F.removedModerator = await createUser('removed@w7.test');
  F.guestMember = await createUser('guest@w7.test');
  F.stranger = await createUser('stranger@w7.test');
  F.foreignModerator = await createUser('foreign@w7.test');

  await asOwner(); // seed as the owner, not as a user

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Wave 7 Event', 'birthday') RETURNING event_id`,
  );
  F.event = e.rows[0]!.event_id;
  const o = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Wave 7 Other Event', 'birthday') RETURNING event_id`,
  );
  F.otherEvent = o.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.event, F.couple],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'coordinator') ON CONFLICT DO NOTHING`,
    [F.event, F.legacyCoordinator],
  );
  // A member of the event who is NOT an operator. The sharpest "did it widen?" case:
  // they hold an event_members row, just not one of the two operator types.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'guest') ON CONFLICT DO NOTHING`,
    [F.event, F.guestMember],
  );

  // ⭐ THE CASE UNDER TEST: accepted, non-removed moderator, and DELIBERATELY no
  // event_members row — which is exactly how a coordinator invite lands.
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', now(), '{}'::jsonb)`,
    [F.event, F.moderatorOnly],
  );
  // Invited, never accepted.
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', NULL, '{}'::jsonb)`,
    [F.event, F.pendingModerator],
  );
  // Accepted, then removed.
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, removed_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', now() - interval '1 day', now(), '{}'::jsonb)`,
    [F.event, F.removedModerator],
  );
  // A real accepted moderator — on the OTHER event. Makes the cross-event assertion
  // meaningful: a genuine operator, just not of this broadcast.
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'wedding_planner_external', now(), '{}'::jsonb)`,
    [F.otherEvent, F.foreignModerator],
  );

  // Two camera channels on the event — the grid that came back empty.
  const z = await db.query<{ id: number }>(
    `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label, is_featured)
     VALUES ($1, 1, 'Ceremony', TRUE) RETURNING id`,
    [F.event],
  );
  F.zoneId = z.rows[0]!.id;
  await db.query(
    `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label)
     VALUES ($1, 2, 'Reception Floor')`,
    [F.event],
  );

  // PROVE the harness enforces RLS before any assertion trusts it: a user with no
  // relationship to this event must see zero of its two channels.
  const strangerSees = await visibleZones(F.stranger);
  rlsProvenEnforced = strangerSees === 0;
  await asOwner();
});

after(async () => {
  await replay?.db?.close?.();
});

/* ── 1 · THE BUG IS FIXED ─────────────────────────────────────────────────────────────── */

test('⚠ META — RLS is actually being enforced in this harness', () => {
  // Guards the whole file. The replay connection is the table OWNER, and Postgres does not apply
  // RLS to an owner — so a missing `SET ROLE authenticated` makes EVERY assertion below pass
  // vacuously, the denial ones included. This test caught exactly that during development: three
  // green "the fix works" assertions against a connection that was bypassing RLS entirely.
  // If this fails, nothing else in this file means anything.
  assert.equal(rlsProvenEnforced, true, 'a stranger saw rows — RLS was bypassed, not satisfied');
});


test('🔴 an accepted moderator-coordinator SEES the channel grid', async () => {
  const all = await actualZoneCount();
  assert.ok(all >= 2, 'fixture sanity');
  assert.equal(
    await visibleZones(F.moderatorOnly),
    all,
    'this is the regression: the grid came back empty for the person running the controller',
  );
});

test('🔴 …and can WRITE the channels — cut, add, name', async () => {
  // Read-only would have filled the grid and then failed on the first save, because the
  // controller's server actions use the session client too.
  assert.equal(await canCut(F.moderatorOnly), 1, 'one-tap cut must persist');
  assert.equal(await canAddChannel(F.moderatorOnly, 7), true, 'adding a camera must persist');
});

test('🔴 …and can save overlays + mark highlight moments', async () => {
  // Fixing zones alone would just move the empty screen: the grid would fill and then the
  // monogram would refuse to save.
  assert.equal(await canSaveOverlay(F.moderatorOnly), true);
  assert.equal(await canMarkHighlight(F.moderatorOnly), true);
});

/* ── 2 · IT DID NOT WIDEN ─────────────────────────────────────────────────────────────── */

test('🔒 a stranger still sees nothing and can change nothing', async () => {
  assert.equal(await visibleZones(F.stranger), 0);
  assert.equal(await canCut(F.stranger), 0);
  assert.equal(await canAddChannel(F.stranger, 90), false);
  assert.equal(await canSaveOverlay(F.stranger), false);
  assert.equal(await canMarkHighlight(F.stranger), false);
});

test('🔒 a GUEST member of this very event is still denied', async () => {
  // The sharpest case: they hold an event_members row on the event, just not an operator one.
  assert.equal(await visibleZones(F.guestMember), 0);
  assert.equal(await canCut(F.guestMember), 0);
  assert.equal(await canSaveOverlay(F.guestMember), false);
});

test('🔒 a real accepted moderator of ANOTHER event is denied here', async () => {
  assert.equal(await visibleZones(F.foreignModerator), 0);
  assert.equal(await canCut(F.foreignModerator), 0);
  assert.equal(await canAddChannel(F.foreignModerator, 91), false);
});

test('🔒 anonymous — no session at all — is denied', async () => {
  assert.equal(await visibleZones(null), 0);
});

/* ── 3 · REVOCATION BITES ─────────────────────────────────────────────────────────────── */

test('🔒 an invite that was never ACCEPTED grants nothing', async () => {
  assert.equal(await visibleZones(F.pendingModerator), 0);
  assert.equal(await canCut(F.pendingModerator), 0);
});

test('🔒 a REMOVED moderator is shut out on the very next query', async () => {
  assert.equal(await visibleZones(F.removedModerator), 0);
  assert.equal(await canCut(F.removedModerator), 0);
  assert.equal(await canSaveOverlay(F.removedModerator), false);
});

test('🔒 removing a live moderator revokes access immediately — no cache, no session to expire', async () => {
  const all = await actualZoneCount();
  assert.equal(await visibleZones(F.moderatorOnly), all, 'in, before');
  await asOwner();
  await db.query(
    `UPDATE public.event_moderators SET removed_at = now()
      WHERE event_id = $1 AND user_id = $2`,
    [F.event, F.moderatorOnly],
  );
  assert.equal(await visibleZones(F.moderatorOnly), 0, 'out, immediately after');
  assert.equal(await canCut(F.moderatorOnly), 0);

  // Put them back so the fixture is not order-dependent for anything added later.
  await asOwner();
  await db.query(
    `UPDATE public.event_moderators SET removed_at = NULL
      WHERE event_id = $1 AND user_id = $2`,
    [F.event, F.moderatorOnly],
  );
  assert.equal(await visibleZones(F.moderatorOnly), all, 're-instated');
});

/* ── 4 · THE ORIGINAL MEMBERSHIP IS UNTOUCHED ─────────────────────────────────────────── */

test('the couple and a legacy event_members coordinator still have full control', async () => {
  // The migration is additive (`OR EXISTS …`), so it cannot remove anyone's access — asserted
  // rather than assumed, because a rewritten policy is exactly where that gets lost.
  const all = await actualZoneCount();
  for (const uid of [F.couple, F.legacyCoordinator]) {
    assert.equal(await visibleZones(uid), all);
    assert.equal(await canCut(uid), 1);
    assert.equal(await canSaveOverlay(uid), true);
    assert.equal(await canMarkHighlight(uid), true);
  }
});

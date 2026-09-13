/**
 * THE CHAIN'S ONE UNGUARDED INVARIANT — a zone that says 'live' must have a camera
 * that is actually beating. Executed against the real replayed schema, not prose.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * `live_studio_guest_rtc_can_access` clause (c) admitted ANY signed-in visitor to
 * `panood-guest:{eventId}` on the strength of two pieces of STORED state — a zone
 * row saying 'live' with a seat bound — written by a phone that was live at the
 * time and never unwritten by anything. Its own migration promised the opposite:
 * "the live-zone test means a dormant or finished event has no joinable topic at
 * all."
 *
 * The reason it did not hold is structural, not accidental.
 * `panood_camera_heartbeat`'s demotion sweep is CRON-FREE by design: one live
 * camera reports its dead neighbours. When the LAST camera on an event leaves,
 * there is no next heartbeat, so nothing ever demotes the final seat or its zone.
 * A finished wedding keeps a row saying 'live' forever.
 *
 * MEASURED IN PRODUCTION, 2026-09-01, before the fix — a uid that was not a
 * member, not a moderator and not an operator on the event:
 *
 *     select set_config('request.jwt.claims',
 *              '{"sub":"<that uid>","role":"authenticated"}', true),
 *            public.live_studio_guest_rtc_can_access('panood-guest:<event>');
 *     → TRUE
 *
 * on an event whose only 'live' zone was bound to a seat last seen 13,843 seconds
 * earlier — 230× the staleness window — with an EMPTY picker manifest and no
 * `panood_broadcasts` row in the platform's whole history. A second event with no
 * live zone returned FALSE in the same statement, so the predicate was being
 * exercised: this was not "true for everything".
 *
 * ── WHAT IS ASSERTED ────────────────────────────────────────────────────────
 *   1. NON-VACUITY FIRST — a genuinely beating camera admits a stranger, so every
 *      FALSE below is the rule firing and not a broken fixture.
 *   2. GONE QUIET — a seat past the window closes the channel with NO other camera
 *      needed to sweep it. The last-camera-to-leave case; the one that makes the
 *      finished-wedding promise true.
 *   3. THE WINDOW IS THE SHIPPED ONE — 59s in, 61s out, so it cannot drift from
 *      CHANNEL_STALE_MS / the RPC's INTERVAL '60 seconds' unnoticed.
 *   4. A SEAT THAT NEVER BEAT is dark — a NULL is not an admission.
 *   5. REISSUE AND REVOKE GO DARK BY THEMSELVES — not because this predicate asks
 *      about them, but because `panood_camera_heartbeat` REFUSES a pulled token, so
 *      the stamp freezes and crosses the window on its own. Asserted through the
 *      real RPC, so the mechanism is proved rather than assumed.
 *   6. THE CONTROL ROOM IS UNTOUCHED — couple, accepted moderator and the operator
 *      still reach the channel while it is dark, because watching what guests see
 *      BEFORE a camera is beating is the point of the testing path.
 *   7. THE HOST'S SWITCH STILL GATES, and no session is still refused.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT TEST, AND WHY.
 *   · "A live zone implies a CLAIMED, UN-REVOKED operator." Not this predicate's
 *     question. `tests/db/live-studio-guest-pick-authz.db.test.ts` records the
 *     decision in its own words — "a person whose camera was revoked is still a
 *     person who may watch the wedding" — and the claimed/un-revoked filter lives
 *     in ONE place, `fetchGuestPickCameras`, the roster this feature's
 *     enforced-by-omission containment is built on. A copy here would be a second
 *     forkable author of that rule. Test 5 above shows freshness reaches the same
 *     place within a minute, without the copy.
 *   · The ₱3,000 entitlement — `canPublishMultiCam`, asked once in the public-page
 *     loader. Restating a money rule in SQL is what Waves 3/5 refuse.
 *   · "An ended broadcast implies an empty manifest." ALREADY GUARDED, in the right
 *     place: `lib/live-studio-recordings.test.ts` → "⭐ teardown completes the rows
 *     and empties the manifest (picker tears down)", which carries its own
 *     anti-vacuity note. The manifest is written ONLY by `mirrorRoamManifest`
 *     because that function IS the paywall; a SQL trigger rebuilding it would be a
 *     second writer of a gated column.
 *   · "A written watch URL implies a broadcast row." NOT AN INVARIANT — false by
 *     design. The by-hand route (`lib/live-studio-manual-air.ts`, shipped for
 *     exactly this) has the host paste their own YouTube/Facebook link with no
 *     `panood_broadcasts` row at all. Asserting it would break a shipped feature.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TOKEN = 'tok-dark-camera-1';

const F = {
  event: '' as string,
  couple: '' as string,
  moderator: '' as string,
  operator: '' as string,
  stranger: '' as string,
  zoneId: 0 as number,
  cameraId: 0 as number,
};

const guestTopic = (eventId: string) => `panood-guest:${eventId}`;

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function mayJoin(uid: string | null): Promise<boolean> {
  await setAuthUid(db, uid);
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.live_studio_guest_rtc_can_access($1) AS ok`,
    [guestTopic(F.event)],
  );
  return r.rows[0]!.ok;
}

/** Call the REAL heartbeat RPC as a given session and return its status word. */
async function beat(uid: string | null, token: string = TOKEN): Promise<string> {
  await setAuthUid(db, uid);
  const r = await db.query<{ j: { status: string } }>(
    `SELECT public.panood_camera_heartbeat($1) AS j`,
    [token],
  );
  return r.rows[0]!.j.status;
}

/** Seat last_seen_at, as seconds ago. */
async function heartbeatAgeSeconds(): Promise<number | null> {
  await setAuthUid(db, null);
  const r = await db.query<{ age: number | null }>(
    `SELECT extract(epoch FROM (now() - last_seen_at))::float8 AS age
       FROM public.panood_camera_operators WHERE id = $1`,
    [F.cameraId],
  );
  return r.rows[0]!.age;
}

/**
 * Put the event back into "a phone is genuinely publishing right now" shape:
 * guest-pick on, zone live and bound, seat held by the operator, beating now.
 */
async function cameraIsBeating(): Promise<void> {
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET claim_qr_token = $2, claimer_user_id = $3, claimed_at = now(),
            revoked_at = NULL, status = 'live', last_seen_at = now()
      WHERE id = $1`,
    [F.cameraId, TOKEN, F.operator],
  );
  await db.query(
    `UPDATE public.live_studio_roam_zones
        SET status = 'live', camera_operator_id = $2
      WHERE id = $1`,
    [F.zoneId, F.cameraId],
  );
  await db.query(
    `UPDATE public.events SET live_studio_guest_pick_enabled = TRUE WHERE event_id = $1`,
    [F.event],
  );
}

/** Age the seat's heartbeat by N seconds without touching anything else. */
async function heartbeatAgedBySeconds(seconds: number): Promise<void> {
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET last_seen_at = now() - make_interval(secs => $2)
      WHERE id = $1`,
    [F.cameraId, seconds],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.couple = await createUser('couple@darkcamera.test');
  F.moderator = await createUser('moderator@darkcamera.test');
  F.operator = await createUser('operator@darkcamera.test');
  F.stranger = await createUser('stranger@darkcamera.test');

  await setAuthUid(db, null); // seed as the migration owner, not as a user

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, live_studio_guest_pick_enabled)
     VALUES ('Dark Camera Event', 'birthday', TRUE) RETURNING event_id`,
  );
  F.event = ev.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.event, F.couple],
  );
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'partner1', now(), '{}'::jsonb)`,
    [F.event, F.moderator],
  );

  const cam = await db.query<{ id: number }>(
    `INSERT INTO public.panood_camera_operators
       (event_id, camera_index, claim_qr_token, claimer_user_id, claimed_at, status, last_seen_at)
     VALUES ($1, 1, $2, $3, now(), 'live', now()) RETURNING id`,
    [F.event, TOKEN, F.operator],
  );
  F.cameraId = cam.rows[0]!.id;

  const zone = await db.query<{ id: number }>(
    `INSERT INTO public.live_studio_roam_zones
       (event_id, zone_index, label, status, camera_operator_id)
     VALUES ($1, 1, 'Aisle', 'live', $2) RETURNING id`,
    [F.event, F.cameraId],
  );
  F.zoneId = zone.rows[0]!.id;
});

after(async () => {
  await replay?.db?.close?.();
});

/* ── 1. Non-vacuity — the fixture CAN admit a stranger ─────────────────────── */

test('⭐ a genuinely beating camera admits a stranger (every FALSE below is the rule, not the fixture)', async () => {
  await cameraIsBeating();
  assert.equal(await mayJoin(F.stranger), true);
});

/* ── 2. The last camera to leave — no sweep will ever come ────────────────── */

test('⭐ a seat gone quiet closes the channel with NO other camera to sweep it', async () => {
  // THE LOAD-BEARING CASE, and the one measured in production. The demotion sweep
  // in panood_camera_heartbeat runs inside ANOTHER camera's heartbeat. This event
  // has exactly one camera, so nothing will ever demote it: the stored rows stay
  // 'live' forever and the old predicate admitted strangers on that alone.
  await cameraIsBeating();
  await heartbeatAgedBySeconds(13_843); // the production number, to the second

  const row = await db.query<{ status: string; zone_status: string }>(
    `SELECT c.status, z.status AS zone_status
       FROM public.panood_camera_operators c
       JOIN public.live_studio_roam_zones z ON z.camera_operator_id = c.id
      WHERE c.id = $1`,
    [F.cameraId],
  );
  assert.equal(row.rows[0]!.status, 'live', 'fixture: nothing demoted the seat');
  assert.equal(row.rows[0]!.zone_status, 'live', 'fixture: nothing demoted the zone');

  assert.equal(await mayJoin(F.stranger), false);
});

test('🔒 the staleness window is the SHIPPED 60s — 59s in, 61s out', async () => {
  // Pins the constant to CHANNEL_STALE_MS and to panood_camera_heartbeat's own
  // INTERVAL '60 seconds'. If any of the three moves alone, this fails.
  await cameraIsBeating();
  await heartbeatAgedBySeconds(59);
  assert.equal(await mayJoin(F.stranger), true, '59s old is still beating');

  await heartbeatAgedBySeconds(61);
  assert.equal(await mayJoin(F.stranger), false, '61s old is dark');
});

test('🔒 a seat that never beat at all is dark — a NULL is not an admission', async () => {
  await cameraIsBeating();
  await setAuthUid(db, null);
  await db.query(`UPDATE public.panood_camera_operators SET last_seen_at = NULL WHERE id = $1`, [
    F.cameraId,
  ]);
  assert.equal(await mayJoin(F.stranger), false);
});

/* ── 3. A pulled seat goes dark on its own — through the real RPC ─────────── */

test('⭐ REISSUE freezes the heartbeat: the RPC refuses the old token, so the channel closes itself', async () => {
  // This predicate never asks "is the seat claimed?" — the ROSTER owns that, and
  // live-studio-guest-pick-authz.db.test.ts records why. What is asserted here is
  // that freshness gets to the same place WITHOUT a second copy of the rule: after
  // a reissue the phone's beats stop landing, so the stamp can only go stale.
  await cameraIsBeating();
  assert.equal(await beat(F.operator), 'beating', 'sanity: the token beats while held');

  // Exactly what reissuePanoodCameraToken writes: new token, binding cleared,
  // revocation cleared, back to 'open'.
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET claim_qr_token = 'tok-dark-camera-reissued',
            claimer_user_id = NULL, claimed_at = NULL,
            revoked_at = NULL, status = 'open'
      WHERE id = $1`,
    [F.cameraId],
  );

  // The phone still holds the OLD token and keeps beating. The RPC refuses it.
  assert.equal(await beat(F.operator), 'invalid', 'a reissued seat rejects the old token');
  // …and the new token is not bound to that phone either, so it cannot beat with it.
  assert.equal(await beat(F.operator, 'tok-dark-camera-reissued'), 'invalid');

  // So the stamp is frozen. Once it crosses the window, the channel is closed —
  // with nothing in this predicate having asked about claims or revocation.
  await heartbeatAgedBySeconds(61);
  assert.equal(await mayJoin(F.stranger), false);
});

test('⭐ REVOKE freezes the heartbeat the same way', async () => {
  await cameraIsBeating();
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET revoked_at = now(), status = 'revoked' WHERE id = $1`,
    [F.cameraId],
  );

  assert.equal(await beat(F.operator), 'invalid', 'a revoked seat cannot beat');

  const ageBefore = await heartbeatAgeSeconds();
  assert.ok(ageBefore !== null && ageBefore >= 0, 'fixture: the stamp is still there');

  await heartbeatAgedBySeconds(61);
  assert.equal(await mayJoin(F.stranger), false);
});

/* ── 4. An unbound or non-live zone, unchanged behaviour ──────────────────── */

test('an unbound zone and a non-live zone both stay closed', async () => {
  await cameraIsBeating();
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.live_studio_roam_zones SET camera_operator_id = NULL WHERE id = $1`,
    [F.zoneId],
  );
  assert.equal(await mayJoin(F.stranger), false, 'unbound');

  await cameraIsBeating();
  await setAuthUid(db, null);
  await db.query(`UPDATE public.live_studio_roam_zones SET status = 'offline' WHERE id = $1`, [
    F.zoneId,
  ]);
  assert.equal(await mayJoin(F.stranger), false, 'zone offline');
});

/* ── 5. The control room is untouched in EVERY dark state ─────────────────── */

test('⭐ the couple, an accepted moderator and the operator still reach the channel while it is dark', async () => {
  // This is the half a tightening breaks. Testing the guest view BEFORE any camera
  // is beating is the whole point of the control-room clauses — if they went dark
  // with the cameras, a host could never rehearse.
  await cameraIsBeating();
  await heartbeatAgedBySeconds(13_843);

  assert.equal(await mayJoin(F.couple), true, 'legacy couple membership');
  assert.equal(await mayJoin(F.moderator), true, 'accepted moderator');
  assert.equal(await mayJoin(F.operator), true, 'the operator who holds the seat');
  assert.equal(await mayJoin(F.stranger), false, 'and the stranger is still out');
});

/* ── 6. The host's switch, and no session at all ──────────────────────────── */

test('guest-pick OFF closes the channel to strangers even with a perfect camera', async () => {
  await cameraIsBeating();
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.events SET live_studio_guest_pick_enabled = FALSE WHERE event_id = $1`,
    [F.event],
  );
  assert.equal(await mayJoin(F.stranger), false);
  assert.equal(await mayJoin(F.couple), true, 'the control room keeps its own way in');
});

test('no session is refused, and a malformed topic denies rather than throwing', async () => {
  await cameraIsBeating();
  assert.equal(await mayJoin(null), false);

  await setAuthUid(db, F.stranger);
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.live_studio_guest_rtc_can_access('panood-guest:not-a-uuid') AS ok`,
  );
  assert.equal(r.rows[0]!.ok, false);
});

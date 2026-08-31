/**
 * Live Studio Wave 10 · GUEST-PICK signaling authorization — DB verification
 * (executed, not prose).
 *
 * Guest-pick serves side cameras to wedding guests over plain peer-to-peer WebRTC.
 * Guests therefore need a signaling channel — and the one the host uses,
 * `panood-rtc:{eventId}`, is the one channel they must NEVER be on: that transport is
 * one-publisher → one-viewer per slot, so a guest answering an offer there would take
 * the camera away from the couple's own control room, mid-ceremony. Migration
 * 20270829134804 exists because exactly that hole was found once.
 *
 * Wave 10 therefore adds a SEPARATE topic, `panood-guest:{eventId}`, guarded by
 * `public.live_studio_guest_rtc_can_access(topic)` (migration 20271006520000). This
 * file tests that predicate against the REAL replayed schema:
 *
 *   1. SEPARATION — the guest predicate refuses `panood-rtc:` topics outright, and the
 *      host predicate refuses `panood-guest:` ones. Neither can be used to reach the
 *      other channel.
 *   2. CROSS-EVENT — a guest admitted to event A gets nothing on event B. This is the
 *      "can a guest of event A watch event B's cameras" question, answered in SQL.
 *   3. THE HOST'S SWITCH IS REAL — guest-pick off ⇒ no joinable topic for guests, even
 *      though the same event's control-room members still get in.
 *   4. NO LIVE CAMERA ⇒ NO TOPIC — a dormant or finished event is not joinable.
 *   5. PARTICIPANTS — moderator, legacy couple member and claimed operator all reach
 *      the guest channel (the operator IS the publisher of the fan-out).
 *   6. ANONYMOUS / MALFORMED — no session is denied; a malformed topic denies rather
 *      than throwing, because an RLS predicate that throws takes the page with it.
 *
 * ⚠ WHAT THIS FILE DELIBERATELY DOES NOT TEST: the ₱3,000 entitlement. That is
 * `canPublishMultiCam` in TypeScript, re-asked on every render of the public page and
 * again in `startGuestPickSession`. Restating it in SQL would be a SECOND copy of a
 * money rule — see the migration header.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  event: '' as string,
  otherEvent: '' as string,
  host: '' as string,
  moderator: '' as string,
  operator: '' as string,
  guest: '' as string,
  zoneId: 0 as number,
  cameraId: 0 as number,
};

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function canGuestAccess(uid: string | null, topic: string): Promise<boolean> {
  await setAuthUid(db, uid);
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.live_studio_guest_rtc_can_access($1) AS ok`,
    [topic],
  );
  return r.rows[0]!.ok;
}

async function canHostAccess(uid: string | null, topic: string): Promise<boolean> {
  await setAuthUid(db, uid);
  const r = await db.query<{ ok: boolean }>(`SELECT public.panood_rtc_can_access($1) AS ok`, [
    topic,
  ]);
  return r.rows[0]!.ok;
}

const guestTopic = (eventId: string) => `panood-guest:${eventId}`;
const hostTopic = (eventId: string) => `panood-rtc:${eventId}`;

/** Put the event back into "guest-pick is live" shape between mutating tests. */
async function resetToLive(): Promise<void> {
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.events SET live_studio_guest_pick_enabled = TRUE WHERE event_id = $1`,
    [F.event],
  );
  await db.query(`UPDATE public.live_studio_roam_zones SET status = 'live' WHERE id = $1`, [
    F.zoneId,
  ]);
  await db.query(
    `UPDATE public.live_studio_roam_zones SET camera_operator_id = $2 WHERE id = $1`,
    [F.zoneId, F.cameraId],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.host = await createUser('host@guestpick.test');
  F.moderator = await createUser('moderator@guestpick.test');
  F.operator = await createUser('operator@guestpick.test');
  F.guest = await createUser('guest@guestpick.test');

  await setAuthUid(db, null); // seed as the migration owner, not as a user

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, live_studio_guest_pick_enabled)
     VALUES ('Guest Pick Event', 'birthday', TRUE) RETURNING event_id`,
  );
  F.event = ev.rows[0]!.event_id;

  // A SECOND event that has guest-pick switched ON but NO live camera. It is the
  // control for "does the predicate actually look at this event, or just any event?"
  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, live_studio_guest_pick_enabled)
     VALUES ('Other Event', 'birthday', TRUE) RETURNING event_id`,
  );
  F.otherEvent = other.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.event, F.host],
  );
  await db.query(
    `INSERT INTO public.event_moderators
       (event_id, user_id, role_subtype, accepted_at, permissions_json)
     VALUES ($1, $2, 'partner1', now(), '{}'::jsonb)`,
    [F.event, F.moderator],
  );

  const cam = await db.query<{ id: number }>(
    `INSERT INTO public.panood_camera_operators
       (event_id, camera_index, claim_qr_token, claimer_user_id, claimed_at, status)
     VALUES ($1, 1, 'tok-guest-pick-1', $2, now(), 'live') RETURNING id`,
    [F.event, F.operator],
  );
  F.cameraId = cam.rows[0]!.id;

  const zone = await db.query<{ id: number }>(
    `INSERT INTO public.live_studio_roam_zones
       (event_id, zone_index, label, status, camera_operator_id)
     VALUES ($1, 1, 'Roaming', 'live', $2) RETURNING id`,
    [F.event, F.cameraId],
  );
  F.zoneId = zone.rows[0]!.id;
});

after(async () => {
  await replay?.db?.close?.();
});

/* ── 1. The two channels are separate, in both directions ─────────────────── */

test('the guest predicate refuses a panood-rtc: topic outright', async () => {
  // THE LOAD-BEARING ASSERTION. If the guest predicate ever accepted a host topic, a
  // guest could answer a camera's offer and black out the couple's control room on the
  // one day that cannot be re-run.
  assert.equal(await canGuestAccess(F.guest, hostTopic(F.event)), false);
  assert.equal(await canGuestAccess(F.host, hostTopic(F.event)), false);
  assert.equal(await canGuestAccess(F.operator, hostTopic(F.event)), false);
});

test('the host predicate refuses a panood-guest: topic outright', async () => {
  // The mirror image, so the two policies can never be satisfied by one topic.
  assert.equal(await canHostAccess(F.host, guestTopic(F.event)), false);
  assert.equal(await canHostAccess(F.operator, guestTopic(F.event)), false);
});

test('a plain guest still cannot reach the host channel', async () => {
  assert.equal(await canHostAccess(F.guest, hostTopic(F.event)), false);
});

/* ── 2. Cross-event isolation ─────────────────────────────────────────────── */

test('a guest admitted to event A gets nothing on event B', async () => {
  await resetToLive();
  assert.equal(await canGuestAccess(F.guest, guestTopic(F.event)), true, 'sanity: A is joinable');
  // B has guest-pick ON but no live camera → not joinable, by anyone, as a guest.
  assert.equal(await canGuestAccess(F.guest, guestTopic(F.otherEvent)), false);
});

test('a control-room member of A is not a guest-channel member of B', async () => {
  assert.equal(await canGuestAccess(F.host, guestTopic(F.otherEvent)), false);
});

/* ── 3. The host's guest-pick switch genuinely gates the channel ──────────── */

test("guest-pick OFF closes the channel to guests but not to the couple", async () => {
  await resetToLive();
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.events SET live_studio_guest_pick_enabled = FALSE WHERE event_id = $1`,
    [F.event],
  );

  assert.equal(await canGuestAccess(F.guest, guestTopic(F.event)), false);
  // The couple and their operator are admitted on their OWN standing, not the switch —
  // otherwise flipping guest-pick off would break the host's ability to test it.
  assert.equal(await canGuestAccess(F.host, guestTopic(F.event)), true);
  assert.equal(await canGuestAccess(F.operator, guestTopic(F.event)), true);

  await resetToLive();
});

/* ── 4. No live camera ⇒ no joinable topic ────────────────────────────────── */

test('an event with no LIVE zone is not joinable by a guest', async () => {
  await resetToLive();
  await setAuthUid(db, null);
  await db.query(`UPDATE public.live_studio_roam_zones SET status = 'planned' WHERE id = $1`, [
    F.zoneId,
  ]);
  assert.equal(await canGuestAccess(F.guest, guestTopic(F.event)), false);
  await resetToLive();
});

test('a live zone with no camera bound is not joinable by a guest', async () => {
  await resetToLive();
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.live_studio_roam_zones SET camera_operator_id = NULL WHERE id = $1`,
    [F.zoneId],
  );
  assert.equal(await canGuestAccess(F.guest, guestTopic(F.event)), false);
  await resetToLive();
});

/* ── 5. Legitimate participants ───────────────────────────────────────────── */

test('the claimed camera operator may join — it is the publisher of the fan-out', async () => {
  await resetToLive();
  assert.equal(await canGuestAccess(F.operator, guestTopic(F.event)), true);
});

test('an accepted moderator and a legacy couple member may join', async () => {
  await resetToLive();
  assert.equal(await canGuestAccess(F.moderator, guestTopic(F.event)), true);
  assert.equal(await canGuestAccess(F.host, guestTopic(F.event)), true);
});

test('revoking the camera removes it from the guest ROSTER, which is the containment', async () => {
  await resetToLive();
  await setAuthUid(db, null);
  await db.query(`UPDATE public.panood_camera_operators SET revoked_at = now() WHERE id = $1`, [
    F.cameraId,
  ]);

  // ⚠ THE PREDICATE ALONE DOES NOT LOCK A REVOKED OPERATOR OUT, and that is correct:
  // arm (c) admits any signed-in session on a guest-pick event, and a person whose
  // camera was revoked is still a person who may watch the wedding. Revocation takes
  // away their ability to PUBLISH, not their standing as a spectator.
  assert.equal(await canGuestAccess(F.operator, guestTopic(F.event)), true);

  // What actually protects the couple is the ROSTER: `fetchGuestPickCameras` only
  // offers a zone whose bound seat is claimed and NOT revoked, so no guest is ever
  // told that camera exists and nobody hellos its slot. This is the same
  // enforced-by-omission posture the YouTube manifest uses. Asserted here as SQL,
  // mirroring the filter in lib/live-studio-guest-pick.ts exactly.
  const roster = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.live_studio_roam_zones z
       JOIN public.panood_camera_operators c
         ON c.id = z.camera_operator_id AND c.event_id = z.event_id
      WHERE z.event_id = $1
        AND z.status = 'live'
        AND c.revoked_at IS NULL
        AND c.status <> 'revoked'
        AND c.claimer_user_id IS NOT NULL`,
    [F.event],
  );
  assert.equal(roster.rows[0]!.n, 0, 'a revoked camera must not appear on the guest roster');

  await setAuthUid(db, null);
  await db.query(`UPDATE public.panood_camera_operators SET revoked_at = NULL WHERE id = $1`, [
    F.cameraId,
  ]);
  await resetToLive();

  // …and it comes back once the revocation is lifted, so the filter is real and not
  // an accident of the fixture.
  const back = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.live_studio_roam_zones z
       JOIN public.panood_camera_operators c
         ON c.id = z.camera_operator_id AND c.event_id = z.event_id
      WHERE z.event_id = $1
        AND z.status = 'live'
        AND c.revoked_at IS NULL
        AND c.status <> 'revoked'
        AND c.claimer_user_id IS NOT NULL`,
    [F.event],
  );
  assert.equal(back.rows[0]!.n, 1);
});

/* ── 6. Anonymous, malformed, foreign ─────────────────────────────────────── */

test('no session at all is denied', async () => {
  await resetToLive();
  assert.equal(await canGuestAccess(null, guestTopic(F.event)), false);
});

test('malformed and foreign topics deny rather than throw', async () => {
  // A predicate that throws inside RLS takes the whole query with it, so every one of
  // these must return false quietly.
  assert.equal(await canGuestAccess(F.guest, 'panood-guest:not-a-uuid'), false);
  assert.equal(await canGuestAccess(F.guest, 'panood-guest:'), false);
  assert.equal(await canGuestAccess(F.guest, 'panood-guest'), false);
  assert.equal(await canGuestAccess(F.guest, 'realtime:lobby'), false);
  assert.equal(await canGuestAccess(F.guest, ''), false);
  assert.equal(await canGuestAccess(F.guest, null as unknown as string), false);
});

test('a guest-pick topic for an event that does not exist is denied', async () => {
  assert.equal(
    await canGuestAccess(F.guest, guestTopic('11111111-2222-3333-4444-555555555555')),
    false,
  );
});

/**
 * Live Studio WebRTC signaling authorization — DB verification (executed, not prose).
 *
 * Guards the fix for a real hole: `panood-rtc:{eventId}` was a PUBLIC Realtime channel with ZERO
 * policies on `realtime.messages` (verified against prod 2026-07-21). Because the transport is
 * ONE PUBLISHER → ONE VIEWER per camera slot, a stranger holding an event id — they travel in
 * dashboard URLs and QR links — could answer a camera's offer and TAKE the stream, blacking out
 * the couple's own control room mid-ceremony.
 *
 * The fix is two halves: `private: true` on the channel (lib/panood-webrtc.ts) plus the policies
 * in migration 20270829134804, which delegate to `public.panood_rtc_can_access(topic)`. This file
 * tests that predicate — the security-critical half — against the REAL replayed schema:
 *
 *   1. STRANGER — a signed-in user with no relationship to the event is DENIED, which is the
 *      whole point of the fix.
 *   2. PARTICIPANTS — a control-room moderator, a legacy couple member, and a CLAIMED camera
 *      operator are each allowed.
 *   3. REVOCATION BITES — revoking a camera drops its operator immediately.
 *   4. MALFORMED / FOREIGN TOPICS — never throw inside an RLS predicate, always deny.
 *   5. ANONYMOUS — no session at all is denied.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** Ids created once in `before` and reused across tests. */
const F = {
  event: '' as string,
  host: '' as string,
  moderator: '' as string,
  operator: '' as string,
  stranger: '' as string,
  otherEvent: '' as string,
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

/** Ask the predicate under a given identity. */
async function canAccess(uid: string | null, topic: string): Promise<boolean> {
  await setAuthUid(db, uid);
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.panood_rtc_can_access($1) AS ok`,
    [topic],
  );
  return r.rows[0]!.ok;
}

const topicFor = (eventId: string) => `panood-rtc:${eventId}`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.host = await createUser('host@rtc.test');
  F.moderator = await createUser('moderator@rtc.test');
  F.operator = await createUser('operator@rtc.test');
  F.stranger = await createUser('stranger@rtc.test');

  await setAuthUid(db, null); // seed as the migration owner, not as a user

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('RTC Authz Event', 'birthday') RETURNING event_id`,
  );
  F.event = ev.rows[0]!.event_id;

  const other = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Someone Else Event', 'birthday') RETURNING event_id`,
  );
  F.otherEvent = other.rows[0]!.event_id;

  // Host as legacy couple member; moderator as an accepted, non-removed moderator.
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

  // The stranger is a legitimate couple on their OWN event — which is what makes the
  // cross-event assertion meaningful: they are a real user, just not on this topic.
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.otherEvent, F.stranger],
  );

  // One provisioned camera, claimed by the operator.
  const cam = await db.query<{ id: number }>(
    `INSERT INTO public.panood_camera_operators
       (event_id, camera_index, claim_qr_token, claimer_user_id, claimed_at, status)
     VALUES ($1, 1, 'tok-rtc-authz-1', $2, now(), 'live') RETURNING id`,
    [F.event, F.operator],
  );
  F.cameraId = cam.rows[0]!.id;
});

after(async () => {
  await replay?.db?.close?.();
});

/* ── 1. The hole this closes ──────────────────────────────────────────────── */

test('a stranger holding the event id is DENIED', async () => {
  // This is the entire fix: event ids are not secret, so knowing one must grant nothing.
  assert.equal(await canAccess(F.stranger, topicFor(F.event)), false);
});

test('a participant on ANOTHER event cannot reach this one', async () => {
  // The host of a different wedding is a legitimate user — but not on this topic.
  assert.equal(await canAccess(F.stranger, topicFor(F.otherEvent)), true, 'sanity: own event ok');
  assert.equal(await canAccess(F.host, topicFor(F.otherEvent)), false);
});

/* ── 2. Legitimate participants ───────────────────────────────────────────── */

test('an accepted moderator may join', async () => {
  assert.equal(await canAccess(F.moderator, topicFor(F.event)), true);
});

test('a legacy couple member may join', async () => {
  assert.equal(await canAccess(F.host, topicFor(F.event)), true);
});

test('a claimed camera operator may join', async () => {
  // Operators are native-anon sessions bound at claim time — they are NOT control-room members,
  // which is exactly why the predicate is SECURITY DEFINER.
  assert.equal(await canAccess(F.operator, topicFor(F.event)), true);
});

test('a removed moderator loses access', async () => {
  await setAuthUid(db, null);
  await db.query(`UPDATE public.event_moderators SET removed_at = now() WHERE user_id = $1`, [
    F.moderator,
  ]);
  assert.equal(await canAccess(F.moderator, topicFor(F.event)), false);

  await setAuthUid(db, null);
  await db.query(`UPDATE public.event_moderators SET removed_at = NULL WHERE user_id = $1`, [
    F.moderator,
  ]);
});

/* ── 3. Revocation bites immediately ──────────────────────────────────────── */

test('revoking a camera drops its operator from the channel', async () => {
  await setAuthUid(db, null);
  await db.query(`UPDATE public.panood_camera_operators SET revoked_at = now() WHERE id = $1`, [
    F.cameraId,
  ]);
  assert.equal(await canAccess(F.operator, topicFor(F.event)), false);

  await setAuthUid(db, null);
  await db.query(`UPDATE public.panood_camera_operators SET revoked_at = NULL WHERE id = $1`, [
    F.cameraId,
  ]);
  assert.equal(await canAccess(F.operator, topicFor(F.event)), true);
});

/* ── 4. Malformed input never throws ──────────────────────────────────────── */

test('malformed and foreign topics deny without throwing', async () => {
  // An exception inside an RLS predicate is an outage, not a denial — these must all return false.
  for (const topic of [
    'panood-rtc:not-a-uuid',
    'panood-rtc:',
    'papic-rtc:' + F.event,
    'realtime:public:events',
    '',
  ]) {
    assert.equal(await canAccess(F.host, topic), false, `topic "${topic}" should deny`);
  }
});

test('a null topic denies', async () => {
  await setAuthUid(db, F.host);
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.panood_rtc_can_access(NULL) AS ok`,
  );
  assert.equal(r.rows[0]!.ok, false);
});

/* ── 5. No session ────────────────────────────────────────────────────────── */

test('an unauthenticated caller is denied', async () => {
  assert.equal(await canAccess(null, topicFor(F.event)), false);
});

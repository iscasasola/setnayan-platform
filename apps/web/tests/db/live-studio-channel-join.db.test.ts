/**
 * Live Studio · QR CAMERA-JOIN — DB verification (executed, not prose).
 *
 * WAVE 4 (Live_Studio_Unified_Spec_2026-07-25 §§ 4b/4c/4d · migration
 * 20271003100000_live_studio_channel_camera_join.sql).
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * Before Wave 4 a purchased Live Studio was unusable: `camera_operator_id` on
 * `live_studio_roam_zones` had ZERO writers anywhere in the codebase and `status`
 * never left its `'planned'` insert default, so a host could create and name
 * channels but no phone could ever join one. Wave 4 binds a channel to a camera
 * seat and gives the seat a heartbeat. Both of those are security-relevant, so the
 * claims are tested against the REAL replayed schema rather than asserted in a
 * comment:
 *
 *   1. BINDING WORKS — the shipped claim RPC binds a phone, and the heartbeat
 *      lights the CHANNEL that seat feeds.
 *   2. 🔴 CROSS-EVENT IS IMPOSSIBLE — the whole point of the composite FK. A host
 *      cannot bind their channel to another event's camera seat, so they can never
 *      be shown (and therefore never harvest) that event's claim token. And a
 *      token from event A cannot heartbeat, or be claimed onto, event B.
 *   3. A STOLEN TOKEN IS INERT — heartbeat additionally requires
 *      claimer_user_id = auth.uid(), so holding the string is not enough.
 *   4. STATUS TELLS THE TRUTH — connect lights the channel; the cron-free sweep
 *      demotes a stale camera to 'offline'; a host-set 'disabled' is never
 *      overwritten by a phone.
 *   5. REVOCATION BITES — a reissued/revoked token stops working immediately, for
 *      both the claim and the heartbeat.
 *   6. ONE SEAT, ONE CHANNEL — two channels cannot share a phone.
 *   7. NO-LOGIN PATH — an anonymous-session uid (no email, exactly what
 *      signInAnonymously mints) can claim, heartbeat, and reach the signaling
 *      channel. That is the "no install, no account" promise, executed.
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
  eventA: '' as string,
  eventB: '' as string,
  hostA: '' as string,
  hostB: '' as string,
  operator: '' as string,
  anonOperator: '' as string,
  stranger: '' as string,
  camA1: 0 as number,
  camA2: 0 as number,
  camB1: 0 as number,
  zoneA1: 0 as number,
  zoneA2: 0 as number,
  zoneB1: 0 as number,
};

const TOKEN_A1 = 'tok-w4-eventA-cam1';
const TOKEN_A2 = 'tok-w4-eventA-cam2';
const TOKEN_B1 = 'tok-w4-eventB-cam1';

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/**
 * A NATIVE ANONYMOUS user — no email at all, which is precisely what
 * `supabase.auth.signInAnonymously()` mints on the login-free claim POST. Tested
 * separately from a normal account because "no install, no login, no account" is
 * the product promise, and a schema that quietly required an email would break it.
 */
async function createAnonUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES (NULL, '{}'::jsonb) RETURNING id`,
  );
  return r.rows[0]!.id;
}

async function claim(uid: string | null, token: string): Promise<string> {
  await setAuthUid(db, uid);
  const r = await db.query<{ out: { status: string } }>(
    `SELECT public.panood_claim_camera($1) AS out`,
    [token],
  );
  return r.rows[0]!.out.status;
}

async function heartbeat(uid: string | null, token: string): Promise<string> {
  await setAuthUid(db, uid);
  const r = await db.query<{ out: { status: string } }>(
    `SELECT public.panood_camera_heartbeat($1) AS out`,
    [token],
  );
  return r.rows[0]!.out.status;
}

async function zoneStatus(zoneId: number): Promise<string> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.live_studio_roam_zones WHERE id = $1`,
    [zoneId],
  );
  return r.rows[0]!.status;
}

async function seatStatus(cameraId: number): Promise<string> {
  const r = await db.query<{ status: string }>(
    `SELECT status FROM public.panood_camera_operators WHERE id = $1`,
    [cameraId],
  );
  return r.rows[0]!.status;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  F.hostA = await createUser('hostA@w4.test');
  F.hostB = await createUser('hostB@w4.test');
  F.operator = await createUser('operator@w4.test');
  F.stranger = await createUser('stranger@w4.test');
  F.anonOperator = await createAnonUser();

  await setAuthUid(db, null); // seed as owner, not as a user

  const a = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Wave 4 Event A', 'birthday') RETURNING event_id`,
  );
  F.eventA = a.rows[0]!.event_id;
  const b = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Wave 4 Event B', 'birthday') RETURNING event_id`,
  );
  F.eventB = b.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.eventA, F.hostA],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple') ON CONFLICT DO NOTHING`,
    [F.eventB, F.hostB],
  );

  // Camera seats: two on A, one on B.
  const mk = async (eventId: string, idx: number, token: string) => {
    const r = await db.query<{ id: number }>(
      `INSERT INTO public.panood_camera_operators (event_id, camera_index, claim_qr_token)
       VALUES ($1, $2, $3) RETURNING id`,
      [eventId, idx, token],
    );
    return r.rows[0]!.id;
  };
  F.camA1 = await mk(F.eventA, 1, TOKEN_A1);
  F.camA2 = await mk(F.eventA, 2, TOKEN_A2);
  F.camB1 = await mk(F.eventB, 1, TOKEN_B1);

  // Channels: two on A, one on B. Bound the way bindChannelCamera does it.
  const mkZone = async (eventId: string, idx: number, label: string, camId: number | null) => {
    const r = await db.query<{ id: number }>(
      `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label, camera_operator_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [eventId, idx, label, camId],
    );
    return r.rows[0]!.id;
  };
  F.zoneA1 = await mkZone(F.eventA, 1, 'Ceremony', F.camA1);
  F.zoneA2 = await mkZone(F.eventA, 2, 'Reception floor', F.camA2);
  F.zoneB1 = await mkZone(F.eventB, 1, 'Garden', F.camB1);
});

after(async () => {
  await replay?.db?.close?.();
});

/* ── 1. The binding works — the gap Wave 4 closes ─────────────────────────── */

test('a channel starts out honestly empty: planned, with nothing joined', async () => {
  // This is the pre-Wave-4 state that used to be PERMANENT — the reason Wave 3's
  // caption said "Waiting for a camera" forever.
  assert.equal(await zoneStatus(F.zoneA1), 'planned');
});

test('claiming the token binds the phone to THAT channel’s seat', async () => {
  assert.equal(await claim(F.operator, TOKEN_A1), 'claimed');

  const r = await db.query<{ zone_id: number; claimer: string }>(
    `SELECT z.id AS zone_id, c.claimer_user_id AS claimer
       FROM public.live_studio_roam_zones z
       JOIN public.panood_camera_operators c ON c.id = z.camera_operator_id
      WHERE c.claim_qr_token = $1`,
    [TOKEN_A1],
  );
  assert.equal(r.rows.length, 1, 'the token resolves to exactly one channel');
  assert.equal(r.rows[0]!.zone_id, F.zoneA1, 'and it is the RIGHT channel');
  assert.equal(r.rows[0]!.claimer, F.operator);
});

test('the heartbeat lights the channel — "Camera connected" becomes true', async () => {
  assert.equal(await heartbeat(F.operator, TOKEN_A1), 'beating');
  assert.equal(await seatStatus(F.camA1), 'live');
  assert.equal(await zoneStatus(F.zoneA1), 'live', 'the CHANNEL follows the camera');
  // The other channel is untouched — a beat lights one camera, not the room.
  assert.equal(await zoneStatus(F.zoneA2), 'planned');
});

/* ── 2. 🔴 CROSS-EVENT — the locked security rule ─────────────────────────── */

test('a channel CANNOT be bound to another event’s camera seat', async () => {
  // The composite FK (camera_operator_id, event_id) is the guard. Without it, host
  // B could point their own channel at event A's seat and their controller would
  // render event A's claim token as a QR — a harvestable hijack credential.
  await assert.rejects(
    () =>
      db.query(`UPDATE public.live_studio_roam_zones SET camera_operator_id = $1 WHERE id = $2`, [
        F.camA1,
        F.zoneB1,
      ]),
    /foreign key|violates/i,
    'binding event B’s channel to event A’s camera must be a database error',
  );
});

test('an event-A token cannot be claimed onto, or beat for, event B', async () => {
  // There is no parameter through which another event could be named: the token is
  // UNIQUE and its row carries exactly one event_id. So the only thing to prove is
  // that a token never reaches a second event's rows — which it structurally cannot.
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.panood_camera_operators
      WHERE claim_qr_token = $1 AND event_id = $2`,
    [TOKEN_A1, F.eventB],
  );
  assert.equal(r.rows[0]!.n, '0');

  // And event B's channel is unaffected by every beat event A has made.
  assert.equal(await zoneStatus(F.zoneB1), 'planned');
});

test('an unknown / foreign token is refused, never a silent no-op success', async () => {
  assert.equal(await claim(F.stranger, 'tok-does-not-exist'), 'invalid');
  assert.equal(await heartbeat(F.stranger, 'tok-does-not-exist'), 'invalid');
});

/* ── 3. A stolen token is inert ───────────────────────────────────────────── */

test('holding someone else’s token does NOT let you claim their camera', async () => {
  // camA1 is already the operator's. A second person with the same string gets the
  // 'taken' verdict, not the camera.
  assert.equal(await claim(F.stranger, TOKEN_A1), 'taken');
});

test('holding someone else’s token does NOT let you heartbeat their camera', async () => {
  // The sharper case: the heartbeat requires claimer_user_id = auth.uid() on TOP of
  // the token, so a leaked string cannot be used to keep a channel falsely green
  // (or to drive the sweep) on somebody else's behalf.
  assert.equal(await heartbeat(F.stranger, TOKEN_A1), 'invalid');
  assert.equal(await zoneStatus(F.zoneA1), 'live', 'and the real state is untouched');
});

test('an unauthenticated caller cannot claim or heartbeat', async () => {
  assert.equal(await claim(null, TOKEN_A2), 'unauthenticated');
  assert.equal(await heartbeat(null, TOKEN_A1), 'unauthenticated');
});

/* ── 4. Status reflects REAL connect / disconnect ─────────────────────────── */

test('the cron-free sweep demotes a camera that stopped beating', async () => {
  // Second operator joins and beats, so both channels are live.
  assert.equal(await claim(F.anonOperator, TOKEN_A2), 'claimed');
  assert.equal(await heartbeat(F.anonOperator, TOKEN_A2), 'beating');
  assert.equal(await zoneStatus(F.zoneA2), 'live');

  // Camera 1 walks out: no goodbye is ever sent, so we age its last beat past the
  // 60s window — exactly what a closed tab looks like to the database.
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET last_seen_at = now() - INTERVAL '5 minutes' WHERE id = $1`,
    [F.camA1],
  );

  // Camera 2's next beat reports its dead neighbour. No scheduler involved.
  assert.equal(await heartbeat(F.anonOperator, TOKEN_A2), 'beating');
  assert.equal(await seatStatus(F.camA1), 'offline');
  assert.equal(await zoneStatus(F.zoneA1), 'offline', '"Camera dropped out" is now true');
  assert.equal(await zoneStatus(F.zoneA2), 'live', 'the living camera stays live');
});

test('reconnecting lights the channel again', async () => {
  assert.equal(await heartbeat(F.operator, TOKEN_A1), 'beating');
  assert.equal(await zoneStatus(F.zoneA1), 'live');
});

test('a host-DISABLED channel is never overridden by a phone', async () => {
  // 'disabled' is the host's own decision. A phone that keeps beating must not be
  // able to switch a channel the host turned off back on.
  await setAuthUid(db, null);
  await db.query(`UPDATE public.live_studio_roam_zones SET status = 'disabled' WHERE id = $1`, [
    F.zoneA1,
  ]);
  assert.equal(await heartbeat(F.operator, TOKEN_A1), 'beating');
  assert.equal(await zoneStatus(F.zoneA1), 'disabled');

  await setAuthUid(db, null);
  await db.query(`UPDATE public.live_studio_roam_zones SET status = 'live' WHERE id = $1`, [
    F.zoneA1,
  ]);
});

/* ── 5. Revocation bites ──────────────────────────────────────────────────── */

test('reissuing a channel’s QR kills the old link for claim AND heartbeat', async () => {
  // What reissueChannelCamera does: new token, binding cleared, back to 'open'.
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET claim_qr_token = 'tok-w4-eventA-cam1-v2',
            claimer_user_id = NULL, claimed_at = NULL, last_seen_at = NULL,
            revoked_at = NULL, status = 'open'
      WHERE id = $1`,
    [F.camA1],
  );

  assert.equal(await heartbeat(F.operator, TOKEN_A1), 'invalid', 'old token cannot beat');
  assert.equal(await claim(F.operator, TOKEN_A1), 'invalid', 'old token cannot re-claim');

  // The new one works, for a brand-new person.
  assert.equal(await claim(F.stranger, 'tok-w4-eventA-cam1-v2'), 'claimed');
  assert.equal(await heartbeat(F.stranger, 'tok-w4-eventA-cam1-v2'), 'beating');
});

test('a REVOKED seat (deleted channel) is dead to both RPCs', async () => {
  // revokeChannelCamera's effect — what happens when the host deletes a channel
  // while its printed QR is still in somebody's pocket.
  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators
        SET revoked_at = now(), status = 'revoked' WHERE id = $1`,
    [F.camA1],
  );
  assert.equal(await heartbeat(F.stranger, 'tok-w4-eventA-cam1-v2'), 'invalid');
  assert.equal(await claim(F.stranger, 'tok-w4-eventA-cam1-v2'), 'invalid');

  await setAuthUid(db, null);
  await db.query(
    `UPDATE public.panood_camera_operators SET revoked_at = NULL, status = 'live' WHERE id = $1`,
    [F.camA1],
  );
});

/* ── 6. One seat, one channel ─────────────────────────────────────────────── */

test('two channels cannot share one camera seat', async () => {
  // Both would light up on a single join and the controller would show the same
  // phone twice under two different names.
  await setAuthUid(db, null);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label, camera_operator_id)
         VALUES ($1, 9, 'Duplicate', $2)`,
        [F.eventA, F.camA2],
      ),
    /duplicate key|unique/i,
  );
});

test('unbound channels are allowed — many of them', async () => {
  // MATCH SIMPLE: a NULL camera_operator_id skips the composite FK entirely, so a
  // channel with no camera yet stays perfectly legal (and reads as 'planned').
  await setAuthUid(db, null);
  await db.query(
    `INSERT INTO public.live_studio_roam_zones (event_id, zone_index, label)
     VALUES ($1, 10, 'No camera yet'), ($1, 11, 'Also none')`,
    [F.eventA],
  );
  const r = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.live_studio_roam_zones
      WHERE event_id = $1 AND camera_operator_id IS NULL`,
    [F.eventA],
  );
  assert.equal(r.rows[0]!.n, '2');
});

/* ── 7. The no-login, no-install path ─────────────────────────────────────── */

test('a native-anonymous session (no email, no account) can join and stay live', async () => {
  // F.anonOperator has NULL email — exactly what signInAnonymously mints on the
  // claim POST. It already claimed TOKEN_A2 above; assert the whole chain holds for
  // an account-less person, because "no install, no account" is the product promise.
  const who = await db.query<{ email: string | null; claimer: string }>(
    `SELECT u.email, c.claimer_user_id AS claimer
       FROM public.panood_camera_operators c
       JOIN auth.users u ON u.id = c.claimer_user_id
      WHERE c.claim_qr_token = $1`,
    [TOKEN_A2],
  );
  assert.equal(who.rows[0]!.email, null, 'the claimer genuinely has no account');
  assert.equal(who.rows[0]!.claimer, F.anonOperator);

  assert.equal(await heartbeat(F.anonOperator, TOKEN_A2), 'beating');
  assert.equal(await zoneStatus(F.zoneA2), 'live');
});

test('that anonymous operator may reach the signaling channel — and only theirs', async () => {
  // The join is worthless if the phone cannot then publish: the WebRTC topic is a
  // PRIVATE Realtime channel gated by panood_rtc_can_access. A claimed operator is
  // admitted on THEIR event and refused on any other.
  await setAuthUid(db, F.anonOperator);
  const own = await db.query<{ ok: boolean }>(
    `SELECT public.panood_rtc_can_access($1) AS ok`,
    [`panood-rtc:${F.eventA}`],
  );
  assert.equal(own.rows[0]!.ok, true);

  const other = await db.query<{ ok: boolean }>(
    `SELECT public.panood_rtc_can_access($1) AS ok`,
    [`panood-rtc:${F.eventB}`],
  );
  assert.equal(other.rows[0]!.ok, false, 'no cross-event signaling, ever');
});

/* ── 8. Joining is FREE — the Wave 3 paywall is elsewhere ─────────────────── */

test('nothing in the join path grants publication', async () => {
  // § 4d: rehearsal is free, PUBLICATION is the paywall. Event A has two joined,
  // live channels and its host has bought nothing — and the one column that makes
  // video guest-visible (events.live_studio_roam_manifest) is still untouched.
  // If a future change makes the join write that column, this fails, which is
  // exactly what it is for.
  const r = await db.query<{ manifest: unknown }>(
    `SELECT live_studio_roam_manifest AS manifest FROM public.events WHERE event_id = $1`,
    [F.eventA],
  );
  assert.equal(r.rows[0]!.manifest, null);

  const orders = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM public.orders WHERE event_id = $1`,
    [F.eventA],
  );
  assert.equal(orders.rows[0]!.n, '0', 'the host bought nothing, and still joined + cut');
});

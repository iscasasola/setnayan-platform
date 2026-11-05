/**
 * ＋ ADD PHOTOS — THE UPLOADS CAMERA IS CLAIMED ONCE, BY A HOST, AND A SECOND PRESS CHANGES NOTHING (owner 2026-10-26,
 * live: "the turn on is not working as well fix it"), against the REPLAYED schema, on an `authenticated` session.
 *
 * The one press (`startAddingPhotos`, `app/dashboard/[eventId]/studio/papic/actions.ts`) reads the camera's token on the
 * service role and claims it on the CALLER'S session through `papic_claim_seat`. What that leans on is here:
 *   1 · the camera can be minted ONCE per event (the UNIQUE the provisioner's upsert names — a second render, or the
 *       studio and Memories renders racing, creates nothing);
 *   2 · the host's claim lands, and a second press is a no-op ('claimed' again, the same claimer, the same claimed_at);
 *   3 · the OTHER host's claim is 'taken' and moves nothing;
 *   4 · a non-host is refused at the two reads the action makes on their session: their membership row (the couple
 *       check) and the camera's token (RLS) both come back empty — so they never hold a token to claim with.
 *
 * 👥 AND SINCE 2026-10-31 EVERY HOST HAS THEIR OWN (owner, asked "Should co-hosts each get a camera, and are host shots
 * free?": *"yes. papic credits still"*). Seat 150 stays the first host's; 3 above is still true OF SEAT 150 — nobody takes
 * a camera from the host who claimed it — but the other host is no longer left without one:
 *   5 · two co-hosts each mint (through the same pure rule the app runs, `hostCameraPick`) and claim their OWN camera,
 *       and neither can claim the other's;
 *   6 · every host camera spends the ONE shared pool — a shot on one co-host's camera is gone from every host's, and
 *       none of them holds credits of its own;
 *   7 · a non-host has no camera: no membership (so no mint, no claim), and no host camera token is readable to them.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { hostCameraPick, PAPIC_HOST_CAMERA_LAST_INDEX, PAPIC_UPLOADS_CAMERA_INDEX, type HostCameraRow } from '../../lib/papic-cameras';

let replay: ReplayResult;
let db: PGlite;
const F = { host: '', partner: '', coHostA: '', coHostB: '', stranger: '', eventId: '', token: 'tok-uploads-0123456789abcdef0123' };

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
}
const claim = (uid: string) =>
  as(uid, async () => (await db.query<{ r: { status: string } }>(`SELECT public.papic_claim_seat($1) AS r`, [F.token])).rows[0]!.r);
const seat = async () =>
  (
    await db.query<{ claimer_user_id: string | null; claimed_at: string | null; n: number }>(
      `SELECT claimer_user_id, claimed_at::text, (SELECT count(*)::int FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 150) AS n
         FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 150`,
      [F.eventId],
    )
  ).rows[0]!;
/** The provisioner's upsert, as `provisionUploadsCameraAdmin` sends it (`onConflict: 'event_id,seat_index'`, ignoreDuplicates). */
const mint = (token: string) =>
  db.query(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, tier, claim_qr_token)
     VALUES ($1, 150, 'PAPIC_CAMERA_FREE', 'free', $2) ON CONFLICT (event_id, seat_index) DO NOTHING`,
    [F.eventId, token],
  );

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const user = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.host = await user('host@uploads.test');
  F.partner = await user('partner@uploads.test');
  F.stranger = await user('stranger@uploads.test');
  F.coHostA = await user('cohost-a@uploads.test');
  F.coHostB = await user('cohost-b@uploads.test');
  F.eventId = (await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Cale and Ice', 'birthday') RETURNING event_id AS e`)).rows[0]!.e;
  // A co-host is a `couple` membership — the same value as the couple (2026-09-28 · 2026-10-29: Full access = the co-host seat).
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple'), ($1, $3, 'couple'), ($1, $4, 'couple'), ($1, $5, 'couple')`,
    [F.eventId, F.host, F.partner, F.coHostA, F.coHostB],
  );
});
after(async () => {
  await db?.close?.();
});

test('1 · the camera is minted once — a second mint (another render, or the two renders racing) creates nothing', async () => {
  await mint(F.token);
  await mint('tok-a-second-render-would-mint-xx');
  const s = await seat();
  assert.equal(s.n, 1, 'two Uploads cameras on one event — the UNIQUE the upsert names is gone');
  const tok = (await db.query<{ t: string }>(`SELECT claim_qr_token AS t FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = 150`, [F.eventId])).rows[0]!.t;
  assert.equal(tok, F.token, 'the second mint replaced the first camera’s token');
  assert.equal(s.claimer_user_id, null, 'a fresh camera is already somebody’s');
});

test('2 · the host’s press claims it; a second press is a no-op — the same claimer, the same moment', async () => {
  assert.equal((await claim(F.host)).status, 'claimed');
  const first = await seat();
  assert.equal(first.claimer_user_id, F.host, 'the claim did not land on the host');
  assert.ok(first.claimed_at, 'the claim left no moment');
  assert.equal((await claim(F.host)).status, 'claimed', 'a second press by the same host is refused — the sheet would say so on every pick');
  const second = await seat();
  assert.equal(second.claimer_user_id, F.host);
  assert.equal(second.claimed_at, first.claimed_at, 'a second press re-claimed the camera (it should change nothing)');
});

test('3 · the other host’s press is "taken" and moves nothing', async () => {
  assert.equal((await claim(F.partner)).status, 'taken');
  assert.equal((await seat()).claimer_user_id, F.host, 'the other host took the camera from the first');
});

test('4 · a non-host is refused at both reads the action makes on their session — no membership, no token', async () => {
  const membership = await as(F.stranger, () =>
    db.query(`SELECT member_type FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [F.eventId, F.stranger]),
  );
  assert.equal(membership.rows.length, 0, 'a stranger reads a membership on this event — the couple check would pass them');
  const token = await as(F.stranger, () =>
    db.query(`SELECT claim_qr_token FROM public.paparazzi_seats WHERE event_id = $1`, [F.eventId]),
  );
  assert.equal(token.rows.length, 0, 'a stranger can read the Uploads camera’s token — they could claim it without the action');
  // Positive control: the host's own session does read their membership (the check is not vacuously empty).
  const own = await as(F.host, () =>
    db.query<{ member_type: string }>(`SELECT member_type FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [F.eventId, F.host]),
  );
  assert.equal(own.rows[0]?.member_type, 'couple', 'the host cannot read their own membership — test 4 would pass for the wrong reason');
});

// ── 👥 one camera per host (owner 2026-10-31) ────────────────────────────────────────────────────────────────────────

/** The host-camera block as `readHostCamera` reads it (service role). */
const hostRows = async () =>
  (
    await db.query<HostCameraRow>(
      `SELECT seat_id::text, seat_index, claim_qr_token, claimer_user_id::text, revoked_at::text
         FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index BETWEEN $2 AND $3 ORDER BY seat_index`,
      [F.eventId, PAPIC_UPLOADS_CAMERA_INDEX, PAPIC_HOST_CAMERA_LAST_INDEX],
    )
  ).rows;

/** What the Memories render does for ONE host: ask the pure rule, mint the index it names (the provisioner's upsert). */
async function mintFor(uid: string): Promise<string> {
  const pick = hostCameraPick(await hostRows(), uid);
  if (pick.kind === 'mine' || pick.kind === 'spare') return pick.seat.claim_qr_token!;
  assert.equal(pick.kind, 'mint', `the block is full for ${uid}`);
  if (pick.kind !== 'mint') throw new Error('unreachable');
  const token = `tok-host-${pick.index}-${uid.slice(0, 8)}`;
  await db.query(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, tier, claim_qr_token)
     VALUES ($1, $2, 'PAPIC_CAMERA_FREE', 'free', $3) ON CONFLICT (event_id, seat_index) DO NOTHING`,
    [F.eventId, pick.index, token],
  );
  return token;
}
const claimToken = (uid: string, token: string) =>
  as(uid, async () => (await db.query<{ r: { status: string } }>(`SELECT public.papic_claim_seat($1) AS r`, [token])).rows[0]!.r);

const tokens: Record<string, string> = {};

test('5 · 🚨 two co-hosts each mint and claim their OWN camera — and neither can claim the other\'s', async () => {
  tokens.a = await mintFor(F.coHostA);
  assert.equal((await claimToken(F.coHostA, tokens.a)).status, 'claimed');
  tokens.b = await mintFor(F.coHostB);
  assert.notEqual(tokens.b, tokens.a, 'the second co-host was handed the first co-host\'s camera');
  assert.equal((await claimToken(F.coHostB, tokens.b)).status, 'claimed');

  const rows = await hostRows();
  const byClaimer = new Map(rows.map((r) => [r.claimer_user_id, r.seat_index]));
  assert.equal(byClaimer.get(F.host), PAPIC_UPLOADS_CAMERA_INDEX, 'the first host lost seat 150');
  assert.ok(byClaimer.has(F.coHostA) && byClaimer.has(F.coHostB), 'a co-host has no camera of their own');
  assert.equal(new Set([byClaimer.get(F.host), byClaimer.get(F.coHostA), byClaimer.get(F.coHostB)]).size, 3, 'two hosts share one camera');
  for (const r of rows) assert.ok(r.seat_index >= PAPIC_UPLOADS_CAMERA_INDEX && r.seat_index <= PAPIC_HOST_CAMERA_LAST_INDEX);

  assert.equal((await claimToken(F.coHostB, tokens.a)).status, 'taken', 'a co-host took another co-host\'s camera');
  assert.equal((await claimToken(F.coHostA, tokens.b)).status, 'taken');
  // The pure rule agrees: each co-host's camera reads as THEIRS, and a re-render mints nothing new.
  assert.equal(hostCameraPick(await hostRows(), F.coHostA).kind, 'mine');
  assert.equal(hostCameraPick(await hostRows(), F.coHostB).kind, 'mine');
  const before = (await hostRows()).length;
  await mintFor(F.coHostA);
  assert.equal((await hostRows()).length, before, 'a host who already has a camera minted another');
  // …and the partner who was told "taken" in 3 now has a camera of their own too.
  tokens.partner = await mintFor(F.partner);
  assert.equal((await claimToken(F.partner, tokens.partner)).status, 'claimed', 'the other host still has no camera');
});

test('6 · 🪙 every host camera spends the ONE shared pool — nothing is free, no camera holds credits of its own', async () => {
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note) VALUES ($1, 100, 'admin', 'host camera test')`,
    [F.eventId],
  );
  const seatOf = async (uid: string) => (await hostRows()).find((r) => r.claimer_user_id === uid)!.seat_id;
  const a = await seatOf(F.coHostA);
  const b = await seatOf(F.coHostB);
  const avail = async (seat: string) =>
    (await db.query<{ n: number }>(`SELECT public.papic_capture_points_available($1, $2) AS n`, [seat, F.eventId])).rows[0]!.n;
  const pool = async () =>
    (await db.query<{ n: number }>(`SELECT remaining_points AS n FROM public.papic_event_pool_status($1)`, [F.eventId])).rows[0]!.n;

  const start = await pool();
  assert.ok(start >= 100, `the pool did not take the grant (${start})`);
  assert.equal(await avail(a), start, 'co-host A\'s camera holds credits of its own, or sees a different pot');
  assert.equal(await avail(b), start, 'co-host B\'s camera holds credits of its own, or sees a different pot');

  const spend = async (seat: string, cost: number) =>
    (
      await db.query<{ ok: boolean; dedicated_spent: number; pool_spent: number }>(
        `SELECT ok, dedicated_spent, pool_spent FROM public.papic_reserve_capture_split($1, $2, $3)`,
        [seat, F.eventId, cost],
      )
    ).rows[0]!;
  const shotA = await spend(a, 3);
  assert.equal(shotA.ok, true, 'co-host A could not shoot on a funded pool');
  assert.equal(shotA.pool_spent, 3, 'co-host A\'s shot was not paid from the shared pool');
  assert.equal(shotA.dedicated_spent, 0);
  const shotB = await spend(b, 2);
  assert.equal(shotB.pool_spent, 2, 'co-host B\'s shot was not paid from the shared pool');

  assert.equal(await pool(), start - 5, 'the two co-hosts\' shots did not come out of the one pool');
  assert.equal(await avail(a), start - 5, 'a shot on B\'s camera is not gone from A\'s — two pools');
  assert.equal(await avail(b), start - 5);
});

test('7 · a non-host gets no camera — no membership to mint for, no host camera token they can read or hold', async () => {
  const membership = await as(F.stranger, () =>
    db.query(`SELECT 1 FROM public.event_members WHERE event_id = $1 AND user_id = $2`, [F.eventId, F.stranger]),
  );
  assert.equal(membership.rows.length, 0, 'a stranger passes the couple check the render and the claim both make');
  const visible = await as(F.stranger, () =>
    db.query(`SELECT claim_qr_token FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index BETWEEN $2 AND $3`, [
      F.eventId,
      PAPIC_UPLOADS_CAMERA_INDEX,
      PAPIC_HOST_CAMERA_LAST_INDEX,
    ]),
  );
  assert.equal(visible.rows.length, 0, 'a stranger can read a host camera\'s token');
  assert.equal((await hostRows()).some((r) => r.claimer_user_id === F.stranger), false, 'a stranger holds a host camera');
  // Positive control: a host DOES read their own camera under RLS (the claimer policy), so 7 is not vacuously empty.
  const own = await as(F.coHostA, () =>
    db.query(`SELECT claim_qr_token FROM public.paparazzi_seats WHERE event_id = $1 AND claimer_user_id = $2`, [F.eventId, F.coHostA]),
  );
  assert.equal(own.rows.length, 1, 'a co-host cannot read their own camera — 7 would pass for the wrong reason');
});

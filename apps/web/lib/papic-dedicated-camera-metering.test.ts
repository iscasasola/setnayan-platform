/**
 * A DEDICATED CAMERA METERS ITS OWN SHOTS — END-TO-END DB verification.
 *
 * ⚠ THIS FILE USED TO TEST THE TWO-TYPE MODEL (Papic Pool + Papic One, owner
 * 2026-07-29). That model is RETIRED: Papic is one product now, and a dedicated
 * camera is something the host MAKES by handing shots to a QR rather than
 * something they BUY (owner 2026-08-11 · migrations 20271130515135 +
 * 20271131476413).
 *
 * Three of its assertions went with the model and are gone from here — the
 * Pool/One rung numbers, the One product's single rung, and the free One
 * camera's own 5 shots. Their replacements live in
 * tests/db/papic-one-product-hand-out.db.test.ts, which owns the new ladder and
 * the hand-out. Restating them here too would mean two files claiming authority
 * over one set of numbers, and the day they disagree the reader has no way to
 * know which is stale.
 *
 * WHAT SURVIVED IS THE METERING, UNCHANGED AND STILL LOAD-BEARING — the half
 * the new model is built ON TOP OF rather than the half it replaced:
 *
 *   (1) DEDICATED MEANS UNSHARED. A camera holding a dedicated balance meters
 *       against its OWN bucket, refuses at its own zero, and its shots are
 *       invisible to the shared pool — which is also never charged for its
 *       captures. This is exactly what makes "hand 200 shots to this QR" mean
 *       anything at all; without it, handing out would be decoration.
 *   (2) A CLIP COSTS ITS FULL WEIGHT or nothing, never a part of it.
 *   (3) TOPPING UP IS ADDITIVE AND KEEPS THE QR. Granting the same camera again
 *       raises its balance without minting a second camera — the reason a
 *       reload never strands whoever is already holding the first QR.
 *
 * Lives under lib/ (not tests/db/) so it runs in the `test:unit` glob alongside
 * papic-pool-metering.test.ts; the replay harness is fully in-process (no
 * docker / supabase / network).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from '../tests/db/replay-migrations';
import { papicCaptureCost } from './papic-cameras';
// PAPIC_ONE_SKU still appears here because the RELOAD test replays a real
// pre-retirement camera order — the shape an event minted before 2026-08-11 and
// the reason those activation hooks stay wired even though nobody can buy one.
import { PAPIC_ONE_SKU } from './papic-one';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

async function createEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/** A camera with NO dedicated grant — it draws the shared pool. */
async function createSeat(eventId: string, index: number): Promise<string> {
  const r = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, $2, 'PAPIC_CAMERA_FREE', $3, 'free') RETURNING seat_id`,
    [eventId, index, randomUUID()],
  );
  return r.rows[0]!.seat_id;
}

async function grantToSeat(eventId: string, seatId: string, points: number): Promise<void> {
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, order_id)
     VALUES ($1, $2, $3, 'camera_grant', NULL)
     ON CONFLICT DO NOTHING`,
    [eventId, seatId, points],
  );
}

const one = async <T>(sql: string, params: unknown[] = []): Promise<T> => {
  const r = await db.query<Record<string, unknown>>(sql, params);
  return Object.values(r.rows[0]!)[0] as T;
};

const reserveCamera = (seatId: string, eventId: string, cost: number) =>
  one<boolean>(`SELECT public.papic_reserve_camera_points($1, $2, $3)`, [seatId, eventId, cost]);
const cameraRemaining = (seatId: string) =>
  one<number>(`SELECT public.papic_camera_points_remaining($1)`, [seatId]);
const dedicated = (seatId: string) =>
  one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]);
const reserveEventForSeat = (eventId: string, seatId: string, cost: number) =>
  one<number>(`SELECT public.papic_reserve_event_points_for_seat($1, $2, $3)`, [
    eventId,
    seatId,
    cost,
  ]);
const eventRemainingForSeat = (eventId: string, seatId: string) =>
  one<number>(`SELECT public.papic_event_points_remaining_for_seat($1, $2)`, [eventId, seatId]);

async function poolTotal(eventId: string): Promise<number> {
  const r = await db.query<{ total_points: number }>(
    `SELECT total_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  return Number(r.rows[0]!.total_points);
}

// ── (2) dedicated means unshared ───────────────────────────────────────────

test('a dedicated camera meters its OWN bucket and refuses at its own zero', async () => {
  const eventId = await createEvent('Dedicated A'); // trigger seeds the shared free pool
  const seatId = await createSeat(eventId, 300);
  const poolBefore = await poolTotal(eventId);

  await grantToSeat(eventId, seatId, 10);
  assert.equal(Number(await dedicated(seatId)), 10);

  // The SHARED pool is completely unmoved by a dedicated grant. This is the
  // whole promise: buying a camera must not raise everybody else's ceiling.
  assert.equal(await poolTotal(eventId), poolBefore);

  assert.equal(Number(await cameraRemaining(seatId)), 10);
  for (let i = 1; i <= 10; i += 1) {
    assert.equal(await reserveCamera(seatId, eventId, 1), true, `dedicated shot ${i}`);
  }
  assert.equal(Number(await cameraRemaining(seatId)), 0);
  assert.equal(await reserveCamera(seatId, eventId, 1), false, '11th shot refused');

  // Spending the camera's bucket never touched the shared pool's ledger.
  const poolUsed = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM public.papic_event_pool_usage WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(poolUsed.rows[0]!.c), 0, 'the shared pool was never charged');
});

test('a clip costs 8 against a dedicated bucket, never partially', async () => {
  const eventId = await createEvent('Dedicated Clip B');
  const seatId = await createSeat(eventId, 300);
  const clip = papicCaptureCost('clip');
  await grantToSeat(eventId, seatId, clip + 1);

  assert.equal(await reserveCamera(seatId, eventId, clip), true, 'the clip fits exactly once');
  assert.equal(Number(await cameraRemaining(seatId)), 1);
  // 1 point left: a photo fits, a second clip does not — and the refused clip
  // must not spend the leftover point.
  assert.equal(await reserveCamera(seatId, eventId, clip), false, 'the second clip is refused');
  assert.equal(Number(await cameraRemaining(seatId)), 1, 'a refused clip spends nothing');
  assert.equal(await reserveCamera(seatId, eventId, 1), true, 'the last photo still fits');
  assert.equal(Number(await cameraRemaining(seatId)), 0);
});

test('the shared pool stands DOWN for a dedicated camera, and binds for every other', async () => {
  const eventId = await createEvent('Stand Down C');
  const dedicatedSeat = await createSeat(eventId, 300);
  const pooledSeat = await createSeat(eventId, 100);
  await grantToSeat(eventId, dedicatedSeat, 10);

  // -1 = "not applicable, nothing booked". If this were a plain TRUE the caller
  // could not tell it apart from a real booking, and an aborted upload would
  // refund shared points that were never spent.
  assert.equal(Number(await reserveEventForSeat(eventId, dedicatedSeat, 1)), -1);
  assert.equal(
    Number(await eventRemainingForSeat(eventId, dedicatedSeat)),
    2147483647,
    'the shared pool does not bound a dedicated camera',
  );

  // A pooled camera is unaffected: 1 = booked against the shared pool.
  assert.equal(Number(await reserveEventForSeat(eventId, pooledSeat, 1)), 1);
  const remaining = Number(await eventRemainingForSeat(eventId, pooledSeat));
  assert.ok(remaining > 0 && remaining < 2147483647, 'a pooled camera IS bounded');

  // …and the dedicated camera's captures never appear in the pool's usage.
  const used = await one<number>(
    `SELECT points_used FROM public.papic_event_pool_usage WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(used), 1, 'only the pooled camera charged the pool');
});

// ── (3) reload ─────────────────────────────────────────────────────────────

test('a RELOAD adds to the same camera — same seat, same QR, more shots', async () => {
  const eventId = await createEvent('Reload D');
  const userId = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [`papic-reload-${randomUUID()}@test.dev`],
  );
  const seatId = await createSeat(eventId, 300);
  const qrBefore = await one<string>(
    `SELECT claim_qr_token FROM public.paparazzi_seats WHERE seat_id = $1`,
    [seatId],
  );
  await grantToSeat(eventId, seatId, 5); // the free One camera's starting bucket
  assert.equal(Number(await dedicated(seatId)), 5);

  // Buy the ₱100 rung AT that camera. The order->camera map is what makes a
  // reload expressible at all: an order alone carries no seat.
  const orderId = await one<string>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, 'Papic One reload', 100, 'paid', $4)
     RETURNING order_id`,
    [eventId, userId.rows[0]!.id, PAPIC_ONE_SKU, `SN${randomUUID().slice(0, 12).toUpperCase()}`],
  );
  await db.query(
    `INSERT INTO public.papic_one_orders (order_id, event_id, seat_id, service_code, points, is_reload)
     VALUES ($1, $2, $3, $4, 100, TRUE)`,
    [orderId, eventId, seatId, PAPIC_ONE_SKU],
  );

  assert.equal(
    Number(await one<number>(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId])),
    100,
  );
  assert.equal(Number(await dedicated(seatId)), 105, 'the reload STACKS onto the free 5');
  assert.equal(Number(await cameraRemaining(seatId)), 105);

  // No second camera, and the QR the guest already scanned is untouched — the
  // entire reason reload exists rather than "just buy another".
  const seats = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM public.paparazzi_seats WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(seats.rows[0]!.c), 1, 'reload mints no new camera');
  assert.equal(
    await one<string>(`SELECT claim_qr_token FROM public.paparazzi_seats WHERE seat_id = $1`, [
      seatId,
    ]),
    qrBefore,
    'the QR is unchanged',
  );

  // Idempotent by order: a re-approval must not double-grant.
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  assert.equal(Number(await dedicated(seatId)), 105, 're-approval does not double-grant');

  // …and none of it leaked into the shared pool.
  const shared = await one<number>(
    `SELECT COALESCE(SUM(points), 0) FROM public.papic_event_point_grants
      WHERE event_id = $1 AND seat_id IS NULL`,
    [eventId],
  );
  assert.equal(await poolTotal(eventId), Number(shared));
});

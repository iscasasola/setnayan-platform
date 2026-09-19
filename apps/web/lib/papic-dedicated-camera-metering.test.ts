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
 * ⚠ AND ON 2026-09-18 (S37) THE PER-CAMERA GATE ITSELF WAS DROPPED —
 * `papic_reserve_camera_points` and `papic_reserve_event_points_for_seat` had
 * no caller since every capture path moved onto `papic_reserve_capture_split`
 * (the "spend 2 and take 6" ruling: dedicated credits are a FLOOR, never a
 * ceiling). Two assertions here tested the retired CEILING — "the 11th shot is
 * refused" is exactly the defect that ruling fixed — and the split gate's own
 * behaviour, including a refused 8-credit capture spending neither side, is
 * owned by tests/db/papic-dedicated-is-a-floor.db.test.ts.
 *
 * WHAT SURVIVES HERE, STILL LOAD-BEARING:
 *
 *   (1) DEDICATED MEANS UNSHARED. A hand-out raises the camera's own bucket
 *       and NEVER the shared pool, and while the camera can pay, the pool is
 *       never charged for its captures.
 *   (2) THE POOL PROBE does not bound a dedicated camera, and does bound a
 *       pooled one (papic_event_points_remaining_for_seat, which the upload
 *       presign still reads).
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

/**
 * An event WITH a couple member — the shared 50-pt pool these tests bound
 * against is seeded by `papic_seed_free_grant_trg` on `event_members`, not on
 * `events` (migration 20271204225094: free credits are per ACCOUNT, first
 * event only). A fresh auth user per call keeps each event "somebody's first".
 */
async function createEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  const eventId = r.rows[0]!.event_id;
  const couple = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [`dedicated-couple-${eventId}@test.dev`],
  );
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, couple.rows[0]!.id],
  );
  return eventId;
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

/** The ONE live capture gate. Returns how much each balance paid. */
async function reserveSplit(
  seatId: string,
  eventId: string,
  cost: number,
): Promise<{ ok: boolean; d: number; p: number }> {
  const r = await db.query<{ ok: boolean; dedicated_spent: number; pool_spent: number }>(
    `SELECT ok, dedicated_spent, pool_spent FROM public.papic_reserve_capture_split($1, $2, $3)`,
    [seatId, eventId, cost],
  );
  const row = r.rows[0]!;
  return { ok: row.ok, d: Number(row.dedicated_spent), p: Number(row.pool_spent) };
}
const cameraRemaining = (seatId: string) =>
  one<number>(`SELECT public.papic_camera_points_remaining($1)`, [seatId]);
const dedicated = (seatId: string) =>
  one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]);
const eventRemainingForSeat = (eventId: string, seatId: string) =>
  one<number>(`SELECT public.papic_event_points_remaining_for_seat($1, $2)`, [eventId, seatId]);

async function poolTotal(eventId: string): Promise<number> {
  const r = await db.query<{ total_points: number }>(
    `SELECT total_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  return Number(r.rows[0]!.total_points);
}

// ── (1)+(2) dedicated means unshared ───────────────────────────────────────────

test('a dedicated camera pays from its OWN bucket, and the pool is never charged', async () => {
  const eventId = await createEvent('Dedicated A'); // trigger seeds the shared free pool
  const seatId = await createSeat(eventId, 300);
  const poolBefore = await poolTotal(eventId);

  await grantToSeat(eventId, seatId, 10);
  assert.equal(Number(await dedicated(seatId)), 10);

  // The SHARED pool is completely unmoved by a dedicated grant. This is the
  // whole promise: handing out a camera must not raise everybody else's ceiling.
  assert.equal(await poolTotal(eventId), poolBefore);

  assert.equal(Number(await cameraRemaining(seatId)), 10);
  for (let i = 1; i <= 10; i += 1) {
    assert.deepEqual(
      await reserveSplit(seatId, eventId, 1),
      { ok: true, d: 1, p: 0 },
      `dedicated shot ${i} must come from the camera's own bucket`,
    );
  }
  assert.equal(Number(await cameraRemaining(seatId)), 0);

  // Spending the camera's bucket never touched the shared pool's ledger.
  const poolUsed = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM public.papic_event_pool_usage WHERE event_id = $1`,
    [eventId],
  );
  assert.equal(Number(poolUsed.rows[0]!.c), 0, 'the shared pool was never charged');
});

test('the pool probe does not bound a dedicated camera, and binds every other', async () => {
  const eventId = await createEvent('Stand Down C');
  const dedicatedSeat = await createSeat(eventId, 300);
  const pooledSeat = await createSeat(eventId, 100);
  await grantToSeat(eventId, dedicatedSeat, 10);

  assert.equal(
    Number(await eventRemainingForSeat(eventId, dedicatedSeat)),
    2147483647,
    'the shared pool does not bound a dedicated camera',
  );

  // A pooled camera is bounded, and ITS capture is what charges the pool.
  assert.deepEqual(await reserveSplit(dedicatedSeat, eventId, 1), { ok: true, d: 1, p: 0 });
  assert.deepEqual(await reserveSplit(pooledSeat, eventId, 1), { ok: true, d: 0, p: 1 });
  const remaining = Number(await eventRemainingForSeat(eventId, pooledSeat));
  assert.ok(remaining > 0 && remaining < 2147483647, 'a pooled camera IS bounded');

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

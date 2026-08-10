/**
 * ONE Papic order may fund MORE THAN ONE dedicated camera.
 *
 * 🚨 THE BUG THIS PINS. Branch (A) of `papic_grant_camera_points` used a bare
 * `SELECT o.seat_id, o.points INTO …` over `papic_one_orders`. plpgsql does NOT
 * raise on multiple rows there — it keeps an arbitrary one and drops the rest.
 * So an order carrying N mapping rows granted points to ONE camera and left the
 * other N-1 provisioned, paid for, holding a QR, and holding ZERO shots.
 * Nothing threw, nothing logged; the couple just found cameras that refused to
 * shoot. Same family as the phantom column / enum value / RPC argument already
 * on the board — the database DECLINES and the only symptom is an absence.
 *
 * It was LATENT until the onboarding Papic picker (owner 2026-08-11), which
 * lets a couple add several cameras in one go and mints them as ONE order with
 * ONE reference code — because handing a brand-new couple N separate bank
 * transfers before they have seen their dashboard is not a thing we will do.
 *
 * ⚠ WHY THIS IS A DB TEST AND NOT A UNIT TEST. The defect lives entirely inside
 * plpgsql's multi-row `SELECT INTO` semantics. No amount of TypeScript around
 * the call can see it: the RPC returns a number, and the WRONG number looks
 * exactly like the right one unless you count the grant rows that landed.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let eventId: string;

/** Reference codes are UNIQUE — never reuse one across orders in a suite. */
let refSeq = 0;
const nextRef = () => `MULTICAM${(refSeq += 1).toString().padStart(4, '0')}`;

/**
 * `(event_id, seat_index)` is UNIQUE. One monotonic counter for the whole
 * suite — deriving indexes from a per-order sequence collided the moment two
 * helpers picked overlapping ranges, which is a test bug that reads exactly
 * like a schema failure.
 */
let seatSeq = 700;
const nextSeatIndex = () => (seatSeq += 1);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Multi-camera Papic Event', 'birthday') RETURNING event_id`,
  );
  eventId = ev.rows[0]!.event_id;
});

after(async () => {
  await db?.close();
});

/** Mint an order plus `count` dedicated cameras, each mapped at `points`. */
async function seedCameraOrder(
  count: number,
  points: number,
  seatPrefix: string,
): Promise<{ orderId: string; seatIds: string[] }> {
  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_ONE_50', 'Papic One — dedicated cameras', 100, 'submitted', $2)
     RETURNING order_id`,
    [eventId, nextRef()],
  );
  const orderId = order.rows[0]!.order_id;

  const seatIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const seat = await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats
         (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
       VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, 'mini', $4)
       RETURNING seat_id`,
      [eventId, nextSeatIndex(), `${seatPrefix}-${i}`, orderId],
    );
    const seatId = seat.rows[0]!.seat_id;
    seatIds.push(seatId);
    // One mapping row PER CAMERA — the shape the onboarding order minter writes.
    await db.query(
      `INSERT INTO public.papic_one_orders
         (order_id, event_id, seat_id, service_code, points, is_reload)
       VALUES ($1, $2, $3, 'PAPIC_ONE_50', $4, FALSE)`,
      [orderId, eventId, seatId, points],
    );
  }
  return { orderId, seatIds };
}

/** Every dedicated (seat-scoped) grant this order produced. */
async function grantsFor(orderId: string) {
  const r = await db.query<{ seat_id: string; points: number }>(
    `SELECT seat_id, points FROM public.papic_event_point_grants
      WHERE order_id = $1 AND source = 'camera_grant' AND seat_id IS NOT NULL
      ORDER BY seat_id`,
    [orderId],
  );
  return r.rows;
}

test('THE REGRESSION: three cameras on one order all get their shots', async () => {
  const points = 50;
  const { orderId, seatIds } = await seedCameraOrder(3, points, 'multi-a');

  const res = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );

  const grants = await grantsFor(orderId);
  assert.equal(
    grants.length,
    3,
    'every camera on the order must be funded — the pre-fix SELECT … INTO funded exactly ONE and silently dropped the rest',
  );
  assert.deepEqual(
    grants.map((g) => g.seat_id).sort(),
    [...seatIds].sort(),
    'the funded cameras must be THIS order’s cameras',
  );
  for (const g of grants) assert.equal(Number(g.points), points);
  assert.equal(
    Number(res.rows[0]!.papic_grant_camera_points),
    points * 3,
    'the return value is the SUM across cameras, not one camera’s bucket',
  );
});

test('a single-camera order is unchanged — no existing order is affected', async () => {
  const points = 100;
  const { orderId, seatIds } = await seedCameraOrder(1, points, 'multi-b');

  const res = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );

  const grants = await grantsFor(orderId);
  assert.equal(grants.length, 1);
  assert.equal(grants[0]!.seat_id, seatIds[0]);
  assert.equal(Number(grants[0]!.points), points);
  assert.equal(Number(res.rows[0]!.papic_grant_camera_points), points);
});

test('cameras bought at DIFFERENT sizes each keep their own bucket', async () => {
  // The tempting shortcut is `count × one rung's points`. It is wrong the moment
  // an order mixes sizes, so each row carries its own snapshotted `points`.
  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_ONE_50', 'Mixed sizes', 150, 'submitted', $2)
     RETURNING order_id`,
    [eventId, nextRef()],
  );
  const orderId = order.rows[0]!.order_id;

  const sizes = [50, 100];
  for (let i = 0; i < sizes.length; i += 1) {
    const seat = await db.query<{ seat_id: string }>(
      `INSERT INTO public.paparazzi_seats
         (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
       VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, 'mini', $4)
       RETURNING seat_id`,
      [eventId, nextSeatIndex(), `mixed-${i}`, orderId],
    );
    await db.query(
      `INSERT INTO public.papic_one_orders
         (order_id, event_id, seat_id, service_code, points, is_reload)
       VALUES ($1, $2, $3, 'PAPIC_ONE_50', $4, FALSE)`,
      [orderId, eventId, seat.rows[0]!.seat_id, sizes[i]],
    );
  }

  const res = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );
  const grants = await grantsFor(orderId);
  assert.deepEqual(
    grants.map((g) => Number(g.points)).sort((a, b) => a - b),
    [...sizes].sort((a, b) => a - b),
    'each camera keeps the bucket it was sold, not a shared average',
  );
  assert.equal(
    Number(res.rows[0]!.papic_grant_camera_points),
    sizes[0]! + sizes[1]!,
  );
});

test('IDEMPOTENT ACROSS CAMERAS: re-approval never double-grants a multi-camera order', async () => {
  // The guard has to stay BEFORE the loop. Behind it, a re-approval would add a
  // second full set of grants — N times the damage the single-row shape had.
  const { orderId } = await seedCameraOrder(2, 50, 'multi-c');

  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  const second = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );

  assert.equal(
    Number(second.rows[0]!.papic_grant_camera_points),
    0,
    'a second call must grant nothing',
  );
  assert.equal(
    (await grantsFor(orderId)).length,
    2,
    'and must not add a second set of grant rows',
  );
});

test('a camera’s shots stay DEDICATED — they never raise the shared pool', async () => {
  // The whole promise of Papic One. Seat-scoped grants must not be counted by
  // papic_event_pool_status, or buying a dedicated camera would quietly raise
  // everybody else's shared ceiling.
  const { orderId } = await seedCameraOrder(2, 50, 'multi-d');
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);

  const shared = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM public.papic_event_point_grants
      WHERE order_id = $1 AND seat_id IS NULL`,
    [orderId],
  );
  assert.equal(Number(shared.rows[0]!.n), 0, 'no shared grant may come from a camera order');
});

test('the legacy PAPIC_CAMERAS shape still works — branch (B) is untouched', async () => {
  // An order with mini seats and NO papic_one_orders rows must still fall
  // through to the legacy per-seat grant. This is the path pre-two-type orders
  // took, and the fix must not have stolen it by returning early.
  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, NULL, 'PAPIC_CAMERAS', 'Legacy multi-camera', 60, 'submitted', $2)
     RETURNING order_id`,
    [eventId, nextRef()],
  );
  const orderId = order.rows[0]!.order_id;
  for (let i = 0; i < 2; i += 1) {
    await db.query(
      `INSERT INTO public.paparazzi_seats
         (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
       VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, 'mini', $4)`,
      [eventId, nextSeatIndex(), `legacy-${i}`, orderId],
    );
  }

  const res = await db.query<{ papic_grant_camera_points: number }>(
    `SELECT public.papic_grant_camera_points($1, $2)`,
    [eventId, orderId],
  );
  assert.ok(
    Number(res.rows[0]!.papic_grant_camera_points) > 0,
    'the legacy branch must still fund its seats',
  );
  assert.equal((await grantsFor(orderId)).length, 2);
});

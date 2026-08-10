/**
 * Papic TWO-TYPE MODEL — END-TO-END DB verification (executed, not prose).
 *
 * Replays the REAL migrations into an in-process PGlite (../tests/db/
 * replay-migrations.ts) and asserts the four things the owner's 2026-07-29 lock
 * actually depends on:
 *
 *   (1) THE CATALOG IS THE PRICE. The Pool rungs' prices and points live in
 *       platform_retail_catalog_v2 + papic_pass_tiers, at the owner's numbers,
 *       and every rung is repeatable. Papic One is ₱1 per photo on both rungs.
 *   (2) DEDICATED MEANS UNSHARED. A camera holding a seat-scoped grant meters
 *       against its OWN bucket, refuses at its own zero, and its points are
 *       invisible to the shared pool — which is also not charged for its
 *       captures.
 *   (3) RELOAD IS ADDITIVE AND KEEPS THE QR. Granting the same seat again
 *       raises that camera's balance without minting a second camera.
 *   (4) THE FREE ONE CAMERA IS IDEMPOTENT. Re-running the provisioner produces
 *       exactly one camera and exactly one grant, however many times it runs.
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
import { papicCaptureCost, PAPIC_FREE_ONE_CAMERA_INDEX } from './papic-cameras';
import { PAPIC_ONE_LEGACY_MINI_SKU, PAPIC_ONE_SKU } from './papic-one';

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

// ── (1) the catalog IS the price ───────────────────────────────────────────

test('Papic POOL rungs come from the catalog, at the owner numbers, all repeatable', async () => {
  const rows = await db.query<{
    service_code: string;
    price: string;
    is_active: boolean;
    points: number;
    is_topup: boolean;
  }>(
    `SELECT c.service_code, c.retail_price_php AS price, c.is_active, t.points, t.is_topup
       FROM public.platform_retail_catalog_v2 c
       JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
      WHERE t.is_active
      ORDER BY t.sort_order`,
  );
  assert.deepEqual(
    rows.rows.map((r) => [r.service_code, Number(r.price), Number(r.points), r.is_active]),
    // ⚠ EXTENDED 2026-08-11 (owner): "3000, 6000, 10000, 13000, 16000, 20000
    // 23000, 26000, 30000", ₱1,000 per step. The three original rungs are
    // UNCHANGED — this lengthened the ladder, it did not reprice it, and that
    // is the thing worth checking here. Migration 20271129155172.
    [
      ['PAPIC_GUEST', 1000, 3000, true],
      ['PAPIC_GUEST_6K', 2000, 6000, true],
      ['PAPIC_GUEST_10K', 3000, 10000, true],
      ['PAPIC_GUEST_13K', 4000, 13000, true],
      ['PAPIC_GUEST_16K', 5000, 16000, true],
      ['PAPIC_GUEST_20K', 6000, 20000, true],
      ['PAPIC_GUEST_23K', 7000, 23000, true],
      ['PAPIC_GUEST_26K', 8000, 26000, true],
      ['PAPIC_GUEST_30K', 9000, 30000, true],
    ],
  );
  // Every rung is a repeatable TOP-UP now, so none may still be gated behind
  // "you must already hold 10,000 points" — that gate is what made the old
  // fourth rung necessary, and it is gone with it.
  assert.equal(rows.rows.every((r) => r.is_topup === false), true);

  // The superseded rung must be un-sellable in BOTH places: dark in the
  // catalog, AND worth zero points if an order for it somehow exists — because
  // resolveRetailChargeCentavos() prices by service_code without checking
  // is_active, so catalog-dark alone is not a fence.
  assert.equal(
    await one<boolean>(
      `SELECT is_active FROM public.platform_retail_catalog_v2 WHERE service_code = 'PAPIC_GUEST_TOPUP'`,
    ),
    false,
  );
  assert.equal(
    await one<boolean>(
      `SELECT is_active FROM public.papic_pass_tiers WHERE service_code = 'PAPIC_GUEST_TOPUP'`,
    ),
    false,
  );
});

test('Papic ONE is ONE rung — 150 credits for ₱50 — and 250 is gone', async () => {
  const rows = await db.query<{ service_code: string; price: string; points: number }>(
    `SELECT c.service_code, c.retail_price_php AS price, t.points
       FROM public.platform_retail_catalog_v2 c
       JOIN public.papic_one_tiers t ON t.service_code = c.service_code
      WHERE t.is_active AND c.is_active
      ORDER BY t.sort_order`,
  );
  assert.deepEqual(
    rows.rows.map((r) => [r.service_code, Number(r.price), Number(r.points)]),
    // ⚠ SUPERSEDED 2026-08-11 (owner): "100 papic credits for 50 pesos … remove
    // the 100 pesos. let's just have one price for papic one." The two-rung
    // ladder AND the flat "₱1 = 1 credit" rule that went with it are both gone;
    // the rate is now ₱0.333 per credit on the single surviving rung —
    // within ~11% of the Pool's ₱0.30, where it used to be 3×.
    // Migration 20271129422037.
    [[PAPIC_ONE_SKU, 50, 150]],
  );
  assert.equal(rows.rows.length, 1, 'a second sellable rung means the ₱100 offer came back');

  // The 50-credit rung is retired, and must be un-sellable in BOTH places —
  // catalog-dark alone is not a fence, because resolveRetailChargeCentavos()
  // prices by service_code without checking is_active.
  for (const table of ['platform_retail_catalog_v2', 'papic_one_tiers']) {
    assert.equal(
      await one<boolean>(
        `SELECT is_active FROM public.${table} WHERE service_code = '${PAPIC_ONE_LEGACY_MINI_SKU}'`,
      ),
      false,
      `${PAPIC_ONE_LEGACY_MINI_SKU} is still live in ${table} — the superseded ` +
        `₱50/50-credit offer is back on the ladder beside the ₱50/100-credit one`,
    );
  }

  // The retired ₱100 -> 250 conversion must not survive as a live value.
  assert.equal(
    Number(
      await one<number>(
        `SELECT camera_grant_points FROM public.papic_event_pool_config WHERE config_key = 'default'`,
      ),
    ),
    0,
  );
});

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

// ── (4) the free One camera ────────────────────────────────────────────────

test('the free Papic One camera is ONE camera with 5 shots, however often it runs', async () => {
  const eventId = await createEvent('Free One E');

  const first = await one<string>(`SELECT public.papic_ensure_free_one_camera($1)`, [eventId]);
  assert.ok(first, 'the free One camera is armed');
  assert.equal(Number(await dedicated(first)), 5, 'with its own 5 dedicated shots');

  // This runs from every event-commit path AND lazily from the Papic studio, so
  // it WILL run more than once. Stacking 5s would silently inflate the camera.
  for (let i = 0; i < 4; i += 1) {
    assert.equal(
      await one<string>(`SELECT public.papic_ensure_free_one_camera($1)`, [eventId]),
      first,
      're-running returns the SAME camera',
    );
  }
  assert.equal(Number(await dedicated(first)), 5, 'and never stacks a second grant');

  // The index is pinned to the app constant, so the SQL function and the code
  // that reasons about "the free One camera" can never drift to two places.
  const seats = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM public.paparazzi_seats WHERE event_id = $1 AND seat_index = $2`,
    [eventId, PAPIC_FREE_ONE_CAMERA_INDEX],
  );
  assert.equal(Number(seats.rows[0]!.c), 1, 'exactly one free One camera');

  const grants = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM public.papic_event_point_grants
      WHERE seat_id = $1 AND source = 'camera_grant' AND order_id IS NULL`,
    [first],
  );
  assert.equal(Number(grants.rows[0]!.c), 1, 'exactly one free grant');

  // It is a FREE-tier seat on purpose: the paid gate refuses any paid-tier seat
  // whose order is not settled, and this camera has no order to settle.
  assert.equal(
    await one<string>(`SELECT tier FROM public.paparazzi_seats WHERE seat_id = $1`, [first]),
    'free',
  );

  // Its 5 shots are its own — the shared pool neither gains them nor is charged
  // when they are spent.
  const poolBefore = await poolTotal(eventId);
  for (let i = 1; i <= 5; i += 1) {
    assert.equal(await reserveCamera(first, eventId, 1), true, `free One shot ${i}`);
  }
  assert.equal(await reserveCamera(first, eventId, 1), false, 'the 6th is refused');
  assert.equal(await poolTotal(eventId), poolBefore, 'the shared pool is untouched');

  // A reload can top up the FREE camera too — that is the point of "including
  // the free one", and it is why the once-per-seat guard is scoped to grants
  // with NO order_id: the free grant is once, paid reloads stack forever.
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [`papic-free-reload-${randomUUID()}@test.dev`],
  );
  const orderId = await one<string>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, $3, 'Papic One reload of the free camera', 50, 'paid', $4)
     RETURNING order_id`,
    [eventId, userId, PAPIC_ONE_LEGACY_MINI_SKU, `SN${randomUUID().slice(0, 12).toUpperCase()}`],
  );
  await db.query(
    `INSERT INTO public.papic_one_orders (order_id, event_id, seat_id, service_code, points, is_reload)
     VALUES ($1, $2, $3, $4, 50, TRUE)`,
    [orderId, eventId, first, PAPIC_ONE_LEGACY_MINI_SKU],
  );
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  assert.equal(Number(await cameraRemaining(first)), 50, 'the reload revives the free camera');
  assert.equal(Number(await dedicated(first)), 55, 'free 5 + reloaded 50');
});

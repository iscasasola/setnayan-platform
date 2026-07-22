/**
 * Papic ONE-POOL metering — END-TO-END DB verification (executed, not prose).
 *
 * Exercises the REAL production schema (all supabase/migrations replayed into an
 * in-process PGlite — see ../tests/db/replay-migrations.ts) for the three
 * load-bearing guarantees of the Papic One / Pool / Free one-pool model
 * (owner 2026-07-22 · Papic_One_Pool_Model_Spec §0):
 *
 *   (a) POOL BINDING (Residual Risk R4) — a priced event pool actually binds:
 *       papic_reserve_event_points decrements the pool and refuses at 0, on BOTH
 *       the photo weight (1 pt) and the clip weight (3 pts), never partially.
 *       This is the exact fence the guest-capture route bypassed before this PR.
 *   (b) FREE POOL CAP — the event-creation trigger seeds exactly ONE 50-pt
 *       free_grant, the pool applies, the 51st capture is refused, and a free
 *       event (owning no PAPIC_GUEST order) can still record via the pool.
 *   (c) ONE GRANT — Papic One grants 250 pts PER paid mini camera into the same
 *       pool (2 cameras = 500), idempotent by order_id.
 *
 * Lives under lib/ (not tests/db/) so it runs in the `test:unit` glob
 * (lib/**\/*.test.ts) alongside the other metering unit tests; the replay
 * harness runs fully in-process (no docker / supabase / network).
 */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from '../tests/db/replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

/** Create an event — fires the real papic_seed_free_grant_trg (seeds 50 pts). */
async function createEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

/** Insert an auth user (fires the real signup trigger → public.users row). */
async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

async function createGuest(eventId: string): Promise<string> {
  const r = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Test', 'Guest', 'both', 'friends') RETURNING guest_id`,
    [eventId],
  );
  return r.rows[0]!.guest_id;
}

/** papic_reserve_event_points(event, cost) → did it book? */
async function reserve(eventId: string, cost: number): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT public.papic_reserve_event_points($1, $2) AS ok`,
    [eventId, cost],
  );
  return r.rows[0]!.ok === true;
}

async function poolStatus(
  eventId: string,
): Promise<{ applies: boolean; total: number }> {
  const r = await db.query<{ applies: boolean; total_points: number }>(
    `SELECT applies, total_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  return { applies: r.rows[0]!.applies === true, total: Number(r.rows[0]!.total_points) };
}

async function clearUsage(eventId: string): Promise<void> {
  await db.query(`DELETE FROM public.papic_event_pool_usage WHERE event_id = $1`, [eventId]);
}

// ── (a) POOL BINDING — the R4 fence, photo + clip, fail-closed ──────────────
test('pool binds a priced grant — photo + clip, fail-closed, never partial', async () => {
  const eventId = await createEvent('Pool Binding E');
  // Isolate to a known N=4: drop the auto-seeded free_grant, add a 4-pt top-up.
  await db.query(`DELETE FROM public.papic_event_point_grants WHERE event_id = $1`, [eventId]);
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source)
     VALUES ($1, 4, 'topup_order')`,
    [eventId],
  );

  const status = await poolStatus(eventId);
  assert.equal(status.applies, true, 'a granted event applies');
  assert.equal(status.total, 4, 'grant-only total == SUM(grants), no guest-clamp base');

  // PHOTO path (1 pt): 4 succeed, the 5th is refused.
  for (let i = 1; i <= 4; i += 1) {
    assert.equal(await reserve(eventId, 1), true, `photo ${i} should book`);
  }
  assert.equal(await reserve(eventId, 1), false, '5th photo refused at 0');

  // CLIP path (3 pts): exact-fit then refuse.
  await clearUsage(eventId);
  assert.equal(await reserve(eventId, 1), true, 'photo → used 1, remaining 3');
  assert.equal(await reserve(eventId, 3), true, 'clip exactly fits the last 3');
  assert.equal(await reserve(eventId, 3), false, 'clip refused at remaining 0');

  // A clip NEVER partially books: with remaining 1, a 3-pt clip is refused whole.
  await clearUsage(eventId);
  assert.equal(await reserve(eventId, 1), true);
  assert.equal(await reserve(eventId, 1), true);
  assert.equal(await reserve(eventId, 1), true); // used 3, remaining 1
  assert.equal(await reserve(eventId, 3), false, 'clip never partially books');
});

// ── (b) FREE POOL CAP — exactly 50, 51st refused, records via pool ──────────
test('free grant is exactly 50, caps the pool, and lets a free event record', async () => {
  const eventId = await createEvent('Free Cap F');

  const g = await db.query<{ points: number }>(
    `SELECT points FROM public.papic_event_point_grants
      WHERE event_id = $1 AND source = 'free_grant'`,
    [eventId],
  );
  assert.equal(g.rows.length, 1, 'exactly one free_grant seeded');
  assert.equal(Number(g.rows[0]!.points), 50, 'free_grant is exactly 50 pts');

  const status = await poolStatus(eventId);
  assert.equal(status.applies, true);
  assert.equal(status.total, 50, 'free pool total is 50');

  // Ownership-via-pool: the free event owns NO PAPIC_GUEST order, yet records
  // (the record RPC no longer 150-caps a pool event — the reserve is the cap).
  // Call the 6-arg overload explicitly (three coexist: 2/3/6-arg with defaults,
  // so a bare 2-arg call is ambiguous) — the 6-arg one is what this PR rebinds
  // and what the guest-capture route calls first.
  const guestId = await createGuest(eventId);
  const rec = await db.query<{ r: { status?: string; unlimited?: boolean } }>(
    `SELECT public.papic_record_guest_capture(
        $1::uuid, 'r2://test/free.jpg'::text, false, 'photo'::text, NULL::int, NULL::text
      ) AS r`,
    [guestId],
  );
  assert.equal(rec.rows[0]!.r.status, 'ok', 'free event records (not not_owned)');

  // 50 reserves succeed; the 51st is refused (fail-closed at 0). The record
  // above does NOT reserve, so counting starts fresh at used 0.
  for (let i = 1; i <= 50; i += 1) {
    assert.equal(await reserve(eventId, 1), true, `capture ${i} within the 50-pt pool`);
  }
  assert.equal(await reserve(eventId, 1), false, '51st capture refused');
});

// ── (c) ONE GRANT — 250 per paid mini camera, idempotent ────────────────────
test('Papic One grants 250 per paid camera (2 → 500), idempotent by order', async () => {
  const eventId = await createEvent('One Grant G');
  const userId = await createUser(`papic-one-${randomUUID()}@test.dev`);

  const order = await db.query<{ order_id: string }>(
    `INSERT INTO public.orders
       (event_id, user_id, service_key, description, requested_total_php, status, reference_code)
     VALUES ($1, $2, 'PAPIC_CAMERAS', 'Papic One x2', 200, 'paid', $3)
     RETURNING order_id`,
    [eventId, userId, `SN${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`],
  );
  const orderId = order.rows[0]!.order_id;

  // 2 mini cameras provisioned for THIS order (as provisionPaidCamerasAdmin does).
  await db.query(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, tier, paid_order_id)
     VALUES ($1, 200, 'PAPIC_CAMERA_MINI_DAY', $2, 'mini', $4),
            ($1, 201, 'PAPIC_CAMERA_MINI_DAY', $3, 'mini', $4)`,
    [eventId, randomUUID(), randomUUID(), orderId],
  );

  const granted = await db.query<{ total: number }>(
    `SELECT public.papic_grant_camera_points($1, $2) AS total`,
    [eventId, orderId],
  );
  assert.equal(Number(granted.rows[0]!.total), 500, '2 cameras × 250 = 500 granted');

  const sum = async () => {
    const r = await db.query<{ s: number }>(
      `SELECT COALESCE(SUM(points), 0) AS s FROM public.papic_event_point_grants
        WHERE order_id = $1 AND source = 'camera_grant'`,
      [orderId],
    );
    return Number(r.rows[0]!.s);
  };
  assert.equal(await sum(), 500, 'one camera_grant row of 500 for the order');

  const seatCount = await db.query<{ c: number }>(
    `SELECT COUNT(*) AS c FROM public.paparazzi_seats
      WHERE paid_order_id = $1 AND tier = 'mini'`,
    [orderId],
  );
  assert.equal(Number(seatCount.rows[0]!.c), 2, '2 mini seats for the order');

  // Idempotent: a re-approval must not double-grant.
  await db.query(`SELECT public.papic_grant_camera_points($1, $2)`, [eventId, orderId]);
  assert.equal(await sum(), 500, 're-approval does not double-grant');
});

/**
 * PAPIC IS ONE PRODUCT — the ladder, and the host handing shots to a QR code.
 *
 * Two migrations under test, both owner-locked 2026-08-11:
 *   20271130515135 — one ladder (50 free · 100 ₱50 · 3,000 ₱1,000 ·
 *                    10,000 ₱3,000 · 20,000 ₱5,000), Papic One retired
 *   20271131476413 — papic_dedicate_shots + papic_seat_allocations
 *
 * ── WHAT THIS IS REALLY GUARDING ──────────────────────────────────────────
 * The hand-out is ZERO-SUM against a live capture gate. Every assertion below
 * is ultimately one question: can a shot ever be spent twice, or vanish?
 *
 *   • hand 200 to a camera  → the shared pot must drop by exactly 200
 *   • take 200 back         → it must come back, and ONLY the unspent part
 *   • the gate must SEE the hand-out — papic_seat_dedicated_points composing
 *     grants and allocations is what stops a camera and the pool spending the
 *     same shot, and it is the one failure with no visible symptom
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

let seatCounter = 0;

/**
 * An event with one camera and a shared pot.
 *
 * ⚠ `startShared` is READ BACK, never assumed to equal `granted`. Every event is
 * armed with the free 50 the moment it exists, so a seed of 1,000 reads 1,050 —
 * which is the owner's rule working ("buy 3,000, hold 3,050"), not noise. The
 * assertions below are all DELTAS for the same reason: zero-sum is a statement
 * about the change, and a test pinned to an absolute number would fail the day
 * the free grant moves off 50 while telling you nothing about the hand-out.
 */
async function seedEvent(
  granted: number,
): Promise<{ eventId: string; seatId: string; startShared: number }> {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('Hand-out test', 'birthday', CURRENT_DATE + 30) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  if (granted > 0) {
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
       VALUES ($1, $2, 'admin', 'test seed')`,
      [eventId, granted],
    );
  }

  // The claim token is UNIQUE across every event, so it has to vary per seed or
  // the second event in a test collides on it rather than on anything real.
  seatCounter += 1;
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, 700, 'PAPIC_CAMERA_FREE', $2, 'free')
     RETURNING seat_id`,
    [eventId, `handout-test-seat-${seatCounter}`],
  );
  const seatId = seat.rows[0]!.seat_id;
  const startShared = await sharedRemaining(eventId);
  return { eventId, seatId, startShared };
}

const sharedRemaining = (eventId: string) =>
  one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);
const dedicated = (seatId: string) =>
  one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]);

// ── the ladder ─────────────────────────────────────────────────────────────

test('exactly the four rungs the owner named are sellable, at his prices', async () => {
  const rungs = await db.query<{ points: number; php: string }>(
    `SELECT t.points, c.retail_price_php AS php
       FROM public.papic_pass_tiers t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.is_active AND c.is_active
      ORDER BY t.points`,
  );
  assert.deepEqual(
    rungs.rows.map((r) => [r.points, Number(r.php)]),
    [
      [100, 50],
      [3_000, 1_000],
      [10_000, 3_000],
      [20_000, 5_000],
    ],
    'the ladder is owner-locked 2026-08-11 — a rung added or repriced here is a pricing decision, not a code change',
  );
});

test('value strictly improves up the ladder, so no rung is one nobody should buy', async () => {
  const rungs = await db.query<{ points: number; php: string }>(
    `SELECT t.points, c.retail_price_php AS php
       FROM public.papic_pass_tiers t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.is_active AND c.is_active
      ORDER BY t.points`,
  );
  const rates = rungs.rows.map((r) => Number(r.php) / r.points);
  for (let i = 1; i < rates.length; i += 1) {
    assert.ok(
      rates[i]! < rates[i - 1]!,
      `rung ${i} costs ${rates[i]}/credit, no better than the ${rates[i - 1]} below it`,
    );
  }
});

test('Papic One is retired as a purchase, but its legacy grant can still resolve', async () => {
  assert.equal(
    await one<string>(`SELECT count(*)::text FROM public.papic_one_tiers WHERE is_active`),
    '0',
    'there is one product now — an active One rung would put the retired product back on sale',
  );
  // deactivate ≠ drop. papic_grant_camera_points branch (B) resolves every
  // legacy multi-camera order through this row's points.
  assert.ok(
    Number(
      await one<string>(
        `SELECT count(*)::text FROM public.papic_one_tiers
          WHERE service_code = 'PAPIC_CAMERA_MINI_DAY' AND points > 0`,
      ),
    ) > 0,
    'PAPIC_CAMERA_MINI_DAY lost its points row — every pre-change camera order would grant nothing',
  );
});

test('free is a flat 50 — no fourth camera armed with its own 5', async () => {
  assert.equal(
    await one<number>(
      `SELECT free_one_camera_points FROM public.papic_event_pool_config WHERE config_key = 'default'`,
    ),
    0,
  );
  // papic_ensure_free_one_camera treats <= 0 as "arm nothing"; prove it rather
  // than trusting the comment, because the copy follows this same number.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Free tier check', 'birthday') RETURNING event_id`,
  );
  const seat = await one<string | null>(`SELECT public.papic_ensure_free_one_camera($1)`, [
    ev.rows[0]!.event_id,
  ]);
  assert.equal(seat, null, 'the free One camera must no longer be armed');
});

// ── handing shots out ──────────────────────────────────────────────────────

test('handing shots to a camera moves them out of the shared pot, exactly', async () => {
  const { eventId, seatId, startShared } = await seedEvent(1_000);
  assert.equal(await dedicated(seatId), 0);

  const got = await one<number>(`SELECT public.papic_dedicate_shots($1, $2, $3)`, [
    eventId,
    seatId,
    200,
  ]);

  assert.equal(got, 200);
  assert.equal(await dedicated(seatId), 200, "the camera's own balance must rise by exactly the hand-out");
  assert.equal(
    await sharedRemaining(eventId),
    startShared - 200,
    'ZERO-SUM: what the camera gained, the pot must have lost. An unchanged pot means the same 200 shots can be spent twice — once by the camera and once by everyone else.',
  );
});

test('taking shots back returns them to the pot', async () => {
  const { eventId, seatId, startShared } = await seedEvent(1_000);
  await one(`SELECT public.papic_dedicate_shots($1, $2, 300)`, [eventId, seatId]);
  assert.equal(await sharedRemaining(eventId), startShared - 300);

  await one(`SELECT public.papic_dedicate_shots($1, $2, 50)`, [eventId, seatId]);

  assert.equal(await dedicated(seatId), 50);
  assert.equal(
    await sharedRemaining(eventId),
    startShared - 50,
    'lowering the target IS the inverse — a hand-out that cannot be undone strands the shots on the wrong QR forever',
  );
});

test('setting the same target twice changes nothing the second time', async () => {
  const { eventId, seatId, startShared } = await seedEvent(1_000);
  await one(`SELECT public.papic_dedicate_shots($1, $2, 400)`, [eventId, seatId]);
  await one(`SELECT public.papic_dedicate_shots($1, $2, 400)`, [eventId, seatId]);

  assert.equal(await dedicated(seatId), 400);
  assert.equal(
    await sharedRemaining(eventId),
    startShared - 400,
    'a TARGET must be idempotent — a double-tap that charged the pot twice is a delta wearing a target’s clothes',
  );
});

test('you cannot hand out shots the event does not still have', async () => {
  const { eventId, seatId, startShared } = await seedEvent(100);
  await assert.rejects(
    () =>
      db.query(`SELECT public.papic_dedicate_shots($1, $2, $3)`, [
        eventId,
        seatId,
        startShared + 1,
      ]),
    new RegExp(`only ${startShared} shots are still shared`),
    'refusing must be loud — a silent clamp leaves the host unsure which number is real',
  );
  assert.equal(await dedicated(seatId), 0, 'a refused hand-out must move nothing at all');
  assert.equal(await sharedRemaining(eventId), startShared);
});

test('you cannot take back shots the camera has already taken', async () => {
  const { eventId, seatId, startShared } = await seedEvent(1_000);
  await one(`SELECT public.papic_dedicate_shots($1, $2, 300)`, [eventId, seatId]);

  // the camera shoots 120 of its own
  await db.query(
    `INSERT INTO public.papic_seat_point_usage (seat_id, points_used) VALUES ($1, 120)`,
    [seatId],
  );

  await assert.rejects(
    () => db.query(`SELECT public.papic_dedicate_shots($1, $2, 50)`, [eventId, seatId]),
    /already taken 120 shots/,
  );

  // …but coming down to exactly what was spent is allowed.
  assert.equal(
    await one<number>(`SELECT public.papic_dedicate_shots($1, $2, 120)`, [eventId, seatId]),
    120,
  );
  assert.equal(await sharedRemaining(eventId), startShared - 120);
});

test('a camera from another event cannot be handed this event’s shots', async () => {
  const mine = await seedEvent(1_000);
  const theirs = await seedEvent(1_000);

  await assert.rejects(
    () => db.query(`SELECT public.papic_dedicate_shots($1, $2, 100)`, [mine.eventId, theirs.seatId]),
    /does not belong to this event/,
    'a seat id is not a capability — without this guard one host drains another host’s pot',
  );
  assert.equal(await sharedRemaining(mine.eventId), mine.startShared);
  assert.equal(await dedicated(theirs.seatId), 0);
});

test('a hand-out makes the pool stand down for that camera, so a shot is never billed twice', async () => {
  const { eventId, seatId, startShared } = await seedEvent(1_000);
  await one(`SELECT public.papic_dedicate_shots($1, $2, 200)`, [eventId, seatId]);

  // -1 = "not applicable, this seat is metered against its OWN balance".
  // 1 would mean the shared pot was ALSO charged for a capture the camera paid
  // for out of its dedicated shots — the double-spend this whole design exists
  // to prevent, and one that leaves no trace anywhere.
  // ⚠ (event, seat, cost) — in that order. Reversing them silently returns 1
  // instead of -1, because the dedicated lookup is then handed an event id and
  // finds nothing. Positional args on a two-UUID signature are a trap; the app
  // calls this RPC by NAME, which is why it cannot hit this.
  assert.equal(
    await one<number>(`SELECT public.papic_reserve_event_points_for_seat($1, $2, 1)`, [
      eventId,
      seatId,
    ]),
    -1,
  );
  assert.equal(
    await sharedRemaining(eventId),
    startShared - 200,
    'the shared pot must not have moved',
  );
});

test('handing out the whole pot does not make the event look like it has no Papic at all', async () => {
  const { eventId, seatId, startShared } = await seedEvent(1_000);
  await one(`SELECT public.papic_dedicate_shots($1, $2, $3)`, [eventId, seatId, startShared]);

  const row = await db.query<{ applies: boolean; granted_points: number; total_points: number }>(
    `SELECT applies, granted_points, total_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  assert.equal(
    row.rows[0]!.applies,
    true,
    'granted_points is this function’s test for "does this event have a pool product"; subtracting hand-outs from it would flip a fully-allocated event to applies=false and report the pool as non-existent on an event that had just paid for it',
  );
  assert.equal(
    row.rows[0]!.granted_points,
    startShared,
    'granted means what was BOUGHT (plus the free grant) — it must not move when shots are handed out',
  );
  assert.equal(row.rows[0]!.total_points, 0, 'total means what is still SHARED');
});

test('the allocations table is not reachable by a session role', async () => {
  for (const role of ['anon', 'authenticated']) {
    assert.equal(
      await one<boolean>(`SELECT has_table_privilege($1, 'public.papic_seat_allocations', 'SELECT')`, [
        role,
      ]),
      false,
      `${role} can read papic_seat_allocations — every table in public ships OPEN and the REVOKE was missed`,
    );
  }
});

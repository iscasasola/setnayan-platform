/**
 * DEDICATED CREDITS ARE A FLOOR, NOT A CEILING (owner-locked 2026-08-11).
 *
 * ── THE DEFECT THIS LOCKS SHUT ────────────────────────────────────────────
 * Handing a camera its own credits used to silently CAP it. Measured before the
 * fix: an event holding 1,047 shared credits, a camera given 3 dedicated. It
 * took its 3, and the 4th capture was refused while the pot sat untouched at
 * 1,047 — because the pool gate stood down on the camera having EVER held
 * dedicated credits rather than having any LEFT.
 *
 * So "give this camera 200 shots of its own" meant "limit this camera to 200",
 * the exact opposite of the promise. Dedicating is supposed to guarantee a floor
 * nobody else can spend, not build a wall around the camera.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * Owner, on a capture that straddles both balances: *"spend 2 and take 6."*
 * The camera's own credits go first, the pot pays the remainder, and a camera
 * never stops while the event has credits anywhere.
 *
 * Run: cd apps/web && npx tsx --test tests/db/papic-dedicated-is-a-floor.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let seatCounter = 0;

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

type Split = { ok: boolean; dedicated_spent: number; pool_spent: number };

const reserve = async (seatId: string, eventId: string, cost: number): Promise<Split> => {
  const r = await db.query<Split>(
    `SELECT ok, dedicated_spent, pool_spent FROM public.papic_reserve_capture_split($1,$2,$3)`,
    [seatId, eventId, cost],
  );
  return r.rows[0]!;
};
const poolLeft = (eventId: string) =>
  one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);
const available = (seatId: string, eventId: string) =>
  one<number>(`SELECT public.papic_capture_points_available($1,$2)`, [seatId, eventId]);

/** An event with `granted` shared credits and one camera holding `dedicated`. */
async function seed(granted: number, dedicated: number) {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Floor test', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  if (granted > 0) {
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
       VALUES ($1, $2, 'admin', 'floor test')`,
      [eventId, granted],
    );
  }
  seatCounter += 1;
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, 800, 'PAPIC_CAMERA_FREE', $2, 'free') RETURNING seat_id`,
    [eventId, `floor-seat-${seatCounter}`],
  );
  const seatId = seat.rows[0]!.seat_id;
  if (dedicated > 0) {
    await one(`SELECT public.papic_dedicate_shots($1,$2,$3)`, [eventId, seatId, dedicated]);
  }
  return { eventId, seatId, poolStart: await poolLeft(eventId) };
}

// ── the owner's rule, exactly ──────────────────────────────────────────────

test('🚨 spend 2 and take 6 — the camera pays what it can, the pot pays the rest', async () => {
  const { eventId, seatId, poolStart } = await seed(100, 2);

  const r = await reserve(seatId, eventId, 8);

  assert.equal(r.ok, true);
  assert.equal(r.dedicated_spent, 2, 'the camera must spend ALL of its own first');
  assert.equal(r.pool_spent, 6, 'the pot must cover exactly the remainder');
  assert.equal(await poolLeft(eventId), poolStart - 6, 'the pot must lose only the remainder');
});

test('🚨 THE DEFECT ITSELF — an emptied camera carries on from the pot', async () => {
  // This is the measured bug, inverted into a guard. Before the fix the fourth
  // capture here was REFUSED with the pot full.
  const { eventId, seatId, poolStart } = await seed(1_000, 3);

  for (let i = 1; i <= 3; i += 1) {
    const r = await reserve(seatId, eventId, 1);
    assert.equal(r.ok, true, `dedicated shot ${i}`);
    assert.equal(r.dedicated_spent, 1, `shot ${i} must come from the camera's own`);
    assert.equal(r.pool_spent, 0);
  }
  assert.equal(await poolLeft(eventId), poolStart, 'the pot is untouched while the camera has its own');

  const fourth = await reserve(seatId, eventId, 1);
  assert.equal(
    fourth.ok,
    true,
    'THE BUG: the camera stopped dead here while the event still held a thousand credits',
  );
  assert.equal(fourth.dedicated_spent, 0);
  assert.equal(fourth.pool_spent, 1, 'the pot pays once the camera has nothing of its own left');
  assert.equal(await poolLeft(eventId), poolStart - 1);
});

test('a camera with no dedicated credits at all just uses the pot', async () => {
  const { eventId, seatId, poolStart } = await seed(50, 0);
  const r = await reserve(seatId, eventId, 8);
  assert.deepEqual(
    { ok: r.ok, dedicated_spent: r.dedicated_spent, pool_spent: r.pool_spent },
    { ok: true, dedicated_spent: 0, pool_spent: 8 },
  );
  assert.equal(await poolLeft(eventId), poolStart - 8);
});

// ── all-or-nothing ─────────────────────────────────────────────────────────

test('🚨 a refusal spends NEITHER side — the camera keeps its own credits', async () => {
  // The camera holds 2; the pot holds nothing. A capture costing 8 cannot be
  // paid. If the camera's 2 were consumed anyway, a shot that never happened
  // would have quietly eaten a guarantee.
  const { eventId, seatId } = await seed(0, 2);
  // drain whatever free grant the event was armed with
  const left = await poolLeft(eventId);
  if (left > 0) await one(`SELECT public.papic_reserve_event_points($1,$2)`, [eventId, left]);
  assert.equal(await poolLeft(eventId), 0);

  const r = await reserve(seatId, eventId, 8);

  assert.equal(r.ok, false, 'nothing can pay for this capture');
  assert.equal(r.dedicated_spent, 0);
  assert.equal(r.pool_spent, 0);
  assert.equal(
    await available(seatId, eventId),
    2,
    'the refused capture must leave the camera’s 2 credits exactly where they were',
  );
});

test('the camera can still spend its own even when the pot is empty', async () => {
  const { eventId, seatId } = await seed(0, 5);
  const left = await poolLeft(eventId);
  if (left > 0) await one(`SELECT public.papic_reserve_event_points($1,$2)`, [eventId, left]);

  const r = await reserve(seatId, eventId, 5);
  assert.deepEqual(
    { ok: r.ok, d: r.dedicated_spent, p: r.pool_spent },
    { ok: true, d: 5, p: 0 },
    'a guaranteed floor must survive an empty pot — that is what it is for',
  );
});

// ── the inverse ────────────────────────────────────────────────────────────

test('🔑 releasing a split puts each half back where it came from', async () => {
  const { eventId, seatId, poolStart } = await seed(100, 2);
  const r = await reserve(seatId, eventId, 8);
  assert.equal(await poolLeft(eventId), poolStart - 6);
  assert.equal(await available(seatId, eventId), poolStart - 6);

  await one(`SELECT public.papic_release_capture_split($1,$2,$3,$4)`, [
    seatId,
    eventId,
    r.dedicated_spent,
    r.pool_spent,
  ]);

  assert.equal(await poolLeft(eventId), poolStart, 'the pot must get its 6 back');
  // the camera's own 2 are back too: available = 2 dedicated + the whole pot
  assert.equal(
    await available(seatId, eventId),
    poolStart + 2,
    'releasing the whole cost to either side alone silently moves credits between the camera and the pot',
  );
});

// ── the guards ─────────────────────────────────────────────────────────────

test('a camera from another event cannot charge this event’s pot', async () => {
  const mine = await seed(100, 0);
  const theirs = await seed(100, 0);

  const r = await reserve(theirs.seatId, mine.eventId, 5);
  assert.equal(r.ok, false, 'a seat id is not a capability');
  assert.equal(await poolLeft(mine.eventId), mine.poolStart);
});

test('a nonsense cost is refused rather than charged', async () => {
  const { eventId, seatId, poolStart } = await seed(100, 5);
  for (const bad of [0, -1, -100]) {
    const r = await reserve(seatId, eventId, bad);
    assert.equal(r.ok, false, `cost ${bad} must be refused`);
    assert.equal(r.dedicated_spent, 0);
    assert.equal(r.pool_spent, 0);
  }
  assert.equal(await poolLeft(eventId), poolStart);
  assert.equal(await available(seatId, eventId), poolStart + 5);
});

test('what a camera can shoot counts BOTH balances', async () => {
  // The presign probe reads this. Asking the camera's own bucket alone is what
  // refused an upload URL to a camera with a full pot behind it.
  const { eventId, seatId, poolStart } = await seed(100, 7);
  assert.equal(await available(seatId, eventId), poolStart + 7);

  await reserve(seatId, eventId, 7); // spends the camera's own exactly
  assert.equal(
    await available(seatId, eventId),
    poolStart,
    'an emptied camera still has the whole pot available to it',
  );
});

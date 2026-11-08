/**
 * THE PAPIC PER-SEAT DAILY BUDGET IS RETIRED — AND NO CAPTURE WENT FREE WITH IT.
 *
 * Owner, 5 Nov 2026, on "Papic per-seat daily budget": *"retire. we do not have
 * papic seat anymore"* — confirming DECISION_LOG 2026-09-16 *"ONE POOL OF
 * CREDITS, SHARED BY EVERYBODY … no dedicated shots individually"*.
 *
 * The retirement removed the last thing that READ the per-day budget
 * (`app/api/upload/route.ts` looked up `papic_tier_config.points_per_day` to
 * pick its refusal sentence). This file proves the money side stayed shut:
 *
 *   1. No SQL function or view reads the per-day budget — so nothing can grant
 *      a camera a fresh allowance each day.
 *   2. On EVERY seat tier, even with `points_per_day` set high, each capture
 *      debits the event's ONE shared pool by exactly its cost, and the per-day
 *      ledger is never written.
 *   3. When the pool cannot cover a capture it is REFUSED, no photo row is
 *      written, and the pool does not move.
 *   4. A seat capture and a guest phone read the SAME pool.
 *
 * The guest-phone path's own exhaustion is pinned in
 * `lib/papic-pool-metering.test.ts` (test "route pool gate").
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { papicCaptureCost } from '../../lib/papic-cameras-pure';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

let n = 0;

/** One event with a couple member (that is what seeds the free pool) and one
 *  claimed camera on `tier`, with NO credits of its own. */
async function seatOnTier(tier: string): Promise<{ eventId: string; seatId: string; userId: string }> {
  n += 1;
  const claimer = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`no-daily-claimer-${n}@example.test`],
  );
  const couple = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [`no-daily-couple-${n}@example.test`],
  );
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ('No daily budget', 'birthday', CURRENT_DATE + 30) RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, couple.rows[0]!.id],
  );
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, tier, claimer_user_id)
     VALUES ($1, 700, 'PAPIC_CAMERA_FREE', $2, $3, $4) RETURNING seat_id`,
    [eventId, `no-daily-seat-${n}`, tier, claimer.rows[0]!.id],
  );
  return { eventId, seatId: seat.rows[0]!.seat_id, userId: claimer.rows[0]!.id };
}

async function poolLeft(eventId: string): Promise<number> {
  const { rows } = await db.query<{ applies: boolean; remaining_points: number }>(
    `SELECT applies, remaining_points FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  assert.equal(rows[0]?.applies, true, 'the pool does not apply to this event — every check below would be vacuous');
  return Number(rows[0]!.remaining_points);
}

async function shoot(
  f: { eventId: string; seatId: string; userId: string },
  kind: 'photo' | 'clip',
  cost: number,
): Promise<{ status: string; dedicated_spent?: number; pool_spent?: number }> {
  n += 1;
  const { rows } = await db.query<{ r: { status: string; dedicated_spent?: number; pool_spent?: number } }>(
    `SELECT public.papic_record_seat_capture(
       $1::uuid, $2::uuid, $3::uuid, $4, $5, NULL, $6) AS r`,
    [f.seatId, f.eventId, f.userId, `r2://media/no-daily/${n}`, kind, cost],
  );
  return rows[0]!.r;
}

async function photoRows(seatId: string): Promise<number> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM public.papic_photos WHERE paparazzi_seat_id = $1`,
    [seatId],
  );
  return Number(rows[0]!.c);
}

async function dayLedgerRows(seatId: string): Promise<number> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM public.papic_seat_day_usage WHERE seat_id = $1`,
    [seatId],
  );
  return Number(rows[0]!.c);
}

test('1 · no SQL function or view reads the per-day budget', async () => {
  const fns = await db.query<{ proname: string }>(
    `SELECT p.proname
       FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
      WHERE ns.nspname = 'public'
        AND (p.prosrc ILIKE '%points_per_day%' OR p.prosrc ILIKE '%papic_seat_day_usage%')`,
  );
  assert.deepEqual(
    fns.rows.map((r) => r.proname),
    [],
    'a function reads the retired per-day budget — a camera could be handed a fresh allowance every day',
  );
  const views = await db.query<{ viewname: string }>(
    `SELECT viewname FROM pg_views
      WHERE schemaname = 'public'
        AND (definition ILIKE '%points_per_day%' OR definition ILIKE '%papic_seat_day_usage%')`,
  );
  assert.deepEqual(views.rows.map((r) => r.viewname), []);
});

test('2 · on every seat tier, each capture debits the shared pool by its exact cost, and the per-day ledger stays empty', async () => {
  const tiers = await db.query<{ tier_code: string; points_per_day: number | null }>(
    `SELECT tier_code, points_per_day FROM public.papic_tier_config ORDER BY tier_code`,
  );
  assert.ok(tiers.rows.length >= 5, `only ${tiers.rows.length} tiers found — the loop below would prove little`);

  // A big per-day number on every tier, to prove it buys nothing. Restored after.
  const saved = tiers.rows;
  await db.query(`UPDATE public.papic_tier_config SET points_per_day = 10000`);
  try {
    const photo = papicCaptureCost('photo');
    const clip = papicCaptureCost('clip', 10_000);
    assert.ok(photo >= 1 && clip > photo, `costs read as photo=${photo}, clip=${clip}`);

    for (const { tier_code } of saved) {
      const f = await seatOnTier(tier_code);
      const start = await poolLeft(f.eventId);
      assert.ok(start >= photo + clip, `${tier_code}: the pool holds ${start} — too little to test with`);

      const a = await shoot(f, 'photo', photo);
      assert.equal(a.status, 'ok', `${tier_code}: a paid-for photo was refused`);
      assert.equal(a.pool_spent, photo, `${tier_code}: the photo did not come out of the shared pool`);
      assert.equal(await poolLeft(f.eventId), start - photo, `${tier_code}: the pool did not move by the photo's cost`);

      const b = await shoot(f, 'clip', clip);
      assert.equal(b.status, 'ok', `${tier_code}: a paid-for clip was refused`);
      assert.equal(b.pool_spent, clip, `${tier_code}: the clip did not come out of the shared pool`);
      assert.equal(await poolLeft(f.eventId), start - photo - clip, `${tier_code}: the pool did not move by the clip's cost`);

      assert.equal(await photoRows(f.seatId), 2, `${tier_code}: the two captures did not both land`);
      assert.equal(await dayLedgerRows(f.seatId), 0, `${tier_code}: something wrote the retired per-day ledger`);
    }
  } finally {
    for (const r of saved) {
      await db.query(`UPDATE public.papic_tier_config SET points_per_day = $2 WHERE tier_code = $1`, [
        r.tier_code,
        r.points_per_day,
      ]);
    }
  }
});

test('3 · an empty pool still refuses — no photo is written and nothing moves', async () => {
  await db.query(`UPDATE public.papic_tier_config SET points_per_day = 10000`);
  const f = await seatOnTier('free');
  const photo = papicCaptureCost('photo');

  // Spend the whole pool, one photo at a time.
  let left = await poolLeft(f.eventId);
  let landed = 0;
  while (left >= photo) {
    const r = await shoot(f, 'photo', photo);
    assert.equal(r.status, 'ok', `capture ${landed + 1} refused with ${left} credits left`);
    landed += 1;
    left = await poolLeft(f.eventId);
    assert.ok(landed <= 100_000, 'the pool never ran out — something is not debiting it');
  }
  assert.equal(left, 0);

  const refused = await shoot(f, 'photo', photo);
  assert.equal(refused.status, 'exhausted', 'a capture went through on an empty pool — a free photo');
  assert.equal(await photoRows(f.seatId), landed, 'the refused capture left a photo behind');
  assert.equal(await poolLeft(f.eventId), 0, 'the refused capture moved the pool');
  assert.equal(await dayLedgerRows(f.seatId), 0, 'something wrote the retired per-day ledger');
});

test('4 · a seat capture and a guest phone read the same pool', async () => {
  const f = await seatOnTier('free');
  const guestView = async () =>
    Number(
      (
        await db.query<{ v: number }>(`SELECT public.papic_event_points_remaining($1) AS v`, [f.eventId])
      ).rows[0]!.v,
    );
  const before = await guestView();
  const photo = papicCaptureCost('photo');
  assert.equal((await shoot(f, 'photo', photo)).status, 'ok');
  assert.equal(await guestView(), before - photo, 'the guest phone does not see what the seat camera spent');
});

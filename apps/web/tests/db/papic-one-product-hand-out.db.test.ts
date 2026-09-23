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

import { PAPIC_LADDER_EXPECTED } from './papic-ladder.expected';
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

test('exactly the rungs the owner named are sellable, at his prices', async () => {
  const rungs = await db.query<{ points: number; php: string }>(
    `SELECT t.points, c.retail_price_php AS php
       FROM public.papic_pass_tiers t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.is_active AND c.is_active
      ORDER BY t.points`,
  );
  assert.deepEqual(
    rungs.rows.map((r) => [r.points, Number(r.php)]),
    PAPIC_LADDER_EXPECTED.map(([shots, php]) => [shots, php]),
    'the ladder is owner-set — a rung added or repriced here is a pricing decision, not a code change',
  );
});

test('no rung is one nobody should buy — the absolute price strictly rises', async () => {
  /*
    🔑 THIS IS THE RULE THAT WOULD HAVE CAUGHT THE OWNER'S OWN FIRST TABLE. It
    had 40,000 at ₱10,000 and 50,000 at ₱10,000 — the same money for 10,000
    fewer shots, so the 40,000 rung was dominated and nobody could rationally
    choose it. Absolute price, not rate, is what catches that.

    ⚠ IT REPLACED A STRICTLY-FALLING RATE CHECK, which the ladder now breaks BY
    DESIGN: the discount holds FLAT across whole bands — ₱0.50 a credit from 100
    through 2,000, ₱0.40 from 3,000 through 7,000, ₱0.25 across 20,000 and
    30,000. A rung at the same rate as the one below it is not dominated; it is
    the same value in a bigger size, which is the entire point of a scrollable
    list. The rate rule survives below as "never gets WORSE".
  */
  const rungs = await db.query<{ points: number; php: string }>(
    `SELECT t.points, c.retail_price_php AS php
       FROM public.papic_pass_tiers t
       JOIN public.platform_retail_catalog_v2 c ON c.service_code = t.service_code
      WHERE t.is_active AND c.is_active
      ORDER BY t.points`,
  );
  assert.ok(rungs.rows.length >= 10, `only ${rungs.rows.length} rungs read back — this rule is vacuous`);

  const dominated: string[] = [];
  const rates = rungs.rows.map((r) => Number(r.php) / r.points);
  for (let i = 1; i < rungs.rows.length; i += 1) {
    const prev = rungs.rows[i - 1]!;
    const here = rungs.rows[i]!;
    if (Number(here.php) <= Number(prev.php)) {
      dominated.push(
        `${prev.points} shots cost ₱${prev.php} and ${here.points} cost ₱${here.php} — ` +
          `nobody should ever buy the ${prev.points} rung`,
      );
    }
    if (rates[i]! > rates[i - 1]!) {
      dominated.push(`${here.points} costs ₱${rates[i]!.toFixed(4)} a credit, worse than the rung below it`);
    }
  }
  assert.deepEqual(dominated, [], dominated.join('; '));
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

/*
 * ══ 2026-09-23 · NINE TESTS RETIRED — THE HOST'S HAND-OUT IS GONE ═══════════
 *
 * ⚖ Owner 2026-09-16 (*"no dedicated shots individually"*), re-confirmed
 * 2026-09-22 against a question naming this control rather than the category.
 * `papic_dedicate_shots` and `papic_seat_allocations` are DROPPED by migration
 * 20271243295861.
 *
 * These nine measured the hand-out itself and cannot run without it:
 *   • handing shots to a camera moves them out of the shared pot, exactly
 *   • taking shots back returns them to the pot
 *   • setting the same target twice changes nothing the second time
 *   • you cannot hand out shots the event does not still have
 *   • you cannot take back shots the camera has already taken
 *   • a camera from another event cannot be handed this event's shots
 *   • a hand-out makes the pool stand down for that camera, so a shot is never
 *     billed twice
 *   • handing out the whole pot does not make the event look like it has no
 *     Papic at all
 *   • the allocations table is not reachable by a session role
 *
 * 🔑 THEY ARE LISTED RATHER THAN DELETED SILENTLY. Every one was a real property
 * of a real money mover, and the list is what tells a later session that the
 * removal was a decision and what it covered — the same rule the controls bill
 * in `_lib/nothing-was-lost-with-the-tabs.test.ts` follows.
 *
 * ⚠ ONE OF THEM DOES NOT SIMPLY VANISH. *"A hand-out makes the pool stand down
 * for that camera, so a shot is never billed twice"* was a ZERO-SUM property —
 * the one failure with no visible symptom. It survives as the same property on
 * the mechanism that remains: a camera's own GRANT makes the pool stand down,
 * which `papic-dedicated-is-a-floor.db.test.ts` measures on every capture.
 *
 * The ladder tests above are untouched — they never used the hand-out.
 */
test('the hand-out machinery is gone, and gone together', async () => {
  /*
    Both halves, because dropping only the function leaves a table no writer can
    reach (`ugat-both-ends` refuses exactly that), and dropping only the table
    leaves a function that fails at runtime.
  */
  const fn = await one<number>(
    `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'papic_dedicate_shots'`,
  );
  assert.equal(fn, 0, 'papic_dedicate_shots is back');
  assert.equal(
    await one<boolean>(`SELECT to_regclass('public.papic_seat_allocations') IS NULL`),
    true,
    'papic_seat_allocations is back',
  );

  // 🚨 AND NO FUNCTION STILL READS THE DROPPED TABLE. A plpgsql body is only
  // text to Postgres, so DROP TABLE does not refuse on account of one — it
  // would simply fail the first time somebody called it.
  const stragglers = await one<number>(
    `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
        AND regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g')
              ILIKE '%papic_seat_allocations%'`,
  );
  assert.equal(stragglers, 0, 'a function still references the dropped table');
});

test('⚖ but the FREE camera grant stayed — the owner said it should', async () => {
  /*
    The half a careless retirement takes out with the other. Measured in prod
    2026-09-23: 4 rows, 20 points, all `source = 'camera_grant'`. A camera still
    carries a balance of its own; what is gone is the COUPLE handing one out.
  */
  assert.equal(
    await one<boolean>(`SELECT to_regclass('public.papic_event_point_grants') IS NOT NULL`),
    true,
    'the free camera grant ledger is gone',
  );
  assert.equal(
    await one<boolean>(`SELECT to_regclass('public.paparazzi_seats') IS NOT NULL`),
    true,
    'paparazzi_seats is gone — a seat is the camera CLAIM, not an allowance',
  );
  assert.equal(
    await one<boolean>(`SELECT to_regclass('public.papic_seat_grant_releases') IS NOT NULL`),
    true,
    'the guest give-back ledger is gone — that is the opposite direction and it stays',
  );

  // And a camera funded by a grant still reports its own balance.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Free camera', 'birthday')
     RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, 950, 'PAPIC_CAMERA_FREE', 'handout-retired-seat', 'free') RETURNING seat_id`,
    [eventId],
  );
  const seatId = seat.rows[0]!.seat_id;
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, note)
     VALUES ($1, $2, 20, 'camera_grant', 'the free Papic One camera')`,
    [eventId, seatId],
  );
  assert.equal(
    await one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]),
    20,
    'a camera can still carry credits of its own — just not ones the couple handed it',
  );
});

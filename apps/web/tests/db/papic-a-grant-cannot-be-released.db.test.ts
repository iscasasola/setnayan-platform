/**
 * A GUEST'S BOUGHT CREDITS ARE A **GRANT**, AND `papic_dedicate_shots` CANNOT
 * REACH A GRANT — measured, not reasoned.
 *
 * ── THE DEFECT THIS FILE IS THE AUTOPSY OF ────────────────────────────────
 * PR #5028 shipped a guest-facing button — *"Give the unused N to the
 * celebration"* — built on `papic_dedicate_shots`, on a corpus line that said
 * that function was *"that call in the pot direction. Nothing new."* It was
 * live, on a surface real guests reach (`NEXT_PUBLIC_PAPIC_GUEST_BUY` is ON in
 * production), and it moved credits THE WRONG WAY ON BOTH SIDES OF THE LEDGER.
 *
 * The claim was false, and the reason is a one-word distinction the pot
 * arithmetic is built on:
 *
 *   dedicated to a camera = its GRANTS  +  its ALLOCATION
 *                           ↑ what was    ↑ what the host
 *                             BOUGHT        HANDED it
 *
 * `papic_dedicate_shots` reads and writes `papic_seat_allocations` ONLY — the
 * right-hand column. A guest's "keep them for me" purchase is a `one_reload`
 * rung, granted through `papic_grant_camera_points`, so it lands in the LEFT
 * column. On such a camera the allocation row is `0`, the function's TARGET
 * arithmetic (`v_delta := p_points - v_current`) sees a target of *her spend*
 * against a current of *zero*, and takes the **giving** branch.
 *
 * ── WHY THE PR'S OWN TESTS WERE GREEN ─────────────────────────────────────
 * They were written from the same wrong premise and never built a
 * grant-funded camera. Every one of them exercised the allocation column,
 * where the primitive is correct. 🔑 A test that shares the defect's premise
 * cannot see the defect — which is why this file seeds through
 * `papic_event_point_grants` with `seat_id` SET and asserts on measured
 * DELTAS, never on "it did not error".
 *
 * ── WHAT THIS FILE LOCKS ──────────────────────────────────────────────────
 * Two things, and deliberately NOT a third:
 *   1. What the #5028 call actually did, in real figures, so the primitive
 *      cannot be re-proposed for this job on the strength of prose.
 *   2. That the obvious "just pass a negative" repair is refused outright.
 *   3. ⏭ NOT a working release. There is none — releasing a grant needs a
 *      primitive that does not exist, and per the corpus correction of
 *      2026-08-31 whether that feature is wanted at all is an OWNER call.
 *      `releasesContract` below states what such a primitive must satisfy,
 *      so the day it is built the assertions are already written.
 *
 * Run: cd apps/web && npx tsx --test tests/db/papic-a-grant-cannot-be-released.db.test.ts
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

/**
 * Every figure is pulled apart from every other, so a right answer and a wrong
 * answer cannot coincide at any of them. With POOL/BOUGHT/SHOT all distinct and
 * none a multiple of another, "balance went down by the releasable amount" and
 * "balance went up by the spend" are different numbers in every column.
 */
const POOL = 3000; // the couple's shared pot
const BOUGHT = 137; // HER `one_reload` purchase — a SEAT-SCOPED GRANT
const SHOT = 41; // what she has already fired; can never come back
const RELEASABLE = BOUGHT - SHOT; // 96 — what the #5028 button offered her

/** An event with a shared pot and one camera funded ENTIRELY by grants. */
async function seedGrantFundedCamera() {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Grant release autopsy', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'the couple''s shared pot')`,
    [eventId, POOL],
  );

  seatCounter += 1;
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, 900, 'PAPIC_CAMERA_FREE', $2, 'free') RETURNING seat_id`,
    [eventId, `grant-release-seat-${seatCounter}`],
  );
  const seatId = seat.rows[0]!.seat_id;

  // ⚠ THE WHOLE POINT: seat_id SET makes this a GRANT, not an allocation —
  // the shape `papic_grant_camera_points` writes for a `one_reload` order.
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, note)
     VALUES ($1, $2, $3, 'admin', 'her one_reload purchase — keep them for me')`,
    [eventId, seatId, BOUGHT],
  );
  await db.query(
    `INSERT INTO public.papic_seat_point_usage (seat_id, points_used) VALUES ($1, $2)`,
    [seatId, SHOT],
  );
  return { eventId, seatId };
}

const dedicated = (seatId: string) =>
  one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]);
const pot = (eventId: string) =>
  one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);
const allocation = (seatId: string) =>
  one<number>(
    `SELECT COALESCE((SELECT points FROM public.papic_seat_allocations WHERE seat_id = $1), 0)`,
    [seatId],
  );

/*
 * ══ 2026-09-23 · THE PRIMITIVE THIS FILE IS THE AUTOPSY OF IS NOW GONE ══════
 *
 * ⚖ Owner 2026-09-16 (*"no dedicated shots individually"*), re-confirmed
 * 2026-09-22 against a question naming the control: `papic_dedicate_shots` and
 * `papic_seat_allocations` are DROPPED by migration 20271243295861.
 *
 * 🔑 THE FINDING ABOVE IS NOT REPEALED — IT IS PROMOTED. The four measurements
 * that used to live here drove the function directly to show it moved credits
 * the wrong way on a grant-funded camera. That defect is now IMPOSSIBLE rather
 * than merely measured, which is strictly stronger than a test: there is no
 * function to reach for and no allocation column to reach into.
 *
 * ⚠ SO THE PROSE ABOVE STAYS AND THE ASSERTIONS CHANGE. The autopsy is the
 * institutional memory of a live money defect on a surface real guests reach
 * (PR #5028, `NEXT_PUBLIC_PAPIC_GUEST_BUY` ON in production); deleting it
 * because the code is gone would throw away the reason anybody knows not to
 * rebuild it. What is measured now is that it CANNOT come back, and that the
 * right primitive still satisfies the contract on the very camera shape that
 * broke — `seedGrantFundedCamera` is unchanged, so the fixture that exposed the
 * defect is the fixture that proves the repair.
 */

test('her credits really are all grants — the allocation column never existed for her', async () => {
  const { seatId } = await seedGrantFundedCamera();
  assert.equal(
    Number(await dedicated(seatId)),
    BOUGHT,
    'her whole balance is a GRANT — that is what made #5028 possible',
  );
  assert.equal(
    await one<boolean>(`SELECT to_regclass('public.papic_seat_allocations') IS NULL`),
    true,
    'the allocation column is back — the left/right distinction #5028 turned on has returned',
  );
});

test('🚨 THE #5028 DEFECT IS NOW UNREACHABLE — the wrong tool no longer exists', async () => {
  /*
    The defect was: call `papic_dedicate_shots(event, seat, her_spend)` on a
    grant-funded camera, and its TARGET arithmetic takes the GIVING branch —
    moving credits the wrong way on both sides of the ledger.

    You cannot make that call any more.

    Sabotage: re-create the function in the migration and watch this go red.
  */
  const gone = await one<number>(
    `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'papic_dedicate_shots'`,
  );
  assert.equal(gone, 0, 'papic_dedicate_shots is back — the #5028 primitive has returned');

  const { eventId, seatId } = await seedGrantFundedCamera();
  await assert.rejects(
    () => one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, SHOT]),
    /does not exist/,
    'the exact call app/papic/buy/actions.ts made must not resolve',
  );
});

test('and the RIGHT primitive still meets the contract on the camera shape that broke', async () => {
  /*
    🔑 THE HALF THAT WOULD BE EASY TO LOSE. Proving the wrong tool is gone says
    nothing about whether the right one still works. `papic_release_seat_grants`
    is what the owner asked for once he was shown what the feature was, and this
    is the same grant-funded camera that exposed #5028.
  */
  const { eventId, seatId } = await seedGrantFundedCamera();
  const dedBefore = Number(await dedicated(seatId));
  const potBefore = Number(await pot(eventId));

  const moved = Number(
    await one<number>(`SELECT public.papic_release_seat_grants($1, $2, NULL)`, [eventId, seatId]),
  );

  assert.equal(moved, RELEASABLE, 'only her UNSPENT own credits move — 137 bought, 41 shot');
  assert.equal(
    Number(await dedicated(seatId)),
    dedBefore - RELEASABLE,
    'her camera goes DOWN by what moved — the direction #5028 got backwards',
  );
  assert.equal(
    Number(await pot(eventId)),
    potBefore + RELEASABLE,
    'and the shared pot goes UP by exactly the same amount — zero-sum',
  );
});

/**
 * ⏭ THE CONTRACT A REAL RELEASE PRIMITIVE MUST MEET now lives in
 * `./papic-release-contract.ts`, and is satisfied as of 2026-08-31 by
 * `papic_release_seat_grants` (migration `20271185813837`), which the owner
 * asked for after being shown what the feature was.
 *
 * It moved out of this file for two mechanical reasons, neither of which
 * changed a single assertion: importing a `.test.ts` re-runs its tests inside
 * the importing suite, and the contract has to seed into the CALLER'S replayed
 * database rather than this file's.
 *
 * ⚠ UPDATED 2026-09-23. This file used to end "THIS FILE STAYS EXACTLY AS IT
 * IS … these four tests are what stops it being re-proposed." It cannot be
 * re-proposed now: `papic_dedicate_shots` is DROPPED. The tests above assert
 * that it is gone and that the right primitive still satisfies the contract on
 * the same grant-funded camera — the fixture that exposed the defect is the one
 * that proves the repair.
 */

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

test('her credits really are all grants — the allocation column is untouched', async () => {
  const { seatId } = await seedGrantFundedCamera();
  assert.equal(
    Number(await dedicated(seatId)),
    BOUGHT,
    'the camera should hold exactly what she bought',
  );
  assert.equal(
    Number(await allocation(seatId)),
    0,
    'a bought credit must NOT create an allocation row — if this fails the ' +
      'funding model changed and everything below is measuring the wrong thing',
  );
});

test('THE #5028 DEFECT: releasing a grant-funded camera moved credits the WRONG WAY, on both sides', async () => {
  const { eventId, seatId } = await seedGrantFundedCamera();

  const dedBefore = Number(await dedicated(seatId));
  const potBefore = Number(await pot(eventId));

  // The UI's own arithmetic at the time: `dedicated - spent`, computed in
  // TypeScript. That helper is gone; the figure is now read from
  // `papic_seat_releasable_grants` instead. Restated here as a literal so this
  // autopsy keeps measuring what #5028 actually did.
  assert.equal(dedBefore - SHOT, RELEASABLE, 'the button read "Give 96 to the celebration"');

  // EXACTLY the call app/papic/buy/actions.ts made: target = her own spend.
  await one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, SHOT]);

  const dedAfter = Number(await dedicated(seatId));
  const potAfter = Number(await pot(eventId));

  // ── the measurement that removal rests on ───────────────────────────────
  assert.equal(
    dedAfter - dedBefore,
    +SHOT,
    'her balance ROSE by her spend — the giving branch ran, because a target ' +
      'of 41 against an allocation of 0 is a POSITIVE delta',
  );
  assert.equal(
    potAfter - potBefore,
    -SHOT,
    "and the couple's shared pot FELL by the same amount — every other guest " +
      'at the event shoots from that pot, so this is not pot-neutral',
  );

  // Stated as absolutes too, so the failure message names real figures.
  assert.equal(dedAfter, BOUGHT + SHOT, 'dedicated 137 -> 178');
  assert.equal(Number(await allocation(seatId)), SHOT, 'an allocation of 41 was invented');

  // Nothing about it releases: the direction is inverted, not merely short.
  assert.ok(
    dedAfter > dedBefore,
    'a RELEASE that increases the balance is the defect, restated',
  );
});

test('a second press is a no-op — which is why this was never noticed by pressing twice', async () => {
  const { eventId, seatId } = await seedGrantFundedCamera();
  await one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, SHOT]);
  const dedOnce = Number(await dedicated(seatId));
  const potOnce = Number(await pot(eventId));

  await one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, SHOT]);
  assert.equal(Number(await dedicated(seatId)), dedOnce, 'target now equals current — no delta');
  assert.equal(Number(await pot(eventId)), potOnce, 'so the pot does not move either');
});

test('and the obvious repair — "just pass a negative" — is refused outright', async () => {
  const { eventId, seatId } = await seedGrantFundedCamera();
  await assert.rejects(
    () => one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, -RELEASABLE]),
    /bad arguments/,
    'p_points < 0 is rejected at the top of the function, so a negative target ' +
      'is not a way in either — the primitive genuinely cannot express this move',
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
 * ⚠ THIS FILE STAYS EXACTLY AS IT IS. `papic_dedicate_shots` is still the
 * wrong tool for that job and still misbehaves on a grant-funded camera in
 * precisely the way measured above; the new primitive does not repair it and
 * was never meant to. These four tests are what stops it being re-proposed.
 */

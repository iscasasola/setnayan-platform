/**
 * THE CONTRACT A GUEST-SIDE CREDIT GIVE-BACK MUST MEET.
 *
 * Authored in PR #5038 — the removal of the broken #5028 implementation —
 * BEFORE any working primitive existed, and deliberately so: the bar for this
 * feature must not be set by whoever eventually writes the function. Moved out
 * of that PR's autopsy test into its own module (PR for owner-approved rebuild,
 * 2026-08-31) for two mechanical reasons and no change of substance:
 *
 *   1. A `.test.ts` file RUNS ITS OWN TESTS when imported, so the autopsy's
 *      four tests were executing a second time inside the implementation's
 *      suite, each spinning up another replayed database.
 *   2. The contract has to run against the CALLER'S database. Every
 *      `*.db.test.ts` builds its own PGlite instance in its own `before()`, so
 *      a contract that closed over the autopsy file's `db` seeded a camera into
 *      one database while the implementation's callback queried another — the
 *      cross-event guard then fired on a seat that genuinely was not there.
 *      That was a harness fault, not a defect, but it is exactly the kind of
 *      green-looking red that this whole feature has already been bitten by, so
 *      the db is now passed in explicitly rather than captured.
 *
 * ── THE CONTRACT ITSELF IS UNCHANGED ──────────────────────────────────────
 * Releasing must reduce what the camera holds and return exactly that much to
 * the shared pot, atomically, refusing to drop below what she has already SHOT.
 * On the figures below: dedicated 137 -> 41 (down 96) and the pot up 96.
 *
 * It cannot be `papic_dedicate_shots` — proved in
 * `papic-a-grant-cannot-be-released.db.test.ts`, which measures that aiming it
 * here moves credits the WRONG WAY on both sides — and it must not simply
 * mutate `papic_event_point_grants`, an append-only money record an admin
 * reconciles orders against.
 */
import assert from 'node:assert/strict';
import type { ReplayResult } from './replay-migrations';

type Db = ReplayResult['db'];

/** Figures pulled apart so a right and a wrong answer differ at every column. */
export const CONTRACT_POOL = 3000;
export const CONTRACT_BOUGHT = 137;
export const CONTRACT_SHOT = 41;
export const CONTRACT_RELEASABLE = CONTRACT_BOUGHT - CONTRACT_SHOT; // 96

let seatCounter = 0;

async function one<T>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, T>>(sql, params);
  return Object.values(r.rows[0] ?? {})[0] as T;
}

/**
 * An event with a shared pot and one camera funded ENTIRELY by grants — the
 * real `one_reload` case, and the one case #5028's own tests never built.
 */
export async function seedGrantFundedCamera(db: Db) {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Release contract', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'the couple''s shared pot')`,
    [eventId, CONTRACT_POOL],
  );

  seatCounter += 1;
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, 900, 'PAPIC_CAMERA_FREE', $2, 'free') RETURNING seat_id`,
    [eventId, `release-contract-seat-${seatCounter}`],
  );
  const seatId = seat.rows[0]!.seat_id;

  // ⚠ seat_id SET makes this a GRANT, not an allocation — the shape
  // `papic_grant_camera_points` writes for a `one_reload` order.
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, note)
     VALUES ($1, $2, $3, 'admin', 'her one_reload purchase — keep them for me')`,
    [eventId, seatId, CONTRACT_BOUGHT],
  );
  await db.query(
    `INSERT INTO public.papic_seat_point_usage (seat_id, points_used) VALUES ($1, $2)`,
    [seatId, CONTRACT_SHOT],
  );
  return { eventId, seatId };
}

export const dedicatedPoints = (db: Db, seatId: string) =>
  one<number>(db, `SELECT public.papic_seat_dedicated_points($1)`, [seatId]);
export const poolRemaining = (db: Db, eventId: string) =>
  one<number>(db, `SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);

/**
 * Run the contract against a candidate release primitive. `release` is handed
 * the ids of a camera this function seeded in the SAME database, and must move
 * every unused bought credit to the pot.
 */
export async function releasesContract(
  db: Db,
  release: (eventId: string, seatId: string) => Promise<unknown>,
) {
  const { eventId, seatId } = await seedGrantFundedCamera(db);
  const dedBefore = Number(await dedicatedPoints(db, seatId));
  const potBefore = Number(await poolRemaining(db, eventId));

  await release(eventId, seatId);

  assert.equal(
    Number(await dedicatedPoints(db, seatId)) - dedBefore,
    -CONTRACT_RELEASABLE,
    'her balance goes DOWN',
  );
  assert.equal(
    Number(await poolRemaining(db, eventId)) - potBefore,
    +CONTRACT_RELEASABLE,
    'the pot goes UP by the same',
  );
  assert.equal(
    Number(await dedicatedPoints(db, seatId)),
    CONTRACT_SHOT,
    'what she already shot stays hers',
  );
}

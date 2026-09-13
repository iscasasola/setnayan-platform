/**
 * A GUEST GIVES HER UNUSED CREDITS BACK — the feature PR #5028 got wrong and
 * PR #5038 removed, rebuilt on a primitive that can actually reach a grant.
 *
 * ── THE BAR THIS FILE HAS TO CLEAR ────────────────────────────────────────
 * #5028's own tests were green while the button moved credits the WRONG WAY,
 * because they were written from the same premise as the code and never built
 * a grant-funded camera. So every test here:
 *   • funds the camera through `papic_event_point_grants` with `seat_id` SET —
 *     the shape `papic_grant_camera_points` writes for a real `one_reload`
 *     purchase, which is the only case that matters;
 *   • asserts on measured DELTAS on BOTH sides of the ledger, never on "no
 *     error" and never on her balance alone (the #5028 defect moved both);
 *   • uses figures pulled apart from one another, so a right answer and a
 *     wrong one cannot coincide at any column.
 *
 * `releasesContract` — written in PR #5038 before this function existed, on
 * purpose, so the contract was not designed by the session that designs the
 * implementation — is imported and run against the real thing below.
 *
 * Run: cd apps/web && npx tsx --test tests/db/papic-a-guest-can-give-her-credits-back.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { releasesContract } from './papic-release-contract';

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

const POOL = 3000; // the couple's shared pot
const BOUGHT = 137; // HER `one_reload` purchase — a SEAT-SCOPED GRANT
const SHOT = 41; // already fired; can never come back
const RELEASABLE = BOUGHT - SHOT; // 96

async function seed({
  bought = BOUGHT,
  shot = SHOT,
  allocated = 0,
  pool = POOL,
}: { bought?: number; shot?: number; allocated?: number; pool?: number } = {}) {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Give-back test', 'birthday') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  if (pool > 0) {
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
       VALUES ($1, $2, 'admin', 'the couple''s shared pot')`,
      [eventId, pool],
    );
  }

  seatCounter += 1;
  const seat = await db.query<{ seat_id: string }>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token, tier)
     VALUES ($1, 910, 'PAPIC_CAMERA_FREE', $2, 'free') RETURNING seat_id`,
    [eventId, `give-back-seat-${seatCounter}`],
  );
  const seatId = seat.rows[0]!.seat_id;

  if (bought > 0) {
    await db.query(
      `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, note)
       VALUES ($1, $2, $3, 'admin', 'her one_reload — keep them for me')`,
      [eventId, seatId, bought],
    );
  }
  if (allocated > 0) {
    await one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, allocated]);
  }
  if (shot > 0) {
    await db.query(
      `INSERT INTO public.papic_seat_point_usage (seat_id, points_used) VALUES ($1, $2)`,
      [seatId, shot],
    );
  }
  return { eventId, seatId };
}


/**
 * A camera belonging to a NAMED guest who bought her own credits AND was handed
 * some of the couple's. The `papic_guest_orders` row is what makes the grant
 * traceable to HER purchase — `papic_guest_self_funded_spend` joins through it,
 * so a grant without an order is invisible to the ceiling.
 */
async function seedNamedBuyerWithHandout({
  bought,
  allocated,
  shot,
}: {
  bought: number;
  allocated: number;
  shot: number;
}) {
  seatCounter += 1;
  const tag = `ceil-${seatCounter}`;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ('Ceiling interaction', 'birthday') RETURNING event_id`,
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, 3000, 'admin', 'the couple''s pot')`,
    [eventId],
  );
  const guestId = await one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at)
     VALUES ($1, 'Ana', 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId],
  );
  const seatId = await one<string>(
    `INSERT INTO public.paparazzi_seats (event_id, seat_index, sku_code, claim_qr_token,
                                         tier, guest_id)
     VALUES ($1, 951, 'PAPIC_CAMERA_FREE', $2, 'unlimited', $3) RETURNING seat_id`,
    [eventId, `${tag}-seat`, guestId],
  );
  const orderId = await one<string>(
    `INSERT INTO public.orders (event_id, description, requested_total_php, reference_code)
     VALUES ($1, 'guest one reload', $2, $3) RETURNING order_id`,
    [eventId, bought, tag.toUpperCase().replace('-', '')],
  );
  await db.query(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, $4, 'one_reload', 'PAPIC_CAMERA_MINI_DAY', $5, $6)`,
    [orderId, eventId, seatId, guestId, bought, `${tag}-token-abcdefghijklmnopqrst`],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants
       (event_id, points, source, order_id, seat_id, note)
     VALUES ($1, $2, 'topup_order', $3, $4, 'keep them for me')`,
    [eventId, bought, orderId, seatId],
  );
  if (allocated > 0) {
    await one(`SELECT public.papic_dedicate_shots($1, $2, $3, NULL)`, [eventId, seatId, allocated]);
  }
  if (shot > 0) {
    await db.query(
      `INSERT INTO public.papic_seat_point_usage (seat_id, points_used) VALUES ($1, $2)`,
      [seatId, shot],
    );
  }
  return { eventId, seatId, guestId };
}

const dedicated = (seatId: string) =>
  one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]);
const pot = (eventId: string) =>
  one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);
const release = (eventId: string, seatId: string) =>
  one<number>(`SELECT public.papic_release_seat_grants($1, $2, NULL)`, [eventId, seatId]);
const grantRows = (seatId: string) =>
  one<number>(
    `SELECT COALESCE(SUM(points), 0)::int FROM public.papic_event_point_grants WHERE seat_id = $1`,
    [seatId],
  );

// ── the headline: the contract #5038 wrote before this function existed ────

test('THE CONTRACT: her balance goes DOWN by 96 and the pot goes UP by 96', async () => {
  const { eventId, seatId } = await seed();

  const dedBefore = Number(await dedicated(seatId));
  const potBefore = Number(await pot(eventId));
  assert.equal(dedBefore, BOUGHT, 'she holds what she bought');

  const moved = Number(await release(eventId, seatId));

  assert.equal(moved, RELEASABLE, 'the function reports how many credits moved');
  assert.equal(
    Number(await dedicated(seatId)) - dedBefore,
    -RELEASABLE,
    'her balance goes DOWN — this is the assertion #5028 failed, in the opposite direction',
  );
  assert.equal(
    Number(await pot(eventId)) - potBefore,
    +RELEASABLE,
    'and the shared pot goes UP by exactly the same amount',
  );
  assert.equal(
    Number(await dedicated(seatId)),
    SHOT,
    'what she already shot stays hers — 137 - 96 = 41',
  );
});

test('it is ZERO-SUM: nothing is minted and nothing evaporates', async () => {
  const { eventId, seatId } = await seed();
  const before = Number(await dedicated(seatId)) + Number(await pot(eventId));
  await release(eventId, seatId);
  const after = Number(await dedicated(seatId)) + Number(await pot(eventId));
  assert.equal(after, before, 'camera + pot is conserved across the move');
});

test('the money record is NOT edited — the receipt still says 137', async () => {
  const { eventId, seatId } = await seed();
  assert.equal(Number(await grantRows(seatId)), BOUGHT);
  await release(eventId, seatId);
  assert.equal(
    Number(await grantRows(seatId)),
    BOUGHT,
    'papic_event_point_grants is append-only — an admin reconciling her order ' +
      'must still see the amount she actually paid for',
  );
});

// ── the floor ──────────────────────────────────────────────────────────────

test('what she already SHOT can never come back', async () => {
  const { eventId, seatId } = await seed({ bought: 137, shot: 137 });
  const potBefore = Number(await pot(eventId));
  const moved = Number(await release(eventId, seatId));
  assert.equal(moved, 0, 'she shot everything — there is nothing unused to give');
  assert.equal(Number(await dedicated(seatId)), 137, 'her balance is untouched');
  assert.equal(Number(await pot(eventId)), potBefore, 'and the pot is untouched');
});

test('a camera that has shot MORE than it bought has nothing of its own left to give', async () => {
  // Host handed 200 on top of her 137; she has shot 300 — more than she bought.
  const { eventId, seatId } = await seed({ bought: 137, allocated: 200, shot: 300 });
  const potBefore = Number(await pot(eventId));
  const dedBefore = Number(await dedicated(seatId));
  const moved = Number(await release(eventId, seatId));
  assert.equal(
    moved,
    0,
    'her own 137 are entirely consumed by a 300-shot spend, so she has nothing ' +
      'left to give. The 37 still unspent on this camera belong to the COUPLE — ' +
      "they are the tail of the host's 200 hand-out, and giving them back would " +
      'return the couple their own money as though it were a gift.',
  );
  assert.equal(Number(await dedicated(seatId)), dedBefore, 'nothing moves');
  assert.equal(Number(await pot(eventId)), potBefore);
});

// ── whose money is it ──────────────────────────────────────────────────────

test("she cannot give away the HOST's hand-out — that is the couple's own money", async () => {
  // Nothing bought; the host handed her camera 200; she has shot 20.
  const { eventId, seatId } = await seed({ bought: 0, allocated: 200, shot: 20 });
  const potBefore = Number(await pot(eventId));
  const dedBefore = Number(await dedicated(seatId));

  const moved = Number(await release(eventId, seatId));

  assert.equal(moved, 0, 'she has no bought credits, so she has nothing to give back');
  assert.equal(Number(await dedicated(seatId)), dedBefore, 'the hand-out stays on her camera');
  assert.equal(
    Number(await pot(eventId)),
    potBefore,
    'and the pot does not double-count money it already lent out — the host ' +
      'takes a hand-out back with papic_dedicate_shots, not this',
  );
});

test('with BOTH a hand-out and a purchase, only her own share moves', async () => {
  const { eventId, seatId } = await seed({ bought: 137, allocated: 200, shot: 41 });
  const potBefore = Number(await pot(eventId));
  const moved = Number(await release(eventId, seatId));
  assert.equal(
    moved,
    96,
    'her own UNSPENT credits are 137 - 41 = 96, and dedicated-minus-spend is ' +
      '296, so the FIRST ceiling binds.\n' +
      '⚠ NOT 137. Her 41 shots are attributed to her own purchase first — the ' +
      'same attribution papic_guest_self_funded_spend makes with LEAST(spent, ' +
      'paid). Letting her give back all 137 would make the couple\'s hand-out ' +
      'silently pay for shots she took with her own money, and leave her a ' +
      'ceiling exemption for credits she no longer owns. Measured, not reasoned.',
  );
  assert.equal(
    Number(await dedicated(seatId)),
    337 - 96,
    "the host's 200 and her own already-shot 41 are still on her camera",
  );
  assert.equal(Number(await pot(eventId)) - potBefore, +96);
});

// ── pressing it twice ──────────────────────────────────────────────────────

test('a second press moves nothing — idempotent by construction, not by a guard', async () => {
  const { eventId, seatId } = await seed();
  assert.equal(Number(await release(eventId, seatId)), RELEASABLE);
  const dedOnce = Number(await dedicated(seatId));
  const potOnce = Number(await pot(eventId));

  assert.equal(Number(await release(eventId, seatId)), 0, 'nothing left to give');
  assert.equal(Number(await dedicated(seatId)), dedOnce);
  assert.equal(
    Number(await pot(eventId)),
    potOnce,
    'the pot must not gain twice — this is the double-submit that a TARGET-shaped ' +
      'call would have had to defend against with a stale number from the page',
  );
});

test('she can give back again after buying again', async () => {
  const { eventId, seatId } = await seed();
  await release(eventId, seatId);
  // A second `one_reload`: 60 more credits, none of them shot.
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, seat_id, points, source, note)
     VALUES ($1, $2, 60, 'admin', 'her second one_reload')`,
    [eventId, seatId],
  );
  const potBefore = Number(await pot(eventId));
  assert.equal(Number(await release(eventId, seatId)), 60, 'the new purchase is releasable too');
  assert.equal(Number(await pot(eventId)) - potBefore, +60);
  assert.equal(Number(await dedicated(seatId)), SHOT, 'still floored at what she shot');
});

// ── refusals ───────────────────────────────────────────────────────────────

test("one event's camera cannot be released into another event's pot", async () => {
  const mine = await seed();
  const other = await seed();
  await assert.rejects(
    () => release(other.eventId, mine.seatId),
    /does not belong to this event/,
    'a seat id is not a capability',
  );
});

test('null arguments are refused rather than treated as "everything"', async () => {
  const { seatId } = await seed();
  await assert.rejects(() => release(null as unknown as string, seatId), /bad arguments/);
});

// ── the capture path composes for free ─────────────────────────────────────

test('after giving everything back she shoots from the shared pool, like any guest', async () => {
  const { eventId, seatId } = await seed();
  await release(eventId, seatId);

  const potBefore = Number(await pot(eventId));
  const split = await db.query<{ ok: boolean; dedicated_spent: number; pool_spent: number }>(
    `SELECT ok, dedicated_spent, pool_spent FROM public.papic_reserve_capture_split($1,$2,$3)`,
    [seatId, eventId, 5],
  );
  const r = split.rows[0]!;
  assert.equal(r.ok, true, 'she can still shoot');
  assert.equal(
    Number(r.dedicated_spent),
    0,
    'nothing comes off her camera — she gave it away and the gate sees that ' +
      'without any change to the capture path',
  );
  assert.equal(Number(r.pool_spent), 5, 'the shot is paid for by the pot');
  assert.equal(Number(await pot(eventId)), potBefore - 5);
});

/**
 * ── THE CONTRACT WRITTEN BEFORE THE IMPLEMENTATION, RUN AGAINST IT ────────
 * `releasesContract` was authored in PR #5038 — the removal — precisely so the
 * bar would not be set by whoever later wrote the function. It seeds its own
 * grant-funded camera and asserts balance DOWN 96 - pot UP 96 - spend intact.
 * Imported rather than restated: a copy could be quietly relaxed to match a
 * wrong implementation; this cannot.
 */
test("PR #5038's pre-written contract passes against the real primitive", async () => {
  await releasesContract(db, (eventId, seatId) =>
    one(`SELECT public.papic_release_seat_grants($1, $2, NULL)`, [eventId, seatId]),
  );
});

/**
 * ── THE PROPERTY #5028 ACTUALLY VIOLATED ──────────────────────────────────
 * Its button said 96 and its call moved −41. Not because either number was
 * hard to compute, but because two places computed it. The number shown and
 * the number moved are now one function, and this asserts that across every
 * shape the two ceilings can take — including the ones where the answer is 0,
 * since "the button must not offer what the call would refuse" is the same
 * property read from the other end.
 */
test('the number shown and the number moved are always the same number', async () => {
  const shapes = [
    { bought: 137, shot: 41, allocated: 0, expect: 96 }, // ordinary
    { bought: 137, shot: 0, allocated: 0, expect: 137 }, // shot nothing
    { bought: 137, shot: 137, allocated: 0, expect: 0 }, // shot everything
    { bought: 0, shot: 20, allocated: 200, expect: 0 }, // host's money only
    { bought: 137, shot: 41, allocated: 200, expect: 96 }, // both: her UNSPENT own share
    { bought: 137, shot: 300, allocated: 200, expect: 0 }, // both: her own is all gone
    { bought: 1, shot: 0, allocated: 0, expect: 1 }, // the smallest real gift
  ];

  for (const s of shapes) {
    const { eventId, seatId } = await seed(s);
    const shown = Number(
      await one<number>(`SELECT public.papic_seat_releasable_grants($1)`, [seatId]),
    );
    const moved = Number(await release(eventId, seatId));
    assert.equal(
      shown,
      s.expect,
      `display wrong for ${JSON.stringify(s)} — got ${shown}, wanted ${s.expect}`,
    );
    assert.equal(
      moved,
      shown,
      `the button offered ${shown} and the call moved ${moved} for ${JSON.stringify(s)}`,
    );
    // And afterwards it must offer nothing, or the button lies on reload.
    assert.equal(
      Number(await one<number>(`SELECT public.papic_seat_releasable_grants($1)`, [seatId])),
      0,
      'nothing is releasable once it has been released',
    );
  }
});

/**
 * ── GIVING CREDITS BACK MUST NOT LEAVE HER A CEILING EXEMPTION FOR THEM ────
 *
 * The interaction between this feature and the per-guest ceiling
 * (`papic_guest_self_funded_spend`, 20271185324597). It was found by rebasing
 * onto main and PROBING the two together — not by reading either one, and not
 * by any test of either feature alone, because neither feature is wrong by
 * itself. Both were green.
 *
 * The rule the owner locked is "her money, outside the couple's limit". Credits
 * she has HANDED TO THE CELEBRATION are not her money any more. Measured before
 * the fix: after donating everything, her exemption still climbed to the full
 * 137 as she kept shooting on the COUPLE'S hand-out — the couple's own money
 * buying her a walk through the couple's own limit.
 */
test('credits she gave back stop earning her an exemption from the couple’s ceiling', async () => {
  const { eventId, seatId, guestId } = await seedNamedBuyerWithHandout({
    bought: 137,
    allocated: 200,
    shot: 41,
  });
  const selfFunded = () =>
    one<number>(`SELECT public.papic_guest_self_funded_spend($1)`, [guestId]);

  assert.equal(Number(await selfFunded()), 41, 'she shot 41 with her own money');
  assert.equal(
    Number(await one<number>(`SELECT public.papic_seat_releasable_grants($1)`, [seatId])),
    96,
    'only her UNSPENT own credits may go — 137 would donate the 41 she already shot',
  );

  assert.equal(Number(await release(eventId, seatId)), 96);
  assert.equal(Number(await selfFunded()), 41, 'the 41 she really did self-fund survive');

  // She keeps shooting — now entirely on the COUPLE'S hand-out.
  await db.query(`UPDATE public.papic_seat_point_usage SET points_used = 137 WHERE seat_id = $1`, [
    seatId,
  ]);
  assert.equal(
    Number(await selfFunded()),
    41,
    'and it STAYS 41. Before the fix this read 137: she was exempted from the ' +
      "couple's ceiling for credits she had given away, while spending the " +
      "couple's own hand-out.",
  );
});

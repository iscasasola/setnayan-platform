/**
 * A GUEST'S OWN CREDITS ARE HERS — the couple's ceiling must not eat them.
 *
 * Owner, 2026-08-28: at the moment a guest buys she picks **keep them for me**
 * (*"their money, their shots, the couple's limit does not touch them"*) or
 * **add them to the celebration** (into the shared pot; she reverts to an
 * ordinary equal share). The buy sheet has offered both choices since
 * 2026-07-29; the gate did not honour the first of them.
 *
 * ── 🔑 WHY EVERY NUMBER IN THIS FILE IS DELIBERATELY PULLED APART ──────────
 * A ceiling of **20** against a purchase of **50**, and a guest who takes
 * **70** captures. The defect and the fix disagree at every single one of those
 * figures, so no assertion here can pass for the wrong reason:
 *
 *   • defective gate  → refused at capture 21 (it counts her own 50)
 *   • correct gate    → 70 pass, the 71st is refused
 *
 * Had the ceiling and the purchase been the same number — or the guest shot
 * fewer than the ceiling — both answers would coincide and the test would prove
 * nothing. That exact trap already bit this stream once, at 500 credits.
 *
 * ── AND THE OTHER HALF OF THE PROOF ───────────────────────────────────────
 * ⛔ An exemption with no floor under it is not a fix, it is the disease with
 * better manners. Every "she is allowed" test below has a twin that asserts she
 * is REFUSED — the same guest without the purchase, the same guest who put her
 * money in the pot instead, the 71st capture.
 *
 * Migration: 20271185324597_a_guest_s_own_credits_are_hers.sql
 * Run: cd apps/web && npx tsx --test tests/db/papic-guest-own-credits-are-hers.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

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

type Reply = {
  status: string;
  reason?: string;
  total?: number;
  used?: number;
  remaining?: number;
  unlimited?: boolean;
  ceiling?: number | null;
  self_funded?: number;
};

/** An event with a REAL shared pool — the condition four dead limits died in. */
async function seedPoolEvent(grantPoints = 5000) {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [`own-credits test ${n}`],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants (event_id, points, source, note)
     VALUES ($1, $2, 'admin', 'own-credits test')`,
    [eventId, grantPoints],
  );
  return eventId;
}

async function seedGuest(eventId: string, name = 'Ana') {
  n += 1;
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category,
                                ugc_terms_accepted_at)
     VALUES ($1, $2, 'Cruz', 'both', 'friends', NOW()) RETURNING guest_id`,
    [eventId, name],
  );
}

const token = () =>
  `tok${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

/**
 * Her own camera, exactly as `ensureGuestOwnCameraAdmin` mints one: tier
 * 'unlimited' (the only tier with a NULL daily budget) and `claimer_user_id`
 * left NULL, because a guest's camera is credentialed by her personal QR.
 */
async function seedOwnCamera(eventId: string, guestId: string) {
  n += 1;
  return one<string>(
    `INSERT INTO public.paparazzi_seats
       (event_id, seat_index, sku_code, claim_qr_token, tier, guest_id)
     VALUES ($1, $2, 'PAPIC_CAMERA_MINI_DAY', $3, 'unlimited', $4)
     RETURNING seat_id`,
    [eventId, 200 + n, token(), guestId],
  );
}

/**
 * "KEEP THEM FOR ME" — a guest purchase that lands on HER camera.
 *
 * Mirrors the shipped chain exactly: `papic_guest_orders(purchase_kind =
 * 'one_reload')` names the seat (its own CHECK forces that), and
 * `papic_grant_camera_points` lands a SEAT-scoped grant carrying the order id.
 */
async function guestBuysForHerself(
  eventId: string,
  guestId: string,
  seatId: string,
  points: number,
) {
  n += 1;
  const orderId = await one<string>(
    `INSERT INTO public.orders (event_id, description, requested_total_php, reference_code)
     VALUES ($1, 'guest one reload', $2, $3) RETURNING order_id`,
    [eventId, points, `OWN${n}${Math.random().toString(36).slice(2, 8).toUpperCase()}`],
  );
  await db.query(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, $4, 'one_reload', 'PAPIC_CAMERA_MINI_DAY', $5, $6)`,
    [orderId, eventId, seatId, guestId, points, token() + token()],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants
       (event_id, points, source, order_id, seat_id, note)
     VALUES ($1, $2, 'topup_order', $3, $4, 'keep them for me')`,
    [eventId, points, orderId, seatId],
  );
  return orderId;
}

/**
 * "ADD THEM TO THE CELEBRATION" — the SAME money, the other choice. A
 * `pool_topup` lands `seat_id IS NULL`, which is what makes it the pot.
 */
async function guestBuysForTheRoom(eventId: string, guestId: string, points: number) {
  n += 1;
  const orderId = await one<string>(
    `INSERT INTO public.orders (event_id, description, requested_total_php, reference_code)
     VALUES ($1, 'guest pool topup', $2, $3) RETURNING order_id`,
    [eventId, points, `ROOM${n}${Math.random().toString(36).slice(2, 8).toUpperCase()}`],
  );
  await db.query(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, NULL, $3, 'pool_topup', 'PAPIC_GUEST', $4, $5)`,
    [orderId, eventId, guestId, points, token() + token()],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants
       (event_id, points, source, order_id, note)
     VALUES ($1, $2, 'topup_order', $3, 'add them to the celebration')`,
    [eventId, points, orderId],
  );
  return orderId;
}

/** The couple turn the ceiling on and NAME this guest at `points`. */
async function nameGuestAt(eventId: string, guestId: string, points: number) {
  await db.query(
    `UPDATE public.events SET papic_guest_spend_ceiling_on = TRUE WHERE event_id = $1`,
    [eventId],
  );
  await db.query(
    `INSERT INTO public.papic_guest_spend_ceilings (guest_id, event_id, ceiling_points)
     VALUES ($1, $2, $3)
     ON CONFLICT (guest_id) DO UPDATE SET ceiling_points = EXCLUDED.ceiling_points`,
    [guestId, eventId, points],
  );
}

/**
 * ONE capture, the way `app/api/papic/guest-capture/route.ts` takes one: the
 * split reserve FIRST (her own balance, then the pot), the record SECOND.
 *
 * ⚠ THE ORDER IS THE POINT, not incidental setup. The reserve is what moves
 * `papic_seat_point_usage`, and the gate reads that ledger — a test that
 * recorded without reserving would be exercising a code path no shipped caller
 * takes, and would report the guest's own credits as never spent.
 */
async function shootOwnCamera(
  eventId: string,
  guestId: string,
  seatId: string,
  kind: 'photo' | 'clip' = 'photo',
  cost = 1,
) {
  await db.query(`SELECT public.papic_reserve_capture_split($1, $2, $3)`, [seatId, eventId, cost]);
  return one<Reply>(
    `SELECT public.papic_record_guest_capture($1, $2, false, $3, $4, NULL, $5)`,
    [guestId, `r2://own/${Math.random()}`, kind, kind === 'clip' ? 10000 : null, cost],
  );
}

/** A guest with no camera of her own — every credit comes from the pot. */
async function shootFromPot(guestId: string, cost = 1) {
  return one<Reply>(
    `SELECT public.papic_record_guest_capture($1, $2, false, 'photo', NULL, NULL, $3)`,
    [guestId, `r2://pot/${Math.random()}`, cost],
  );
}

const selfFunded = (guestId: string) =>
  one<number>(`SELECT public.papic_guest_self_funded_spend($1)`, [guestId]);
const meteredSpend = (guestId: string) =>
  one<number>(`SELECT public.papic_guest_ceiling_spend($1)`, [guestId]);
const poolLeft = (eventId: string) =>
  one<number>(`SELECT remaining_points FROM public.papic_event_pool_status($1)`, [eventId]);

// ══ 0 · THE SURFACE ════════════════════════════════════════════════════════

test('both new functions exist and NEITHER is reachable by a session role', async () => {
  for (const sig of [
    'public.papic_guest_self_funded_spend(uuid)',
    'public.papic_guest_ceiling_spend(uuid,integer)',
  ]) {
    assert.equal(
      await one<number>(`SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace nsp
                           ON nsp.oid = p.pronamespace
                         WHERE p.oid = $1::regprocedure`, [sig]),
      1,
      `${sig} did not ship`,
    );
    for (const role of ['anon', 'authenticated']) {
      assert.equal(
        await one<boolean>(`SELECT has_function_privilege($1, $2::regprocedure, 'EXECUTE')`, [role, sig]),
        false,
        `${sig} is EXECUTEable by ${role} — functions in public ship granted to PUBLIC, so the REVOKE is not optional`,
      );
    }
  }
});

test('⛔ the funding source is NOT an argument — this function is anon-callable', async () => {
  // A `p_self_funded BOOLEAN` would be a one-word walk through the couple's
  // ceiling on the ONE object a hostile direct caller still reaches.
  const args = await one<string[]>(
    `SELECT COALESCE(p.proargnames, ARRAY[]::text[])
       FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
      WHERE nsp.nspname = 'public' AND p.proname = 'papic_record_guest_capture'`,
  );
  for (const a of args) {
    assert.doesNotMatch(
      a,
      /(self_funded|is_mine|own_credits|funding)/,
      `papic_record_guest_capture grew a caller-supplied funding-source argument (${a}) — ` +
        'anon holds EXECUTE on it, so that is a way past the ceiling entirely',
    );
  }
  assert.equal(
    await one<boolean>(
      `SELECT has_function_privilege('anon',
         'public.papic_record_guest_capture(uuid,text,boolean,text,integer,text,integer)'::regprocedure,
         'EXECUTE')`,
    ),
    true,
    'PRECONDITION: anon must still hold EXECUTE, or the argument test above is about nothing',
  );
});

test('ONE overload — a second makes every named call 42725 and degrades every clip', async () => {
  assert.equal(
    await one<number>(
      `SELECT COUNT(*)::int FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
        WHERE nsp.nspname = 'public' AND p.proname = 'papic_record_guest_capture'`,
    ),
    1,
  );
});

// ══ 1 · 🚨 THE HEADLINE — ceiling 20, purchase 50, and the 71st is the refusal ══

test('🚨 a NAMED guest capped at 20 who bought 50 of her own shoots 70 — then is refused', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'Marites');
  const seatId = await seedOwnCamera(eventId, guestId);
  await guestBuysForHerself(eventId, guestId, seatId, 50);
  await nameGuestAt(eventId, guestId, 20);

  assert.equal(
    await one<number>(`SELECT public.papic_guest_spend_ceiling($1)`, [guestId]),
    20,
    'PRECONDITION: the named guest must resolve to 20, or nothing below proves anything',
  );
  assert.equal(
    await one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]),
    50,
    'PRECONDITION: her camera must hold the 50 she bought',
  );

  // ── HER OWN 50. Every one of these was refused by the shipped gate from the
  // 21st onward, because it counted her money against the couple's number.
  for (let i = 1; i <= 50; i += 1) {
    const r = await shootOwnCamera(eventId, guestId, seatId);
    assert.equal(
      r.status,
      'ok',
      `capture ${i} of her OWN 50 was refused (${r.status}/${r.reason}) — her money, outside the couple's limit`,
    );
  }
  assert.equal(await selfFunded(guestId), 50, 'all 50 of her own credits are spent');
  assert.equal(
    await meteredSpend(guestId),
    0,
    'and the couple’s ceiling has metered NOTHING — she has not touched the pot',
  );

  // ── THEN THE COUPLE'S 20, which is the number they actually set.
  for (let i = 1; i <= 20; i += 1) {
    const r = await shootOwnCamera(eventId, guestId, seatId);
    assert.equal(r.status, 'ok', `pot-funded capture ${i} of 20 was refused (${r.status}/${r.reason})`);
  }
  assert.equal(await meteredSpend(guestId), 20, 'exactly her ceiling, and not one credit more');
  assert.equal(await selfFunded(guestId), 50, 'her own spend is still 50 — it cannot grow past what she bought');

  // ── AND THE 71st IS REFUSED. Without this the test would only prove that the
  // ceiling stopped binding, which is a worse bug than the one being fixed.
  const refused = await shootOwnCamera(eventId, guestId, seatId);
  assert.equal(refused.status, 'quota_exhausted', 'the 21st POT-funded credit must be refused');
  assert.equal(refused.reason, 'guest_spend_ceiling', 'and it must say WHICH limit refused');
  assert.equal(refused.total, 20, 'the refusal speaks in the ceiling’s own currency');
  assert.equal(
    refused.used,
    20,
    'and reports the POT-funded figure — telling a guest she is 50 over a ceiling of 20 would be a correct refusal with a lying explanation',
  );
  assert.equal(refused.remaining, 0);
  assert.equal(refused.self_funded, 50, 'the reply says what she paid for, so a screen never has to derive it');

  assert.equal(
    await one<number>(`SELECT COUNT(*)::int FROM public.papic_guest_captures WHERE guest_id = $1`, [guestId]),
    70,
    'a refused capture must not land a row',
  );
  assert.ok(
    (await poolLeft(eventId)) >= 5000 - 20,
    'the celebration paid for exactly the 20 the couple allowed — her own 50 never touched the pot',
  );
});

// ══ 2 · ⛔ THE CONTROL — the same guest WITHOUT the purchase ═══════════════

test('⛔ the identical guest who bought NOTHING is refused at 21 — the exemption is doing the work', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'Control');
  await nameGuestAt(eventId, guestId, 20);

  assert.equal(await selfFunded(guestId), 0, 'she bought nothing, so nothing is exempt');

  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootFromPot(guestId)).status, 'ok', `capture ${i} of 20 refused`);
  }
  const refused = await shootFromPot(guestId);
  assert.equal(
    refused.status,
    'quota_exhausted',
    'a guest who bought nothing must still be stopped at the couple’s number — ' +
      'if this passes 21 the fix has removed the ceiling rather than corrected it',
  );
  assert.equal(refused.reason, 'guest_spend_ceiling');
  assert.equal(refused.used, 20);
});

// ══ 3 · ⚖ THE OTHER CHOICE — "add them to the celebration" ════════════════

test('⚖ a guest who put her 50 IN THE POT reverts to an ordinary share — refused at 21', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'Generous');
  const seatId = await seedOwnCamera(eventId, guestId);
  // THE SAME MONEY, THE OTHER BUTTON. Owner 2026-08-28: this puts them in the
  // shared pot for the room and she reverts to an ordinary equal share.
  await guestBuysForTheRoom(eventId, guestId, 50);
  await nameGuestAt(eventId, guestId, 20);

  assert.equal(
    await one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]),
    0,
    'a pool top-up must land seat_id IS NULL — those credits ARE the pot now',
  );
  assert.equal(await selfFunded(guestId), 0, 'and nothing is exempt from the couple’s ceiling');

  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootOwnCamera(eventId, guestId, seatId)).status, 'ok', `capture ${i} refused`);
  }
  const refused = await shootOwnCamera(eventId, guestId, seatId);
  assert.equal(refused.status, 'quota_exhausted');
  assert.equal(refused.reason, 'guest_spend_ceiling');
  assert.ok(
    (await poolLeft(eventId)) >= 5000 + 50 - 20,
    'her gift raised the ROOM’s pot, which is exactly what she chose',
  );
});

// ══ 4 · 🚨 "SPEND 2 AND TAKE 6" — a clip that straddles both balances ══════

test('🚨 a clip paid 2-from-her and 6-from-the-pot meters SIX against the ceiling, not eight', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'Straddle');
  const seatId = await seedOwnCamera(eventId, guestId);
  await guestBuysForHerself(eventId, guestId, seatId, 50);
  await nameGuestAt(eventId, guestId, 20);

  // Burn 48 of her 50, leaving exactly 2 — the owner's own worked example.
  for (let i = 1; i <= 48; i += 1) {
    assert.equal((await shootOwnCamera(eventId, guestId, seatId)).status, 'ok');
  }
  assert.equal(await selfFunded(guestId), 48);
  assert.equal(await meteredSpend(guestId), 0, 'nothing metered yet — all 48 were hers');

  // A ten-second clip costs 8. Her camera holds 2.
  const clip = await shootOwnCamera(eventId, guestId, seatId, 'clip', 8);
  assert.equal(clip.status, 'ok');
  assert.equal(await selfFunded(guestId), 50, 'her last 2 credits went first — dedicated is a FLOOR');
  assert.equal(
    await meteredSpend(guestId),
    6,
    'and the couple’s ceiling metered the SIX the pot paid, not the whole 8 — ' +
      'owner 2026-08-11: "spend 2 and take 6"',
  );
  assert.equal(clip.used, 6, 'the reply says the same six');
  assert.equal(clip.remaining, 14, '20 minus 6');
});

// ══ 5 · ⚖ WHAT DELIBERATELY STILL COUNTS ══════════════════════════════════

test('⚖ credits the HOST handed her camera still count — that is the couple’s own pot money', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'HandedTo');
  const seatId = await seedOwnCamera(eventId, guestId);
  await nameGuestAt(eventId, guestId, 20);

  // papic_dedicate_shots moves the couple's OWN pot credits onto one QR. The
  // owner's ruling is about "a guest who BUYS credits"; this migration does not
  // widen it, and this test is here so the boundary is a decision on the record
  // rather than an accident nobody measured.
  await db.query(`SELECT public.papic_dedicate_shots($1, $2, 200)`, [eventId, seatId]);
  assert.equal(
    await one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]),
    200,
    'PRECONDITION: the host hand-out must have landed',
  );
  assert.equal(
    await selfFunded(guestId),
    0,
    'she paid for none of it, so none of it is exempt from the couple’s own limit',
  );

  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootOwnCamera(eventId, guestId, seatId)).status, 'ok', `capture ${i} refused`);
  }
  const refused = await shootOwnCamera(eventId, guestId, seatId);
  assert.equal(
    refused.status,
    'quota_exhausted',
    'the tightest gate wins: a couple who both name her at 20 and hand her 200 have given ' +
      'two contradictory instructions, and the ceiling is the one this migration was told to keep',
  );
});

test('⚖ somebody ELSE’s purchase on her camera exempts nothing', async () => {
  const eventId = await seedPoolEvent(5000);
  const her = await seedGuest(eventId, 'Her');
  const other = await seedGuest(eventId, 'Other');
  const herSeat = await seedOwnCamera(eventId, her);
  await nameGuestAt(eventId, her, 20);

  // A guest order that names HER camera but ANOTHER guest as the buyer. The
  // join is on the buyer, not on the camera, and this is why.
  await guestBuysForHerself(eventId, other, herSeat, 50);
  assert.equal(
    await one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [herSeat]),
    50,
    'PRECONDITION: her camera holds credits — they are simply not HERS',
  );
  assert.equal(await selfFunded(her), 0, 'money on your camera is not the same as your money');

  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootOwnCamera(eventId, her, herSeat)).status, 'ok');
  }
  assert.equal((await shootOwnCamera(eventId, her, herSeat)).status, 'quota_exhausted');
});

// ══ 5b · 🛡 THE THREE PREDICATES, EACH MADE LOAD-BEARING ══════════════════
//
// 🚨 THESE THREE TESTS EXIST BECAUSE A MUTATION RUN FOUND THEIR GUARDS GREEN.
// Deleting `purchase_kind = 'one_reload'`, deleting `g.seat_id = v_seat` and
// deleting the negative clamp all left every test above passing — each one was
// covered only by ANOTHER predicate in the same query, so the suite was
// asserting the conjunction and not the parts. A predicate no test can kill is
// a comment with a WHERE in front of it.

test('🛡 a seat-scoped grant from a POOL purchase exempts nothing — the kind filter is load-bearing', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'KindFilter');
  const seatId = await seedOwnCamera(eventId, guestId);
  await nameGuestAt(eventId, guestId, 20);

  // ⚠ THIS STATE IS NOT PRODUCIBLE TODAY, AND THAT IS THE POINT. A pool top-up
  // is granted by `grantPapicPassPoints`, which writes seat_id NULL; only a One
  // reload goes through `papic_grant_camera_points`. So `seat_id = v_seat`
  // already excludes pool money — TODAY. The kind filter is the second fence,
  // and it is here for the day somebody teaches the pool path to name a seat
  // (the buyer's own camera is already on the order row, so it is one line
  // away). Constructed by hand precisely because the product cannot yet make it.
  const orderId = await one<string>(
    `INSERT INTO public.orders (event_id, description, requested_total_php, reference_code)
     VALUES ($1, 'pool topup with a seat', 50, $2) RETURNING order_id`,
    [eventId, `KIND${Math.random().toString(36).slice(2, 10).toUpperCase()}`],
  );
  await db.query(
    `INSERT INTO public.papic_guest_orders
       (order_id, event_id, seat_id, guest_id, purchase_kind, service_code, points, access_token)
     VALUES ($1, $2, $3, $4, 'pool_topup', 'PAPIC_GUEST', 50, $5)`,
    [orderId, eventId, seatId, guestId, token() + token()],
  );
  await db.query(
    `INSERT INTO public.papic_event_point_grants
       (event_id, points, source, order_id, seat_id, note)
     VALUES ($1, 50, 'topup_order', $2, $3, 'pool money that landed on a seat')`,
    [eventId, orderId, seatId],
  );

  assert.equal(
    await one<number>(`SELECT public.papic_seat_dedicated_points($1)`, [seatId]),
    50,
    'PRECONDITION: the credits must be on her camera, or the kind filter is not what is being tested',
  );
  assert.equal(
    await selfFunded(guestId),
    0,
    'she chose "add them to the celebration" — that money is the room’s, wherever the grant row landed',
  );

  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootOwnCamera(eventId, guestId, seatId)).status, 'ok', `capture ${i} refused`);
  }
  assert.equal(
    (await shootOwnCamera(eventId, guestId, seatId)).status,
    'quota_exhausted',
    'the ceiling must still bind — the buyer’s own choice decides, not where the ledger row landed',
  );
});

test('🛡 her purchase on a DIFFERENT camera exempts nothing — the seat filter is load-bearing', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'OldCamera');

  // Camera A: she bought 50 on it, and it was later revoked (a re-issued QR, a
  // lost phone). `resolveGuestOwnCamera` only ever finds a live camera, and
  // `paparazzi_seats_one_active_camera_per_guest` allows exactly this pair.
  const seatA = await seedOwnCamera(eventId, guestId);
  await guestBuysForHerself(eventId, guestId, seatA, 50);
  await db.query(`UPDATE public.paparazzi_seats SET revoked_at = NOW() WHERE seat_id = $1`, [seatA]);

  // Camera B: her live camera, holding 200 the HOST handed it — the couple's
  // own pot money, which is deliberately NOT exempt.
  const seatB = await seedOwnCamera(eventId, guestId);
  await db.query(`SELECT public.papic_dedicate_shots($1, $2, 200)`, [eventId, seatB]);
  await nameGuestAt(eventId, guestId, 20);

  assert.equal(
    await selfFunded(guestId),
    0,
    'the 50 she paid for sit on a camera she is not holding — a dead camera’s receipt must not ' +
      'launder the host’s hand-out on the live one',
  );

  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootOwnCamera(eventId, guestId, seatB)).status, 'ok', `capture ${i} refused`);
  }
  assert.equal(
    (await shootOwnCamera(eventId, guestId, seatB)).status,
    'quota_exhausted',
    'without `g.seat_id = v_seat` the old purchase would exempt up to 50 credits of the host’s own money',
  );
});

test('🛡 dedicated credits spent through the OTHER door cannot become CREDIT — and the over-draw is bounded by what she paid for', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'OtherDoor');
  const seatId = await seedOwnCamera(eventId, guestId);
  await guestBuysForHerself(eventId, guestId, seatId, 50);
  await nameGuestAt(eventId, guestId, 20);

  // ⚠ THE BOUND THE MIGRATION HEADER STATES, EXERCISED RATHER THAN ASSERTED IN
  // PROSE. Her camera can in principle also shoot through the SEAT door
  // (papic_record_seat_capture → papic_photos), which spends the same dedicated
  // balance and lands NO row in papic_guest_captures. Reserving without
  // recording is exactly what that does to these two ledgers.
  //
  // 🔎 REACHABLE? Only barely, and not today. papic_record_seat_capture refuses
  // unless `claimer_user_id = auth.uid()`, and a guest's own camera is minted
  // with that column NULL; `claim_paparazzi_seat` would claim it for whoever
  // presents its `claim_qr_token`, but nothing renders that token for a
  // guest-linked camera. Defended anyway — "unreachable today" is not a
  // guarantee, and this is money.
  for (let i = 1; i <= 50; i += 1) {
    await db.query(`SELECT public.papic_reserve_capture_split($1, $2, 1)`, [seatId, eventId]);
  }
  assert.equal(await selfFunded(guestId), 50, 'PRECONDITION: her balance is spent, on the other door');
  assert.equal(
    await one<number>(`SELECT COUNT(*)::int FROM public.papic_guest_captures WHERE guest_id = $1`, [guestId]),
    0,
    'PRECONDITION: and not one row landed here',
  );

  // ── 1 · THE METER FLOORS AT ZERO. Unclamped it reads −50, and a negative
  // meter is not merely a wrong number — `remaining` is `ceiling − metered`, so
  // it would tell her she has SEVENTY of the couple's credits when the couple
  // gave her twenty.
  assert.equal(await meteredSpend(guestId), 0, 'the meter must floor at zero, never go negative');

  // ── 2 · AND THE OVER-DRAW IS BOUNDED BY WHAT SHE PAID FOR — never by what a
  // second door happened to spend. She gets her ceiling of 20 plus, at worst,
  // the 50 credits she personally bought; the 71st is refused. That is the
  // honest ceiling of this design, and stating it as a number is the only way a
  // future reader can tell a bounded consequence from an unbounded one.
  for (let i = 1; i <= 70; i += 1) {
    assert.equal((await shootFromPot(guestId)).status, 'ok', `capture ${i} of 70 refused`);
  }
  const refused = await shootFromPot(guestId);
  assert.equal(
    refused.status,
    'quota_exhausted',
    'the exemption must be bounded by her purchase — an unbounded one is a ceiling that never binds',
  );
  assert.equal(refused.reason, 'guest_spend_ceiling');
  assert.equal(refused.used, 20, 'and 20 is the couple’s number, which is what she was over');
});

// ══ 6 · 🪤 THE HOSTILE CALLER ══════════════════════════════════════════════

test('🪤 skipping the reserve makes the gate STRICTER, never looser', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'Direct');
  const seatId = await seedOwnCamera(eventId, guestId);
  await guestBuysForHerself(eventId, guestId, seatId, 50);
  await nameGuestAt(eventId, guestId, 20);

  // A caller who reaches papic_record_guest_capture directly — the anonymous
  // door — never moves papic_seat_point_usage, so nothing is ever exempt for
  // them. 20 captures, then refused: the ceiling behaves as if she had bought
  // nothing at all. There is no ordering a caller can arrange that LOOSENS it.
  for (let i = 1; i <= 20; i += 1) {
    assert.equal((await shootFromPot(guestId)).status, 'ok', `direct capture ${i} refused`);
  }
  const refused = await shootFromPot(guestId);
  assert.equal(
    refused.status,
    'quota_exhausted',
    'a caller who skips the split reserve must not thereby gain an exemption',
  );
  assert.equal(await selfFunded(guestId), 0, 'nothing was spent from her balance, so nothing is exempt');
});

// ══ 7 · NOTHING CHANGES FOR A GUEST WHO BOUGHT NOTHING ════════════════════

test('a celebration with no ceiling reports byte-identically, and self_funded is 0', async () => {
  const eventId = await seedPoolEvent(5000);
  const guestId = await seedGuest(eventId, 'Ordinary');

  const r = await shootFromPot(guestId);
  assert.equal(r.status, 'ok');
  assert.equal(r.unlimited, true, 'the pool still stands the per-guest gate down when no ceiling is set');
  assert.equal(r.ceiling, null);
  assert.equal(r.total, 150, 'the platform’s flat 150 is still what an uncapped guest is told');
  assert.equal(r.used, 1, 'and `used` is still every credit spent, from whatever ledger');
  assert.equal(r.self_funded, 0);
});

test('the 150 branch still counts EVERY credit — that limit has never cared who paid', async () => {
  // No pool, no Unlock: the legacy branch. A guest's own purchase must not buy
  // her past the platform's own deposit limit — that is a limit on how much one
  // phone may put into this gallery, not on whose money it was.
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type)
     VALUES ($1, 'birthday') RETURNING event_id`,
    [`no-pool ${n}`],
  );
  const guestId = await seedGuest(eventId, 'NoPool');
  // 🪤 EVERY EVENT ARMS THE FREE 50-CREDIT POOL GRANT ON CREATION, so "an event
  // with no pot" cannot be made by simply not granting one — the seed trigger
  // has already granted it and `applies` comes back TRUE. That is exactly why
  // the ceiling migration calls this branch "inert in practice"; reaching it at
  // all takes deleting the grant the product itself armed.
  await db.query(`DELETE FROM public.papic_event_point_grants WHERE event_id = $1`, [eventId]);
  assert.equal(
    await one<boolean>(`SELECT applies FROM public.papic_event_pool_status($1)`, [eventId]),
    false,
    'PRECONDITION: no pot may apply, or this is the wrong branch',
  );
  // Ownership still has to pass, so the event owns PAPIC_GUEST outright.
  await db.query(
    `INSERT INTO public.orders (event_id, description, requested_total_php, reference_code, service_key, status)
     VALUES ($1, 'papic guest', 1000, $2, 'PAPIC_GUEST', 'paid')`,
    [eventId, `NOPOOL${n}${Math.random().toString(36).slice(2, 8).toUpperCase()}`],
  );

  const first = await shootFromPot(guestId, 149);
  assert.equal(first.status, 'ok');
  assert.equal(first.total, 150);
  const second = await shootFromPot(guestId, 2);
  assert.equal(second.status, 'quota_exhausted');
  assert.equal(second.reason, 'per_guest_credits', 'and it is the PLATFORM’s refusal, not the couple’s');
});

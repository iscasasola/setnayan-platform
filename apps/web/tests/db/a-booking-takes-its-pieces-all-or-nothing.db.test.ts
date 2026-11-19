/**
 * A BOOKING TAKES ITS PIECES, ALL OR NOTHING — Availability plan step 4 (owner "ok" 2026-11-19, DECISION_LOG
 * "AVAILABILITY STEPS 3 AND 4 APPROVED"; migration a_booking_takes_its_pieces_all_or_nothing).
 *
 * Proven against the replayed migrations:
 *   1. `event_vendors.booked_quantity` is written ONLY by `set_booked_quantity` — a browser session cannot shrink it;
 *   2. the supplier's yes for a piece card takes N pieces only when N fit ("320 of 500 out" + 200 is refused, 180 is
 *      not), and the card's count is the SUM of quantities (`service_card_bookings_on`);
 *   3. a card that is not by the piece is left alone; a piece yes with no number is refused (never "one" by default);
 *   4. `acquire_schedule_pools` carries quantity — a pool with 500 and 320 out refuses a 200-piece booking and takes
 *      nothing; an Always available card takes no seat at all.
 *   5. Made to order is counted IN PROGRESS on every day of [due − prep, due] (owner 19 Nov, AVAILABILITY FINALIZED),
 *      the order's own prep_days over the card's usual_prep_days; prep_days is neither browser-readable nor -writable.
 *
 *   6. every writer of a booking's pieces locks booking row → card → shop (no deadlock); the couple's ask locks the row
 *      before its status check; a door with no number keeps the earlier one; a slotted piece card is counted by pieces.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const DAY = '2028-03-14';

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  try {
    return await fn();
  } finally {
    await reset();
  }
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

let seq = 0;
async function mkUser(label: string, type: 'customer' | 'vendor'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data)
       VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [`${label}-${++seq}@pieces.test`, type],
    )
  ).rows[0]!.id;
}

type Shop = { uid: string; vpid: string };
async function mkShop(label: string, tier: string): Promise<Shop> {
  const uid = await mkUser(label, 'vendor');
  const vpid =
    (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [uid]))
      .rows[0]?.v ??
    (
      await db.query<{ v: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2) RETURNING vendor_profile_id AS v`,
        [uid, label],
      )
    ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET business_name = $2, location_city = 'Manila', services = ARRAY['photography']::text[],
            verification_state = 'verified'::public.vendor_verification_state, last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility,
            tier_state = $3::public.vendor_tier_state
      WHERE vendor_profile_id = $1`,
    [vpid, label, tier],
  );
  return { uid, vpid };
}

async function mkCard(vpid: string, dailyCapacity: number | null): Promise<string> {
  const s = await db.query<{ s: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text, is_active, primary_photo_r2_key)
     VALUES ($1, 'photo_booth', 40000, 'Free extra hour', FALSE, 'vendor-media/per-date/cover.jpg') RETURNING vendor_service_id AS s`,
    [vpid],
  );
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label, worth_php, sort_order)
     VALUES ($1, $2, 'Unlimited prints', 0, 0)`,
    [s.rows[0]!.s, vpid],
  );
  await db.query(`UPDATE public.vendor_services SET daily_capacity = $2, is_active = TRUE WHERE vendor_service_id = $1`, [
    s.rows[0]!.s,
    dailyCapacity,
  ]);
  return s.rows[0]!.s;
}

async function mkEvent(name: string): Promise<string> {
  return (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ($1, 'birthday', $2::date, 'day') RETURNING event_id AS e`,
      [name, DAY],
    )
  ).rows[0]!.e;
}

/** Another couple already BOOKED on the card on DAY. */
async function booked(shop: string, card: string): Promise<string> {
  const ev = await mkEvent('Booked couple');
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
       VALUES ($1, 'misc', 'Pieces Rental', 'contracted', $2, $3) RETURNING vendor_id AS v`,
      [ev, shop, card],
    )
  ).rows[0]!.v;
}

/** A couple's open ask for the card on DAY — the row the supplier says yes to. */
async function ask(couple: string, shop: string, card: string): Promise<string> {
  const ev = await mkEvent('Asking couple');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [ev, couple]);
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, marketplace_vendor_id, service_id,
          lock_request_state, lock_requested_at, lock_requested_by_user_id)
       VALUES ($1, 'misc', 'Pieces Rental', 'considering', $2, $3, 'pending', NOW(), $4)
       RETURNING vendor_id AS v`,
      [ev, shop, card, couple],
    )
  ).rows[0]!.v;
}

async function agree(uid: string, rowId: string): Promise<{ status: string; daily_limit?: number }> {
  return asUser(uid, async () => (await db.query<{ r: { status: string; daily_limit?: number } }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [rowId])).rows[0]!.r);
}
let couple = '';

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  couple = await mkUser('couple', 'customer');
});

after(async () => {
  await db?.close();
});


async function setQty(uid: string, row: string, n: number | null): Promise<{ status: string; free?: number }> {
  return asUser(uid, async () => (await db.query<{ r: { status: string; free?: number } }>(`SELECT public.set_booked_quantity($1, $2) AS r`, [row, n])).rows[0]!.r);
}
async function outOn(card: string): Promise<number> {
  return asService(async () => (await db.query<{ n: number }>(`SELECT public.service_card_bookings_on($1, $2::date, NULL) AS n`, [card, DAY])).rows[0]!.n);
}
async function pieceCard(vpid: string, have: number): Promise<string> {
  const c = await mkCard(vpid, have);
  await db.query(`UPDATE public.vendor_services SET availability_style = 'piece' WHERE vendor_service_id = $1`, [c]);
  return c;
}

test('1 · booked_quantity is written only by set_booked_quantity — a couple cannot shrink their own 200 to 1', async () => {
  const shop = await mkShop('Guard Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 500);
  const row = await ask(couple, shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 200 WHERE vendor_id = $1`, [row]);
  // Refused by the trigger (or not even visible to the write) — either way the 200 must stand.
  await asUser(couple, () => db.query(`UPDATE public.event_vendors SET booked_quantity = 1 WHERE vendor_id = $1`, [row])).catch((e: Error) => {
    assert.match(e.message, /set only by set_booked_quantity|permission denied/i);
  });
  const n = (await db.query<{ q: number }>(`SELECT booked_quantity AS q FROM public.event_vendors WHERE vendor_id = $1`, [row])).rows[0]!.q;
  assert.equal(n, 200);
});

test('2 · the yes takes N pieces only when they fit, and the card counts the SUM', async () => {
  const shop = await mkShop('Tiffany Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 500);
  const other = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 320 WHERE vendor_id = $1`, [other]);
  assert.equal(await outOn(chairs), 320, 'the card did not count pieces');
  const row = await ask(couple, shop.vpid, chairs);
  const tooMany = await setQty(shop.uid, row, 200);
  assert.equal(tooMany.status, 'full');
  assert.equal(tooMany.free, 180);
  assert.equal((await setQty(shop.uid, row, 180)).status, 'ok');
  const r = await agree(shop.uid, row);
  assert.notEqual(r.status, 'daily_limit_reached', '320 + 180 of 500 was refused');
  assert.equal(await outOn(chairs), 500);
});

test('3 · a card not by the piece is left alone; a piece yes with no number is refused', async () => {
  const shop = await mkShop('Mixed Rentals', 'pro');
  const plain = await mkCard(shop.vpid, 2);
  const row = await ask(couple, shop.vpid, plain);
  assert.equal((await setQty(shop.uid, row, 0)).status, 'not_by_the_piece');
  const chairs = await pieceCard(shop.vpid, 50);
  const row2 = await ask(couple, shop.vpid, chairs);
  assert.equal((await setQty(shop.uid, row2, 0)).status, 'bad_quantity');
  assert.equal((await setQty(shop.uid, row2, null)).status, 'bad_quantity');
  const stranger = await mkShop('Stranger', 'pro');
  assert.equal((await setQty(stranger.uid, row2, 10)).status, 'not_authorized');
});

async function mkPool(vpid: string, cap: number): Promise<string> {
  return (
    await db.query<{ p: string }>(
      `INSERT INTO public.vendor_schedule_pools (vendor_profile_id, pool_label, daily_booking_capacity, is_active)
       VALUES ($1, 'Chairs', $2, TRUE) RETURNING pool_id AS p`,
      [vpid, cap],
    )
  ).rows[0]!.p;
}
/** As the SHOP (the function's own caller check: the shop on its own booking, or the couple). */
async function acquire(row: string, pool: string): Promise<{ status: string; counted?: boolean }> {
  const r = (await db.query<{ e: string; uid: string }>(
    `SELECT ev.event_id AS e, vp.user_id AS uid FROM public.event_vendors ev
       JOIN public.vendor_profiles vp ON vp.vendor_profile_id = ev.marketplace_vendor_id
      WHERE ev.vendor_id = $1`,
    [row],
  )).rows[0]!;
  return asUser(r.uid, async () =>
    (await db.query<{ out: { status: string; counted?: boolean } }>(`SELECT public.acquire_schedule_pools($1, $2, $3::uuid[]) AS out`, [r.e, row, [pool]])).rows[0]!.out,
  );
}
async function seats(row: string): Promise<number> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_schedule_pool_bookings WHERE event_vendor_id = $1 AND released_at IS NULL`, [row])).rows[0]!.n;
}

test('4 · acquire_schedule_pools carries quantity against the CARD\'s number, all or nothing — and an Always available card takes no seat', async () => {
  const shop = await mkShop('Pool Rentals', 'pro');
  // 🔢 One number for pieces (review 2026-11-19): 500 chairs on the card, on a schedule left at its default "1 a day".
  // The schedule's 1 never holds pieces — the card's 500 does.
  const chairs = await pieceCard(shop.vpid, 500);
  const pool = await mkPool(shop.vpid, 1);
  const first = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 320 WHERE vendor_id = $1`, [first]);
  assert.equal((await acquire(first, pool)).status, 'ok');
  const big = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 200 WHERE vendor_id = $1`, [big]);
  assert.equal((await acquire(big, pool)).status, 'full', '320 + 200 on a 500-chair card was taken');
  assert.equal(await seats(big), 0, 'a refused booking kept a seat');
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 180 WHERE vendor_id = $1`, [big]);
  assert.equal((await acquire(big, pool)).status, 'ok');

  const always = await mkCard(shop.vpid, 1);
  await db.query(`UPDATE public.vendor_services SET availability_style = 'none' WHERE vendor_service_id = $1`, [always]);
  const tiny = await mkPool(shop.vpid, 1);
  const a = await booked(shop.vpid, always);
  const b = await booked(shop.vpid, always);
  const ra = await acquire(a, tiny);
  assert.equal(ra.status, 'ok');
  assert.equal(ra.counted, false);
  assert.equal((await acquire(b, tiny)).status, 'ok', 'an Always available card was counted');
  assert.equal(await seats(a) + (await seats(b)), 0);
});

test('5 · ONE number for pieces: a 2,000-chair card on a 1-a-day schedule takes 1,200 at the yes, the deposit gate and the bench alike', async () => {
  const shop = await mkShop('Big Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 2000);
  const pool = await mkPool(shop.vpid, 1);
  await db.query(
    `INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id) VALUES ($1, $2, $3)`,
    [chairs, pool, shop.vpid],
  );
  const first = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 800 WHERE vendor_id = $1`, [first]);
  assert.equal((await acquire(first, pool)).status, 'ok');
  const row = await ask(couple, shop.vpid, chairs);
  // The supplier's number: the card's 2,000 holds, not the schedule's 1.
  assert.equal((await setQty(shop.uid, row, 1200)).status, 'ok', 'the schedule\'s "1 a day" refused pieces the card has');
  assert.equal((await acquire(row, pool)).status, 'ok', 'the deposit gate held pieces to the schedule\'s number');
  // The bench mirror agrees: the card is still offered on the day while chairs are left, and hidden once all are out.
  const hidden = async () =>
    asService(async () => (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.service_cards_unbookable_on($1::uuid[], $2::date[])`, [[chairs], [DAY]],
    )).rows[0]!.n);
  assert.equal(await outOn(chairs), 800, 'only the booked row counts before the yes');
  assert.equal(await hidden(), 0, 'the bench hid a card with chairs left because its schedule said 1');
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 2000 WHERE vendor_id = $1`, [first]);
  assert.equal(await hidden(), 1, 'the bench offered a card with every chair out');
  // The schedule itself keeps its 1..500 (the cap lift lives on the card's number).
  await assert.rejects(mkPool(shop.vpid, 2000), /daily_booking_capacity/);
});

async function askQty(uid: string, row: string, n: number | null): Promise<{ status: string; free?: number }> {
  return asUser(uid, async () => (await db.query<{ r: { status: string; free?: number } }>(`SELECT public.set_asked_quantity($1, $2) AS r`, [row, n])).rows[0]!.r);
}

test('6 · the COUPLE says how many at the ask — honestly told when not enough are free; a stranger cannot', async () => {
  const shop = await mkShop('Ask Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 500);
  const other = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 320 WHERE vendor_id = $1`, [other]);
  const row = await ask(couple, shop.vpid, chairs);
  const tooMany = await askQty(couple, row, 200);
  assert.equal(tooMany.status, 'full');
  assert.equal(tooMany.free, 180);
  assert.equal((await askQty(couple, row, 150)).status, 'ok');
  const q = (await db.query<{ q: number }>(`SELECT booked_quantity AS q FROM public.event_vendors WHERE vendor_id = $1`, [row])).rows[0]!.q;
  assert.equal(q, 150, "the couple's number was not kept");
  const stranger = await mkUser('stranger-couple', 'customer');
  assert.equal((await askQty(stranger, row, 10)).status, 'not_authorized');
  // The yes takes the couple's number — no supplier number needed.
  assert.notEqual((await agree(shop.uid, row)).status, 'pieces_needed');
  assert.equal(await outOn(chairs), 470);
  assert.equal((await askQty(couple, row, 1)).status, 'already_booked', 'a booked number changed after the yes');
});

test('7 · the yes counts its OWN pieces: 420 of 500 out, a stale 100 is refused, 80 fits, then 1 more is refused', async () => {
  // (One ask open at a time: the shipped "answer the others first" rule refuses a yes while other couples wait on the
  // same date — see the PR's owner questions.)
  const shop = await mkShop('Race Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 500);
  const other = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 320 WHERE vendor_id = $1`, [other]);
  const [ca, cb, cc] = [await mkUser('race-a', 'customer'), await mkUser('race-b', 'customer'), await mkUser('race-c', 'customer')];
  const a = await ask(ca, shop.vpid, chairs);
  assert.equal((await askQty(ca, a, 100)).status, 'ok');
  assert.equal((await agree(shop.uid, a)).status, 'ok');
  assert.equal(await outOn(chairs), 420);
  // A number written while it still fitted (the couple asked before the other yes) — the yes must re-count.
  const b = await ask(cb, shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 100 WHERE vendor_id = $1`, [b]);
  assert.equal((await agree(shop.uid, b)).status, 'daily_limit_reached', '420 + 100 of 500 was taken — a double booking');
  assert.equal((await setQty(shop.uid, b, 80)).status, 'ok');
  assert.equal((await agree(shop.uid, b)).status, 'ok', '420 + 80 of 500 was refused');
  assert.equal(await outOn(chairs), 500);
  const c = await ask(cc, shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 1 WHERE vendor_id = $1`, [c]);
  assert.equal((await agree(shop.uid, c)).status, 'daily_limit_reached', '501 of 500 was taken');
});

test('8 · the yes and the piece number take ONE lock per shop (the guard is in the database, not the app)', async () => {
  // PGlite runs one connection, so two transactions cannot truly race here. What can be proven: both writers that
  // grow a card's count take the same transaction lock, which in Postgres serializes them — the second waits for the
  // first to commit and then reads its pieces.
  for (const fn of ['vendor_agree_to_lock', 'set_booked_quantity']) {
    const def = (await db.query<{ d: string }>(`SELECT pg_get_functiondef(oid) AS d FROM pg_proc WHERE proname = $1`, [fn])).rows[0]!.d;
    assert.match(def, /lock_shop_day_counts\(v_service\)/, `${fn} does not take the shop lock`);
  }
  const lock = (await db.query<{ d: string }>(`SELECT pg_get_functiondef(oid) AS d FROM pg_proc WHERE proname = 'lock_shop_day_counts'`)).rows[0]!.d;
  assert.match(lock, /pg_advisory_xact_lock/);
});

test('9 · ONE count per fact: chairs never fill a shared schedule\'s seats, and the day reads each guard\'s own count, each stock once', async () => {
  const shop = await mkShop('Bar Rentals', 'pro');
  // A schedule left at "1 a day", shared by two chair cards of ONE service (one stock of 500) and a photo booth.
  const pool = await mkPool(shop.vpid, 1);
  const chairs = await pieceCard(shop.vpid, 500);
  const chairs2 = await pieceCard(shop.vpid, 500);
  const booth = await mkCard(shop.vpid, 1);
  await db.query(`UPDATE public.vendor_services SET category = 'photography' WHERE vendor_service_id = $1`, [booth]);
  for (const card of [chairs, chairs2, booth]) {
    await db.query(
      `INSERT INTO public.vendor_schedule_calendar_services (vendor_service_id, pool_id, vendor_profile_id) VALUES ($1, $2, $3)`,
      [card, pool, shop.vpid],
    );
  }
  // 320 chairs AGREED (contracted) and not yet deposited — no seat row yet.
  const first = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 320 WHERE vendor_id = $1`, [first]);
  const read = async (uid: string) =>
    asUser(uid, async () =>
      (await db.query<{ pool_id: string; taken: number; pieces_out: number | null; pieces_have: number | null }>(
        `SELECT * FROM public.vendor_day_pool_taken($1::date)`, [DAY],
      )).rows,
    );
  let r = (await read(shop.uid)).find((x) => x.pool_id === pool);
  // (2) the bar reads the yes's count — agreed-but-undeposited chairs are OUT, not free.
  assert.equal(r?.pieces_out, 320, 'agreed chairs read as free on the day');
  assert.equal(r?.pieces_out, await outOn(chairs), 'the day and the guard disagree on chairs out');
  // (smaller) one stock counted once: two cards of one service read "of 500", not "of 1,000".
  assert.equal(r?.pieces_have, 500, 'a shared stock was counted twice');
  // The deposit takes the chairs' seat row — still never a SEAT.
  assert.equal((await acquire(first, pool)).status, 'ok');
  r = (await read(shop.uid)).find((x) => x.pool_id === pool);
  assert.equal(r?.taken, 0, 'chairs took a seat on the shared schedule');
  assert.equal(r?.pieces_out, 320);
  // (1) the booth's one seat is free — the guard, the mirror and the day all say so, then all say it is taken.
  const hidden = async (card: string) =>
    asService(async () => (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.service_cards_unbookable_on($1::uuid[], $2::date[])`, [[card], [DAY]],
    )).rows[0]!.n);
  assert.equal(await hidden(booth), 0, 'the bench hid the booth because chairs were out');
  const boothRow = await booked(shop.vpid, booth);
  assert.equal((await acquire(boothRow, pool)).status, 'ok', 'chairs filled the booth\'s seat');
  r = (await read(shop.uid)).find((x) => x.pool_id === pool);
  assert.equal(r?.taken, 1);
  assert.equal(await hidden(booth), 1, 'the bench offered a booth whose one seat is taken');
  const secondBooth = await booked(shop.vpid, booth);
  assert.equal((await acquire(secondBooth, pool)).status, 'full');
  // Only the shop reads its own schedule.
  const stranger = await mkShop('Nosy Rentals', 'pro');
  assert.equal((await read(stranger.uid)).some((x) => x.pool_id === pool), false, "another shop read this shop's schedule");
});

/** The schedule's in-progress and taken counts on a day, as the shop's Clients day bar reads them. */
async function barOn(uid: string, pool: string, day: string): Promise<{ in_progress: number; taken: number }> {
  const rows = await asUser(uid, async () =>
    (await db.query<{ pool_id: string; taken: number; in_progress: number }>(`SELECT * FROM public.vendor_day_pool_taken($1::date)`, [day])).rows,
  );
  const r = rows.find((x) => x.pool_id === pool);
  assert.ok(r, 'the shop could not read its own schedule');
  return { in_progress: r.in_progress, taken: r.taken };
}

test('10 · Made to order is IN PROGRESS across its preparation window, not only on its due date (owner 19 Nov)', async () => {
  // Owner, DECISION_LOG 2026-11-19 "AVAILABILITY FINALIZED" — "Wrong, fix": an order due the 14th that takes 13 days
  // is being made from the 1st. Counting it on the due date only reads the 1st as free — this test fails on that.
  const shop = await mkShop('Cake Studio', 'pro');
  const cakes = await mkCard(shop.vpid, 5);
  await db.query(`UPDATE public.vendor_services SET availability_style = 'order', usual_prep_days = 13 WHERE vendor_service_id = $1`, [cakes]);
  const pool = await mkPool(shop.vpid, 5);
  const first = await booked(shop.vpid, cakes); // due DAY = 2028-03-14
  assert.equal((await acquire(first, pool)).status, 'ok');

  assert.deepEqual(await barOn(shop.uid, pool, '2028-03-01'), { in_progress: 1, taken: 0 }, 'an order 13 days from due was not in progress');
  assert.deepEqual(await barOn(shop.uid, pool, '2028-03-14'), { in_progress: 1, taken: 1 });
  assert.equal((await barOn(shop.uid, pool, '2028-02-29')).in_progress, 0, 'counted before its preparation began');
  assert.equal((await barOn(shop.uid, pool, '2028-03-15')).in_progress, 0, 'counted after its due date');

  // THIS order's own time wins over the card's (2b writes it at accept; the definer here is the test's own role).
  const second = await booked(shop.vpid, cakes);
  await db.query(`UPDATE public.event_vendors SET prep_days = 2 WHERE vendor_id = $1`, [second]);
  assert.equal((await acquire(second, pool)).status, 'ok');
  assert.equal((await barOn(shop.uid, pool, '2028-03-12')).in_progress, 2);
  assert.equal((await barOn(shop.uid, pool, '2028-03-11')).in_progress, 1, "the order's own 2 days were not used");

  // A card that is NOT Made to order keeps its usual_prep_days out of the count (day precision, as today).
  const day = await mkCard(shop.vpid, 5);
  await db.query(`UPDATE public.vendor_services SET usual_prep_days = 13 WHERE vendor_service_id = $1`, [day]);
  const dayPool = await mkPool(shop.vpid, 5);
  const third = await booked(shop.vpid, day);
  assert.equal((await acquire(third, dayPool)).status, 'ok');
  assert.equal((await barOn(shop.uid, dayPool, '2028-03-01')).in_progress, 0);

  // The hard refusal still counts the due date only (until 2b): two orders in progress on the 12th, five fit on it.
  assert.equal((await barOn(shop.uid, pool, '2028-03-12')).taken, 0);
});

test('11 · a couple can neither read nor change an order\'s prep_days — only a definer writes it', async () => {
  const shop = await mkShop('Prep Guard Cakes', 'pro');
  const cakes = await mkCard(shop.vpid, 5);
  await db.query(`UPDATE public.vendor_services SET availability_style = 'order', usual_prep_days = 10 WHERE vendor_service_id = $1`, [cakes]);
  const row = await ask(couple, shop.vpid, cakes);
  await db.query(`UPDATE public.event_vendors SET prep_days = 10 WHERE vendor_id = $1`, [row]);
  await assert.rejects(
    asUser(couple, () => db.query(`SELECT prep_days FROM public.event_vendors WHERE vendor_id = $1`, [row])),
    /permission denied/i,
    'a browser session read prep_days',
  );
  await asUser(couple, () => db.query(`UPDATE public.event_vendors SET prep_days = 0 WHERE vendor_id = $1`, [row])).catch((e: Error) => {
    assert.match(e.message, /set only by a definer|permission denied/i);
  });
  const p = (await db.query<{ p: number }>(`SELECT prep_days AS p FROM public.event_vendors WHERE vendor_id = $1`, [row])).rows[0]!.p;
  assert.equal(p, 10, 'a couple shortened their order\'s preparation window');
});

/** The function's own text with `--` comments removed, so an order read from it is the code's, not a comment's. */
async function bodyOf(fn: string): Promise<string> {
  const def = (await db.query<{ d: string }>(`SELECT pg_get_functiondef(oid) AS d FROM pg_proc WHERE proname = $1`, [fn])).rows[0]!.d;
  return def.replace(/--[^\n]*/g, '');
}
/** Where a lock is first taken in a body: the booking row, the card row, the shop's one count lock. */
function lockAt(body: string, what: 'booking' | 'card' | 'shop'): number {
  const re =
    what === 'booking'
      ? /FROM\s+public\.event_vendors(?:\s+ev)?\s+WHERE\s+(?:ev\.)?vendor_id\s*=\s*p_event_vendor_id\s+FOR\s+UPDATE/i
      : what === 'card'
        ? /FROM\s+public\.vendor_services\s+vs\s+WHERE\s+vs\.vendor_service_id\s*=\s*v_service\s+FOR\s+(?:NO\s+KEY\s+)?UPDATE/i
        : /lock_shop_day_counts\(v_service\)/i;
  const m = re.exec(body);
  return m ? m.index : -1;
}

test('12 · every writer of a booking\'s pieces locks in ONE order — booking row, then card, then shop (no deadlock, review 2026-11-20)', async () => {
  // Two transactions that take the same two locks in opposite orders deadlock: set_booked_quantity drafted card →
  // booking while vendor_agree_to_lock takes booking → card. PGlite has one connection, so the deadlock itself cannot
  // be staged here; the ORDER can be read from each function's own code, and it is the order that prevents it.
  for (const fn of ['vendor_agree_to_lock', 'set_booked_quantity']) {
    const body = await bodyOf(fn);
    const [booking, card, shop] = [lockAt(body, 'booking'), lockAt(body, 'card'), lockAt(body, 'shop')];
    assert.ok(booking >= 0, `${fn} never locks the booking row`);
    assert.ok(card >= 0, `${fn} never locks the card row`);
    assert.ok(shop >= 0, `${fn} never takes the shop lock`);
    assert.ok(booking < card && card < shop, `${fn} locks out of order (booking ${booking}, card ${card}, shop ${shop})`);
  }
  // The couple's ask locks the booking row BEFORE it reads the status it checks.
  const asked = await bodyOf('set_asked_quantity');
  const lockedAt = lockAt(asked, 'booking');
  assert.ok(lockedAt >= 0, 'set_asked_quantity reads the status without locking the booking row');
  assert.ok(lockedAt < asked.search(/v_status\s+IN\s*\(/i), 'set_asked_quantity checks the status before it locks the row');
  // …and the write carries the status predicate too, so a booked row is never rewritten by an ask.
  assert.match(asked, /UPDATE\s+public\.event_vendors\s+SET\s+booked_quantity[\s\S]*?status::text\s+NOT\s+IN\s*\(\s*'contracted'/i);
});

test('13 · a door with no "how many" field keeps the couple\'s earlier number; no number anywhere is pieces_needed, never one', async () => {
  const shop = await mkShop('Door Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 500);
  const row = await ask(couple, shop.vpid, chairs);
  // No number yet, none sent (book-this-build / pending-lock-proposals) → the couple is sent to the picker.
  assert.equal((await askQty(couple, row, null)).status, 'pieces_needed');
  assert.equal((await db.query<{ q: number | null }>(`SELECT booked_quantity AS q FROM public.event_vendors WHERE vendor_id = $1`, [row])).rows[0]!.q, null);
  // The accordion asked 150; a later door sends nothing → 150 stands, and is re-checked against what is free.
  assert.equal((await askQty(couple, row, 150)).status, 'ok');
  const again = await askQty(couple, row, null);
  assert.equal(again.status, 'ok');
  assert.equal((again as { quantity?: number }).quantity, 150);
  const other = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 400 WHERE vendor_id = $1`, [other]);
  const late = await askQty(couple, row, null);
  assert.equal(late.status, 'full', 'a kept number was not re-checked against what is free now');
  assert.equal(late.free, 100);
  assert.equal((await askQty(couple, row, 0)).status, 'bad_quantity');
});

test('14 · a piece card WITH time windows is still counted by its pieces at the yes (review 2026-11-20)', async () => {
  const shop = await mkShop('Slot Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 500);
  await db.query(
    `INSERT INTO public.vendor_service_time_slots (vendor_profile_id, vendor_service_id, slot_label, start_time, end_time, slot_capacity)
     VALUES ($1, $2, 'Morning', '08:00', '12:00', 50)`,
    [shop.vpid, chairs],
  );
  const other = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 450 WHERE vendor_id = $1`, [other]);
  const cx = await mkUser('slot-couple', 'customer');
  const row = await ask(cx, shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 100 WHERE vendor_id = $1`, [row]);
  assert.equal((await agree(shop.uid, row)).status, 'daily_limit_reached', '450 + 100 of 500 was taken on a slotted piece card');
  await db.query(`UPDATE public.event_vendors SET booked_quantity = NULL WHERE vendor_id = $1`, [row]);
  assert.equal((await agree(shop.uid, row)).status, 'pieces_needed', 'a slotted piece yes with no number went through');
  assert.equal((await setQty(shop.uid, row, 50)).status, 'ok');
  assert.equal((await agree(shop.uid, row)).status, 'ok', '450 + 50 of 500 was refused');
  assert.equal(await outOn(chairs), 500);
});

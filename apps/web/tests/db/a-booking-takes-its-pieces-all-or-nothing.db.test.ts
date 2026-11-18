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
  await assert.rejects(
    asUser(couple, () => db.query(`UPDATE public.event_vendors SET booked_quantity = 1 WHERE vendor_id = $1`, [row])),
    /set only by set_booked_quantity|permission denied/i,
  );
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
async function acquire(row: string, pool: string): Promise<{ status: string; counted?: boolean }> {
  const ev = (await db.query<{ e: string }>(`SELECT event_id AS e FROM public.event_vendors WHERE vendor_id = $1`, [row])).rows[0]!.e;
  return (await db.query<{ out: { status: string; counted?: boolean } }>(`SELECT public.acquire_schedule_pools($1, $2, $3::uuid[]) AS out`, [ev, row, [pool]])).rows[0]!.out;
}
async function seats(row: string): Promise<number> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.vendor_schedule_pool_bookings WHERE event_vendor_id = $1 AND released_at IS NULL`, [row])).rows[0]!.n;
}

test('4 · acquire_schedule_pools carries quantity, all or nothing — and an Always available card takes no seat', async () => {
  const shop = await mkShop('Pool Rentals', 'pro');
  const chairs = await pieceCard(shop.vpid, 900);
  const pool = await mkPool(shop.vpid, 500);
  const first = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 320 WHERE vendor_id = $1`, [first]);
  assert.equal((await acquire(first, pool)).status, 'ok');
  const big = await booked(shop.vpid, chairs);
  await db.query(`UPDATE public.event_vendors SET booked_quantity = 200 WHERE vendor_id = $1`, [big]);
  assert.equal((await acquire(big, pool)).status, 'full', '320 + 200 on a 500 pool was taken');
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

test('5 · a schedule that rents pieces may hold more than 500', async () => {
  const shop = await mkShop('Big Rentals', 'pro');
  await mkPool(shop.vpid, 2000);
});

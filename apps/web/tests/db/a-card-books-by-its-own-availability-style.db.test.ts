/**
 * A CARD BOOKS BY ITS OWN AVAILABILITY STYLE — Availability plan step 3 (owner "ok" 2026-11-19, DECISION_LOG
 * "AVAILABILITY STEPS 3 AND 4 APPROVED"; migration a_card_books_by_its_own_availability_style).
 *
 * Proven against the replayed migrations, as a real `authenticated` supplier where it matters:
 *   1. the card's two columns exist, nullable, and their CHECKs refuse anything outside the seven / 0..365;
 *   2. an Always available card is NEVER counted (ruling 4): no daily limit, and a second couple's yes goes through
 *      on a card whose stored number is 1 — while the same card Not set still refuses it (behaves as today);
 *   3. "Order at least N days" is read only for a Made to order card with a rule (`service_card_order_lead_days`),
 *      and only by the server.
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
      [`${label}-${++seq}@card-style.test`, type],
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
       VALUES ($1, 'misc', 'Card Style Studio', 'contracted', $2, $3) RETURNING vendor_id AS v`,
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
       VALUES ($1, 'misc', 'Card Style Studio', 'considering', $2, $3, 'pending', NOW(), $4)
       RETURNING vendor_id AS v`,
      [ev, shop, card, couple],
    )
  ).rows[0]!.v;
}

async function agree(uid: string, rowId: string): Promise<{ status: string; daily_limit?: number }> {
  return asUser(uid, async () => (await db.query<{ r: { status: string; daily_limit?: number } }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [rowId])).rows[0]!.r);
}
async function limitOf(card: string): Promise<number | null> {
  return asService(async () => (await db.query<{ n: number | null }>(`SELECT public.service_card_daily_limit($1) AS n`, [card])).rows[0]!.n);
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

async function leadOf(card: string): Promise<number | null> {
  return asService(async () => (await db.query<{ n: number | null }>(`SELECT public.service_card_order_lead_days($1) AS n`, [card])).rows[0]!.n);
}

test('1 · the card carries its own style and order lead days — nullable, held by their CHECKs', async () => {
  const cols = await db.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'vendor_services' AND column_name IN ('availability_style', 'order_lead_days')
      ORDER BY column_name`,
  );
  assert.deepEqual(cols.rows, [
    { column_name: 'availability_style', is_nullable: 'YES' },
    { column_name: 'order_lead_days', is_nullable: 'YES' },
  ]);
  const shop = await mkShop('Style Checks', 'pro');
  const card = await mkCard(shop.vpid, 2);
  for (const ok of ['day', 'order', 'hour', 'piece', 'time', 'night', 'none']) {
    await db.query(`UPDATE public.vendor_services SET availability_style = $2 WHERE vendor_service_id = $1`, [card, ok]);
  }
  for (const bad of ['', 'weekly', 'DAY']) {
    await assert.rejects(db.query(`UPDATE public.vendor_services SET availability_style = $2 WHERE vendor_service_id = $1`, [card, bad]), /check/i);
  }
  await assert.rejects(db.query(`UPDATE public.vendor_services SET order_lead_days = -1 WHERE vendor_service_id = $1`, [card]), /check/i);
  await assert.rejects(db.query(`UPDATE public.vendor_services SET order_lead_days = 366 WHERE vendor_service_id = $1`, [card]), /check/i);
});

test('2 · Always available is never counted — a one-a-day card set to none takes a second couple; Not set still refuses', async () => {
  const shop = await mkShop('Always Insurance', 'pro');
  const none = await mkCard(shop.vpid, 1);
  await db.query(`UPDATE public.vendor_services SET availability_style = 'none' WHERE vendor_service_id = $1`, [none]);
  assert.equal(await limitOf(none), null, 'an Always available card still has a daily limit');
  await booked(shop.vpid, none);
  const second = await ask(couple, shop.vpid, none);
  const r = await agree(shop.uid, second);
  assert.notEqual(r.status, 'daily_limit_reached', 'an Always available card refused a second couple on a date');

  const asToday = await mkCard(shop.vpid, 1);
  assert.equal(await limitOf(asToday), 1, 'a card Not set lost its own number');
  await booked(shop.vpid, asToday);
  const again = await ask(couple, shop.vpid, asToday);
  assert.equal((await agree(shop.uid, again)).status, 'daily_limit_reached', 'a card Not set stopped behaving as it did before');
});

test('3 · Order at least N days is read only for a Made to order card with a rule, and only by the server', async () => {
  const shop = await mkShop('Cake Shop', 'pro');
  const cake = await mkCard(shop.vpid, 5);
  await db.query(`UPDATE public.vendor_services SET availability_style = 'order', order_lead_days = 14 WHERE vendor_service_id = $1`, [cake]);
  assert.equal(await leadOf(cake), 14);
  await db.query(`UPDATE public.vendor_services SET order_lead_days = 0 WHERE vendor_service_id = $1`, [cake]);
  assert.equal(await leadOf(cake), null, '0 is no rule');
  await db.query(`UPDATE public.vendor_services SET availability_style = 'day', order_lead_days = 14 WHERE vendor_service_id = $1`, [cake]);
  assert.equal(await leadOf(cake), null, 'a card that is not Made to order has no order rule');
  await assert.rejects(
    asUser(shop.uid, () => db.query(`SELECT public.service_card_order_lead_days($1)`, [cake])),
    /permission denied/i,
    'a browser session can call the order-lead reader',
  );
});

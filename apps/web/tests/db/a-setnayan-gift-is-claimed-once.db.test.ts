/**
 * 🎁 A SETNAYAN GIFT TO A SHOP IS CLAIMED ONCE — AND A GIFTED PLAN HANDS THE SHOP ITS OWN PLAN BACK (owner 14 Nov 2026,
 * DECISION_LOG "PRESSING REDEEM IS THE CLAIM — AND IT CAN NEVER COUNT TWICE" · "A GIFTED SUPPLIER PLAN: THE SHOP
 * CHOOSES" · "FINAL — … 28 DAYS" · "A SHOP ALREADY ON SUPPLIER ULTRA … ADDS 28 DAYS").
 *
 * Migration `setnayan_gifts_to_a_shop`. What a unit test cannot see:
 *
 *   1 · GIFT STOCK, PRESSED TWICE — one `shop_badge_rewards` row, one 'badge_reward' stock row (outside the 40% limit);
 *       the second press answers 'already' and writes nothing.
 *   2 · PLAN TIME, NO PLAN — "Start it" puts the shop on the gifted plan for 28 days; a repeat press grants nothing more
 *       (the end day does not move).
 *   3 · UPGRADE NOW, THEN THE END — a Supplier Pro shop (paid, 10 days left) takes Supplier Ultra now; when the gift's
 *       end day has passed, the shipped lapse sweep hands it back Supplier Pro, self-paid, with its 10 days.
 *   5 · SAME PLAN — Ultra → Ultra adds 28 days to the block the shop is on.
 *   6 · START IT WHEN MY PLAN ENDS — held; the sweep starts it INSTEAD of lapsing the shop to Free.
 *   7 · A choice the shop's plan does not allow is refused, and claims nothing.
 *   8 · No signed-in session can call the claim door or write the table.
 *
 * Sabotage, measured 2026-11-14: deleting the hand-back branch at the top of the sweep turns 3 red (the shop lapses to
 * Free · Verified and its Pro days are gone).
 * ⚠ What this file CANNOT show: two presses truly at once. PGlite is one connection, so the repeats here are in
 * sequence and are answered by the claim's first read (`claimed_at IS NOT NULL` → 'already'). The race itself is held
 * by the conditional UPDATE (`… AND claimed_at IS NULL`) under the shop's row lock — and, for stock, by
 * `shop_badge_rewards_once` underneath it.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;
const uniq = () => `sgift-${++seq}-${Date.now()}`;
const DAY = 86_400_000;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

type Plan = { tier: string; expiresIn: number | null; source?: 'admin_comp' | 'self_serve' };

async function newShop(plan: Plan | null = null): Promise<{ userId: string; shop: string }> {
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id AS v`,
    [`${uniq()}@t.local`],
  );
  const shop = await one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1,'Gift Studio','Manila',ARRAY['photography']::text[],'verified',NOW()) RETURNING vendor_profile_id AS v`,
    [userId],
  );
  if (plan) {
    await db.query(
      `UPDATE public.vendor_profiles
          SET tier_state = $2::public.vendor_tier_state,
              tier_expires_at = CASE WHEN $3::bigint IS NULL THEN NULL ELSE now() + ($3::bigint || ' milliseconds')::interval END,
              tier_source = $4
        WHERE vendor_profile_id = $1`,
      [shop, plan.tier, plan.expiresIn, plan.source ?? 'self_serve'],
    );
  }
  return { userId, shop };
}

async function sendPlan(shop: string, tier: 'solo' | 'pro' | 'enterprise'): Promise<string> {
  return one<string>(
    `INSERT INTO public.setnayan_shop_gifts (vendor_profile_id, gift_type, plan_tier)
     VALUES ($1, 'plan', $2::public.vendor_tier_state) RETURNING gift_id AS v`,
    [shop, tier],
  );
}

type Claim = { status: string; choice?: string; allowed?: string[] };
async function claim(gift: string, shop: string, choice: string, actor: string): Promise<Claim> {
  return one<Claim>(`SELECT public.setnayan_shop_gift_claim($1, $2, $3, $4) AS v`, [gift, shop, choice, actor]);
}

type Row = { tier_state: string; tier_expires_at: string | null; tier_source: string };
async function planOf(shop: string): Promise<Row> {
  const r = await db.query<Row>(
    `SELECT tier_state::text AS tier_state, tier_expires_at::text AS tier_expires_at, tier_source
       FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [shop],
  );
  return r.rows[0]!;
}
const msLeft = (iso: string | null) => (iso ? Date.parse(iso) - Date.now() : Number.NaN);

/** Wind a running gift's end day (and the plan it wrote) into the past, as time would. */
async function endTheGift(gift: string, shop: string): Promise<void> {
  await db.query(
    `WITH t AS (SELECT now() - interval '1 minute' AS at)
     UPDATE public.setnayan_shop_gifts SET plan_ends_at = (SELECT at FROM t) WHERE gift_id = $1`,
    [gift],
  );
  await db.query(
    `UPDATE public.vendor_profiles
        SET tier_expires_at = (SELECT plan_ends_at FROM public.setnayan_shop_gifts WHERE gift_id = $2)
      WHERE vendor_profile_id = $1`,
    [shop, gift],
  );
}

test('1 · gift stock pressed twice lands once, as reward stock', async () => {
  const { userId, shop } = await newShop();
  const gift = await one<string>(
    `INSERT INTO public.setnayan_shop_gifts (vendor_profile_id, gift_type, stock_kind, stock_units, stock_credits_each)
     VALUES ($1, 'stock', 'papic', 3, 1000) RETURNING gift_id AS v`,
    [shop],
  );
  const first = await claim(gift, shop, 'stock', userId);
  assert.equal(first.status, 'claimed');
  const again = await claim(gift, shop, 'stock', userId);
  assert.equal(again.status, 'already', 'a second press claims nothing');

  const rewards = await one<number>(
    `SELECT count(*)::int AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1 AND reward_key = $2`,
    [shop, `setnayan_gift:${gift}`],
  );
  assert.equal(rewards, 1);
  const stock = await one<number>(
    `SELECT COALESCE(sum(delta), 0)::int AS v FROM public.shop_gift_stock_entries
      WHERE vendor_profile_id = $1 AND gift_kind = 'papic' AND kind = 'badge_reward'`,
    [shop],
  );
  assert.equal(stock, 3000, '3 × the 1,000-credit pack, once');
});

test('2 · plan time with no plan: Start it, and a repeat press moves nothing', async () => {
  const { userId, shop } = await newShop();
  const gift = await sendPlan(shop, 'pro');
  assert.deepEqual(await one<string[]>(`SELECT public.setnayan_shop_gift_choices($1) AS v`, [gift]), ['start']);
  assert.equal((await claim(gift, shop, 'start', userId)).status, 'claimed');
  const after1 = await planOf(shop);
  assert.equal(after1.tier_state, 'pro');
  assert.equal(after1.tier_source, 'admin_comp');
  assert.ok(Math.abs(msLeft(after1.tier_expires_at) - 28 * DAY) < 60_000, '28 days');

  assert.equal((await claim(gift, shop, 'start', userId)).status, 'already');
  assert.equal((await planOf(shop)).tier_expires_at, after1.tier_expires_at, 'the end day did not move');
});

test('3 · Upgrade now pauses Supplier Pro; when the gift ends the sweep hands Pro back with its days', async () => {
  const { userId, shop } = await newShop({ tier: 'pro', expiresIn: 10 * DAY });
  const gift = await sendPlan(shop, 'enterprise');
  assert.deepEqual(await one<string[]>(`SELECT public.setnayan_shop_gift_choices($1) AS v`, [gift]), ['now', 'after']);
  assert.equal((await claim(gift, shop, 'now', userId)).status, 'claimed');
  assert.equal((await planOf(shop)).tier_state, 'enterprise');

  await endTheGift(gift, shop);
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [shop]);
  const back = await planOf(shop);
  assert.equal(back.tier_state, 'pro', 'its own plan, not Free');
  assert.equal(back.tier_source, 'self_serve', 'still the plan it paid for');
  assert.ok(Math.abs(msLeft(back.tier_expires_at) - 10 * DAY) < 120_000, 'with the 10 days it had left');
  assert.equal(
    await one<string>(`SELECT finish_reason AS v FROM public.setnayan_shop_gifts WHERE gift_id = $1`, [gift]),
    'ended',
  );
});

test('5 · Ultra → Ultra adds 28 days to the block the shop is on', async () => {
  const { userId, shop } = await newShop({ tier: 'enterprise', expiresIn: 5 * DAY });
  const gift = await sendPlan(shop, 'enterprise');
  assert.deepEqual(await one<string[]>(`SELECT public.setnayan_shop_gift_choices($1) AS v`, [gift]), ['extend']);
  assert.equal((await claim(gift, shop, 'extend', userId)).status, 'claimed');
  const p = await planOf(shop);
  assert.equal(p.tier_state, 'enterprise');
  assert.equal(p.tier_source, 'self_serve', 'still its own plan — only longer');
  assert.ok(Math.abs(msLeft(p.tier_expires_at) - 33 * DAY) < 120_000);
  assert.equal((await claim(gift, shop, 'extend', userId)).status, 'already');
  assert.equal((await planOf(shop)).tier_expires_at, p.tier_expires_at, 'a repeat press adds nothing');
});

test('6 · Start it when my plan ends: held, then started by the sweep instead of the lapse', async () => {
  const { userId, shop } = await newShop({ tier: 'solo', expiresIn: 3 * DAY });
  const gift = await sendPlan(shop, 'enterprise');
  assert.equal((await claim(gift, shop, 'after', userId)).status, 'claimed');
  assert.equal((await planOf(shop)).tier_state, 'solo', 'nothing changes while its own plan runs');

  await db.query(
    `UPDATE public.vendor_profiles SET tier_expires_at = now() - interval '1 minute' WHERE vendor_profile_id = $1`,
    [shop],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [shop]);
  const p = await planOf(shop);
  assert.equal(p.tier_state, 'enterprise', 'the gift started instead of a lapse to Free');
  assert.ok(Math.abs(msLeft(p.tier_expires_at) - 28 * DAY) < 120_000);

  // …and when it ends, the shop goes where its own plan would have: Free · Verified.
  await endTheGift(gift, shop);
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [shop]);
  assert.equal((await planOf(shop)).tier_state, 'verified');
});

test('7 · a choice the plan does not allow is refused and claims nothing', async () => {
  const { userId, shop } = await newShop();
  const gift = await sendPlan(shop, 'pro');
  const before = await planOf(shop);
  const res = await claim(gift, shop, 'now', userId);
  assert.equal(res.status, 'bad_choice');
  assert.equal(
    await one<string | null>(`SELECT claimed_at::text AS v FROM public.setnayan_shop_gifts WHERE gift_id = $1`, [gift]),
    null,
  );
  assert.deepEqual(await planOf(shop), before, 'the plan is untouched');
});

test('8 · no signed-in session can call the claim door or write the table', async () => {
  const { userId, shop } = await newShop();
  const gift = await sendPlan(shop, 'pro');
  await db.query(`SET ROLE authenticated`);
  try {
    await assert.rejects(db.query(`SELECT public.setnayan_shop_gift_claim($1, $2, 'start', $3)`, [gift, shop, userId]));
  } finally {
    await db.query(`RESET ROLE`);
  }
  await db.query(`SET ROLE authenticated`);
  try {
    await assert.rejects(
      db.query(`INSERT INTO public.setnayan_shop_gifts (vendor_profile_id, gift_type, plan_tier) VALUES ($1,'plan','pro')`, [shop]),
    );
  } finally {
    await db.query(`RESET ROLE`);
  }
});

test('9 · a held gift takes over when the shop’s own plan ends — and the credit still goes with that plan', async () => {
  // Owner 2026-08-28: "the credit goes with the plan". A held ("Start it when my plan ends") gift starting is not a
  // reason to keep the balance, and when the gift ends there is no old balance to come back to.
  const { userId, shop } = await newShop({ tier: 'pro', expiresIn: 3 * DAY });
  await db.query(`UPDATE public.vendor_profiles SET subscription_credit_php = 4200 WHERE vendor_profile_id = $1`, [shop]);
  const gift = await sendPlan(shop, 'enterprise');
  assert.equal((await claim(gift, shop, 'after', userId)).status, 'claimed');

  await db.query(
    `UPDATE public.vendor_profiles SET tier_expires_at = now() - interval '1 minute' WHERE vendor_profile_id = $1`,
    [shop],
  );
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [shop]);
  assert.equal((await planOf(shop)).tier_state, 'enterprise', 'the held gift started');
  assert.equal(
    Number(await one<string>(`SELECT subscription_credit_php::text AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop])),
    0,
    'the credit survived the end of the shop’s own plan because a gift took over',
  );
  const led = await db.query<{ delta_php: string; reason: string }>(
    `SELECT delta_php::text AS delta_php, reason FROM public.vendor_credit_ledger
      WHERE vendor_profile_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [shop],
  );
  assert.equal(Number(led.rows[0]?.delta_php), -4200, 'the money went with no ledger row behind it');
  assert.equal(led.rows[0]?.reason, 'lapse');

  // …and when the gift ends there is nothing to hand back: Free · Verified, still no credit.
  await endTheGift(gift, shop);
  await db.query(`SELECT public.sweep_vendor_tier_expiry($1)`, [shop]);
  assert.equal((await planOf(shop)).tier_state, 'verified');
  assert.equal(
    Number(await one<string>(`SELECT subscription_credit_php::text AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop])),
    0,
  );
});

test('10 · Event Ultra is a stock kind the gift row accepts', async () => {
  const { shop } = await newShop();
  const gift = await one<string>(
    `INSERT INTO public.setnayan_shop_gifts (vendor_profile_id, gift_type, stock_kind, stock_units)
     VALUES ($1, 'stock', 'event_ultra', 1) RETURNING gift_id AS v`,
    [shop],
  );
  assert.ok(gift);
});

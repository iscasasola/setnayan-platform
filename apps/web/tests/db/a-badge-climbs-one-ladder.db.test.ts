/**
 * 🏅 A BADGE CLIMBS ONE LADDER — the database half of the owner's 15 Nov rulings (DECISION_LOG "SUPPLIER BADGES,
 * SEALS AND REWARDS"), what a unit test cannot see:
 *
 *   1 · A BIGGER PACK LANDS AS ITS OWN CREDITS. Gold pays Papic 1000: the ONE grant door takes the pack's credits read
 *       from the catalogue (`p_credits_each`), so the gift stock grows by exactly that — and a second grant of the same
 *       step answers 'already' and adds nothing (the 8 Nov key, unchanged).
 *   2 · TAP TO CLAIM COUNTS ONCE. The shop's own press is the claim (`gift_moment_claim`, 'badge_reward'); a second
 *       press answers 'already' with the SAME claimed_at, one claim row exists, and the stock is untouched by either
 *       press — a claim is an acknowledgement, never money. Another shop's press is refused.
 *   3 · 🛑 EVENT ULTRA HAS NO DOOR. The grant door refuses 'event_ultra' and writes nothing — the reason the app
 *       leaves Black Diamond's reward owed (`GRANTABLE_KINDS`) instead of inventing one.
 *   4 · THE FIVE-STAR COUNT USES THE PUBLIC STARS' RULE. `shop_trusted_five_star_count` counts a booked 5★, not a 4★,
 *       not one never booked through Setnayan, not one voided for fraud, not the shop owner reviewing their own event —
 *       and no signed-in session may call it (service_role only).
 *
 * Sabotage (2026-11-15, measured): `rating_overall = 5` → `>= 4` plus dropping the owner-as-couple arm turns 4 red
 * (2 !== 1). The `p_units * p_credits_each` arm is covered by 1 (1,000 credits, not 150).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ v: T }>(sql, params);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newUser(email: string, accountType: 'customer' | 'vendor'): Promise<string> {
  return one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id AS v`,
    [email, accountType],
  );
}

async function shopOf(userId: string, name: string): Promise<string> {
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, name],
  );
}

async function grant(shop: string, key: string, kind: string, creditsEach: number | null): Promise<{ status: string }> {
  return one<{ status: string }>(
    `SELECT public.shop_badge_reward_grant($1, $2, $3, $4, 1, $5, 'test') AS v`,
    [shop, key, key.split(':')[0], kind, creditsEach],
  );
}

async function stock(shop: string, kind = 'papic'): Promise<number> {
  return Number(
    await one<string>(
      `SELECT COALESCE(SUM(delta), 0)::text AS v FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1 AND gift_kind = $2`,
      [shop, kind],
    ),
  );
}

async function asUser<T>(uid: string, sql: string, params: unknown[] = []): Promise<T> {
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, uid);
    return await one<T>(sql, params);
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

/** A couple's event with `couple` as its host, and one review of `shop` from them. */
async function review(shop: string, couple: string, rating: number, opts: { booked?: boolean; fraud?: boolean } = {}): Promise<string> {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`,
    [`five star ${n}`],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  // "Booked through Setnayan" is never written by hand — `stamp_review_provenance` derives it from a marketplace
  // booking on the event, so a booked review needs the booking row (as a-review-keeps-its-receipt does).
  if (opts.booked ?? true) {
    await db.query(
      `INSERT INTO public.event_vendors
         (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id)
       VALUES ($1, 'photographer', 'Hiraya Studio', 'delivered', $2, $2)`,
      [eventId, shop],
    );
  }
  const reviewId = await one<string>(
    `INSERT INTO public.vendor_reviews
       (vendor_profile_id, event_id, couple_user_id, rating_overall,
        rating_communication, rating_quality, rating_value, rating_on_time, body)
     VALUES ($1, $2, $3, $4, 5, 5, 5, 5, 'A lovely day.')
     RETURNING review_id AS v`,
    [shop, eventId, couple, rating],
  );
  if (opts.fraud) await db.query(`UPDATE public.vendor_reviews SET voided_by_fraud = TRUE WHERE review_id = $1`, [reviewId]);
  return eventId;
}

let shopUser: string;
let otherShopUser: string;
let shop: string;
let otherShop: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  shopUser = await newUser('ladder-shop@test.test', 'vendor');
  otherShopUser = await newUser('ladder-other@test.test', 'vendor');
  shop = await shopOf(shopUser, 'Hiraya Studio');
  otherShop = await shopOf(otherShopUser, 'Dagat Florals');
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the five-star count', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · Gold pays Papic 1000 as 1,000 credits of stock — once', async () => {
  const before = await stock(shop);
  assert.equal((await grant(shop, 'events:100', 'papic', 1000)).status, 'granted');
  assert.equal(await stock(shop), before + 1000);
  assert.equal((await grant(shop, 'events:100', 'papic', 1000)).status, 'already');
  assert.equal(await stock(shop), before + 1000, 'a repeat grant added stock');
  const row = await one<{ stock_delta: number; units: number }>(
    `SELECT jsonb_build_object('stock_delta', stock_delta, 'units', units) AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1 AND reward_key = 'events:100'`,
    [shop],
  );
  assert.deepEqual(row, { stock_delta: 1000, units: 1 }, 'the app reads which pack it was from stock_delta ÷ units');
});

test('2 · 🚨 tap to claim counts once, moves nothing, and only the shop itself may press', async () => {
  assert.equal((await grant(shop, 'reviews:25', 'papic', 1000)).status, 'granted');
  const ref = await one<string>(`SELECT reward_id::text AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1 AND reward_key = 'reviews:25'`, [shop]);
  const before = await stock(shop);

  const first = await asUser<{ status: string; claimed_at: string }>(shopUser, `SELECT public.gift_moment_claim('badge_reward', $1) AS v`, [ref]);
  const second = await asUser<{ status: string; claimed_at: string }>(shopUser, `SELECT public.gift_moment_claim('badge_reward', $1) AS v`, [ref]);
  assert.equal(first.status, 'claimed');
  assert.equal(second.status, 'already');
  assert.equal(second.claimed_at, first.claimed_at, 'the second press answers the SAME claim');
  assert.equal(
    Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.gift_moment_claims WHERE ref_id = $1`, [ref])),
    1,
  );
  assert.equal(await stock(shop), before, 'a claim moved stock');

  const other = await asUser<{ status: string }>(otherShopUser, `SELECT public.gift_moment_claim('badge_reward', $1) AS v`, [ref]);
  assert.equal(other.status, 'refused');
  void otherShop;
});

test('3 · 🛑 the grant door has no Event Ultra — refused, nothing written', async () => {
  const before = await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1`, [shop]);
  assert.equal((await grant(shop, 'events:10000', 'event_ultra', null)).status, 'bad_input');
  assert.equal(await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1`, [shop]), before);
});

test('4 · the five-star count follows the public stars: booked 5★ only, never a self-review; service_role only', async () => {
  const count = () => one<number>(`SELECT public.shop_trusted_five_star_count($1) AS v`, [shop]);
  // A marketplace booking needs a bookable (verified) shop — the same seed a-review-keeps-its-receipt uses.
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW() WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.equal(await count(), 0);
  const c1 = await newUser('ladder-couple-1@test.test', 'customer');
  const c2 = await newUser('ladder-couple-2@test.test', 'customer');
  const c3 = await newUser('ladder-couple-3@test.test', 'customer');
  const c4 = await newUser('ladder-couple-4@test.test', 'customer');
  await review(shop, c1, 5);
  assert.equal(await count(), 1);
  await review(shop, c2, 4);
  await review(shop, c3, 5, { booked: false });
  await review(shop, c4, 5, { fraud: true });
  assert.equal(await count(), 1, 'a 4★, an unbooked 5★ or a fraud-voided 5★ counted');
  // The insert-time guard already refuses the owner reviewing their own shop (SELF_REVIEW_BLOCKED) …
  const c5 = await newUser('ladder-couple-5@test.test', 'customer');
  await assert.rejects(review(shop, shopUser, 5), /SELF_REVIEW_BLOCKED/);
  // … so the count's own self-review arm is measured the way it can still happen: the owner joins the couple's
  // event as a co-host AFTER the 5★ landed. The public stars drop that review, and so must the badge count.
  const joined = await review(shop, c5, 5);
  assert.equal(await count(), 2, 'a second booked 5★ did not count');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [joined, shopUser]);
  assert.equal(await count(), 1, "the shop owner's own event's 5★ counted");

  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, shopUser);
    await assert.rejects(db.query(`SELECT public.shop_trusted_five_star_count($1)`, [shop]), /permission denied/);
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});

/**
 * A GIFT IS CLAIMED ONCE — pressing Redeem on the gift moment IS the claim, and it can never count twice
 * (owner 2026-11-14, DECISION_LOG "PRESSING REDEEM IS THE CLAIM — AND IT CAN NEVER COUNT TWICE").
 *
 * Migration `gift_moment_claims`. What a unit test cannot see:
 *
 *   1 · ONCE — the first press answers 'claimed'; a second press, a retry after a lost connection, the other host's
 *       press all answer 'already' with the SAME claimed_at, and exactly ONE claim row exists. Nothing is granted by a
 *       claim: the event's Papic pool holds exactly what the gift gave before and after every press.
 *   2 · THE KEY HOLDS EVEN IF THE DOOR IS BYPASSED — a second row for the same gift is refused by
 *       `gift_moment_claims_once`.
 *   3 · ONLY THE GIFT'S OWN — a guest of the event, a stranger and another shop are refused and write nothing;
 *       `gift_moments_for_event` / `gift_moments_for_shop` give them no rows (each host, guests never).
 *   4 · A BADGE REWARD is claimed once by its shop the same way; a revoked reward is refused.
 *   5 · NO SESSION WRITES A CLAIM ROW directly.
 *
 * Sabotage (2026-11-14): `ON CONFLICT (source, ref_id) DO NOTHING` → a plain INSERT turns 1 red (the repeat throws
 * instead of answering 'already'); dropping `gift_moment_claims_once` turns 1 and 2 red (two rows); dropping
 * `AND e.event_id IN (SELECT public.current_couple_event_ids())` turns 3 red (the guest claims).
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
  if (existing.rows[0]) {
    await db.query(`UPDATE public.vendor_profiles SET business_name = $2 WHERE vendor_profile_id = $1`, [
      existing.rows[0].vendor_profile_id,
      name,
    ]);
    return existing.rows[0].vendor_profile_id;
  }
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, name],
  );
}

/** A couple's event hosted by `hosts`, a guest member, a booking of `shop`, an accepted quote with a Papic 1000 gift — paid and delivered. */
async function deliveredGift(
  shop: string,
  hosts: string[],
  guest: string,
): Promise<{ eventId: string; proposalId: string }> {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`,
    [`gift moment ${n}`],
  );
  for (const h of hosts) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, h]);
  }
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [eventId, guest]);
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'papic', 5000, 'bought')`,
    [shop],
  );
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1, 'band_dj', 'Gift Shop', 'considering', $2, 50000) RETURNING vendor_id AS v`,
    [eventId, shop],
  );
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos, valid_until)
     VALUES ($1, $2, 'Quote', 'accepted', NOW(), 5000000, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id AS v`,
    [shop, eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
     VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 1000, 499, 'Papic 1000')`,
    [proposalId, shop],
  );
  await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [eventVendorId]);
  const door = await one<{ status: string }>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [eventVendorId]);
  assert.equal(door.status, 'ok', 'the gift did not reach the event (setup)');
  return { eventId, proposalId };
}

type Claim = { status: string; claimed_at?: string };

/** Press Redeem as `uid`, the way the app does: the authenticated role, the caller's own id. */
async function press(uid: string, source: string, ref: string): Promise<Claim> {
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, uid);
    return await one<Claim>(`SELECT public.gift_moment_claim($1, $2) AS v`, [source, ref]);
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

async function asUser<T>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, uid);
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
}

async function claimRows(ref: string): Promise<number> {
  return Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.gift_moment_claims WHERE ref_id = $1`, [ref]));
}

async function poolPoints(eventId: string): Promise<number> {
  return Number(
    await one<string>(
      `SELECT COALESCE(SUM(points), 0)::text AS v FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'shop_gift'`,
      [eventId],
    ),
  );
}

let hostA: string;
let hostB: string;
let guest: string;
let stranger: string;
let shopUser: string;
let otherShopUser: string;
let shop: string;
let otherShop: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  hostA = await newUser('gift-host-a@test.test', 'customer');
  hostB = await newUser('gift-host-b@test.test', 'customer');
  guest = await newUser('gift-guest@test.test', 'customer');
  stranger = await newUser('gift-stranger@test.test', 'customer');
  shopUser = await newUser('gift-shop@test.test', 'vendor');
  otherShopUser = await newUser('gift-other-shop@test.test', 'vendor');
  shop = await shopOf(shopUser, 'Liwanag Lights & Bar');
  otherShop = await shopOf(otherShopUser, 'Bulaklak Florals');
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. gift moment claims', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · 🚨 a repeated claim grants once — double tap, retry, the other host', async () => {
  const g = await deliveredGift(shop, [hostA, hostB], guest);
  const before = await poolPoints(g.eventId);
  assert.equal(before, 1000);

  const first = await press(hostA, 'shop_gift', g.proposalId);
  assert.equal(first.status, 'claimed');
  assert.ok(first.claimed_at, 'a claim with no time');

  // The same press again (a double tap, or Try again after "No connection") and the other host's press.
  const retry = await press(hostA, 'shop_gift', g.proposalId);
  const other = await press(hostB, 'shop_gift', g.proposalId);
  for (const r of [retry, other]) {
    assert.equal(r.status, 'already', 'a repeated claim was treated as a new one');
    assert.equal(new Date(r.claimed_at!).getTime(), new Date(first.claimed_at!).getTime(), 'a repeat moved the claim');
  }
  assert.equal(await claimRows(g.proposalId), 1, 'a repeated claim wrote a second row');
  assert.equal(await poolPoints(g.eventId), before, 'a claim moved the Papic pool — the gift landed already');

  // Both hosts read it back as claimed.
  for (const h of [hostA, hostB]) {
    const rows = await asUser<{ ref_id: string; claimed_at: string | null; giver_name: string; lines: unknown }>(
      h,
      `SELECT ref_id, claimed_at, giver_name, lines FROM public.gift_moments_for_event($1)`,
      [g.eventId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.ref_id, g.proposalId);
    assert.ok(rows[0]!.claimed_at, 'a claimed gift still reads as waiting');
    assert.equal(rows[0]!.giver_name, 'Liwanag Lights & Bar');
    assert.deepEqual(rows[0]!.lines, [{ title: 'Papic 1000', kind: 'papic', credits: 1000 }]);
  }
});

test('2 · the key holds even when the door is bypassed', async () => {
  const g = await deliveredGift(shop, [hostA], guest);
  assert.equal((await press(hostA, 'shop_gift', g.proposalId)).status, 'claimed');
  await assert.rejects(
    db.query(
      `INSERT INTO public.gift_moment_claims (source, ref_id, event_id) VALUES ('shop_gift', $1, $2)`,
      [g.proposalId, g.eventId],
    ),
    /gift_moment_claims_once|duplicate key/,
  );
  assert.equal(await claimRows(g.proposalId), 1);
});

test('3 · only a host claims or reads it — a guest, a stranger and another shop are refused and write nothing', async () => {
  const g = await deliveredGift(shop, [hostA], guest);
  for (const who of [guest, stranger, otherShopUser, shopUser]) {
    assert.equal((await press(who, 'shop_gift', g.proposalId)).status, 'refused');
    const rows = await asUser(who, `SELECT ref_id FROM public.gift_moments_for_event($1)`, [g.eventId]);
    assert.equal(rows.length, 0, 'a non-host was shown the gift moment');
  }
  assert.equal(await claimRows(g.proposalId), 0, 'a refused claim wrote a row');
  // A waiting gift reads as waiting to its host.
  const rows = await asUser<{ claimed_at: string | null }>(hostA, `SELECT claimed_at FROM public.gift_moments_for_event($1)`, [g.eventId]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.claimed_at, null);
  // A made-up gift is refused.
  assert.equal((await press(hostA, 'shop_gift', '00000000-0000-4000-8000-000000000001')).status, 'refused');
  assert.equal((await press(hostA, 'nonsense', g.proposalId)).status, 'refused');
});

test('4 · a badge reward is claimed once by its own shop; a revoked one is refused', async () => {
  const grant = await one<{ status: string; reward_id: string }>(
    `SELECT public.shop_badge_reward_grant($1, 'events:50', 'events', 'event_plus', 1, 1) AS v`,
    [shop],
  );
  const rewardId =
    grant.reward_id ??
    (await one<string>(`SELECT reward_id AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1 AND reward_key = 'events:50'`, [shop]));

  assert.equal((await press(otherShopUser, 'badge_reward', rewardId)).status, 'refused');
  assert.equal((await asUser(otherShopUser, `SELECT ref_id FROM public.gift_moments_for_shop($1)`, [shop])).length, 0);

  const waiting = await asUser<{ ref_id: string; reward_key: string; claimed_at: string | null }>(
    shopUser,
    `SELECT ref_id, reward_key, claimed_at FROM public.gift_moments_for_shop($1)`,
    [shop],
  );
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0]!.reward_key, 'events:50');
  assert.equal(waiting[0]!.claimed_at, null);

  assert.equal((await press(shopUser, 'badge_reward', rewardId)).status, 'claimed');
  assert.equal((await press(shopUser, 'badge_reward', rewardId)).status, 'already');
  assert.equal(await claimRows(rewardId), 1);

  // Revoked: refused, and gone from the shop's list.
  const grant2 = await one<{ reward_id?: string }>(
    `SELECT public.shop_badge_reward_grant($1, 'reviews:5', 'reviews', 'papic', 1, 150) AS v`,
    [shop],
  );
  const r2 =
    grant2.reward_id ??
    (await one<string>(`SELECT reward_id AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1 AND reward_key = 'reviews:5'`, [shop]));
  await db.query(`UPDATE public.shop_badge_rewards SET revoked_at = NOW() WHERE reward_id = $1`, [r2]);
  assert.equal((await press(shopUser, 'badge_reward', r2)).status, 'refused');
  const after = await asUser<{ ref_id: string }>(shopUser, `SELECT ref_id FROM public.gift_moments_for_shop($1)`, [shop]);
  assert.ok(!after.some((r) => r.ref_id === r2), 'a revoked reward still waits as a gift');
});

test('5 · no session writes a claim row directly', async () => {
  const g = await deliveredGift(shop, [hostA], guest);
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, hostA);
    await assert.rejects(
      db.query(`INSERT INTO public.gift_moment_claims (source, ref_id, event_id) VALUES ('shop_gift', $1, $2)`, [
        g.proposalId,
        g.eventId,
      ]),
      /permission denied|row-level security/,
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
  assert.equal(await claimRows(g.proposalId), 0);
});

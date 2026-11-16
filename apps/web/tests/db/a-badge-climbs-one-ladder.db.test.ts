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
 *   3 · 💎 BLACK DIAMOND GIVES THE REAL EVENT ULTRA (owner 15 Nov, migration 20271348181787). The t7 grant mints one
 *       'event_ultra' unlock once; the shop's claim counts once; on a quote it is given at the couple's first payment —
 *       upgrading an event that holds Pro — as EVENT_ULTRA, with the catalogue row's included Papic credits; and the
 *       event then holds exactly what an Ultra order confers (`EVENT_ULTRA_GRANTS`), never the staff-made extras.
 *   4 · THE FIVE-STAR COUNT USES THE PUBLIC STARS' RULE. `shop_trusted_five_star_count` counts a booked 5★, not a 4★,
 *       not one never booked through Setnayan, not one voided for fraud, not the shop owner reviewing their own event —
 *       and no signed-in session may call it (service_role only).
 *
 * Sabotage (2026-11-15, measured): `rating_overall = 5` → `>= 4` plus dropping the owner-as-couple arm turns 4 red
 * (2 !== 1). The `p_units * p_credits_each` arm is covered by 1 (1,000 credits, not 150).
 * Sabotage of 20271348181787 (measured, each alone turns 3 red): an Ultra line delivered as COUPLE_WEBSITE_PRO; the
 * gifted-Ultra arm dropped from event_has_comp_for_sku (false !== true); the top-up read from Pro's row (2000 !== 3500).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { EVENT_ULTRA_GRANTS, EVENT_ULTRA_NEVER_GRANTS, EVENT_ULTRA_SKU } from '../../lib/event-ultra';

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
        rating_communication, rating_quality, rating_value, rating_on_time, body, created_at)
     VALUES ($1, $2, $3, $4, 5, 5, 5, 5, 'A lovely day.', '2026-12-20T12:00:00+08:00')
     RETURNING review_id AS v`,
    // Dated after the badge counters start (badge_counts_start(), 18 Dec 2026) — before it, nothing counts.
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

test('3 · 💎 Black Diamond mints the REAL Event Ultra: claimed once, given once, the event holds Ultra', async () => {
  const ultraUser = await newUser('ladder-ultra@test.test', 'vendor');
  const ultraShop = await shopOf(ultraUser, 'Tala Lights');
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`,
    [ultraShop],
  );

  // The t7 grant lands one Event Ultra unlock in the gift stock — once.
  assert.equal((await grant(ultraShop, 'events:10000', 'event_ultra', null)).status, 'granted');
  assert.equal((await grant(ultraShop, 'events:10000', 'event_ultra', null)).status, 'already');
  assert.equal(await stock(ultraShop, 'event_ultra'), 1, 'a repeat t7 grant added a second Ultra');
  const status = await one<{ balance: number; held: number }>(
    `SELECT jsonb_build_object('balance', balance, 'held', held) AS v FROM public.shop_gift_stock_status($1, NULL) WHERE gift_kind = 'event_ultra'`,
    [ultraShop],
  );
  assert.deepEqual(status, { balance: 1, held: 0 });
  const earned = await one<{ earned: number; used: number }>(
    `SELECT jsonb_build_object('earned', earned, 'used', used) AS v FROM public.shop_gift_reward_stock_status($1, NULL) WHERE gift_kind = 'event_ultra'`,
    [ultraShop],
  );
  assert.deepEqual(earned, { earned: 1, used: 0 });

  // Tap to claim: once.
  const ref = await one<string>(
    `SELECT reward_id::text AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1 AND reward_key = 'events:10000'`,
    [ultraShop],
  );
  assert.equal((await asUser<{ status: string }>(ultraUser, `SELECT public.gift_moment_claim('badge_reward', $1) AS v`, [ref])).status, 'claimed');
  assert.equal((await asUser<{ status: string }>(ultraUser, `SELECT public.gift_moment_claim('badge_reward', $1) AS v`, [ref])).status, 'already');

  // Given on a quote: an event that already holds Event Pro is UPGRADED to Ultra at the first payment.
  const couple = await newUser('ladder-ultra-couple@test.test', 'customer');
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Ultra day', 'birthday') RETURNING event_id AS v`,
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1, 'band_dj', 'Tala Lights', 'considering', $2, 50000) RETURNING vendor_id AS v`,
    [eventId, ultraShop],
  );
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos, valid_until)
     VALUES ($1, $2, 'Quote', 'accepted', NOW(), 5000000, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id AS v`,
    [ultraShop, eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts
       (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title, from_badge_reward)
     VALUES ($1, $2, 'EVENT_ULTRA', 'event_ultra', 1, 9990, 'Event Ultra', TRUE)`,
    [proposalId, ultraShop],
  );
  type UnlockDoor = { status: string; given?: Array<{ gift_kind: string; unlocks_sku: string }>; already_has?: number };
  const door = (has: string) =>
    one<UnlockDoor>(`SELECT public.shop_gift_deliver_unlocks_for_booking($1, $2) AS v`, [eventVendorId, has]);
  assert.equal((await door('pro')).status, 'not_paid');
  await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [eventVendorId]);

  const given = await door('pro');
  assert.equal(given.status, 'ok');
  assert.deepEqual((given.given ?? []).map((g) => [g.gift_kind, g.unlocks_sku]), [['event_ultra', 'EVENT_ULTRA']]);
  assert.equal(await stock(ultraShop, 'event_ultra'), 0, 'the Ultra did not leave the stock');
  // A repeat (now holding Ultra) gives nothing.
  assert.equal((await door('ultra')).status, 'nothing_to_give');
  assert.equal(await stock(ultraShop, 'event_ultra'), 0);

  // What buying Ultra does: AI on, the included credits topped up to the EVENT_ULTRA row's number — read, never typed.
  const included = Number(
    await one<string>(`SELECT included_papic_credits::text AS v FROM public.platform_retail_catalog_v2 WHERE service_code = 'EVENT_ULTRA'`),
  );
  assert.ok(included > 0, 'the catalogue has no Ultra credits to compare against');
  assert.equal(
    Number(await one<string>(
      `SELECT COALESCE(SUM(points), 0)::text AS v FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'plan_included'`,
      [eventId],
    )),
    included,
  );
  assert.equal(await one<boolean>(`SELECT setnayan_ai_active AS v FROM public.events WHERE event_id = $1`, [eventId]), true);

  // The event holds what an Ultra ORDER confers — the app's own list, so the two can never drift.
  const skus = await one<string[]>(`SELECT public.event_comp_active_skus($1) AS v`, [eventId]);
  assert.deepEqual([...skus].sort(), [EVENT_ULTRA_SKU, ...EVENT_ULTRA_GRANTS].sort());
  for (const sku of [EVENT_ULTRA_SKU, ...EVENT_ULTRA_GRANTS]) {
    assert.equal(await one<boolean>(`SELECT public.event_has_comp_for_sku($1, $2) AS v`, [eventId, sku]), true, sku);
  }
  for (const sku of EVENT_ULTRA_NEVER_GRANTS) {
    assert.equal(await one<boolean>(`SELECT public.event_has_comp_for_sku($1, $2) AS v`, [eventId, sku]), false, sku);
  }
});

test('4 · the five-star count follows the public stars: booked 5★ only, never a self-review; service_role only', async () => {
  const count = () => one<number>(`SELECT public.shop_trusted_five_star_count($1) AS v`, [shop]);
  // A marketplace booking needs a bookable shop — verified AND listed (a hidden shop takes no booking since
  // 20271346561709) — the same seed a-review-keeps-its-receipt uses.
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`,
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

test('5 · 💎 a GIFTED Ultra is FULL Ultra: 12-month originals and canvas; a gifted Pro gets neither, an admin comp keeps 3 months', async () => {
  const DAY = 86_400_000;
  const GRACE = 92; // FULL_RES_POST_EVENT_GRACE_DAYS (lib/papic-fullres-drop-core.ts), as event-ultra-keeps-originals does
  const giftUser = await newUser('ladder-full-ultra@test.test', 'vendor');
  const giftShop = await shopOf(giftUser, 'Sinag Films');
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`,
    [giftShop],
  );
  // One earned Ultra (the t7 door) and one Pro unit in stock.
  assert.equal((await grant(giftShop, 'events:10000', 'event_ultra', null)).status, 'granted');
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'event_pro', 1, 'bought')`,
    [giftShop],
  );

  /** An event whose last day was `daysAgo`, a Papic capture from long ago, and this shop's paid booking giving `code`. */
  async function giftedEvent(code: 'EVENT_ULTRA' | 'COUPLE_WEBSITE_PRO', daysAgo: number) {
    n += 1;
    const eventId = await one<string>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', $2::date) RETURNING event_id AS v`,
      [`gifted ${code} ${n}`, new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10)],
    );
    const guestId = await one<string>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, 'Gift', 'Clock', 'both', 'friends') RETURNING guest_id AS v`,
      [eventId],
    );
    await db.query(
      `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, display_r2_key, media_type, captured_at)
       VALUES ($1, $2, $3, $3, 'photo', $4)`,
      [eventId, guestId, `r2://setnayan-media/papic/${eventId}.jpg`, new Date(Date.now() - 900 * DAY).toISOString()],
    );
    const eventVendorId = await one<string>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
       VALUES ($1, 'band_dj', 'Sinag Films', 'considering', $2, 50000) RETURNING vendor_id AS v`,
      [eventId, giftShop],
    );
    const proposalId = await one<string>(
      `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos, valid_until)
       VALUES ($1, $2, 'Quote', 'accepted', NOW(), 5000000, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id AS v`,
      [giftShop, eventId],
    );
    await db.query(
      `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
       VALUES ($1, $2, $3, $4, 1, 1, $5)`,
      [proposalId, giftShop, code, code === 'EVENT_ULTRA' ? 'event_ultra' : 'event_pro', code === 'EVENT_ULTRA' ? 'Event Ultra' : 'Event Pro'],
    );
    return { eventId, eventVendorId };
  }
  const deliverGift = async (eventVendorId: string) => {
    await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [eventVendorId]);
    const r = await one<{ status: string }>(`SELECT public.shop_gift_deliver_unlocks_for_booking($1, 'none') AS v`, [eventVendorId]);
    assert.equal(r.status, 'ok');
  };
  const released = async () =>
    new Set(
      (await db.query<{ event_id: string }>(`SELECT event_id FROM public.papic_events_past_fullres_clock(0, $1::int)`, [GRACE])).rows.map(
        (r) => r.event_id,
      ),
    );
  /** What lib/event-ultra-gates.ts eventCanvasPrintsActive asks first: eventSkuActive(EVENT_ULTRA) → this comp read. */
  const holdsUltra = (eventId: string) =>
    one<boolean>(`SELECT public.event_has_comp_for_sku($1, 'EVENT_ULTRA') AS v`, [eventId]);

  const ultra = await giftedEvent('EVENT_ULTRA', 100);
  const pro = await giftedEvent('COUPLE_WEBSITE_PRO', 100);
  // Before the first payment nothing is gifted yet: the plain 92-day floor applies and no canvas.
  assert.ok((await released()).has(ultra.eventId), 'an undelivered Ultra gift already held the originals');
  assert.equal(await holdsUltra(ultra.eventId), false, 'canvas opened before the gift was delivered');

  await deliverGift(ultra.eventVendorId);
  await deliverGift(pro.eventVendorId);
  const after = await released();
  assert.ok(!after.has(ultra.eventId), 'a GIFTED Ultra event was released at three months — the gift does not hold originals');
  assert.ok(after.has(pro.eventId), 'a gifted Pro held originals past three months — only Ultra holds longer');
  assert.equal(await holdsUltra(ultra.eventId), true, 'a gifted Ultra does not open canvas prints');
  assert.equal(await holdsUltra(pro.eventId), false, 'a gifted Pro opened canvas prints');

  // 🛑 An ADMIN comp keeps the plain 3 months (owner 15 Nov: "keep them at 3 months") — all-services, or Ultra by name.
  // Canvas is untouched by this ruling: an admin comp of Ultra is a deliberate full-plan grant at every gate.
  async function compedEvent(label: string, skus: string[] | null) {
    n += 1;
    const host = await newUser(`ladder-comp-${n}@test.test`, 'customer');
    const eventId = await one<string>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', $2::date) RETURNING event_id AS v`,
      [label, new Date(Date.now() - 100 * DAY).toISOString().slice(0, 10)],
    );
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, host]);
    const guestId = await one<string>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, 'Comp', 'Clock', 'both', 'friends') RETURNING guest_id AS v`,
      [eventId],
    );
    await db.query(
      `INSERT INTO public.papic_guest_captures (event_id, guest_id, r2_object_key, display_r2_key, media_type, captured_at)
       VALUES ($1, $2, $3, $3, 'photo', $4)`,
      [eventId, guestId, `r2://setnayan-media/papic/${eventId}.jpg`, new Date(Date.now() - 900 * DAY).toISOString()],
    );
    await db.query(
      `INSERT INTO public.comp_grants (user_id, event_id, source, scope, scoped_skus, rationale)
       VALUES ($1, $2, 'external_promo', $3, $4, 'test: admin comp keeps three months')`,
      [host, eventId, skus ? 'specific_skus' : 'all_services', skus],
    );
    return eventId;
  }
  const allServices = await compedEvent('all-services comp', null);
  const ultraComp = await compedEvent('Ultra comp', ['EVENT_ULTRA']);
  assert.equal(await holdsUltra(allServices), true, 'precondition: the comp reader sees the all-services comp');
  assert.equal(await holdsUltra(ultraComp), true, 'precondition: the comp reader sees the Ultra comp');
  const afterComps = await released();
  assert.ok(afterComps.has(allServices), 'an admin ALL-SERVICES comp held originals past three months');
  assert.ok(afterComps.has(ultraComp), 'an admin comp of Ultra held originals past three months');
  assert.ok(!afterComps.has(ultra.eventId), 'the supplier-gifted Ultra lost its hold');

  // The hold still lets go after the catalogue row's 12 months.
  const extra = Number(
    await one<string>(`SELECT fullres_extra_keep_days::text AS v FROM public.platform_retail_catalog_v2 WHERE service_code = 'EVENT_ULTRA'`),
  );
  assert.ok(extra > 0);
  assert.equal((await grant(giftShop, 'reviews:10000', 'event_ultra', null)).status, 'granted');
  const old = await giftedEvent('EVENT_ULTRA', GRACE + extra + 3);
  await deliverGift(old.eventVendorId);
  assert.ok((await released()).has(old.eventId), 'a gifted Ultra never lets its originals go');
});

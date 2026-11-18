/**
 * 🏅 THE BADGE BUILD · J0 — what the database must hold (migration `award_flow_gift_points_and_auto_claim`):
 *
 *   1 · GIFT POINTS MATCH THE RULING — `gift_points_for_price` equals lib/gift-points.ts on every ruled value
 *       (₱99 → 10 · ₱499 → 50 · ₱999 → 100 · ₱2,990 → 300 · ₱5,690 → 600 · ₱9,990 → 1,000) and answers NULL for no price.
 *   2 · THE GIFTS GIVEN COUNTER — `shop_gift_points` counts a gift only once it was GIVEN and only on an event whose
 *       booking with the shop is complete; prices come from the catalogue.
 *   3 · A TIER PAYS ONCE — the same reward key twice is 'already' (the database's key; legacy blocking is the app's
 *       `notYetPaid`, unit-tested in lib/badge-rewards.test.ts).
 *   4 · AUTO-CLAIM GRANTS ONCE — `shop_badge_rewards_auto_claim` claims every reward through `gift_moment_claims_once`;
 *       a second run claims nothing; nothing moves in the gift stock.
 *   5 · A FLOW RESUMES AT ITS EXACT STEP — `shop_award_flow_progress`: RLS at create, the shop reads its own, nobody
 *       else reads it, no session writes it.
 *
 * Sabotage seen red (2026-11-15): drop the `ev.status IN ('delivered','complete')` filter → test 2 red (a gift on an
 * unfinished event counts); drop `ON CONFLICT … DO NOTHING` → test 4 red; drop the read policy → test 5 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { giftPointsForPrice } from '../../lib/gift-points';

/** After the badge counters start (badge_counts_start(): 18 Dec 2026, Manila) — what a counted fixture is dated. */
const AFTER = '2026-12-20T12:00:00+08:00';
/** Before the counters start: a test booking that must never count (owner 16 Nov). */
const BEFORE = '2026-12-17T23:59:00+08:00';

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
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0].vendor_profile_id;
  return one<string>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id AS v`,
    [userId, name],
  );
}

async function price(code: string): Promise<number> {
  return Number(await one<string>(`SELECT retail_price_php::text AS v FROM public.platform_retail_catalog_v2 WHERE service_code = $1`, [code]));
}

/** An event with a booking of `shop` at `status`, an accepted quote carrying `lines`, and a 'given' row per line kind. */
async function giftedEvent(
  shop: string,
  status: 'contracted' | 'delivered' | 'complete',
  lines: Array<{ code: string; kind: 'papic' | 'event_plus' | 'event_pro'; credits: number }>,
): Promise<string> {
  n += 1;
  const eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`, [`gift pts ${n}`]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id, created_at)
     VALUES ($1, 'photographer', 'Gift Shop', $2, $3, $3, $4)`,
    [eventId, status, shop, AFTER],
  );
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos)
     VALUES ($1, $2, 'Quote', 'accepted', NOW(), 5000000) RETURNING proposal_id AS v`,
    [shop, eventId],
  );
  for (const l of lines) {
    await db.query(
      `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
       VALUES ($1, $2, $3, $4, $5, 1, $3)`,
      [proposalId, shop, l.code, l.kind, l.credits],
    );
  }
  const papicCredits = lines.filter((l) => l.kind === 'papic').reduce((s, l) => s + l.credits, 0);
  if (papicCredits > 0) {
    await db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id, created_at) VALUES ($1, 'papic', $2, 'given', $3, $4, $5)`,
      [shop, -papicCredits, eventId, proposalId, AFTER],
    );
  }
  for (const l of lines.filter((x) => x.kind !== 'papic')) {
    await db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id, created_at) VALUES ($1, $2, -1, 'given', $3, $4, $5)`,
      [shop, l.kind, eventId, proposalId, AFTER],
    );
  }
  return eventId;
}

let ownerA: string;
let ownerB: string;
let shopA: string;
let shopB: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  ownerA = await newUser('award-a@test.test', 'vendor');
  ownerB = await newUser('award-b@test.test', 'vendor');
  shopA = await shopOf(ownerA, 'Award Shop A');
  shopB = await shopOf(ownerB, 'Award Shop B');
  // A booking requires a verified shop (booking_requires_verified_vendor).
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = ANY($1::uuid[])`,
    [[shopA, shopB]],
  );
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. the award flow', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · gift points match the ruling, SQL == TS', async () => {
  for (const [p, pts] of [[99, 10], [499, 50], [999, 100], [2990, 300], [5690, 600], [9990, 1000]] as const) {
    const sql = await one<number | null>(`SELECT public.gift_points_for_price($1::numeric) AS v`, [p]);
    assert.equal(sql, pts, `SQL ₱${p}`);
    assert.equal(giftPointsForPrice(p), pts, `TS ₱${p}`);
  }
  assert.equal(await one<number | null>(`SELECT public.gift_points_for_price(NULL) AS v`), null);
  assert.equal(await one<number | null>(`SELECT public.gift_points_for_price(0) AS v`), null);
});

test('2 · Gifts given counts a gift once GIVEN, only on a COMPLETE booking, priced from the catalogue', async () => {
  const p1k = await price('PAPIC_GUEST_1K');
  const plus = await price('EVENT_PLUS');
  assert.ok(p1k > 0 && plus > 0, 'the catalogue must hold the fixture products');
  assert.equal(await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shopA]), 0);
  // An unfinished booking: nothing counts yet.
  await giftedEvent(shopA, 'contracted', [{ code: 'PAPIC_GUEST_1K', kind: 'papic', credits: 1000 }]);
  assert.equal(await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shopA]), 0, 'a gift on an unfinished event counted');
  // A completed one: one Papic 1000 + one Event Plus.
  await giftedEvent(shopA, 'complete', [
    { code: 'PAPIC_GUEST_1K', kind: 'papic', credits: 1000 },
    { code: 'EVENT_PLUS', kind: 'event_plus', credits: 1 },
  ]);
  const want = giftPointsForPrice(p1k)! + giftPointsForPrice(plus)!;
  assert.equal(await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shopA]), want);
  // Service-role only.
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await one<boolean>(`SELECT has_function_privilege($1, 'public.shop_gift_points(uuid)', 'EXECUTE') AS v`, [role]), false);
  }
});

test('3 + 4 · a tier pays once; auto-claim claims every reward exactly once and moves nothing', async () => {
  const g1 = await one<{ status: string }>(`SELECT public.shop_badge_reward_grant($1, 'completed_bookings:tier1', 'completed_bookings', 'papic', 1, 150, 'test') AS v`, [shopB]);
  assert.equal(g1.status, 'granted');
  const g2 = await one<{ status: string }>(`SELECT public.shop_badge_reward_grant($1, 'completed_bookings:tier1', 'completed_bookings', 'papic', 1, 150, 'test') AS v`, [shopB]);
  assert.equal(g2.status, 'already', 'a tier paid twice');
  await one(`SELECT public.shop_badge_reward_grant($1, 'verified', 'verified', 'papic', 1, 150, 'test') AS v`, [shopB]);
  const stockBefore = Number(await one<string>(`SELECT COALESCE(SUM(delta),0)::text AS v FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1`, [shopB]));

  assert.equal(await one<number>(`SELECT public.shop_badge_rewards_auto_claim($1) AS v`, [shopB]), 2);
  assert.equal(await one<number>(`SELECT public.shop_badge_rewards_auto_claim($1) AS v`, [shopB]), 0, 'auto-claim claimed twice');
  assert.equal(
    Number(await one<string>(`SELECT count(*)::text AS v FROM public.gift_moment_claims WHERE vendor_profile_id = $1 AND source = 'badge_reward'`, [shopB])),
    2,
  );
  const stockAfter = Number(await one<string>(`SELECT COALESCE(SUM(delta),0)::text AS v FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1`, [shopB]));
  assert.equal(stockAfter, stockBefore, 'a claim must grant nothing');
  // Another shop's rewards are untouched.
  assert.equal(await one<number>(`SELECT public.shop_badge_rewards_auto_claim($1) AS v`, [shopA]), 0);
  for (const role of ['anon', 'authenticated']) {
    assert.equal(await one<boolean>(`SELECT has_function_privilege($1, 'public.shop_badge_rewards_auto_claim(uuid)', 'EXECUTE') AS v`, [role]), false);
  }
});

test('5 · a flow resumes at its exact step; only the shop reads it; no session writes it', async () => {
  await db.query(
    `INSERT INTO public.shop_award_flow_progress (vendor_profile_id, flow_key, step, total_steps, opened_at)
     VALUES ($1, 'completed_bookings:tier1', 4, 9, NOW())`,
    [shopB],
  );
  const read = async (uid: string) => {
    await db.exec(`SET ROLE authenticated`);
    try {
      await setAuthUid(db, uid);
      return (await db.query<{ step: number }>(`SELECT step FROM public.shop_award_flow_progress WHERE vendor_profile_id = $1`, [shopB])).rows;
    } finally {
      await db.exec(`RESET ROLE`);
      await setAuthUid(db, null);
    }
  };
  assert.deepEqual((await read(ownerB)).map((r) => r.step), [4], 'the shop resumes at step 4');
  assert.deepEqual(await read(ownerA), [], 'another shop read the flow');

  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, ownerB);
    await assert.rejects(
      db.query(`INSERT INTO public.shop_award_flow_progress (vendor_profile_id, flow_key, step) VALUES ($1, 'verified', 1)`, [shopB]),
      /permission denied/,
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
  // A step past the flow's own length is refused by the table.
  await assert.rejects(
    db.query(`INSERT INTO public.shop_award_flow_progress (vendor_profile_id, flow_key, step, total_steps) VALUES ($1, 'verified', 8, 7)`, [shopB]),
    /shop_award_flow_progress_total_range/,
  );
  const rls = await one<boolean>(`SELECT relrowsecurity AS v FROM pg_class WHERE oid = 'public.shop_award_flow_progress'::regclass`);
  assert.equal(rls, true);
});

/* ── 16 Nov owner-approved rules (controller, PR #7753) ─────────────────────────────────────────────────────────── */

/** A booking of `shop` for `couple` at `status`, from `source` (an import or not); optional own-link chat. */
async function booking(
  shop: string,
  couple: string,
  status: 'contracted' | 'delivered' | 'complete',
  source: string | null,
  ownLinkChat = false,
  createdAt: string = AFTER,
): Promise<string> {
  n += 1;
  const eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`, [`booking ${n}`]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [eventId, couple]);
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, linked_vendor_profile_id, marketplace_vendor_id, source, created_at)
     VALUES ($1, 'photographer', 'Count Shop', $2, $3, $3, $4, $5)`,
    [eventId, status, shop, source, createdAt],
  );
  if (ownLinkChat) {
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'website')`, [eventId, shop]);
  }
  return eventId;
}

test('16 Nov · 1 · a gift paid from BADGE-REWARD stock never counts toward Gifts given', async () => {
  const before = await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shopA]);
  const eventId = await giftedEvent(shopA, 'complete', [{ code: 'PAPIC_GUEST_1K', kind: 'papic', credits: 1000 }]);
  const paid = await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shopA]);
  assert.ok(paid > before, 'a bought gift on a completed event counts');
  // The same gift again, but its quote line was paid from the shop's badge-reward stock.
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos)
     VALUES ($1, $2, 'Reward quote', 'accepted', NOW(), 5000000) RETURNING proposal_id AS v`,
    [shopA, eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title, from_badge_reward)
     VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 1000, 1, 'Papic 1000', TRUE)`,
    [proposalId, shopA],
  );
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, event_id, proposal_id, created_at) VALUES ($1, 'papic', -1000, 'given', $2, $3, $4)`,
    [shopA, eventId, proposalId, AFTER],
  );
  assert.equal(await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shopA]), paid, 'a reward-paid gift counted');
});

test('16 Nov · 2 · imports never count toward Completed bookings or Trusted by; 3 · their gifts still count', async () => {
  const owner = await newUser('award-c@test.test', 'vendor');
  const shop = await shopOf(owner, 'Award Shop C');
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`, [shop]);
  const c1 = await newUser('award-c1@test.test', 'customer');
  const c2 = await newUser('award-c2@test.test', 'customer');
  const c3 = await newUser('award-c3@test.test', 'customer');
  const completed = () => one<number>(`SELECT public.shop_completed_bookings_count($1) AS v`, [shop]);
  const trusted = () => one<number>(`SELECT public.shop_trusted_by_count($1) AS v`, [shop]);

  await booking(shop, c1, 'complete', null);
  assert.equal(await completed(), 1, 'a booking Setnayan made counts');
  for (const src of ['vendor_invite', 'vendor_locked_qr', 'reuse_accept']) {
    await booking(shop, c2, 'complete', src);
    assert.equal(await completed(), 1, `a ${src} import counted`);
  }
  await booking(shop, c3, 'complete', null, true);
  assert.equal(await completed(), 1, 'an own-link (?src=own) arrival counted');
  await booking(shop, c3, 'complete', 'website');
  assert.equal(await completed(), 1, "a source 'website' booking counted");
  // A Booking QR token of this shop claimed onto a booking that kept an earlier source is still an import (the seals
  // engine's rule, folded into the one definition).
  const claimed = await booking(shop, c3, 'complete', 'host_manual');
  await db.query(
    `INSERT INTO public.vendor_locked_qr_tokens (token, vendor_profile_id, created_by_user_id, category, claimed_event_vendor_id)
     VALUES ('award-qr-import', $1, $2, 'photographer', (SELECT vendor_id FROM public.event_vendors WHERE event_id = $3))`,
    [shop, owner, claimed],
  );
  assert.equal(await completed(), 1, 'a booking with a claimed Booking QR counted');
  // The public completed-events number is untouched by this rule.
  assert.ok(Number(await one<string>(`SELECT count(*)::text AS v FROM public.event_vendors WHERE linked_vendor_profile_id = $1 AND status = 'complete'`, [shop])) >= 7);

  // Trusted by COUNTS imports (controller's audit of 923f981994: the 16 Nov rows rule imports out of Completed bookings
  // only). c2 booked the shop on several events, every one an import → trusted. c1 then comes back → +1, once.
  const t0 = await trusted();
  assert.ok(t0 >= 1, 'a client whose repeat bookings are all imports is Trusted by');
  await booking(shop, c1, 'contracted', null);
  assert.equal(await trusted(), t0 + 1, 'a client who came back counts once');
  await booking(shop, c1, 'contracted', null);
  assert.equal(await trusted(), t0 + 1, 'a third booking adds nothing');

  // Rule 3: a gift given on an imported client's completed event DOES count toward Gifts given.
  const imported = await giftedEvent(shop, 'complete', [{ code: 'PAPIC_GUEST_150', kind: 'papic', credits: 150 }]);
  await db.query(`UPDATE public.event_vendors SET source = 'vendor_invite' WHERE event_id = $1`, [imported]);
  assert.equal(await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shop]), giftPointsForPrice(await price('PAPIC_GUEST_150')));

  for (const fn of ['shop_completed_bookings_count(uuid)', 'shop_trusted_by_count(uuid)', 'shop_booking_is_import(uuid, uuid, text)']) {
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await one<boolean>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS v`, [role, `public.${fn}`]), false, `${role} can call ${fn}`);
    }
  }
});

test('16 Nov · the counters start on 18 Dec 2026 (Manila): a booking, gift or review before then never counts', async () => {
  assert.equal(await one<string>(`SELECT to_char(public.badge_counts_start() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI') AS v`), '2026-12-18 00:00');
  const owner = await newUser('award-d@test.test', 'vendor');
  const shop = await shopOf(owner, 'Award Shop D');
  await db.query(`UPDATE public.vendor_profiles SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`, [shop]);
  const c = await newUser('award-d1@test.test', 'customer');
  const completed = () => one<number>(`SELECT public.shop_completed_bookings_count($1) AS v`, [shop]);
  const trusted = () => one<number>(`SELECT public.shop_trusted_by_count($1) AS v`, [shop]);

  // A test booking the minute before the counters start, completed, and the same client back again — none of it counts.
  await booking(shop, c, 'complete', null, false, BEFORE);
  await booking(shop, c, 'complete', null, false, BEFORE);
  assert.equal(await completed(), 0, 'a booking before 18 Dec counted toward Completed bookings');
  assert.equal(await trusted(), 0, 'bookings before 18 Dec counted toward Trusted by');
  // A gift given on a test booking: no points.
  const ev = await giftedEvent(shop, 'complete', [{ code: 'PAPIC_GUEST_150', kind: 'papic', credits: 150 }]);
  await db.query(`UPDATE public.event_vendors SET created_at = $2 WHERE event_id = $1`, [ev, BEFORE]);
  assert.equal(await one<number>(`SELECT public.shop_gift_points($1) AS v`, [shop]), 0, 'a gift on a pre-launch booking counted');
  // The first booking after the start counts.
  await booking(shop, c, 'complete', null);
  assert.equal(await completed(), 1);
});

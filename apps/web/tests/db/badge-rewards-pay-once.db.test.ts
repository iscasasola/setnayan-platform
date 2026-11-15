/**
 * BADGE REWARDS PAY ONCE — and a free booking fee pays the next fee, never a free one (owner 2026-11-05).
 *
 * Migration `badge_rewards_land_in_the_gift_stock`. What a unit test cannot see:
 *
 *   1 · EXACTLY ONCE — `shop_badge_reward_grant` writes one reward and one 'badge_reward' stock row per
 *       (shop, reward_key); a second call, or a call after the reward was revoked, writes nothing. The stock row is the
 *       reward, so `shop_gift_stock_status` counts it with no change.
 *   2 · THE FREE BOOKING FEE — the shop's first (already free) booking does not spend it; the next booking that would
 *       be billed reads ₱0 · `paid` and names the reward; the one after is billed again (one per booking); a re-lock
 *       spends nothing more; a promo window keeps it unspent; two free fees cover two bookings.
 *   3 · AN AMENDED BADGE-PAID BOOKING STAYS FREE — `booking_fee_rederive_lock_fee` answers `badge_noop` and opens no
 *       delta (without the arm a ₱0 `paid` primary reads as underpaid by the whole fee).
 *   4 · REVOKE — the admin takes back an unused free fee (the next booking is then billed); a used one cannot be.
 *   5 · REWARD STOCK — `shop_gift_reward_stock_status` counts reward lines on live quotes as used, frees them when the
 *       quote lapses, and leaves out the event a new quote replaces.
 *   6 · RLS — a shop reads only its own rewards; no session writes one or calls the doors.
 *   7 · A CANCELLED BOOKING GIVES ITS FREE FEE BACK (owner 2026-11-05) — before its day, the charge lets go
 *       (cancelled_unbilled) and the free fee waits again for the next booking.
 *   8 · THE COUPLE STILL GETS THE SETNAYAN GIFT (owner 2026-11-05) — on a badge-paid booking whose quote / card offers
 *       it: landed once on that event, no bill, and the quote answers 'badge_reward' before and after.
 *
 * Sabotage (2026-11-05): removing `ON CONFLICT … DO NOTHING` from the grant turns test 1 red (unique violation, not
 * 'already'); moving the badge arm above `IF v_is_free` turns test 2 red (the free first booking spends the reward);
 * deleting the `badge_noop` arm turns test 3 red (a delta for the whole fee is opened).
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let seq = 0;
const uniq = () => `badge-${++seq}-${Date.now()}`;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  // No launch offer, no promotion — only the shop's own free first booking waives.
  await db.query(
    `UPDATE public.platform_settings
        SET launch_offer_enabled = NULL, launch_offer_started_at = NULL,
            launch_offer_closed_at = NULL, launch_offer_pro_ends_at = NULL,
            launch_offer_booking_cap = 2000,
            booking_fee_free_from = NULL, booking_fee_free_until = NULL
      WHERE id = 1`,
  );
});

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

async function newShop(): Promise<{ userId: string; shop: string }> {
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id AS v`,
    [`${uniq()}@t.local`],
  );
  const shop = await one<string>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1,'Badge Studio','Manila',ARRAY['photography']::text[],'verified',NOW(), 'verified')
     RETURNING vendor_profile_id AS v`,
    [userId],
  );
  return { userId, shop };
}

/** A Setnayan-sourced booking of `shop` (an explore thread), agreed at `total` pesos. */
async function newBooking(shop: string, total = 50000): Promise<{ eventId: string; eventVendorId: string }> {
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type, event_date)
     VALUES ($1,'birthday','2030-08-01') RETURNING event_id AS v`,
    [uniq()],
  );
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1,'photographer','Badge Studio','contracted'::vendor_status,$2,$3) RETURNING vendor_id AS v`,
    [eventId, shop, total],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'explore')`,
    [eventId, shop],
  );
  return { eventId, eventVendorId };
}

type Grant = { status: string; reward_id?: string };
async function grant(
  shop: string,
  key: string,
  kind: 'papic' | 'event_plus' | 'event_pro' | 'fee_waiver',
  units: number,
  creditsEach: number | null,
): Promise<Grant> {
  return one<Grant>(
    `SELECT public.shop_badge_reward_grant($1, $2, $3, $4, $5, $6, 'Badge reward · test') AS v`,
    [shop, key, key.split(':')[0], kind, units, creditsEach],
  );
}

type Open = {
  charge_id?: string;
  status?: string;
  amount_charged_centavos?: number;
  computed_fee_centavos?: number;
  badge_reward_id?: string | null;
  reused?: boolean;
};
async function openCharge(eventVendorId: string): Promise<Open> {
  return one<Open>(`SELECT public.booking_fee_open_lock_charge($1) AS v`, [eventVendorId]);
}

async function waiver(rewardId: string): Promise<{ used_on_charge_id: string | null; revoked_at: string | null }> {
  const r = await db.query<{ used_on_charge_id: string | null; revoked_at: string | null }>(
    `SELECT used_on_charge_id, revoked_at FROM public.shop_badge_rewards WHERE reward_id = $1`,
    [rewardId],
  );
  return r.rows[0]!;
}

test('1 · a reward pays exactly once — a re-run and a re-earn after a revoke write nothing', async () => {
  const { shop } = await newShop();

  const first = await grant(shop, 'events:10', 'papic', 2, 150);
  assert.equal(first.status, 'granted');
  assert.equal((await grant(shop, 'events:10', 'papic', 2, 150)).status, 'already', 'a re-run paid the step twice');

  const stock = await db.query<{ delta: number; kind: string; badge_reward_id: string }>(
    `SELECT delta, kind, badge_reward_id FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1`,
    [shop],
  );
  assert.equal(stock.rows.length, 1, 'one reward, one stock row');
  assert.equal(stock.rows[0]!.kind, 'badge_reward', 'the reward is not marked as a badge reward');
  assert.equal(Number(stock.rows[0]!.delta), 300, '2 × the pack credits handed in');
  assert.equal(stock.rows[0]!.badge_reward_id, first.reward_id);

  const status = await db.query<{ balance: number }>(
    `SELECT balance FROM public.shop_gift_stock_status($1, NULL) WHERE gift_kind = 'papic'`,
    [shop],
  );
  assert.equal(Number(status.rows[0]!.balance), 300, 'the gift stock does not count the badge reward');

  // An Event Plus lands as one unit of its own kind.
  assert.equal((await grant(shop, 'events:50', 'event_plus', 1, null)).status, 'granted');
  const plus = await db.query<{ balance: number }>(
    `SELECT balance FROM public.shop_gift_stock_status($1, NULL) WHERE gift_kind = 'event_plus'`,
    [shop],
  );
  assert.equal(Number(plus.rows[0]!.balance), 1);

  // A free booking fee is not stock.
  const fw = await grant(shop, 'events:1000', 'fee_waiver', 1, null);
  assert.equal(fw.status, 'granted');
  const fwStock = await one<string>(
    `SELECT COUNT(*)::text AS v FROM public.shop_gift_stock_entries WHERE badge_reward_id = $1`,
    [fw.reward_id],
  );
  assert.equal(Number(fwStock), 0, 'a free booking fee was written into the gift stock');

  // Revoked, then "earned again" (a voided booking took the count down and back up): the key stays spent.
  assert.equal((await one<{ status: string }>(`SELECT public.shop_badge_fee_waiver_revoke($1, NULL, 'test') AS v`, [fw.reward_id])).status, 'revoked');
  assert.equal((await grant(shop, 'events:1000', 'fee_waiver', 1, null)).status, 'already', 'a revoked step paid again');

  // Bad input writes nothing.
  assert.equal((await grant(shop, 'reviews:5', 'papic', 1, null)).status, 'bad_input', 'Papic with no pack credits');
  assert.equal((await grant(shop, 'x:1', 'fee_waiver', 2, null)).status, 'bad_input', 'two free fees in one row');
});

test('2 · the free booking fee pays the next billed booking — never the free one, one per booking', async () => {
  const { shop } = await newShop();
  const fw = await grant(shop, 'events:1000', 'fee_waiver', 1, null);

  const firstBooking = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(firstBooking.status, 'waived_free5', 'the first booking is free on its own');
  assert.equal((await waiver(fw.reward_id!)).used_on_charge_id, null, 'the free first booking spent the badge reward');

  const b2 = await newBooking(shop);
  const second = await openCharge(b2.eventVendorId);
  assert.equal(second.status, 'paid', `the badge-paid booking is ${second.status}`);
  assert.equal(second.amount_charged_centavos, 0, 'the badge-paid booking charged money');
  assert.ok((second.computed_fee_centavos ?? 0) > 0, 'it does not record what the fee would have been');
  assert.equal(second.badge_reward_id, fw.reward_id, 'the charge does not name its reward');
  assert.equal((await waiver(fw.reward_id!)).used_on_charge_id, second.charge_id, 'the reward is not marked used');

  const again = await openCharge(b2.eventVendorId);
  assert.equal(again.reused, true);
  assert.equal(again.charge_id, second.charge_id, 'a re-lock made a second charge');

  const third = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(third.status, 'pending', 'one free fee covered two bookings');
  assert.ok((third.amount_charged_centavos ?? 0) > 0);

  // A promotion running → the booking is waived by the promotion, and a waiting free fee stays unspent.
  const fw2 = await grant(shop, 'events:5000', 'fee_waiver', 1, null);
  await db.query(
    `UPDATE public.platform_settings
        SET booking_fee_free_from = NOW() - INTERVAL '1 day', booking_fee_free_until = NOW() + INTERVAL '1 day'
      WHERE id = 1`,
  );
  const promo = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(promo.status, 'waived_promo');
  assert.equal((await waiver(fw2.reward_id!)).used_on_charge_id, null, 'a booking already free spent the free fee');
  await db.query(`UPDATE public.platform_settings SET booking_fee_free_from = NULL, booking_fee_free_until = NULL WHERE id = 1`);

  // Two free fees waiting, two bookings → each takes its own, oldest first.
  const fw3 = await grant(shop, 'events:10000', 'fee_waiver', 1, null);
  const x = await openCharge((await newBooking(shop)).eventVendorId);
  const y = await openCharge((await newBooking(shop)).eventVendorId);
  assert.deepEqual([x.badge_reward_id, y.badge_reward_id], [fw2.reward_id, fw3.reward_id]);
});

test('3 · an amended badge-paid booking stays free — no delta for the whole fee', async () => {
  const { shop } = await newShop();
  await openCharge((await newBooking(shop)).eventVendorId); // the free first booking
  await grant(shop, 'events:1000', 'fee_waiver', 1, null);
  const b = await newBooking(shop);
  const paid = await openCharge(b.eventVendorId);
  assert.equal(paid.status, 'paid');

  await db.query(`UPDATE public.event_vendors SET total_cost_php = 90000 WHERE vendor_id = $1`, [b.eventVendorId]);
  const r = await one<{ action: string }>(`SELECT public.booking_fee_rederive_lock_fee($1) AS v`, [b.eventVendorId]);
  assert.equal(r.action, 'badge_noop', `an amended badge-paid booking was re-priced: ${r.action}`);
  const deltas = await one<string>(
    `SELECT COUNT(*)::text AS v FROM public.booking_fee_charges WHERE event_vendor_id = $1 AND kind = 'amendment_delta'`,
    [b.eventVendorId],
  );
  assert.equal(Number(deltas), 0, 'an amendment billed the fee the badge reward paid');
});

test('4 · the admin revokes an unused free fee; a used one cannot be revoked', async () => {
  const { shop } = await newShop();
  await openCharge((await newBooking(shop)).eventVendorId); // the free first booking
  const unused = await grant(shop, 'events:1000', 'fee_waiver', 1, null);
  assert.equal((await one<{ status: string }>(`SELECT public.shop_badge_fee_waiver_revoke($1, NULL, 'mistake') AS v`, [unused.reward_id])).status, 'revoked');
  const billed = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(billed.status, 'pending', 'a revoked free fee still paid a booking');

  const used = await grant(shop, 'events:5000', 'fee_waiver', 1, null);
  const free = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(free.badge_reward_id, used.reward_id);
  assert.equal((await one<{ status: string }>(`SELECT public.shop_badge_fee_waiver_revoke($1, NULL, 'x') AS v`, [used.reward_id])).status, 'used');
  assert.equal((await waiver(used.reward_id!)).revoked_at, null);
});

test('5 · reward stock: live reward lines use it, a lapsed quote frees it, the replaced event is left out', async () => {
  const { shop } = await newShop();
  await grant(shop, 'verified', 'papic', 1, 150);
  await grant(shop, 'first_booking', 'papic', 1, 150);

  const reward = async (except: string | null = null) => {
    const r = await db.query<{ earned: number; used: number }>(
      `SELECT earned, used FROM public.shop_gift_reward_stock_status($1, $2) WHERE gift_kind = 'papic'`,
      [shop, except],
    );
    return { earned: Number(r.rows[0]!.earned), used: Number(r.rows[0]!.used) };
  };
  assert.deepEqual(await reward(), { earned: 300, used: 0 });

  const b = await newBooking(shop);
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, total_centavos, valid_until)
     VALUES ($1, $2, 'Quote', 'sent', 5000000, (NOW() + INTERVAL '10 days')::date) RETURNING proposal_id AS v`,
    [shop, b.eventId],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts
       (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title, from_badge_reward)
     VALUES ($1, $2, 'PAPIC_GUEST', 'papic', 150, 99, 'Papic 150', TRUE),
            ($1, $2, 'PAPIC_GUEST', 'papic', 150, 99, 'Papic 150', FALSE)`,
    [proposalId, shop],
  );
  assert.deepEqual(await reward(), { earned: 300, used: 150 }, 'a bought line was counted as reward');
  assert.deepEqual(await reward(b.eventId), { earned: 300, used: 0 }, 'the replaced event still holds reward');

  // Time passes: the quote was sent with an honest Valid until, and that day is now behind us. The send-time rule
  // (`vendor_proposals_valid_until`, "no lifetime quotation") refuses a past date ON A SEND — a lapse is the clock
  // moving, not a send — so the trigger is stood aside for this one write only, exactly as the clock would.
  await db.exec(`ALTER TABLE public.vendor_proposals DISABLE TRIGGER vendor_proposals_valid_until`);
  try {
    await db.query(`UPDATE public.vendor_proposals SET valid_until = (NOW() - INTERVAL '3 days')::date WHERE proposal_id = $1`, [proposalId]);
  } finally {
    await db.exec(`ALTER TABLE public.vendor_proposals ENABLE TRIGGER vendor_proposals_valid_until`);
  }
  assert.deepEqual(await reward(), { earned: 300, used: 0 }, 'a lapsed quote still holds reward stock');
});

test('7 · a booking cancelled before its day gives its free booking fee back (owner 2026-11-05)', async () => {
  const { shop } = await newShop();
  await openCharge((await newBooking(shop)).eventVendorId); // the free first booking
  const fw = await grant(shop, 'events:1000', 'fee_waiver', 1, null);
  const b = await newBooking(shop);
  const paid = await openCharge(b.eventVendorId);
  assert.equal(paid.badge_reward_id, fw.reward_id);

  await db.query(`UPDATE public.event_vendors SET archived_at = NOW() WHERE vendor_id = $1`, [b.eventVendorId]);
  const back = await db.query<{ used_on_charge_id: string | null; returned_at: string | null; returned_from_charge_id: string | null }>(
    `SELECT used_on_charge_id, returned_at, returned_from_charge_id FROM public.shop_badge_rewards WHERE reward_id = $1`,
    [fw.reward_id],
  );
  assert.equal(back.rows[0]!.used_on_charge_id, null, 'the free fee did not come back');
  assert.ok(back.rows[0]!.returned_at, 'the return is not recorded');
  assert.equal(back.rows[0]!.returned_from_charge_id, paid.charge_id);
  const charge = await db.query<{ status: string; badge_reward_id: string | null }>(
    `SELECT status, badge_reward_id FROM public.booking_fee_charges WHERE charge_id = $1`,
    [paid.charge_id],
  );
  assert.equal(charge.rows[0]!.status, 'cancelled_unbilled');
  assert.equal(charge.rows[0]!.badge_reward_id, null);

  // It waits again — the next booking with a fee takes it.
  const next = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(next.badge_reward_id, fw.reward_id, 'the returned free fee did not pay the next booking');
});

test('8 · a badge-paid booking still gives the couple the Setnayan gift, and the quote says so (owner 2026-11-05)', async () => {
  const { shop } = await newShop();
  await openCharge((await newBooking(shop)).eventVendorId); // the free first booking
  const fw = await grant(shop, 'events:1000', 'fee_waiver', 1, null);

  const b = await newBooking(shop);
  // The supplier's accepted quote carries the gift switch ON.
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos, includes_setnayan_gift)
     VALUES ($1, $2, 'Quote', 'accepted', NOW(), 5000000, TRUE)`,
    [shop, b.eventId],
  );
  const before = await one<string>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS v`, [b.eventId, shop]);
  assert.equal(before, 'badge_reward', 'the quote of a booking a free fee will pay does not promise the gift');

  const paid = await openCharge(b.eventVendorId);
  assert.equal(paid.badge_reward_id, fw.reward_id);
  assert.equal(paid.amount_charged_centavos, 0, 'the gift was billed');
  const reward = await db.query<{ setnayan_gift_credits: number | null; setnayan_gift_grant_id: string | null }>(
    `SELECT setnayan_gift_credits, setnayan_gift_grant_id FROM public.shop_badge_rewards WHERE reward_id = $1`,
    [fw.reward_id],
  );
  const credits = Number(reward.rows[0]!.setnayan_gift_credits ?? 0);
  assert.ok(credits > 0, 'the couple got no Setnayan gift on a badge-paid booking');
  const pool = await db.query<{ points: number; event_id: string }>(
    `SELECT points, event_id FROM public.papic_event_point_grants WHERE grant_id = $1`,
    [reward.rows[0]!.setnayan_gift_grant_id],
  );
  assert.equal(pool.rows[0]!.event_id, b.eventId, 'the gift landed on another event');
  assert.equal(Number(pool.rows[0]!.points), credits);
  assert.equal(await one<string>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS v`, [b.eventId, shop]), 'badge_reward');

  // A re-lock gives nothing twice.
  await openCharge(b.eventVendorId);
  const grants = await one<string>(
    `SELECT COUNT(*)::text AS v FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'comp'`,
    [b.eventId],
  );
  assert.equal(Number(grants), 1, 'the gift was given twice');

  // A booking whose quote and card say no carries no gift — the free fee alone.
  const fw2 = await grant(shop, 'events:5000', 'fee_waiver', 1, null);
  const plain = await openCharge((await newBooking(shop)).eventVendorId);
  assert.equal(plain.badge_reward_id, fw2.reward_id);
  const plainGift = await one<number | null>(`SELECT setnayan_gift_credits AS v FROM public.shop_badge_rewards WHERE reward_id = $1`, [fw2.reward_id]);
  assert.equal(plainGift, null, 'a gift nobody offered was given');
});

test('6 · 🚨 RLS: own rewards only; no session writes a reward or calls the doors', async () => {
  const a = await newShop();
  const b = await newShop();
  const g = await grant(a.shop, 'verified', 'papic', 1, 150);
  const w = await grant(a.shop, 'events:1000', 'fee_waiver', 1, null);

  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, a.userId);
    assert.equal(Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1`, [a.shop])), 2);
    await setAuthUid(db, b.userId);
    assert.equal(
      Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_badge_rewards WHERE vendor_profile_id = $1`, [a.shop])),
      0,
      'shop B reads shop A’s rewards',
    );

    await setAuthUid(db, a.userId);
    await assert.rejects(
      db.query(
        `INSERT INTO public.shop_badge_rewards (vendor_profile_id, reward_key, badge, reward_kind, units, stock_delta)
         VALUES ($1, 'mine', 'mine', 'papic', 10, 1500)`,
        [a.shop],
      ),
      /permission denied/,
      'a shop wrote its own reward',
    );
    await assert.rejects(
      db.query(`SELECT public.shop_badge_reward_grant($1, 'x', 'x', 'papic', 1, 150)`, [a.shop]),
      /permission denied/,
      'a session called the grant door',
    );
    await assert.rejects(
      db.query(`SELECT public.shop_badge_fee_waiver_revoke($1, NULL, NULL)`, [w.reward_id]),
      /permission denied/,
      'a session called the revoke door',
    );
    assert.ok(g.reward_id);
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});

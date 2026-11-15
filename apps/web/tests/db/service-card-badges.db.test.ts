/**
 * 🏅 THE SERVICE-CARD BADGES IN THE DATABASE (badge build J3; migration 20271348906302_service_card_badge_holds_and_facts).
 *
 * Fails if:
 *   1 · `service_card_badge_facts` stops counting a card's OWN paid bookings (another card's do not add up), its
 *       distinct couples, the bookings that carry a shop gift, or a booking that is archived / fraud / unpaid / an
 *       IMPORT (the shop's invite, Locked QR, a reused booking — DECISION_LOG fd5814dc) starts counting;
 *   2 · an inquiry about a card stops being timed from the shop's first OWN reply (a bot message, or a couple's, is not
 *       a reply), or a category-only inquiry is credited to a card;
 *   3 · a shop that does not exist reads as zero instead of NULL (a failed read must look failed);
 *   4 · `service_card_badge_settle` announces a badge twice, keeps showing one that stopped passing, ERASES its time
 *       held instead of keeping it in the shop's record (owner, DECISION_LOG 7fbff0cd), refuses to let the card earn it
 *       again, or takes a card of ANOTHER shop;
 *   5 · either function, or the holds table, becomes reachable by anon or a signed-in user.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];
let n = 0;

async function newUser(): Promise<string> {
  n += 1;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
    [`card-badges-${n}@test.local`],
  );
  return u.rows[0]!.id;
}

async function newShop(): Promise<string> {
  const owner = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Badge Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW() - INTERVAL '100 days', 'verified')
     RETURNING vendor_profile_id`,
    [owner],
  );
  return v.rows[0]!.vendor_profile_id;
}

async function newCard(shop: string, title: string): Promise<string> {
  // A draft first, then what a published card needs (a cover, a price, one inclusion), then published.
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, title, is_active, primary_photo_r2_key, starting_price_php)
     VALUES ($1, 'photography', $2, FALSE, 'r2://media/badge-cover.jpg', 15000) RETURNING vendor_service_id`,
    [shop, title],
  );
  const id = r.rows[0]!.vendor_service_id;
  await db.query(
    `INSERT INTO public.vendor_service_inclusions (vendor_service_id, vendor_profile_id, label) VALUES ($1, $2, 'Full-day coverage')`,
    [id, shop],
  );
  await db.query(`UPDATE public.vendor_services SET is_active = TRUE WHERE vendor_service_id = $1`, [id]);
  return id;
}

async function newEvent(): Promise<string> {
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Badge Event', 'birthday') RETURNING event_id`,
  );
  return e.rows[0]!.event_id;
}

/** A paid booking of `card` on a fresh event (deposit recorded `daysAgo`). */
async function paidBooking(
  shop: string,
  card: string,
  daysAgo = 3,
  extra = '',
  source = 'host_marketplace_search',
): Promise<{ event: string }> {
  const event = await newEvent();
  // Found on Setnayan (a save from Find) unless the case says otherwise — an import never counts.
  await db.query(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, service_id, deposit_recorded_at, deposit_paid_php, source)
     VALUES ($1, 'photographer', 'Badge Shop', 'deposit_paid', $2, $3, NOW() - ($4 || ' days')::interval, 1000, $5)`,
    [event, shop, card, String(daysAgo), source],
  );
  if (extra) await db.query(extra, [event]);
  return { event };
}

type Facts = {
  good_standing: boolean;
  verified_since: string | null;
  cards: Array<{
    id: string;
    paid_bookings: number;
    paid_couples: number;
    paid_with_gift: number;
    inquiries: Array<{ asked_at: string; replied_at: string | null; withdrawn: boolean }>;
  }>;
};
async function facts(shop: string): Promise<Facts | null> {
  const r = await db.query<{ f: Facts | null }>(`SELECT public.service_card_badge_facts($1) AS f`, [shop]);
  return r.rows[0]!.f;
}
const cardOf = (f: Facts | null, id: string) => f!.cards.find((c) => c.id === id)!;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('1 · a card counts its OWN paid bookings, its couples, and the ones the shop gave a gift', async () => {
  const shop = await newShop();
  const film = await newCard(shop, 'Wedding Film');
  const photos = await newCard(shop, 'Photo Coverage');

  const gifted = await paidBooking(shop, film);
  const notGifted = await paidBooking(shop, film);
  await paidBooking(shop, photos); // another card's booking — never adds up
  await paidBooking(shop, film, 45); // outside the 30 days
  await paidBooking(shop, film, 3, `UPDATE public.event_vendors SET archived_at = NOW() WHERE event_id = $1`);
  await paidBooking(shop, film, 3, `UPDATE public.event_vendors SET voided_by_fraud = TRUE WHERE event_id = $1`);
  // Imports never count (DECISION_LOG fd5814dc): the shop's invite, its Locked QR, a reused booking.
  await paidBooking(shop, film, 3, '', 'vendor_invite');
  await paidBooking(shop, film, 3, '', 'vendor_locked_qr');
  await paidBooking(shop, film, 3, '', 'reuse_accept');
  // An ask that never got paid is not a paid booking.
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, service_id)
     VALUES ($1, 'photographer', 'Badge Shop', 'contracted', $2, $3)`,
    [await newEvent(), shop, film],
  );

  // The shop's gift: an ACCEPTED quote on that event, naming the card, with a gift line.
  const p = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, service_card_ids)
     VALUES ($1, $2, 'Quote', 'accepted', jsonb_build_array($3::text)) RETURNING proposal_id`,
    [shop, gifted.event, film],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
     VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 1000, 499, 'Papic 1000')`,
    [p.rows[0]!.proposal_id, shop],
  );

  // A gift on that second event's quote that names ONLY the other card is not this card's gift.
  const p2 = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, service_card_ids)
     VALUES ($1, $2, 'Quote', 'accepted', jsonb_build_array($3::text)) RETURNING proposal_id`,
    [shop, notGifted.event, photos],
  );
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
     VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 1000, 499, 'Papic 1000')`,
    [p2.rows[0]!.proposal_id, shop],
  );

  const f = await facts(shop);
  assert.equal(f!.good_standing, true);
  assert.ok(f!.verified_since, 'the held time of Verified runs from the date the shop was verified');
  const c = cardOf(f, film);
  assert.equal(c.paid_bookings, 2, 'two paid, in the window, live, found on Setnayan — the archived, fraud, old, unpaid and IMPORTED ones do not count');
  assert.equal(c.paid_couples, 2);
  assert.equal(c.paid_with_gift, 1, 'one of them carried the shop’s gift — a gift naming another card is not this card’s');
  assert.equal(cardOf(f, photos).paid_bookings, 1, 'the other card keeps its own count');
});

test('2 · an inquiry is timed from the shop’s first OWN reply; a category-only inquiry is nobody’s', async () => {
  const shop = await newShop();
  const film = await newCard(shop, 'Wedding Film');
  const couple = await newUser();
  const event = await newEvent();
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status, created_at)
     VALUES ($1, $2, $3, 'pending', NOW() - INTERVAL '2 hours') RETURNING thread_id`,
    [event, shop, couple],
  );
  const thread = t.rows[0]!.thread_id;
  await db.query(
    `INSERT INTO public.thread_service_interests (thread_id, vendor_service_id, source, status, added_by_role, created_at)
     VALUES ($1, $2, 'initial', 'asked', 'couple', NOW() - INTERVAL '2 hours'),
            ($1, NULL, 'initial', 'asked', 'couple', NOW() - INTERVAL '2 hours')`,
    [thread, film],
  );
  const msg = (role: string, bot: boolean, ago: string) =>
    db.query(
      `INSERT INTO public.chat_messages (thread_id, event_id, vendor_profile_id, sender_user_id, sender_role, body, is_bot, created_at)
       VALUES ($1, $2, $3, $4, $5::public.chat_sender_role, 'hi', $6, NOW() - $7::interval)`,
      [thread, event, shop, couple, role, bot, ago],
    );
  await msg('couple', false, '110 minutes');
  await msg('vendor', true, '100 minutes'); // an automatic reply — not the shop's own
  await msg('vendor', false, '90 minutes'); // the shop's own reply: 30 minutes after the ask

  const c = cardOf(await facts(shop), film);
  assert.equal(c.inquiries.length, 1, 'the category-only interest is credited to no card');
  const q = c.inquiries[0]!;
  const minutes = (Date.parse(q.replied_at!) - Date.parse(q.asked_at)) / 60_000;
  assert.ok(Math.abs(minutes - 30) < 1, `timed to the shop's own reply, got ${minutes} min`);
  assert.equal(q.withdrawn, false);
});

test('3 · a shop that does not exist reads as NULL — a failed read, never zero', async () => {
  assert.equal(await facts('00000000-0000-0000-0000-000000000000'), null);
});

test('4 · settle announces a badge ONCE, keeps a lost one on record, lets it be earned again, ignores another shop’s card', async () => {
  const shop = await newShop();
  const other = await newShop();
  const film = await newCard(shop, 'Wedding Film');
  const theirs = await newCard(other, 'Not yours');
  const settle = async (passing: Array<{ card: string; badge: string }>) =>
    (
      await db.query<{ vendor_service_id: string; badge: string; held_since: string; is_new: boolean }>(
        `SELECT * FROM public.service_card_badge_settle($1, $2::jsonb)`,
        [shop, JSON.stringify(passing)],
      )
    ).rows;

  const first = await settle([{ card: film, badge: 'book' }, { card: theirs, badge: 'book' }, { card: film, badge: 'nope' }]);
  assert.deepEqual(first.map((r) => [r.badge, r.is_new]), [['book', true]], 'one new hold — the stranger card and the bad key ignored');

  const again = await settle([{ card: film, badge: 'book' }]);
  assert.deepEqual(again.map((r) => [r.badge, r.is_new]), [['book', false]], 'never announced twice');
  assert.equal(String(again[0]!.held_since), String(first[0]!.held_since), 'the held time keeps running');

  assert.deepEqual(await settle([]), [], 'stopped passing → the medal leaves the row');
  const kept = await db.query<{ held_since: string; lost_at: string | null }>(
    `SELECT held_since, lost_at FROM public.service_card_badge_holds WHERE vendor_service_id = $1 AND badge = 'book'`,
    [film],
  );
  assert.equal(kept.rows.length, 1, 'its time held stays in the shop’s record');
  assert.ok(kept.rows[0]!.lost_at, '…closed, not erased');

  const back = await settle([{ card: film, badge: 'book' }]);
  assert.equal(back.length, 1);
  assert.equal(back[0]!.is_new, true, 'the card can earn it again — and is congratulated again');
  const spans = await db.query(`SELECT 1 FROM public.service_card_badge_holds WHERE vendor_service_id = $1 AND badge = 'book'`, [film]);
  assert.equal(spans.rows.length, 2, 'the old span and the new one, both on record');

  const stranger = await db.query(`SELECT 1 FROM public.service_card_badge_holds WHERE vendor_service_id = $1`, [theirs]);
  assert.equal(stranger.rows.length, 0);
});

test('5 · nothing here is reachable by anon or a signed-in user', async () => {
  const r = await db.query<{ role: string; facts: boolean; settle: boolean; tbl: boolean }>(
    `SELECT r AS role,
            has_function_privilege(r, 'public.service_card_badge_facts(uuid)', 'EXECUTE') AS facts,
            has_function_privilege(r, 'public.service_card_badge_settle(uuid, jsonb)', 'EXECUTE') AS settle,
            has_table_privilege(r, 'public.service_card_badge_holds', 'SELECT') AS tbl
       FROM unnest(ARRAY['anon', 'authenticated']) r`,
  );
  for (const row of r.rows) {
    assert.deepEqual([row.facts, row.settle, row.tbl], [false, false, false], `${row.role} must reach nothing`);
  }
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.service_card_badge_holds'::regclass`,
  );
  assert.equal(rls.rows[0]!.on, true);
});

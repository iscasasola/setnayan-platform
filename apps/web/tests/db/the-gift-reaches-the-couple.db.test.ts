/**
 * THE SETNAYAN GIFT REACHES THE BILL, AND THE COUPLE'S POT — against replayed
 * migrations (20271222508050).
 *
 * ⚖ What each block proves, and why it would otherwise fail SILENTLY:
 *   ① THE ARITHMETIC, on the REAL ladder the migrations seed (which is
 *     production's — tests/db/papic-ladder.expected.ts). The owner's own sanity
 *     numbers are asserted here and nowhere else, so no rung price is re-typed:
 *     ₱20k → 571 · ₱50k → 1,429 · ₱100k → 3,571 · ₱500k → 6,429 · ₱1M → 14,074
 *     · ₱3.35M and above → 50,000, the charge stopping at the 50,000 rung.
 *   ② THE MIRROR — the TS the quote uses and the SQL the bill uses agree at
 *     every amount swept. Two copies of a rule drift; this is the fence.
 *   ③ THE CAP IS CREDITS — reprice the 50,000 rung and the cap is still 50,000
 *     photographs; the 100,000 rung is never on the gift ladder.
 *   ④ THE BILL — a charge on a card that said yes carries the gift BESIDE the
 *     fee (the fee column is untouched), a card that said no / another shop's
 *     card / the first five / an import client carry none, and the order the
 *     supplier pays is fee + gift and names the photos.
 *   ⑤ THE POT — nothing lands until the order is PAID; then exactly the charge's
 *     photos land once in the event's SHARED pot; a second approval lands none.
 *   ⑥ THE FREEZE — once paid, a later price change does not move the gift and
 *     a supplementary charge carries none; nobody can write the gift columns.
 *   ⑦ THE QUOTE'S QUESTION — it names a count only when the bill will carry it.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { bookingFeePhp } from '../../lib/booking-fee';
import {
  GIFT_CAP_CREDITS,
  GIFT_SHARE_OF_FEE_PCT,
  giftLadderFrom,
  setnayanGiftBillClause,
  setnayanGiftForFee,
  type GiftCatalogRow,
  type GiftRung,
  type GiftTierRow,
} from '../../lib/setnayan-gift';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Gift = { credits: number; charge_centavos: number; capped: boolean };

async function sqlGiftForFee(feeCentavos: number): Promise<Gift> {
  const r = await db.query<{ credits: number; charge_centavos: string; capped: boolean }>(
    `SELECT credits, charge_centavos, capped FROM public.setnayan_gift_for_fee($1::bigint)`,
    [feeCentavos],
  );
  const row = r.rows[0]!;
  return { credits: Number(row.credits), charge_centavos: Number(row.charge_centavos), capped: row.capped };
}

async function sqlFeeCentavos(bookingPhp: number): Promise<number> {
  const r = await db.query<{ fee: string }>(
    `SELECT public.booking_fee_centavos($1::bigint) AS fee`,
    [Math.round(bookingPhp * 100)],
  );
  return Number(r.rows[0]!.fee);
}

/** The gift for a BOOKING, the way the bill computes it (fee in SQL, gift in SQL). */
async function sqlGiftForBooking(bookingPhp: number): Promise<Gift> {
  return sqlGiftForFee(await sqlFeeCentavos(bookingPhp));
}

/** The live ladder as the TS reads it — the SAME two tables, no typed price. */
async function tsLadder(): Promise<GiftRung[]> {
  const c = await db.query<GiftCatalogRow>(
    `SELECT service_code, retail_price_php, is_active, retired_at
       FROM public.platform_retail_catalog_v2 WHERE service_code LIKE 'PAPIC_GUEST%'`,
  );
  const t = await db.query<GiftTierRow>(
    `SELECT service_code, points, is_active, is_topup
       FROM public.papic_pass_tiers WHERE service_code LIKE 'PAPIC_GUEST%'`,
  );
  return giftLadderFrom(c.rows, t.rows);
}

async function rungPriceCentavos(credits: number): Promise<number> {
  const r = await db.query<{ p: string }>(
    `SELECT round(c.retail_price_php * 100)::bigint AS p
       FROM public.platform_retail_catalog_v2 c
       JOIN public.papic_pass_tiers t ON t.service_code = c.service_code
      WHERE t.points = $1 AND c.is_active AND t.is_active AND left(c.service_code, 11) = 'PAPIC_GUEST'`,
    [credits],
  );
  assert.equal(r.rows.length, 1, `exactly one live ${credits}-credit rung`);
  return Number(r.rows[0]!.p);
}

// ── fixtures ────────────────────────────────────────────────────────────────

async function newVendor(email: string): Promise<{ vendorProfileId: string; userId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  const userId = u.rows[0]!.id;
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Gift Test Vendor', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [userId],
  );
  return { vendorProfileId: v.rows[0]!.vendor_profile_id, userId };
}

/** A DRAFT card (so no publish rule is in play) — the gift yes/no is the point. */
async function newCard(vendorProfileId: string, gift: boolean): Promise<string> {
  const r = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services
       (vendor_profile_id, category, starting_price_php, includes_setnayan_gift, is_active)
     VALUES ($1, 'photographer', 40000, $2, false) RETURNING vendor_service_id`,
    [vendorProfileId, gift],
  );
  return r.rows[0]!.vendor_service_id;
}

async function newEvent(name: string): Promise<string> {
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
    [name],
  );
  return r.rows[0]!.event_id;
}

async function newBooking(
  eventId: string,
  vendorProfileId: string,
  totalPhp: number,
  opts: { serviceId?: string | null; sourced?: boolean; status?: string } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, service_id)
     VALUES ($1, 'photographer', 'Gift Test Vendor', $4::vendor_status, $2, $3, $5)
     RETURNING vendor_id`,
    [eventId, totalPhp, vendorProfileId, opts.status ?? 'contracted', opts.serviceId ?? null],
  );
  if (opts.sourced !== false) {
    await db.query(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source)
       VALUES ($1, $2, 'explore')`,
      [eventId, vendorProfileId],
    );
  }
  return r.rows[0]!.vendor_id;
}

type OpenResult = { charge_id?: string; status?: string; skipped?: string };

async function openCharge(evId: string): Promise<OpenResult> {
  const r = await db.query<{ result: OpenResult }>(
    `SELECT public.booking_fee_open_lock_charge($1) AS result`,
    [evId],
  );
  return r.rows[0]!.result;
}

/** Burn the vendor's five free bookings so the next one bears a fee. */
async function warmPastFree5(vendorProfileId: string, label: string): Promise<void> {
  for (let i = 1; i <= 5; i += 1) {
    const eventId = await newEvent(`${label}-warm-${i}`);
    const evId = await newBooking(eventId, vendorProfileId, 10_000);
    await openCharge(evId);
  }
}

type ChargeGift = {
  charge_id: string;
  status: string;
  kind: string;
  amount: number;
  offered: boolean;
  credits: number;
  gift: number;
};

async function chargesFor(evId: string): Promise<ChargeGift[]> {
  const r = await db.query<{
    charge_id: string;
    status: string;
    kind: string;
    amount_charged_centavos: string;
    setnayan_gift_offered: boolean;
    gift_credits: number;
    gift_centavos: string;
  }>(
    `SELECT charge_id, status, kind, amount_charged_centavos, setnayan_gift_offered,
            gift_credits, gift_centavos
       FROM public.booking_fee_charges WHERE event_vendor_id = $1 ORDER BY created_at`,
    [evId],
  );
  return r.rows.map((x) => ({
    charge_id: x.charge_id,
    status: x.status,
    kind: x.kind,
    amount: Number(x.amount_charged_centavos),
    offered: x.setnayan_gift_offered,
    credits: Number(x.gift_credits),
    gift: Number(x.gift_centavos),
  }));
}

async function potGrants(eventId: string) {
  const r = await db.query<{ points: number; source: string; order_id: string | null; seat_id: string | null }>(
    `SELECT points, source, order_id, seat_id FROM public.papic_event_point_grants
      WHERE event_id = $1 AND source = 'comp'`,
    [eventId],
  );
  return r.rows;
}

async function grant(chargeId: string, orderId: string) {
  const r = await db.query<{ result: { granted: boolean; reason?: string; credits?: number } }>(
    `SELECT public.booking_fee_grant_setnayan_gift($1, $2) AS result`,
    [chargeId, orderId],
  );
  return r.rows[0]!.result;
}

async function orderFor(chargeId: string) {
  const r = await db.query<{ order_id: string; requested_total_php: string; description: string; status: string }>(
    `SELECT order_id, requested_total_php, description, status::text AS status
       FROM public.orders WHERE service_key = $1`,
    [`vendor_booking_fee__${chargeId}`],
  );
  return r.rows[0] ?? null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

// ── ① THE ARITHMETIC, ON THE REAL LADDER ────────────────────────────────────

test("① the owner's sanity numbers, from the live catalog — nothing re-typed", async () => {
  const expected: Array<[number, number]> = [
    [3_500, 100], // the floor: fee ₱175, 40% ₱70, exactly the 100-credit rung
    [20_000, 571],
    [50_000, 1_429],
    [100_000, 3_571],
    [500_000, 6_429],
    [1_000_000, 14_074],
    [3_350_000, GIFT_CAP_CREDITS],
  ];
  for (const [booking, photos] of expected) {
    const g = await sqlGiftForBooking(booking);
    assert.equal(g.credits, photos, `₱${booking.toLocaleString()} booking → ${photos} photos`);
  }
  // THE FLOOR: one peso below ₱3,500 there is no gift at all, and no charge.
  const below = await sqlGiftForBooking(3_499);
  assert.deepEqual(below, { credits: 0, charge_centavos: 0, capped: false });
});

test('① the charge is 40% of the fee (floored) until the cap, then the 50,000 rung — never more', async () => {
  const capPrice = await rungPriceCentavos(GIFT_CAP_CREDITS);
  for (const booking of [3_500, 20_000, 50_000, 1_000_000, 3_000_000]) {
    const fee = await sqlFeeCentavos(booking);
    const g = await sqlGiftForFee(fee);
    assert.equal(g.charge_centavos, Math.floor((fee * GIFT_SHARE_OF_FEE_PCT) / 100));
    assert.equal(g.capped, false);
  }
  for (const booking of [3_350_000, 5_000_000, 10_000_000]) {
    const g = await sqlGiftForBooking(booking);
    assert.equal(g.credits, GIFT_CAP_CREDITS);
    assert.equal(g.charge_centavos, capPrice, 'above the cap the supplier pays the 50,000 rung, not 40%');
    assert.equal(g.capped, true);
  }
});

// ── ② THE MIRROR ────────────────────────────────────────────────────────────

test('② the TS the quote uses == the SQL the bill uses, at every amount swept', async () => {
  const ladder = await tsLadder();
  assert.ok(ladder.length >= 10, `the replayed gift ladder has rungs (${ladder.length})`);
  assert.equal(ladder[ladder.length - 1]!.credits, GIFT_CAP_CREDITS, 'the top of the gift ladder is 50,000');
  let checked = 0;
  for (let booking = 0; booking <= 4_000_000; booking += booking < 200_000 ? 1_237 : 48_611) {
    const sqlFee = await sqlFeeCentavos(booking);
    const tsFee = Math.round(bookingFeePhp(booking) * 100);
    assert.equal(tsFee, sqlFee, `fee parity at ₱${booking}`);
    const sql = await sqlGiftForFee(sqlFee);
    const ts = setnayanGiftForFee(tsFee, ladder);
    assert.deepEqual(
      { credits: ts.credits, charge_centavos: ts.chargeCentavos, capped: ts.capped },
      sql,
      `gift parity at ₱${booking}`,
    );
    checked += 1;
  }
  assert.ok(checked > 150, `swept ${checked} amounts`);
});

test('② the bill clause the TS mints == the one the SQL mints', async () => {
  const r = await db.query<{ c: string }>(
    `SELECT public.setnayan_gift_bill_clause(250000, 1429, 100000) AS c`,
  );
  assert.equal(r.rows[0]!.c, setnayanGiftBillClause(250_000, 1_429, 100_000));
  assert.equal(
    r.rows[0]!.c,
    ' ₱2,500 + your Setnayan gift for your couple: 1,429 free Papic photos, ₱1,000',
  );
  const odd = await db.query<{ c: string }>(
    `SELECT public.setnayan_gift_bill_clause(1234567, 50000, 1500050) AS c`,
  );
  assert.equal(odd.rows[0]!.c, setnayanGiftBillClause(1_234_567, 50_000, 1_500_050));
});

// ── ③ THE CAP IS CREDITS ────────────────────────────────────────────────────

test('③ reprice the 50,000 rung → the cap is still 50,000 photos, at the NEW price', async () => {
  await db.exec('BEGIN');
  try {
    await db.query(
      `UPDATE public.platform_retail_catalog_v2 SET retail_price_php = retail_price_php + 1000
        WHERE service_code = (SELECT service_code FROM public.papic_pass_tiers WHERE points = 50000 AND is_active LIMIT 1)`,
    );
    const newCap = await rungPriceCentavos(GIFT_CAP_CREDITS);
    const g = await sqlGiftForBooking(10_000_000);
    assert.equal(g.credits, GIFT_CAP_CREDITS);
    assert.equal(g.charge_centavos, newCap);
  } finally {
    await db.exec('ROLLBACK');
  }
});

test('③ the 100,000 rung is on sale but never on the gift ladder', async () => {
  const onSale = await db.query(
    `SELECT 1 FROM public.papic_pass_tiers t JOIN public.platform_retail_catalog_v2 c USING (service_code)
      WHERE t.points = 100000 AND t.is_active AND c.is_active`,
  );
  assert.equal(onSale.rows.length, 1, 'the 100,000 rung is live (the check below is not vacuous)');
  const top = await sqlGiftForBooking(100_000_000);
  assert.equal(top.credits, GIFT_CAP_CREDITS);
});

// ── ④ THE BILL ──────────────────────────────────────────────────────────────

test('④ a card that said YES: the charge carries the gift BESIDE the fee, and the order is fee + gift', async () => {
  const { vendorProfileId } = await newVendor('yes@gift.test');
  await warmPastFree5(vendorProfileId, 'yes');
  const card = await newCard(vendorProfileId, true);
  const eventId = await newEvent('yes-6');
  const evId = await newBooking(eventId, vendorProfileId, 50_000, { serviceId: card });

  const open = await openCharge(evId);
  assert.equal(open.status, 'pending');
  const [c] = await chargesFor(evId);
  assert.ok(c);
  const fee = await sqlFeeCentavos(50_000);
  assert.equal(c.amount, fee, 'amount_charged_centavos STAYS the booking fee alone');
  assert.equal(c.offered, true);
  assert.equal(c.credits, 1_429, '₱50,000 → 1,429 free photos');
  assert.equal(c.gift, Math.floor((fee * 40) / 100), 'the gift costs 40% of the fee');

  // The SQL minter (the path an amended booking takes) bills fee + gift.
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [c.charge_id]);
  const order = await orderFor(c.charge_id);
  assert.ok(order, 'an order exists for the charge');
  assert.equal(Number(order.requested_total_php) * 100, fee + c.gift, 'the supplier pays fee + gift');
  assert.ok(
    order.description.includes(setnayanGiftBillClause(fee, 1_429, c.gift)),
    `the bill names the photos: ${order.description}`,
  );
});

test('④ no gift: a card that said no · another shop’s card · no card · the first five · an import client', async () => {
  const { vendorProfileId } = await newVendor('no@gift.test');
  const other = await newVendor('other@gift.test');
  const noCard = await newCard(vendorProfileId, false);
  const theirs = await newCard(other.vendorProfileId, true);
  const mine = await newCard(vendorProfileId, true);

  // THE FIRST FIVE ARE FREE — "no fee. no gift." — even on a card that said yes.
  for (let i = 1; i <= 5; i += 1) {
    const e = await newEvent(`no-free-${i}`);
    const ev = await newBooking(e, vendorProfileId, 50_000, { serviceId: mine });
    const o = await openCharge(ev);
    assert.equal(o.status, 'waived_free5');
    const [c] = await chargesFor(ev);
    assert.equal(c!.credits, 0, `free booking ${i} carries no gift`);
    assert.equal(c!.gift, 0);
  }

  const cases: Array<[string, string | null, boolean]> = [
    ['card said no', noCard, true],
    ['another shop’s gift card', theirs, true],
    ['no card on the booking', null, true],
    ['an import (vendor-brought) client', mine, false],
  ];
  for (const [label, serviceId, sourced] of cases) {
    const e = await newEvent(`no-${label}`);
    const ev = await newBooking(e, vendorProfileId, 50_000, { serviceId, sourced });
    await openCharge(ev);
    const [c] = await chargesFor(ev);
    assert.ok(c, `${label}: a charge row exists`);
    assert.equal(c.credits, 0, `${label}: no gift`);
    assert.equal(c.gift, 0, `${label}: nothing billed for a gift`);
  }

  // Positive control: the same vendor, past its five, on its own yes card, DOES gift.
  const e = await newEvent('no-control');
  const ev = await newBooking(e, vendorProfileId, 50_000, { serviceId: mine });
  await openCharge(ev);
  assert.equal((await chargesFor(ev))[0]!.credits, 1_429);
});

test('④ below the floor a yes card bills no gift', async () => {
  const { vendorProfileId } = await newVendor('floor@gift.test');
  await warmPastFree5(vendorProfileId, 'floor');
  const card = await newCard(vendorProfileId, true);
  const ev = await newBooking(await newEvent('floor-6'), vendorProfileId, 3_000, { serviceId: card });
  await openCharge(ev);
  const [c] = await chargesFor(ev);
  assert.equal(c!.status, 'pending', 'the fee itself is still billed');
  assert.equal(c!.offered, true);
  assert.equal(c!.credits, 0);
  assert.equal(c!.gift, 0);
});

// ── ⑤ THE POT ───────────────────────────────────────────────────────────────

test('⑤ granted when the money CLEARS — once, into the SHARED pot', async () => {
  const { vendorProfileId } = await newVendor('pot@gift.test');
  await warmPastFree5(vendorProfileId, 'pot');
  const card = await newCard(vendorProfileId, true);
  const eventId = await newEvent('pot-6');
  const evId = await newBooking(eventId, vendorProfileId, 100_000, { serviceId: card });
  await openCharge(evId);
  const [c] = await chargesFor(evId);
  assert.equal(c!.credits, 3_571);
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [c!.charge_id]);
  const order = (await orderFor(c!.charge_id))!;

  // Not paid yet → nothing lands.
  assert.equal((await grant(c!.charge_id, order.order_id)).reason, 'not_cleared');
  assert.deepEqual(await potGrants(eventId), []);

  // The charge settles but the order is not paid → still nothing.
  await db.query(`SELECT public.booking_fee_settle_charge($1, 'manual', $2)`, [c!.charge_id, order.order_id]);
  assert.equal((await grant(c!.charge_id, order.order_id)).reason, 'order_not_paid');
  // Another order id (not this charge's bill) → refused.
  assert.equal((await grant(c!.charge_id, '00000000-0000-0000-0000-000000000000')).reason, 'order_not_paid');

  // The admin approves: the order is paid → the photos land.
  await db.query(`UPDATE public.orders SET status = 'paid' WHERE order_id = $1`, [order.order_id]);
  const g = await grant(c!.charge_id, order.order_id);
  assert.equal(g.granted, true);
  assert.equal(g.credits, 3_571);
  const rows = await potGrants(eventId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.points, 3_571);
  assert.equal(rows[0]!.seat_id, null, 'the SHARED pot, not a camera');
  assert.equal(rows[0]!.order_id, order.order_id, 'tied to the paid bill, so a reversal takes it back');

  const pool = await db.query<{ granted_points: number; applies: boolean }>(
    `SELECT granted_points, applies FROM public.papic_event_pool_status($1)`,
    [eventId],
  );
  assert.equal(pool.rows[0]!.applies, true);
  assert.ok(pool.rows[0]!.granted_points >= 3_571, 'the pot counts the gift');

  // A re-approval lands nothing new.
  assert.equal((await grant(c!.charge_id, order.order_id)).reason, 'already_granted');
  assert.equal((await potGrants(eventId)).length, 1);
});

// ── ⑥ THE FREEZE, AND NOBODY WRITES THE GIFT ────────────────────────────────

test('⑥ pending: a price change re-sizes the gift; paid: it is frozen and a delta carries none', async () => {
  const { vendorProfileId } = await newVendor('freeze@gift.test');
  await warmPastFree5(vendorProfileId, 'freeze');
  const card = await newCard(vendorProfileId, true);
  const eventId = await newEvent('freeze-6');
  const evId = await newBooking(eventId, vendorProfileId, 20_000, { serviceId: card });
  await openCharge(evId);
  assert.equal((await chargesFor(evId))[0]!.credits, 571);

  // The supplier flips the card to NO after the bill opened — the snapshot holds.
  await db.query(`UPDATE public.vendor_services SET includes_setnayan_gift = false WHERE vendor_service_id = $1`, [card]);
  // A price change before payment re-derives the pending fee → the gift follows it.
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 50000 WHERE vendor_id = $1`, [evId]);
  let [c] = await chargesFor(evId);
  assert.equal(c!.offered, true, 'the yes/no is a snapshot, never re-read');
  assert.equal(c!.credits, 1_429, 'pending gift re-sized with the re-derived fee');

  // Paid → frozen.
  await db.query(`SELECT public.booking_fee_settle_charge($1, 'manual', NULL)`, [c!.charge_id]);
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 100000 WHERE vendor_id = $1`, [evId]);
  const all = await chargesFor(evId);
  const primary = all.find((x) => x.kind === 'primary')!;
  assert.equal(primary.status, 'paid');
  assert.equal(primary.credits, 1_429, 'a paid gift does not move');
  const delta = all.find((x) => x.kind === 'amendment_delta');
  assert.ok(delta, 'a price rise after payment opens a supplementary fee charge');
  assert.equal(delta.credits, 0, 'the supplementary charge carries no gift');
  assert.equal(delta.gift, 0);

  // Nobody can write the gift columns directly — the row re-derives them.
  await db.query(
    `UPDATE public.booking_fee_charges SET gift_credits = 99999, gift_centavos = 1, setnayan_gift_offered = false
      WHERE charge_id = $1`,
    [primary.charge_id],
  );
  [c] = (await chargesFor(evId)).filter((x) => x.kind === 'primary');
  assert.equal(c!.credits, 1_429);
  assert.equal(c!.offered, true);
});

// ── ⑦ THE QUOTE'S QUESTION ──────────────────────────────────────────────────

test('⑦ the quote names a count only when the bill will carry it', async () => {
  const { vendorProfileId } = await newVendor('quote@gift.test');
  const yes = await newCard(vendorProfileId, true);
  const no = await newCard(vendorProfileId, false);
  const ask = async (eventId: string) => {
    const r = await db.query<{ a: string }>(`SELECT public.setnayan_gift_quote_applies($1, $2) AS a`, [
      eventId,
      vendorProfileId,
    ]);
    return r.rows[0]!.a;
  };

  assert.equal(await ask(await newEvent('quote-none')), 'no_booking');

  const eNo = await newEvent('quote-no');
  await newBooking(eNo, vendorProfileId, 50_000, { serviceId: no, status: 'considering' });
  assert.equal(await ask(eNo), 'card_says_no');

  const eImport = await newEvent('quote-import');
  await newBooking(eImport, vendorProfileId, 50_000, { serviceId: yes, status: 'considering', sourced: false });
  assert.equal(await ask(eImport), 'not_sourced');

  // A brand-new supplier: the next booking is one of the first five → free → no gift.
  const eFirst = await newEvent('quote-first');
  await newBooking(eFirst, vendorProfileId, 50_000, { serviceId: yes, status: 'considering' });
  assert.equal(await ask(eFirst), 'free_booking');

  // Past the five → the gift is real.
  await warmPastFree5(vendorProfileId, 'quote');
  const eSixth = await newEvent('quote-sixth');
  await newBooking(eSixth, vendorProfileId, 50_000, { serviceId: yes, status: 'considering' });
  assert.equal(await ask(eSixth), 'applies');
});

test('⑦ every new function is server-only — no browser role may call it', async () => {
  const fns = [
    'public.setnayan_gift_for_fee(bigint)',
    'public.setnayan_gift_offered_on(uuid)',
    'public.setnayan_gift_bill_clause(bigint,integer,bigint)',
    'public.booking_fee_grant_setnayan_gift(uuid,uuid)',
    'public.setnayan_gift_quote_applies(uuid,uuid)',
  ];
  for (const fn of fns) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`,
        [role, fn],
      );
      assert.equal(r.rows[0]!.ok, false, `${role} must not EXECUTE ${fn}`);
    }
  }
});

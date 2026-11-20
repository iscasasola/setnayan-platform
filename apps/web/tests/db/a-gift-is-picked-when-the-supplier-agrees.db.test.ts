/**
 * GIFT FOR SERVICES — the supplier picks the couple's gift when they agree. Migration
 * `gifts_picked_when_the_supplier_agrees`, as ruled through 21 Nov (DECISION_LOG): 15 Nov "GIFT FOR SERVICES DESIGN";
 * 16 Nov ee10c425 (gifts are bought as stock first, NEVER on a booking-fee bill); 20 Nov "EVERY BOOKING CARRIES AT LEAST
 * ONE SETNAYAN GIFT — NO EXCEPTIONS"; 21 Nov "OUT OF GIFTS STILL MEANS THEY CAN BUY" · "JUMP TO THE BUY PAGE, THEN BACK"
 * · "A GIFT BOUGHT BY BDO COUNTS ONCE THE PAYMENT IS SENT". One test per claim:
 *
 *   ① THE PHOTO GIFT RETIRES — a new charge is never offered the old "N free Papic photos" gift.
 *   ② AT LEAST ONE GIFT, NO EXCEPTIONS — zero gifts is refused on a billed, a free, an imported and a no-fee booking;
 *      the smallest Papic pack alone always fits, even where there is no fee at all.
 *   ③ THE LIMIT — list prices against this booking's fee; nothing is written on a refusal.
 *   ④ THE OTHER REFUSALS — not agreed · not on sale · a plan the event holds · two plans · a repeat.
 *   ⑤ NEVER ON THE BILL — a pick leaves the booking-fee charge and its order exactly as they were.
 *   ⑥ STOCK FIRST — free stock is taken and held; with neither stock nor a sent payment the answer is `needs_stock`.
 *   ⑦ A SENT STORE PAYMENT COUNTS — a "Waiting for approval" order line covers one pick; an UNSENT one does not;
 *      one line never covers two picks.
 *   ⑧ APPROVED → the pick becomes an ordinary stock hold and lands at the couple's first payment.
 *   ⑨ REFUSED → the pick is cleared (not deleted), holds nothing, and the booking may pick again.
 *   ⑩ REFUNDED → cleared too, unless the gift already reached the couple.
 *   ⑪ THE DRY RUN — the yes asks before it books: judged, nothing written, no agreement needed.
 *   ⑫ SERVER-ONLY — no browser role calls a new function or writes a line; a shop reads only its own lines.
 *
 * Failing first, measured 2026-11-21: run against the migration as it stood before this change (bought on the bill,
 * `no_fee`, no order lines), 11 of 13 are red — ② to ⑫; only the replay and ① pass. (③, ④ and ⑫ are red partly
 * because the four-argument pick did not exist; ②, ⑤–⑪ are red on behaviour.) Sabotage on the new body: dropping the
 * `v_n = 0 → 'none'` refusal turns ② red; dropping the `p.status = 'pending'` + proof test turns ⑦ red (an unsent order
 * counts); dropping the `cleared_at IS NULL` in the unique index turns ⑨'s re-pick red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/** Catalogue codes, one per line (two codes in one array read as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const P1K = 'PAPIC_GUEST_1K';
const PLUS = 'EVENT_PLUS';
const PRO = 'COUPLE_WEBSITE_PRO';
const ULTRA = 'EVENT_ULTRA';

let replay: ReplayResult;
let db: PGlite;
let n = 0;

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<Record<string, unknown>>(sql, params);
  const row = r.rows[0];
  if (!row) throw new Error(`no row: ${sql}`);
  return (row.v ?? Object.values(row)[0]) as T;
}

/** A catalogue LIST price in centavos — read, never typed. */
async function listCentavos(code: string): Promise<number> {
  return Number(
    await one<string>(
      `SELECT round(retail_price_php * 100)::bigint AS v FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
      [code],
    ),
  );
}

async function credits(code: string): Promise<number> {
  return Number(await one<number>(`SELECT points AS v FROM public.papic_pass_tiers WHERE service_code = $1`, [code]));
}

async function newShop(email: string): Promise<string> {
  const userId = await one<string>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id AS v`,
    [email],
  );
  const existing = await db.query<{ vendor_profile_id: string }>(
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`,
    [userId],
  );
  if (existing.rows[0]) {
    await db.query(
      `UPDATE public.vendor_profiles
          SET verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified'
        WHERE vendor_profile_id = $1`,
      [existing.rows[0].vendor_profile_id],
    );
    return existing.rows[0].vendor_profile_id;
  }
  return one<string>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
     VALUES ($1, 'Pick Shop', 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified')
     RETURNING vendor_profile_id AS v`,
    [userId],
  );
}

async function newEvent(): Promise<string> {
  n += 1;
  return one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`, [
    `pick event ${n}`,
  ]);
}

/** A sourced booking of `shop` at `totalPhp`, AGREED, with its primary fee charge opened. */
async function agreedBooking(
  shop: string,
  totalPhp: number,
  opts: { serviceId?: string | null; agreed?: boolean } = {},
): Promise<{ eventId: string; evId: string; chargeId: string | null; chargeStatus: string | null }> {
  const eventId = await newEvent();
  const evId = await one<string>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, service_id, lock_agreed_at)
     VALUES ($1, 'photographer', 'Pick Shop', 'contracted', $2, $3, $4, CASE WHEN $5 THEN NOW() END)
     RETURNING vendor_id AS v`,
    [eventId, totalPhp, shop, opts.serviceId ?? null, opts.agreed !== false],
  );
  await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_source) VALUES ($1, $2, 'explore')`, [
    eventId,
    shop,
  ]);
  const open = await one<{ charge_id?: string; status?: string }>(`SELECT public.booking_fee_open_lock_charge($1) AS v`, [evId]);
  return { eventId, evId, chargeId: open.charge_id ?? null, chargeStatus: open.status ?? null };
}

/** Burn the shop's free bookings so the next one bears a fee. */
async function warm(shop: string): Promise<void> {
  for (let i = 0; i < 5; i += 1) await agreedBooking(shop, 10_000);
}

type Pick = { status: string; from_stock?: number; sent?: number; codes?: string[]; value_centavos?: number; limit_centavos?: number; dry_run?: boolean };
async function pick(evId: string, codes: string[], has: 'none' | 'plus' | 'pro' | 'ultra' = 'none', dryRun = false): Promise<Pick> {
  return one<Pick>(`SELECT public.booking_gift_pick($1, $2::text[], $3, $4) AS v`, [evId, codes, has, dryRun]);
}

type GiftLine = { service_code: string; from_stock: boolean; price_centavos: number; order_line: string | null; cleared: string | null };
async function lines(evId: string): Promise<GiftLine[]> {
  const r = await db.query<{ service_code: string; from_stock: boolean; price_centavos: string; order_line: string | null; cleared: string | null }>(
    `SELECT service_code, from_stock, price_centavos, gift_order_line_id AS order_line, cleared_reason AS cleared
       FROM public.booking_gift_lines WHERE event_vendor_id = $1 ORDER BY created_at, line_id`,
    [evId],
  );
  return r.rows.map((x) => ({ ...x, price_centavos: Number(x.price_centavos) }));
}

async function charge(chargeId: string): Promise<{ amount: number; credits: number; gift: number; offered: boolean }> {
  const r = await db.query<{ amount_charged_centavos: string; gift_credits: number; gift_centavos: string; setnayan_gift_offered: boolean }>(
    `SELECT amount_charged_centavos, gift_credits, gift_centavos, setnayan_gift_offered FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  const c = r.rows[0]!;
  return { amount: Number(c.amount_charged_centavos), credits: Number(c.gift_credits), gift: Number(c.gift_centavos), offered: c.setnayan_gift_offered };
}

async function order(chargeId: string): Promise<{ order_id: string; total: number; description: string } | null> {
  const r = await db.query<{ order_id: string; requested_total_php: string; description: string }>(
    `SELECT order_id, requested_total_php, description FROM public.orders WHERE service_key = $1`,
    [`vendor_booking_fee__${chargeId}`],
  );
  const o = r.rows[0];
  return o ? { order_id: o.order_id, total: Math.round(Number(o.requested_total_php) * 100), description: o.description } : null;
}

async function userOf(shopId: string): Promise<string> {
  return one<string>(`SELECT user_id AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shopId]);
}

/**
 * A "Your gifts" store order for ONE gift (#7923's shape: `vendor_gift__GIFT_CART` + its line), with a payment.
 * `sent` = the payment carries a bank reference (what "Waiting for approval" means); otherwise it was minted and
 * nothing was sent yet ("Not paid yet").
 */
async function storeOrder(shopId: string, code: string, opts: { sent: boolean; qty?: number }): Promise<{ orderId: string; lineId: string }> {
  n += 1;
  const userId = await userOf(shopId);
  const unit = (await listCentavos(code)) / 100;
  const kind = code === PLUS ? 'event_plus' : code === PRO ? 'event_pro' : code === ULTRA ? 'event_ultra' : 'papic';
  const each = kind === 'papic' ? await credits(code) : 1;
  const qty = opts.qty ?? 1;
  const orderId = await one<string>(
    `INSERT INTO public.orders (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES (NULL, $1, $2, 'vendor_gift__GIFT_CART', 'Gifts for your couples', $3, 'submitted', $4) RETURNING order_id AS v`,
    [userId, shopId, unit * qty, `G${n}${Date.now().toString(36).toUpperCase()}`],
  );
  const lineId = await one<string>(
    `INSERT INTO public.shop_gift_order_lines
       (order_id, line_no, vendor_profile_id, service_code, gift_kind, bundle_code, quantity, packs_each,
        credits_per_pack, unit_price_php, price_basis, created_by)
     VALUES ($1, 1, $2, $3, $4, NULL, $5, 1, $6, $7, 'list', $8) RETURNING line_id AS v`,
    [orderId, shopId, code, kind, qty, each, unit, userId],
  );
  await db.query(
    `INSERT INTO public.payments (order_id, user_id, amount_php, channel, paid_at, reference_number)
     VALUES ($1, $2, $3, 'manual', CURRENT_DATE, $4)`,
    [orderId, userId, unit * qty, opts.sent ? `REF${n}` : null],
  );
  return { orderId, lineId };
}

/** The admin approves the store payment (the shipped grant: stock lands, one 'bought' row per line). */
async function approveStore(orderId: string): Promise<void> {
  await db.query(`UPDATE public.payments SET status = 'matched' WHERE order_id = $1`, [orderId]);
  await db.query(`SELECT * FROM public.shop_gift_grant_order_lines($1, NULL)`, [orderId]);
  await db.query(`UPDATE public.orders SET status = 'paid' WHERE order_id = $1`, [orderId]);
}

/** The admin refuses it (rejectPayment's two writes: the payment, then the open order is cancelled). */
async function refuseStore(orderId: string): Promise<void> {
  await db.query(`UPDATE public.payments SET status = 'rejected' WHERE order_id = $1`, [orderId]);
  await db.query(`UPDATE public.orders SET status = 'cancelled' WHERE order_id = $1 AND status = 'submitted'`, [orderId]);
}

async function limitOf(chargeId: string): Promise<number> {
  const pct = Number(await one<number>(`SELECT gift_limit_pct AS v FROM public.platform_settings WHERE id = 1`));
  return Math.floor(((await charge(chargeId)).amount * pct) / 100);
}

async function stockIn(shop: string, code: string, packs: number): Promise<void> {
  const each = await credits(code);
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, pack_code, packs)
     VALUES ($1, 'papic', $2, 'bought', $3, $4)`,
    [shop, packs * each, code, packs],
  );
}

async function packStatus(shop: string, code: string): Promise<{ balance: number; held: number }> {
  const r = await db.query<{ balance: number; held: number }>(
    `SELECT balance, held FROM public.shop_gift_pack_stock_status($1, NULL) WHERE pack_code = $2`,
    [shop, code],
  );
  return { balance: Number(r.rows[0]?.balance ?? 0), held: Number(r.rows[0]?.held ?? 0) };
}

let shop: string;
let otherShop: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  shop = await newShop('pick-shop@gift.test');
  otherShop = await newShop('pick-other@gift.test');
  await warm(shop);
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. gift for services', () => {
  assert.equal(replay.applied, replay.total);
});

test('① the old photo gift retires: a card that said YES opens a charge with no gift', async () => {
  const card = await one<string>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, includes_setnayan_gift, is_active)
     VALUES ($1, 'photographer', 40000, true, false) RETURNING vendor_service_id AS v`,
    [shop],
  );
  const b = await agreedBooking(shop, 100_000, { serviceId: card });
  assert.equal(b.chargeStatus, 'pending');
  const c = await charge(b.chargeId!);
  assert.equal(c.offered, false, 'a new charge is never offered the retired photo gift');
  assert.equal(c.credits, 0);
  assert.equal(c.gift, 0);
});

test('② at least one gift, no exceptions: zero is refused on billed, free, imported and no-fee bookings', async () => {
  const s = await newShop('pick-atleast@gift.test');
  await stockIn(s, P150, 10);
  const free = await agreedBooking(s, 50_000); // the shop's first bookings carry no bill
  await warm(s);
  const billed = await agreedBooking(s, 50_000);
  assert.equal(billed.chargeStatus, 'pending', 'fixture: a billed booking');
  // An imported booking: agreed, no fee charge opened at all.
  const importedEvent = await newEvent();
  const imported = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, lock_agreed_at)
     VALUES ($1, 'photographer', 'Pick Shop', 'contracted', 30000, $2, NOW()) RETURNING vendor_id AS v`,
    [importedEvent, s],
  );
  // A booking with no fee at all (a ₱0 total).
  const zeroEvent = await newEvent();
  const zero = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id, lock_agreed_at)
     VALUES ($1, 'photographer', 'Pick Shop', 'contracted', 0, $2, NOW()) RETURNING vendor_id AS v`,
    [zeroEvent, s],
  );
  for (const [label, evId] of [['billed', billed.evId], ['free', free.evId], ['imported', imported], ['no fee', zero]] as const) {
    assert.equal((await pick(evId, [])).status, 'none', `${label}: zero gifts is refused`);
    assert.equal((await pick(evId, [], 'none', true)).status, 'none', `${label}: the dry run refuses zero too`);
    assert.deepEqual(await lines(evId), [], `${label}: nothing written`);
    const smallest = await one<string>(`SELECT service_code AS v FROM public.shop_gift_smallest_papic_pack()`);
    assert.equal((await pick(evId, [smallest])).status, 'ok', `${label}: the smallest Papic pack alone always fits`);
    assert.equal((await lines(evId)).length, 1);
  }
});

test('③ the limit: list prices against this booking’s fee; a refusal writes nothing', async () => {
  const b = await agreedBooking(shop, 10_000);
  const limit = await limitOf(b.chargeId!);
  const p1k = await listCentavos(P1K);
  assert.ok(p1k > limit, `fixture: one Papic 1000 (${p1k}) is over this booking's limit (${limit})`);
  const over = await pick(b.evId, [P1K]);
  assert.equal(over.status, 'over_limit');
  assert.equal(over.limit_centavos, limit);
  assert.deepEqual(await lines(b.evId), []);
});

test('④ refusals: not agreed · not on sale · a plan the event holds · two plans · a repeat', async () => {
  await stockIn(shop, P150, 5);
  const notAgreed = await agreedBooking(shop, 3_000_000, { agreed: false });
  assert.equal((await pick(notAgreed.evId, [P150])).status, 'not_agreed');
  const b = await agreedBooking(shop, 3_000_000);
  assert.equal((await pick(b.evId, ['NOT_A_GIFT'])).status, 'unknown_pack');
  assert.equal((await pick(b.evId, [PRO], 'pro')).status, 'already_has');
  assert.equal((await pick(b.evId, [PLUS, PRO])).status, 'one_plan');
  assert.deepEqual(await lines(b.evId), []);
  assert.equal((await pick(b.evId, [P150])).status, 'ok');
  assert.equal((await pick(b.evId, [P150])).status, 'already', 'once per booking');
});

test('⑤ never on the bill: the charge and its order are untouched by a pick', async () => {
  const s = await newShop('pick-nobill@gift.test');
  await warm(s);
  await stockIn(s, P150, 3);
  const b = await agreedBooking(s, 3_000_000);
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [b.chargeId]);
  const before = { charge: await charge(b.chargeId!), order: await order(b.chargeId!) };
  const sent = await storeOrder(s, P1K, { sent: true });
  assert.equal((await pick(b.evId, [P150, P1K])).status, 'ok');
  assert.deepEqual(await charge(b.chargeId!), before.charge, 'the charge carries no gift');
  assert.deepEqual(await order(b.chargeId!), before.order, 'the bill is not re-priced or re-worded');
  assert.ok(sent.orderId);
});

test('⑥ stock first, held; nothing in stock and nothing sent → needs_stock with the codes', async () => {
  const s = await newShop('pick-stock@gift.test');
  await warm(s);
  await stockIn(s, P150, 1);
  const b = await agreedBooking(s, 3_000_000);
  const r = await pick(b.evId, [P150, P150]);
  assert.equal(r.status, 'needs_stock');
  assert.deepEqual(r.codes, [P150], 'the gift to buy is named');
  assert.deepEqual(await lines(b.evId), [], 'nothing written');
  assert.equal((await pick(b.evId, [P150])).status, 'ok');
  assert.deepEqual((await lines(b.evId)).map((l) => l.from_stock), [true]);
  assert.deepEqual(await packStatus(s, P150), { balance: 1, held: 1 }, 'the stock pick is held');
});

test('⑦ a SENT store payment covers one pick; an UNSENT one does not; one line never covers two', async () => {
  const s = await newShop('pick-sent@gift.test');
  await warm(s);
  const unsent = await storeOrder(s, P1K, { sent: false });
  const a = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(a.evId, [P1K])).status, 'needs_stock', 'an order nobody paid yet counts for nothing');

  const sent = await storeOrder(s, P1K, { sent: true });
  assert.equal((await pick(a.evId, [P1K], 'none', true)).status, 'ok', 'the dry run sees the sent order');
  assert.equal((await pick(a.evId, [P1K])).status, 'ok');
  const la = await lines(a.evId);
  assert.equal(la.length, 1);
  assert.equal(la[0]!.from_stock, false);
  assert.equal(la[0]!.order_line, sent.lineId, 'the pick names the order line that covers it');

  const b = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(b.evId, [P1K])).status, 'needs_stock', 'that line already covers booking A');
  await assert.rejects(
    db.query(
      `INSERT INTO public.booking_gift_lines (event_vendor_id, event_id, vendor_profile_id, gift_order_line_id, service_code,
         gift_kind, credits, price_centavos, title, from_stock)
       SELECT $1, ev.event_id, $2, $3, $4, 'papic', 1, 1, 'x', FALSE FROM public.event_vendors ev WHERE ev.vendor_id = $1`,
      [b.evId, s, sent.lineId, P1K],
    ),
    /booking_gift_lines_one_pick_per_order_line/,
    'the database itself refuses a second live pick on one order line',
  );
  assert.ok(unsent.lineId);
});

test('⑧ approved: the pick becomes a stock hold and lands at the couple’s first payment', async () => {
  const s = await newShop('pick-approve@gift.test');
  await warm(s);
  const sent = await storeOrder(s, P1K, { sent: true });
  const b = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(b.evId, [P1K])).status, 'ok');
  assert.deepEqual(await packStatus(s, P1K), { balance: 0, held: 0 }, 'nothing landed yet');
  await approveStore(sent.orderId);
  assert.deepEqual((await lines(b.evId)).map((l) => l.from_stock), [true], 'landed: now a stock hold');
  assert.deepEqual(await packStatus(s, P1K), { balance: 1, held: 1 });
  await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [b.evId]);
  const d = await one<{ status: string; credits: number }>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [b.evId]);
  assert.equal(d.status, 'ok');
  assert.equal(d.credits, await credits(P1K));
});

test('⑨ refused: the pick is cleared, holds nothing, and the booking may pick again', async () => {
  const s = await newShop('pick-refuse@gift.test');
  await warm(s);
  const sent = await storeOrder(s, P1K, { sent: true });
  const b = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(b.evId, [P1K])).status, 'ok');
  await refuseStore(sent.orderId);
  const l = await lines(b.evId);
  assert.equal(l.length, 1, 'cleared, never deleted');
  assert.equal(l[0]!.cleared, 'refused');
  assert.deepEqual(await packStatus(s, P1K), { balance: 0, held: 0 });

  const again = await storeOrder(s, P1K, { sent: true });
  assert.equal((await pick(b.evId, [P1K])).status, 'ok', 'a cleared pick is not "already": the booking picks again');
  const live = (await lines(b.evId)).filter((x) => x.cleared === null);
  assert.deepEqual(live.map((x) => x.order_line), [again.lineId]);
});

test('⑩ refunded: cleared unless the gift already reached the couple', async () => {
  const s = await newShop('pick-refund@gift.test');
  await warm(s);
  const one1 = await storeOrder(s, P1K, { sent: true });
  const b = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(b.evId, [P1K])).status, 'ok');
  await approveStore(one1.orderId);
  await db.query(`SELECT public.shop_gift_reverse_order_lines($1, NULL)`, [one1.orderId]);
  assert.equal((await lines(b.evId))[0]!.cleared, 'refunded', 'refunded before it was given: cleared');

  const two = await storeOrder(s, P1K, { sent: true });
  const c = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(c.evId, [P1K])).status, 'ok');
  await approveStore(two.orderId);
  await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [c.evId]);
  assert.equal((await one<{ status: string }>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [c.evId])).status, 'ok');
  await db.query(`UPDATE public.orders SET status = 'refunded' WHERE order_id = $1`, [two.orderId]);
  assert.equal((await lines(c.evId))[0]!.cleared, null, 'already given to the couple: it stays given');
});

test('⑪ the dry run: judged before the yes, nothing written', async () => {
  const s = await newShop('pick-dry@gift.test');
  await warm(s);
  await stockIn(s, P150, 1);
  const b = await agreedBooking(s, 3_000_000, { agreed: false });
  const r = await pick(b.evId, [P150], 'none', true);
  assert.equal(r.status, 'ok');
  assert.equal(r.dry_run, true);
  assert.deepEqual(await lines(b.evId), []);
  assert.deepEqual(await packStatus(s, P150), { balance: 1, held: 0 }, 'nothing held by a dry run');
  assert.equal((await pick(b.evId, [P150])).status, 'not_agreed', 'the real pick still waits for the yes');
});

test('⑫ server-only: no browser role calls a new function or writes a line; a shop reads only its own', async () => {
  for (const fn of [
    'booking_gift_pick(uuid, text[], text, boolean)',
    'shop_gift_sent_order_lines(uuid)',
    'booking_gift_lines_follow_the_store_order(uuid, smallint, text)',
    'booking_gift_lines_on_stock_entry()',
    'booking_gift_lines_on_store_order_closed()',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const can = await one<boolean>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS v`, [role, `public.${fn}`]);
      assert.equal(can, false, `${role} may not call ${fn}`);
    }
  }
  for (const priv of ['INSERT', 'UPDATE', 'DELETE']) {
    const can = await one<boolean>(`SELECT has_table_privilege('authenticated', 'public.booking_gift_lines', $1) AS v`, [priv]);
    assert.equal(can, false, `authenticated may not ${priv}`);
  }
  const rls = await one<boolean>(`SELECT relrowsecurity AS v FROM pg_class WHERE oid = 'public.booking_gift_lines'::regclass`);
  assert.equal(rls, true);

  const other = await userOf(otherShop);
  const mine = await userOf(shop);
  const count = async (uid: string) => {
    await setAuthUid(db, uid);
    await db.exec(`SET ROLE authenticated`);
    try {
      return await one<number>(`SELECT COUNT(*)::int AS v FROM public.booking_gift_lines WHERE vendor_profile_id = $1`, [shop]);
    } finally {
      await db.exec(`RESET ROLE`);
      await setAuthUid(db, null);
    }
  };
  assert.equal(await count(other), 0, 'another shop reads none of these lines');
  assert.ok((await count(mine)) > 0, 'the shop reads its own');
});

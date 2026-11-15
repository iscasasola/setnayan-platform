/**
 * GIFT FOR SERVICES — the supplier picks the couple's gift when they agree (owner 2026-11-15, DECISION_LOG
 * "GIFT FOR SERVICES DESIGN — DECISIONS"). Migration `gifts_picked_when_the_supplier_agrees`. One test per claim:
 *
 *   ① THE PHOTO GIFT RETIRES — a new charge is never offered the old "N free Papic photos" gift, even from a card
 *      that said yes; a charge that already carries it keeps it.
 *   ② THE LIMIT — everything picked is capped at the gift limit of THIS booking's billed fee, at the LIST price read
 *      from the catalogue; the smallest Papic pack alone always fits; nothing is written on a refusal.
 *   ③ THE REFUSALS — not agreed · a code that is not on sale · a plan the event holds · two plans · a repeat
 *      ('already') — and NO BILL (a free booking): only gifts from stock, nothing bought, no bill made (owner 16 Nov).
 *   ④ STOCK FIRST — what the shop holds is taken from its stock (held, costs nothing more, still counts toward the
 *      limit); the rest is BOUGHT on the bill: the charge carries exactly the bought lines, the order is fee + gift
 *      and names the items.
 *   ⑤ A BOUGHT GIFT lands when the supplier's bill is PAID — Papic through the shipped grant door, a plan as a
 *      bought/given pair the entitlement chain reads (once); a plan the event already holds stays in the shop's stock.
 *   ⑥ A STOCK GIFT lands at the couple's FIRST PAYMENT through the shipped stock door — no quote needed.
 *   ⑦ SERVER-ONLY — no browser role calls a new function or writes a line; a shop reads only its own lines.
 *
 * Sabotage, measured on this file (2026-11-15):
 *   • `NEW.setnayan_gift_offered = FALSE` → the old snapshot expression: ① red.
 *   • dropping `v_value > v_limit` from the pick: ② red (an over-limit pick is written).
 *   • dropping the `UPDATE … SET from_stock = TRUE` stock-first step: ④ red (the bill charges a pack the shop held).
 *   • dropping the booking-lines branch from `shop_gift_deliver_for_booking`'s wanted set: ⑥ red.
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

type Pick = { status: string; from_stock?: number; bought_centavos?: number; value_centavos?: number; limit_centavos?: number };
async function pick(evId: string, codes: string[], has: 'none' | 'plus' | 'pro' | 'ultra' = 'none'): Promise<Pick> {
  return one<Pick>(`SELECT public.booking_gift_pick($1, $2::text[], $3) AS v`, [evId, codes, has]);
}

async function lines(evId: string): Promise<Array<{ service_code: string; from_stock: boolean; price_centavos: number; charge_id: string | null }>> {
  const r = await db.query<{ service_code: string; from_stock: boolean; price_centavos: string; charge_id: string | null }>(
    `SELECT service_code, from_stock, price_centavos, charge_id FROM public.booking_gift_lines
      WHERE event_vendor_id = $1 ORDER BY created_at, line_id`,
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

/** The admin approves the supplier's bill: the charge settles and the order is paid. */
async function payBill(chargeId: string): Promise<string> {
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [chargeId]);
  const o = (await order(chargeId))!;
  await db.query(`SELECT public.booking_fee_settle_charge($1, 'manual', $2)`, [chargeId, o.order_id]);
  await db.query(`UPDATE public.orders SET status = 'paid' WHERE order_id = $1`, [o.order_id]);
  return o.order_id;
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
  assert.equal(c.gift, 0, 'nothing is added to the bill without a pick');
});

test('② the limit: list prices against this booking’s billed fee; the smallest pack alone always fits', async () => {
  const b = await agreedBooking(shop, 10_000); // a small fee: its limit is below one Papic 1000
  const limit = await limitOf(b.chargeId!);
  const p1k = await listCentavos(P1K);
  assert.ok(p1k > limit, `fixture: one Papic 1000 (${p1k}) is over this booking's limit (${limit})`);

  const over = await pick(b.evId, [P1K]);
  assert.equal(over.status, 'over_limit');
  assert.equal(over.limit_centavos, limit, 'the limit is the gift limit % of the billed fee');
  assert.deepEqual(await lines(b.evId), [], 'a refused pick writes nothing');

  // The smallest Papic pack, alone, always fits — even above the limit.
  const p150 = await listCentavos(P150);
  const twoSmall = 2 * p150;
  if (twoSmall > limit) assert.equal((await pick(b.evId, [P150, P150])).status, 'over_limit', 'two are not "alone"');
  const ok = await pick(b.evId, [P150]);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.value_centavos, p150, 'counted at the LIST price from the catalogue');
});

test('③ refusals: not agreed · no bill takes stock only · not on sale · a plan the event holds · two plans · a repeat', async () => {
  const notAgreed = await agreedBooking(shop, 3_000_000, { agreed: false });
  assert.equal((await pick(notAgreed.evId, [P150])).status, 'not_agreed');

  // 🎁 No bill (owner 2026-11-16, DECISION_LOG 03e465e1): a free booking may still give from stock — nothing is bought.
  const fresh = await newShop('pick-free@gift.test'); // its first booking is on us → no bill
  const free = await agreedBooking(fresh, 3_000_000);
  assert.notEqual(free.chargeStatus, 'pending', 'fixture: the first booking bears no bill');
  assert.equal((await pick(free.evId, [P150])).status, 'stock_only', 'nothing can be bought where nothing is billed');
  assert.deepEqual(await lines(free.evId), [], 'a refused stock-only pick writes nothing');
  await stockIn(fresh, P150, 1);
  const fromStock = await pick(free.evId, [P150]);
  assert.equal(fromStock.status, 'ok', 'a gift from stock goes on a booking with no bill');
  assert.equal(fromStock.bought_centavos, 0);
  assert.deepEqual((await lines(free.evId)).map((l) => [l.from_stock, l.charge_id]), [[true, null]], 'no bill is made');

  const b = await agreedBooking(shop, 3_000_000);
  assert.equal((await pick(b.evId, ['NOT_A_GIFT'])).status, 'unknown_pack');
  assert.equal((await pick(b.evId, [PLUS], 'pro')).status, 'already_has', 'Plus on a Pro event lands as nothing');
  assert.equal((await pick(b.evId, [PRO], 'ultra')).status, 'already_has');
  assert.equal((await pick(b.evId, [PLUS, PRO])).status, 'one_plan', 'Plus + Pro never make Ultra');
  assert.deepEqual(await lines(b.evId), [], 'no refusal wrote a line');

  assert.equal((await pick(b.evId, [ULTRA], 'pro')).status, 'ok', 'Ultra on a Pro event gives full Ultra');
  assert.equal((await pick(b.evId, [P150])).status, 'already', 'picked once per booking');
  assert.equal((await lines(b.evId)).length, 1);
});

test('④ stock first: held packs cost nothing more; the rest is bought on the bill, which names it', async () => {
  const s = await newShop('pick-stock@gift.test');
  await warm(s);
  await stockIn(s, P1K, 1);
  const b = await agreedBooking(s, 3_000_000);
  const fee = (await charge(b.chargeId!)).amount;
  await db.query(`SELECT public.booking_fee_upsert_vendor_order($1)`, [b.chargeId]); // the bill exists at the yes
  const p1k = await listCentavos(P1K);
  const plus = await listCentavos(PLUS);

  const r = await pick(b.evId, [P1K, P1K, PLUS]);
  assert.equal(r.status, 'ok');
  assert.equal(r.from_stock, 1, 'the one Papic 1000 in stock is used first');
  assert.equal(r.value_centavos, 2 * p1k + plus, 'the stock pack still counts toward the limit');
  assert.equal(r.bought_centavos, p1k + plus, 'only what was not in stock is bought');

  const ls = await lines(b.evId);
  const shape = ls.map((l) => `${l.service_code}:${l.from_stock ? 'stock' : 'bought'}`).sort();
  assert.deepEqual(shape, [`${P1K}:bought`, `${P1K}:stock`, `${PLUS}:bought`].sort());
  assert.equal(ls.filter((l) => l.from_stock).every((l) => l.charge_id === null), true, 'a stock line rides no bill');

  const c = await charge(b.chargeId!);
  assert.equal(c.gift, p1k + plus, 'the charge carries exactly the bought lines');
  assert.equal(c.credits, await credits(P1K), 'its Papic credits are the bought pack’s, granted when the bill is paid');
  const o = (await order(b.chargeId!))!;
  assert.equal(o.total, fee + p1k + plus, 'the supplier pays fee + gift');
  assert.match(o.description, /your Setnayan gift for your couple: 1 × .+ · .+, ₱/, `the bill names the items: ${o.description}`);

  assert.deepEqual(await packStatus(s, P1K), { balance: 1, held: 1 }, 'the stock pack is held for this booking');
  // A re-price of the pending fee keeps the picked gift.
  await db.query(`UPDATE public.booking_fee_charges SET updated_at = NOW() WHERE charge_id = $1`, [b.chargeId]);
  assert.equal((await charge(b.chargeId!)).gift, p1k + plus);
});

test('⑤ a bought gift lands when the supplier’s bill is paid — Papic in the pot, the plan once', async () => {
  const s = await newShop('pick-bought@gift.test');
  await warm(s);
  const b = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(b.evId, [P1K, PRO])).status, 'ok');

  const early = await one<{ status: string }>(`SELECT public.booking_gift_give_bought_plans($1, gen_random_uuid(), 'none') AS v`, [
    b.chargeId,
  ]);
  assert.equal(early.status, 'not_cleared', 'nothing lands before the bill is paid');

  const orderId = await payBill(b.chargeId!);
  const papic = await one<{ granted: boolean; credits: number }>(`SELECT public.booking_fee_grant_setnayan_gift($1, $2) AS v`, [
    b.chargeId,
    orderId,
  ]);
  assert.equal(papic.granted, true);
  assert.equal(papic.credits, await credits(P1K), 'the bought Papic lands through the shipped grant door');

  const g = await one<{ status: string; given: Array<{ unlocks_sku: string }> }>(
    `SELECT public.booking_gift_give_bought_plans($1, $2, 'none') AS v`,
    [b.chargeId, orderId],
  );
  assert.equal(g.status, 'ok');
  assert.deepEqual(g.given.map((x) => x.unlocks_sku), [PRO]);
  const pro = await one<boolean>(`SELECT public.event_has_comp_for_sku($1, $2) AS v`, [b.eventId, PRO]);
  assert.equal(pro, true, 'the entitlement chain reads the bought plan');
  const again = await one<{ status: string }>(`SELECT public.booking_gift_give_bought_plans($1, $2, 'none') AS v`, [
    b.chargeId,
    orderId,
  ]);
  assert.equal(again.status, 'nothing_to_give', 'once per line');
  const net = Number(
    await one<number>(`SELECT COALESCE(SUM(delta), 0) AS v FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1 AND gift_kind = 'event_pro'`, [s]),
  );
  assert.equal(net, 0, 'bought then given: the shop’s stock nets to zero');

  // The event already holds the plan when the bill clears → the shop keeps it.
  const k = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(k.evId, [PLUS])).status, 'ok');
  const kOrder = await payBill(k.chargeId!);
  const kept = await one<{ status: string }>(`SELECT public.booking_gift_give_bought_plans($1, $2, 'pro') AS v`, [k.chargeId, kOrder]);
  assert.equal(kept.status, 'kept_in_stock');
  const plusStock = Number(
    await one<number>(`SELECT COALESCE(SUM(delta), 0) AS v FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1 AND gift_kind = 'event_plus'`, [s]),
  );
  assert.equal(plusStock, 1, 'a plan the event already had is not lost — it is in the shop’s stock');
});

test('⑥ a stock gift lands at the couple’s first payment, with no quote at all', async () => {
  const s = await newShop('pick-first@gift.test');
  await warm(s);
  await stockIn(s, P150, 2);
  const b = await agreedBooking(s, 3_000_000);
  assert.equal((await pick(b.evId, [P150, P150])).status, 'ok');
  assert.equal((await charge(b.chargeId!)).gift, 0, 'all from stock: nothing is added to the bill');

  const before = await one<{ status: string }>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [b.evId]);
  assert.equal(before.status, 'not_paid');
  await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [b.evId]);
  const d = await one<{ status: string; credits: number }>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [b.evId]);
  assert.equal(d.status, 'ok');
  assert.equal(d.credits, 2 * (await credits(P150)));
  assert.deepEqual(await packStatus(s, P150), { balance: 0, held: 0 }, 'given: out of stock, no longer held');
  assert.equal((await one<{ status: string }>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [b.evId])).status, 'already');
});

test('⑦ server-only: no browser role calls a new function or writes a line; a shop reads only its own', async () => {
  for (const fn of [
    'booking_gift_pick(uuid, text[], text)',
    'booking_gift_give_bought_plans(uuid, uuid, text)',
    'booking_gift_bill_clause(uuid)',
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

  const other = await one<string>(`SELECT user_id AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [otherShop]);
  const mine = await one<string>(`SELECT user_id AS v FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [shop]);
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

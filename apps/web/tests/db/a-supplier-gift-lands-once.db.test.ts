/**
 * A SUPPLIER GIFT LANDS ONCE — on the couple's event, when their first payment clears (owner 2026-11-04).
 *
 * Migration `supplier_gifts_stock_quote_lines_and_delivery`. What a unit test cannot see:
 *
 *   1 · SIGN IS TIED TO KIND — a 'given' or 'reversal' row can never mint; a 'bought' row can never drain; zero is
 *       refused; a bought / reversal lands once per order.
 *   2 · HELD — `shop_gift_stock_status` counts what live quotes promise and the event has not received; the event a new
 *       quote replaces can be left out.
 *   3 · THE ONE DOOR — `shop_gift_deliver_for_booking` gives nothing before the first payment, gives the accepted
 *       quote's credits into the SHARED pool (source 'shop_gift') once, answers 'already' on a repeat, and refuses —
 *       writing nothing — when the stock cannot cover it.
 *   4 · RLS — a shop reads only its own stock, purchases and quote gift lines (a couple who is not on the event reads
 *       none); no session writes a row or calls the door.
 *
 *   5 · 💎 EVENT PLUS / EVENT PRO (slice 2, migration `supplier_gifts_event_plus_and_pro`) — counted in units from
 *       their own stock; `shop_gift_deliver_unlocks_for_booking` unlocks the EVENT once (the gifted-access readers
 *       answer for it), a second Plus becomes Pro (owner 2026-11-05), an event that already has Pro takes nothing and
 *       the unit stays in stock, Setnayan AI goes on and the included Papic credits are topped up (never added twice),
 *       and an unlock stops being held once that booking's first payment has cleared.
 *
 * Sabotage (2026-11-04): dropping `AND e.event_id = v_event` from the door's "given" sum turns test 3 red (a second
 * event's gift is answered 'already'); dropping `- COALESCE(gv.credits, 0)` from `held` turns test 2 red.
 *   7 · 🔢 PAPIC COUNTED IN PACKS (migration `gift_bundles_and_papic_packs`, owner 2026-11-14) — stock is held and given
 *       PER PACK (`shop_gift_pack_stock_status`); the door refuses when THAT pack is short even if the credit total would
 *       cover it; a badge reward's Papic lands as Papic 150 packs; a bundle purchase lands its whole count.
 * Sabotage (2026-11-14): dropping `AND e.pack_code = d.pack_code` from the door's balance sum turns test 7 red (a
 * Papic 1000 is given out of Papic 150 stock).
 * Sabotage (2026-11-05): `WHEN v_has = 'plus' THEN 'COUPLE_WEBSITE_PRO'` → `'EVENT_PLUS'` turns test 5 red (two Plus
 * stay Plus); dropping the shop-gift branch of `event_has_comp_for_sku` turns test 5 red (the event is not unlocked).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

/** Catalogue codes, one per line (a code beside another code in one array reads as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const P1K = 'PAPIC_GUEST_1K';
const P3K = 'PAPIC_GUEST';

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

async function giftOrder(userId: string, shop: string): Promise<string> {
  n += 1;
  return one<string>(
    `INSERT INTO public.orders
       (event_id, user_id, vendor_profile_id, service_key, description, requested_total_php, status, reference_code)
     VALUES (NULL, $1, $2, 'vendor_gift__PAPIC_GUEST_1K', 'Gifts for your couples', 449, 'submitted', $3)
     RETURNING order_id AS v`,
    [userId, shop, `G${Date.now().toString(36).toUpperCase()}${n}`],
  );
}

/** 🔢 `packs` Papic 1000 packs into stock (credits = packs × 1000) — or any other pack by `code` / `each`. */
async function stockIn(
  shop: string,
  packs: number,
  orderId: string | null = null,
  code = 'PAPIC_GUEST_1K',
  each = 1000,
): Promise<void> {
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, order_id, pack_code, packs)
     VALUES ($1, 'papic', $2, 'bought', $3, $4, $5)`,
    [shop, packs * each, orderId, code, packs],
  );
}

/** The Papic stock of ONE pack, counted in packs. */
async function packStatus(shop: string, code = 'PAPIC_GUEST_1K', except: string | null = null): Promise<{ balance: number; held: number }> {
  const r = await db.query<{ balance: number; held: number }>(
    `SELECT balance, held FROM public.shop_gift_pack_stock_status($1, $2) WHERE pack_code = $3`,
    [shop, except, code],
  );
  return { balance: Number(r.rows[0]?.balance ?? 0), held: Number(r.rows[0]?.held ?? 0) };
}

async function status(shop: string, except: string | null = null): Promise<{ balance: number; held: number }> {
  return statusOf(shop, 'papic', except);
}

async function statusOf(
  shop: string,
  kind: 'papic' | 'event_plus' | 'event_pro' | 'event_ultra',
  except: string | null = null,
): Promise<{ balance: number; held: number }> {
  const r = await db.query<{ balance: number; held: number }>(
    `SELECT balance, held FROM public.shop_gift_stock_status($1, $2) WHERE gift_kind = $3`,
    [shop, except, kind],
  );
  return { balance: Number(r.rows[0]!.balance), held: Number(r.rows[0]!.held) };
}

/** A couple's event, a booking of `shop` on it, and a quote of `status` carrying `packs` Papic packs (one line each). */
async function bookingWithQuote(
  shop: string,
  quoteStatus: 'sent' | 'accepted',
  packs: number,
  code = 'PAPIC_GUEST_1K',
  each = 1000,
): Promise<{ eventId: string; eventVendorId: string; proposalId: string }> {
  n += 1;
  const eventId = await one<string>(
    `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS v`,
    [`gift event ${n}`],
  );
  const eventVendorId = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php)
     VALUES ($1, 'band_dj', 'Gift Shop', 'considering', $2, 50000) RETURNING vendor_id AS v`,
    [eventId, shop],
  );
  const proposalId = await one<string>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos, valid_until)
     VALUES ($1, $2, 'Quote', $3, CASE WHEN $3 = 'accepted' THEN NOW() END, 5000000, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7) RETURNING proposal_id AS v`,
    [shop, eventId, quoteStatus],
  );
  for (let i = 0; i < packs; i += 1) {
    await db.query(
      `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
       VALUES ($1, $2, $3, 'papic', $4, 499, 'Papic pack')`,
      [proposalId, shop, code, each],
    );
  }
  return { eventId, eventVendorId, proposalId };
}

type Door = { status: string; credits?: number; grant_id?: string; wanted?: number; balance?: number };
async function deliver(eventVendorId: string): Promise<Door> {
  return one<Door>(`SELECT public.shop_gift_deliver_for_booking($1) AS v`, [eventVendorId]);
}

async function pay(eventVendorId: string): Promise<void> {
  await db.query(`UPDATE public.event_vendors SET deposit_acknowledged_at = NOW() WHERE vendor_id = $1`, [
    eventVendorId,
  ]);
}

let coupleUser: string;
let userA: string;
let userB: string;
let shopA: string;
let shopB: string;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await setAuthUid(db, null);
  coupleUser = await newUser('couple-gifts@test.test', 'customer');
  userA = await newUser('shop-a-gifts@test.test', 'vendor');
  userB = await newUser('shop-b-gifts@test.test', 'vendor');
  shopA = await shopOf(userA, 'Gift Shop A');
  shopB = await shopOf(userB, 'Gift Shop B');
});

after(async () => {
  await db?.close();
});

test('replay applies every migration incl. supplier gifts', () => {
  assert.equal(replay.applied, replay.total);
});

test('1 · the sign is tied to the kind; a purchase lands and reverses once', async () => {
  for (const [delta, kind] of [
    [50, 'given'],
    [50, 'reversal'],
    [-50, 'bought'],
  ] as const) {
    await assert.rejects(
      db.query(
        `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'papic', $2, $3)`,
        [shopB, delta, kind],
      ),
      /shop_gift_stock_entries_sign_matches_kind/,
      `a ${kind} row of ${delta} was accepted`,
    );
  }
  await assert.rejects(
    db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'papic', 0, 'bought')`,
      [shopB],
    ),
    /shop_gift_stock_entries_delta_nonzero|shop_gift_stock_entries_sign_matches_kind/,
  );
  const o = await giftOrder(userB, shopB);
  await stockIn(shopB, 1, o);
  await assert.rejects(stockIn(shopB, 1, o), /shop_gift_stock_entries_order_kind_unique|duplicate key/);
  const reverse = () =>
    db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, order_id)
       VALUES ($1, 'papic', -1000, 'reversal', $2)`,
      [shopB, o],
    );
  await reverse();
  await assert.rejects(reverse(), /shop_gift_stock_entries_order_kind_unique|duplicate key/);
  assert.deepEqual(await status(shopB), { balance: 0, held: 0 });
});

test('2 · held counts what live quotes promise and the event has not received', async () => {
  await stockIn(shopA, 3, await giftOrder(userA, shopA));
  const sent = await bookingWithQuote(shopA, 'sent', 1);
  const accepted = await bookingWithQuote(shopA, 'accepted', 1);
  await bookingWithQuote(shopA, 'sent', 0); // a quote with no gift holds nothing
  assert.deepEqual(await status(shopA), { balance: 3000, held: 2000 });
  assert.deepEqual(await packStatus(shopA), { balance: 3, held: 2 }, 'held in PACKS');
  // The event a NEW quote replaces is left out — its old hold must not block the new one.
  assert.deepEqual(await status(shopA, sent.eventId), { balance: 3000, held: 1000 });
  assert.deepEqual(await packStatus(shopA, 'PAPIC_GUEST_1K', sent.eventId), { balance: 3, held: 1 });

  // A gift that landed is no longer held.
  await pay(accepted.eventVendorId);
  assert.equal((await deliver(accepted.eventVendorId)).status, 'ok');
  assert.deepEqual(await status(shopA), { balance: 2000, held: 1000 });
  assert.deepEqual(await packStatus(shopA), { balance: 2, held: 1 });
});

test('3 · 🚨 the door: nothing before payment · once into the shared pool · refuses short without writing', async () => {
  const b = await bookingWithQuote(shopA, 'accepted', 1);
  assert.equal((await deliver(b.eventVendorId)).status, 'not_paid', 'a gift left the stock before any payment');

  await pay(b.eventVendorId);
  const first = await deliver(b.eventVendorId);
  assert.equal(first.status, 'ok');
  assert.equal(first.credits, 1000);
  const grant = await db.query<{ points: number; source: string; seat_id: string | null; event_id: string }>(
    `SELECT points, source, seat_id, event_id FROM public.papic_event_point_grants WHERE grant_id = $1`,
    [first.grant_id],
  );
  assert.equal(grant.rows[0]?.source, 'shop_gift');
  assert.equal(Number(grant.rows[0]?.points), 1000);
  assert.equal(grant.rows[0]?.seat_id, null, 'a supplier gift must land in the SHARED pool');
  assert.equal(grant.rows[0]?.event_id, b.eventId);

  // A repeat (a second door clearing the same payment, a repair sweep) gives nothing more.
  assert.equal((await deliver(b.eventVendorId)).status, 'already');
  const grants = await one<string>(
    `SELECT COUNT(*)::text AS v FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'shop_gift'`,
    [b.eventId],
  );
  assert.equal(grants, '1', 'one payment gave twice');

  // Short: more promised than in stock — refused, and NOTHING written.
  const { balance } = await status(shopA);
  const big = await bookingWithQuote(shopA, 'accepted', (await packStatus(shopA)).balance + 1);
  await pay(big.eventVendorId);
  const short = await deliver(big.eventVendorId);
  assert.equal(short.status, 'short');
  assert.equal(
    await one<string>(`SELECT COUNT(*)::text AS v FROM public.papic_event_point_grants WHERE event_id = $1`, [big.eventId]),
    '0',
    'a refused gift wrote a pool row',
  );
  assert.equal((await status(shopA)).balance, balance, 'a refused gift moved the stock');

  // No gift on the accepted quote → nothing to give.
  const none = await bookingWithQuote(shopA, 'accepted', 0);
  await pay(none.eventVendorId);
  assert.equal((await deliver(none.eventVendorId)).status, 'no_gift');
});

test('4 · 🚨 RLS: own stock only; strangers read nothing; no session writes or delivers', async () => {
  const b = await bookingWithQuote(shopA, 'sent', 1);

  const countAs = async (uid: string, table: string, col: string, val: string): Promise<number> => {
    await setAuthUid(db, uid);
    return Number(await one<string>(`SELECT COUNT(*)::text AS v FROM public.${table} WHERE ${col} = $1`, [val]));
  };

  const ownRows = Number(
    await one<string>(`SELECT COUNT(*)::text AS v FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1`, [shopA]),
  );
  await db.exec(`SET ROLE authenticated`);
  try {
    assert.equal(await countAs(userA, 'shop_gift_stock_entries', 'vendor_profile_id', shopA), ownRows);
    assert.equal(await countAs(userB, 'shop_gift_stock_entries', 'vendor_profile_id', shopA), 0, 'shop B reads shop A’s stock');
    assert.equal(await countAs(userB, 'shop_gift_purchases', 'vendor_profile_id', shopA), 0, 'shop B reads shop A’s purchases');
    assert.equal(await countAs(userB, 'vendor_proposal_shop_gifts', 'proposal_id', b.proposalId), 0, 'shop B reads shop A’s quote gift');
    assert.equal(await countAs(userA, 'vendor_proposal_shop_gifts', 'proposal_id', b.proposalId), 1, 'shop A cannot read its own quote gift');
    assert.equal(await countAs(coupleUser, 'vendor_proposal_shop_gifts', 'proposal_id', b.proposalId), 0, 'a stranger reads a quote gift');
    assert.equal(await countAs(coupleUser, 'shop_gift_stock_entries', 'vendor_profile_id', shopA), 0, 'a couple reads a shop’s stock');

    await setAuthUid(db, userA);
    await assert.rejects(
      db.query(
        `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, 'papic', 9999, 'bought')`,
        [shopA],
      ),
      /permission denied/,
      'a shop minted its own gift stock',
    );
    await assert.rejects(
      db.query(
        `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
         VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 1000, 499, 'x')`,
        [b.proposalId, shopA],
      ),
      /permission denied/,
      'a session wrote a quote gift line past the send action',
    );
    await assert.rejects(
      db.query(`SELECT public.shop_gift_deliver_for_booking($1)`, [b.eventVendorId]),
      /permission denied/,
      'a session called the delivery door',
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});

/* ═══ 5 · 💎 EVENT PLUS / EVENT PRO ═══════════════════════════════════════ */

type UnlockDoor = { status: string; given?: Array<{ gift_kind: string; unlocks_sku: string }>; already_has?: number; short?: number };
async function deliverUnlocks(eventVendorId: string, eventHas: 'none' | 'plus' | 'pro' | 'ultra'): Promise<UnlockDoor> {
  return one<UnlockDoor>(`SELECT public.shop_gift_deliver_unlocks_for_booking($1, $2) AS v`, [eventVendorId, eventHas]);
}

async function unlockStock(shop: string, kind: 'event_plus' | 'event_pro' | 'event_ultra', units: number): Promise<void> {
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind) VALUES ($1, $2, $3, 'bought')`,
    [shop, kind, units],
  );
}

async function addUnlockLine(proposalId: string, shop: string, code: 'EVENT_PLUS' | 'COUPLE_WEBSITE_PRO' | 'EVENT_ULTRA'): Promise<void> {
  const kind = code === 'EVENT_PLUS' ? 'event_plus' : code === 'EVENT_ULTRA' ? 'event_ultra' : 'event_pro';
  const title = code === 'EVENT_PLUS' ? 'Event Plus' : code === 'EVENT_ULTRA' ? 'Event Ultra' : 'Event Pro';
  await db.query(
    `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
     VALUES ($1, $2, $3, $4, 1, 2990, $5)`,
    [proposalId, shop, code, kind, title],
  );
}

const hasComp = (eventId: string, sku: string) =>
  one<boolean>(`SELECT public.event_has_comp_for_sku($1, $2) AS v`, [eventId, sku]);
const compSkus = (eventId: string) => one<string[]>(`SELECT public.event_comp_active_skus($1) AS v`, [eventId]);
const includedOf = async (sku: string) =>
  Number(
    (await db.query<{ n: number | null }>(
      `SELECT included_papic_credits AS n FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
      [sku],
    )).rows[0]?.n ?? 0,
  );
const planIncluded = async (eventId: string) =>
  Number(
    await one<string>(
      `SELECT COALESCE(SUM(points), 0)::text AS v FROM public.papic_event_point_grants WHERE event_id = $1 AND source = 'plan_included'`,
      [eventId],
    ),
  );

test('5 · 💎 Event Plus / Pro: one each, unlocks the event once, a second Plus is Pro, an event with Pro takes nothing', async () => {
  const userC = await newUser('shop-c-gifts@test.test', 'vendor');
  const shopC = await shopOf(userC, 'Gift Shop C');

  // A unit is one: an unlock line of 2 is refused.
  const probe = await bookingWithQuote(shopC, 'sent', 0);
  await assert.rejects(
    db.query(
      `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
       VALUES ($1, $2, 'EVENT_PLUS', 'event_plus', 2, 2990, 'Event Plus')`,
      [probe.proposalId, shopC],
    ),
    /vendor_proposal_shop_gifts_unlock_is_one/,
  );

  await unlockStock(shopC, 'event_plus', 3);
  const b = await bookingWithQuote(shopC, 'accepted', 0);
  await addUnlockLine(b.proposalId, shopC, 'EVENT_PLUS');
  await addUnlockLine(b.proposalId, shopC, 'EVENT_PLUS');

  // Held while the quote waits for its first payment — counted apart from the Papic credits.
  assert.deepEqual(await statusOf(shopC, 'event_plus'), { balance: 3, held: 2 });
  assert.deepEqual(await statusOf(shopC, 'papic'), { balance: 0, held: 0 });
  assert.equal((await deliverUnlocks(b.eventVendorId, 'none')).status, 'not_paid');
  assert.equal(await hasComp(b.eventId, 'EVENT_PLUS'), false);

  await pay(b.eventVendorId);
  const first = await deliverUnlocks(b.eventVendorId, 'none');
  assert.equal(first.status, 'ok');
  assert.deepEqual(
    (first.given ?? []).map((g) => g.unlocks_sku),
    ['EVENT_PLUS', 'COUPLE_WEBSITE_PRO'],
    'the second Event Plus did not become Event Pro',
  );
  assert.equal(await hasComp(b.eventId, 'COUPLE_WEBSITE_PRO'), true, 'the gifted Pro does not unlock the event');
  assert.equal(await hasComp(b.eventId, 'EVENT_PLUS'), true);
  assert.deepEqual([...(await compSkus(b.eventId))].sort(), ['COUPLE_WEBSITE_PRO', 'EVENT_PLUS']);
  // What buying it does: Setnayan AI on, the included credits topped up to Pro's number — never Plus + Pro.
  assert.equal(await one<boolean>(`SELECT setnayan_ai_active AS v FROM public.events WHERE event_id = $1`, [b.eventId]), true);
  assert.equal(await planIncluded(b.eventId), await includedOf('COUPLE_WEBSITE_PRO'));
  // Out of stock, and no longer held once the payment cleared.
  assert.deepEqual(await statusOf(shopC, 'event_plus'), { balance: 1, held: 0 });

  // A repeat gives nothing more.
  const again = await deliverUnlocks(b.eventVendorId, 'pro');
  assert.equal(again.status, 'nothing_to_give');
  assert.equal(await planIncluded(b.eventId), await includedOf('COUPLE_WEBSITE_PRO'));
  assert.equal((await statusOf(shopC, 'event_plus')).balance, 1);

  // An event that already has Event Pro takes nothing — the unit stays the shop's.
  const hasPro = await bookingWithQuote(shopC, 'accepted', 0);
  await addUnlockLine(hasPro.proposalId, shopC, 'EVENT_PLUS');
  await pay(hasPro.eventVendorId);
  const skipped = await deliverUnlocks(hasPro.eventVendorId, 'pro');
  assert.equal(skipped.status, 'nothing_to_give');
  assert.equal(skipped.already_has, 1);
  assert.equal((await statusOf(shopC, 'event_plus')).balance, 1, 'a gift to an event that has Pro left the stock');
  assert.deepEqual(await compSkus(hasPro.eventId), []);

  // Short: an Event Pro with no Pro in stock — nothing written.
  const short = await bookingWithQuote(shopC, 'accepted', 0);
  await addUnlockLine(short.proposalId, shopC, 'COUPLE_WEBSITE_PRO');
  await pay(short.eventVendorId);
  const s = await deliverUnlocks(short.eventVendorId, 'none');
  assert.equal(s.status, 'nothing_to_give');
  assert.equal(s.short, 1);
  assert.equal(await hasComp(short.eventId, 'COUPLE_WEBSITE_PRO'), false);

  // A bad answer about the event is refused, not guessed.
  assert.equal((await deliverUnlocks(short.eventVendorId, 'maybe' as 'none')).status, 'bad_input');

  // No session calls the door.
  await db.exec(`SET ROLE authenticated`);
  try {
    await setAuthUid(db, userC);
    await assert.rejects(
      db.query(`SELECT public.shop_gift_deliver_unlocks_for_booking($1, 'none')`, [short.eventVendorId]),
      /permission denied/,
      'a session called the unlock door',
    );
  } finally {
    await db.exec(`RESET ROLE`);
    await setAuthUid(db, null);
  }
});

/* ═══ 6 · 💎 EVENT ULTRA (owner 2026-11-13: "Gifting Ultra: yes" · on a Plus/Pro event "Gives full Ultra") ══════ */

test('6 · 💎 Event Ultra: a fourth kind; full Ultra on a Pro event, with what Ultra grants; an Ultra event takes nothing', async () => {
  const userD = await newUser('shop-d-gifts@test.test', 'vendor');
  const shopD = await shopOf(userD, 'Gift Shop D');
  await unlockStock(shopD, 'event_ultra', 2);
  assert.deepEqual(await statusOf(shopD, 'event_ultra'), { balance: 2, held: 0 });

  // An Ultra gift reaching an event that already holds Event Pro gives FULL Ultra (owner's ruling).
  const b = await bookingWithQuote(shopD, 'accepted', 0);
  await addUnlockLine(b.proposalId, shopD, 'EVENT_ULTRA');
  assert.deepEqual(await statusOf(shopD, 'event_ultra'), { balance: 2, held: 1 });
  await pay(b.eventVendorId);
  const given = await deliverUnlocks(b.eventVendorId, 'pro');
  assert.equal(given.status, 'ok');
  assert.deepEqual((given.given ?? []).map((g) => g.unlocks_sku), ['EVENT_ULTRA']);

  // A gifted Ultra answers for what Ultra grants (lib/event-ultra.ts EVENT_ULTRA_GRANTS) — the app's aliases read
  // orders only, so without this a gifted Ultra would unlock nothing but its own name.
  for (const sku of ['EVENT_ULTRA', 'COUPLE_WEBSITE_PRO', 'LIVE_STUDIO', 'PATIKTOK_COMPILER']) {
    assert.equal(await hasComp(b.eventId, sku), true, `a gifted Ultra does not unlock ${sku}`);
  }
  assert.equal(await hasComp(b.eventId, 'PAKANTA'), false, 'Ultra never grants Music Maker (staff-made)');
  assert.deepEqual(
    [...(await compSkus(b.eventId))].sort(),
    ['COUPLE_WEBSITE_PRO', 'EVENT_ULTRA', 'LIVE_STUDIO', 'PATIKTOK_COMPILER'],
  );
  // What buying it does: AI on, and the included credits topped up to ULTRA's own row.
  assert.equal(await one<boolean>(`SELECT setnayan_ai_active AS v FROM public.events WHERE event_id = $1`, [b.eventId]), true);
  assert.equal(await planIncluded(b.eventId), await includedOf('EVENT_ULTRA'));
  assert.deepEqual(await statusOf(shopD, 'event_ultra'), { balance: 1, held: 0 });

  // An event that already holds Ultra takes nothing — not Ultra, not Pro, not Plus; the units stay the shop's.
  await unlockStock(shopD, 'event_pro', 1);
  const hasUltra = await bookingWithQuote(shopD, 'accepted', 0);
  await addUnlockLine(hasUltra.proposalId, shopD, 'EVENT_ULTRA');
  await addUnlockLine(hasUltra.proposalId, shopD, 'COUPLE_WEBSITE_PRO');
  await pay(hasUltra.eventVendorId);
  const skipped = await deliverUnlocks(hasUltra.eventVendorId, 'ultra');
  assert.equal(skipped.status, 'nothing_to_give');
  assert.equal(skipped.already_has, 2);
  assert.equal((await statusOf(shopD, 'event_ultra')).balance, 1);
  assert.equal((await statusOf(shopD, 'event_pro')).balance, 1);

  // 🏅 A badge reward may be an Event Ultra (a KIND — no step pays it yet, lib/badge-rewards.ts); it lands as one unit.
  const r = await one<{ status: string }>(
    `SELECT public.shop_badge_reward_grant($1, 'ultra-probe', 'events', 'event_ultra', 1, NULL, NULL) AS v`,
    [shopD],
  );
  assert.equal(r.status, 'granted');
  assert.equal((await statusOf(shopD, 'event_ultra')).balance, 2);
  const reward = (await db.query<{ gift_kind: string; earned: number }>(
    `SELECT gift_kind, earned FROM public.shop_gift_reward_stock_status($1) WHERE gift_kind = 'event_ultra'`,
    [shopD],
  )).rows[0];
  assert.equal(Number(reward?.earned), 1);

  // 📦 A gifted Ultra keeps originals as long as a bought one: the clock reads the gift's row too.
  const keep = Number(
    await one<string>(
      `SELECT COALESCE(fullres_extra_keep_days, 0)::text AS v FROM public.platform_retail_catalog_v2 WHERE service_code = 'EVENT_ULTRA'`,
    ),
  );
  assert.ok(keep > 0, 'the Ultra row keeps originals longer');
  const clockSrc = await one<string>(`SELECT pg_get_functiondef('public.papic_events_past_fullres_clock(integer,integer)'::regprocedure) AS v`);
  assert.match(clockSrc, /shop_gift_stock_entries/, 'the originals clock does not read a gifted plan');
});

test('7 · 🔢 Papic counted in packs: held and given per pack; a short pack refuses even when the credits would cover it', async () => {
  const uE = await newUser('shop-e-gifts@test.test', 'vendor');
  const shopE = await shopOf(uE, 'Gift Shop E');
  // 20 × Papic 150 = 3,000 credits — exactly one Papic 3000's worth, and still NOT a Papic 1000.
  await stockIn(shopE, 20, await giftOrder(uE, shopE), 'PAPIC_GUEST_150', 150);
  assert.deepEqual(await packStatus(shopE, 'PAPIC_GUEST_150'), { balance: 20, held: 0 });
  const wants1k = await bookingWithQuote(shopE, 'accepted', 1, 'PAPIC_GUEST_1K', 1000);
  await pay(wants1k.eventVendorId);
  const short = await deliver(wants1k.eventVendorId);
  assert.equal(short.status, 'short', 'a Papic 1000 was given out of Papic 150 stock');
  assert.equal((await status(shopE)).balance, 3000, 'a refused gift moved the stock');

  // Two Papic 150 lines: given as 2 packs, 300 credits into the pool, one given row naming the pack.
  const two = await bookingWithQuote(shopE, 'accepted', 2, 'PAPIC_GUEST_150', 150);
  assert.deepEqual(await packStatus(shopE, 'PAPIC_GUEST_150'), { balance: 20, held: 2 });
  await pay(two.eventVendorId);
  const ok = await deliver(two.eventVendorId);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.credits, 300);
  const given = await db.query<{ pack_code: string; packs: number; delta: number }>(
    `SELECT pack_code, packs, delta FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1 AND event_id = $2 AND kind = 'given'`,
    [shopE, two.eventId],
  );
  assert.deepEqual(given.rows.map((r) => [r.pack_code, Number(r.packs), Number(r.delta)]), [['PAPIC_GUEST_150', -2, -300]]);
  assert.deepEqual(await packStatus(shopE, 'PAPIC_GUEST_150'), { balance: 18, held: 0 });
  assert.equal((await deliver(two.eventVendorId)).status, 'already');

  // 🏅 A badge reward's Papic lands as Papic 150 packs (the smallest pack on sale), one per unit.
  const r = await one<{ status: string }>(
    `SELECT public.shop_badge_reward_grant($1, 'packs-probe', 'events', 'papic', 2, 150, NULL) AS v`,
    [shopE],
  );
  assert.equal(r.status, 'granted');
  const rewardRow = await db.query<{ pack_code: string; packs: number }>(
    `SELECT pack_code, packs FROM public.shop_gift_stock_entries WHERE vendor_profile_id = $1 AND kind = 'badge_reward'`,
    [shopE],
  );
  assert.deepEqual(rewardRow.rows.map((x) => [x.pack_code, Number(x.packs)]), [['PAPIC_GUEST_150', 2]]);
  assert.deepEqual(await packStatus(shopE, 'PAPIC_GUEST_150'), { balance: 20, held: 0 });

  // A pack row must say which pack and how many, signed like its credits.
  await assert.rejects(
    db.query(
      `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, pack_code, packs) VALUES ($1, 'papic', 150, 'bought', 'PAPIC_GUEST_150', -1)`,
      [shopE],
    ),
    /shop_gift_stock_entries_packs_shape/,
  );
});

test('8 · 📦 the three bundles are catalogue rows that say which pack and how many; a purchase may record a bundle', async () => {
  const rows = await db.query<{ service_code: string; bundle_of_service_code: string; bundle_quantity: number; retail_price_php: string; is_active: boolean }>(
    `SELECT service_code, bundle_of_service_code, bundle_quantity, retail_price_php, is_active
       FROM public.platform_retail_catalog_v2 WHERE bundle_of_service_code IS NOT NULL ORDER BY retail_price_php`,
  );
  assert.deepEqual(
    rows.rows.map((r) => [r.service_code, r.bundle_of_service_code, Number(r.bundle_quantity), Number(r.retail_price_php), r.is_active]),
    [
      ['GIFT_BUNDLE_PAPIC_150', P150, 11, 990, true],
      ['GIFT_BUNDLE_PAPIC_1K', P1K, 11, 4990, true],
      ['GIFT_BUNDLE_PAPIC_3000', P3K, 11, 9990, true],
    ],
  );
  // Readable like the rest of the catalogue's public columns.
  for (const role of ['anon', 'authenticated']) {
    const ok = await one<boolean>(
      `SELECT has_column_privilege($1, 'public.platform_retail_catalog_v2', 'bundle_quantity', 'SELECT') AS v`,
      [role],
    );
    assert.equal(ok, true, `${role} reads what a bundle holds`);
  }
  // A bundle row must name a pack and a count of at least 2.
  await assert.rejects(
    db.query(`UPDATE public.platform_retail_catalog_v2 SET bundle_quantity = 1 WHERE service_code = 'GIFT_BUNDLE_PAPIC_1K'`),
    /platform_retail_catalog_v2_bundle_shape/,
  );
  // price_basis 'bundle' is accepted on a purchase.
  const uF = await newUser('shop-f-gifts@test.test', 'vendor');
  const shopF = await shopOf(uF, 'Gift Shop F');
  const order = await giftOrder(uF, shopF);
  await db.query(
    `INSERT INTO public.shop_gift_purchases (order_id, vendor_profile_id, service_code, gift_kind, quantity, credits_each, unit_price_php, price_basis, packs_each, bundle_code)
     VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', 1, 11000, 4990, 'bundle', 11, 'GIFT_BUNDLE_PAPIC_1K')`,
    [order, shopF],
  );
});

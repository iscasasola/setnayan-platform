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
 * Sabotage (2026-11-04): dropping `AND e.event_id = v_event` from the door's "given" sum turns test 3 red (a second
 * event's gift is answered 'already'); dropping `- COALESCE(gv.credits, 0)` from `held` turns test 2 red.
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

async function stockIn(shop: string, credits: number, orderId: string | null = null): Promise<void> {
  await db.query(
    `INSERT INTO public.shop_gift_stock_entries (vendor_profile_id, gift_kind, delta, kind, order_id)
     VALUES ($1, 'papic', $2, 'bought', $3)`,
    [shop, credits, orderId],
  );
}

async function status(shop: string, except: string | null = null): Promise<{ balance: number; held: number }> {
  const r = await db.query<{ balance: number; held: number }>(
    `SELECT balance, held FROM public.shop_gift_stock_status($1, $2)`,
    [shop, except],
  );
  return { balance: Number(r.rows[0]!.balance), held: Number(r.rows[0]!.held) };
}

/** A couple's event, a booking of `shop` on it, and a quote of `status` carrying `credits` of gift. */
async function bookingWithQuote(
  shop: string,
  quoteStatus: 'sent' | 'accepted',
  credits: number,
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
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, resolved_at, total_centavos)
     VALUES ($1, $2, 'Quote', $3, CASE WHEN $3 = 'accepted' THEN NOW() END, 5000000) RETURNING proposal_id AS v`,
    [shop, eventId, quoteStatus],
  );
  if (credits > 0) {
    await db.query(
      `INSERT INTO public.vendor_proposal_shop_gifts (proposal_id, vendor_profile_id, service_code, gift_kind, credits, srp_php, title)
       VALUES ($1, $2, 'PAPIC_GUEST_1K', 'papic', $3, 499, 'Papic 1000')`,
      [proposalId, shop, credits],
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
  await stockIn(shopB, 1000, o);
  await assert.rejects(stockIn(shopB, 1000, o), /shop_gift_stock_entries_order_kind_unique|duplicate key/);
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
  await stockIn(shopA, 3000, await giftOrder(userA, shopA));
  const sent = await bookingWithQuote(shopA, 'sent', 1000);
  const accepted = await bookingWithQuote(shopA, 'accepted', 150);
  await bookingWithQuote(shopA, 'sent', 0); // a quote with no gift holds nothing
  assert.deepEqual(await status(shopA), { balance: 3000, held: 1150 });
  // The event a NEW quote replaces is left out — its old hold must not block the new one.
  assert.deepEqual(await status(shopA, sent.eventId), { balance: 3000, held: 150 });

  // A gift that landed is no longer held.
  await pay(accepted.eventVendorId);
  assert.equal((await deliver(accepted.eventVendorId)).status, 'ok');
  assert.deepEqual(await status(shopA), { balance: 2850, held: 1000 });
});

test('3 · 🚨 the door: nothing before payment · once into the shared pool · refuses short without writing', async () => {
  const b = await bookingWithQuote(shopA, 'accepted', 1000);
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
  const big = await bookingWithQuote(shopA, 'accepted', balance + 1);
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
  const b = await bookingWithQuote(shopA, 'sent', 150);

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

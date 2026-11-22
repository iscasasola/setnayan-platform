/**
 * 💝 A SHOP'S GIFT BOUGHT THROUGH APPLE LANDS LIKE A WEB GIFT (owner 2026-11-04, "they can purchase inside apple as
 * well"; controller 22 Nov: the App Store submit waits on it).
 *
 * Against the REPLAYED schema with the REAL production modules (lib/iap/fulfil.server.ts, lib/sku-activation.ts):
 *
 *   1 · A Papic gift: ONE paid iOS order keyed `vendor_gift__<code>` on the SHOP (no event), the `shop_gift_purchases`
 *       row a web gift order carries (one gift, list basis, what Apple charged), and ONE pack in the shop's stock —
 *       through the web gift's own activation hook. The same transaction again is still one order and one pack.
 *   2 · An Event Plus gift lands one Event Plus unit — the web's unlock stock.
 *   3 · Apple's refund takes the gift back out of the stock (the web gift's reversal hook).
 *   4 · Never crossed: a gift transaction on a couple's intent is refused, and the intent writer refuses a gift for an
 *       event or a couple product for a shop. A shop deleted after it bought is refused as 'no_shop', never landed.
 *   5 · Every gift product is a LIVE catalogue row the web gift store sells (active, not retired) — and a Papic gift's
 *       credits are its tier's.
 *
 * Apple is not called: the transaction is the fixture's VERIFIED transaction (lib/iap/apple-jws-fixture.ts) with this
 * test's product and token — the verification itself is held by an-app-store-purchase-is-one-order.db.test.ts.
 *
 * 🛡 Sabotaged 2026-11-22, each red then restored (PR body): dropping the `shop_gift_purchases` insert from the
 * fulfilment turns 1 red (no stock lands); writing the order with `vendorProfileId: null` turns 1 red.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import { FIXTURE_ROOTS, fixtureJws } from '../../lib/iap/apple-jws-fixture';
import { verifyAppleTransaction, type AppleTransaction } from '../../lib/iap/apple-transaction';
import { IAP_SUPPLIER_GIFT_PRODUCTS, iapProductById, iapSupplierGiftProductForCode } from '../../lib/iap/products';
import { shopGiftKindOf } from '../../lib/shop-gifts';

/** Catalogue codes, one per line (two codes side by side read as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const PLUS = 'EVENT_PLUS';

let replay: ReplayResult;
let db: PGlite;
let admin: SupabaseClient;
let fulfil: typeof import('../../lib/iap/fulfil.server');
let seq = 0;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db);
  fulfil = await import('../../lib/iap/fulfil.server');
});
after(async () => {
  await db?.close();
});

async function newShop(): Promise<{ userId: string; shop: string }> {
  const n = seq++;
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','vendor')) RETURNING id`,
    [`iap-gift-${n}@example.test`],
  );
  const userId = u.rows[0]!.id;
  const existing = await db.query<{ vendor_profile_id: string }>(`SELECT vendor_profile_id FROM public.vendor_profiles WHERE user_id = $1`, [userId]);
  const shop =
    existing.rows[0]?.vendor_profile_id ??
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services)
         VALUES ($1, $2, 'Manila', ARRAY['photography']::text[]) RETURNING vendor_profile_id`,
        [userId, `Gift Shop ${n}`],
      )
    ).rows[0]!.vendor_profile_id;
  return { userId, shop };
}

/** The fixture's verified transaction, as THIS product, THIS token and a fresh transaction id, at `php` pesos. */
function giftTx(code: string, token: string, php: number): AppleTransaction {
  const v = verifyAppleTransaction(fixtureJws('txPapic'), FIXTURE_ROOTS);
  assert.ok(v.ok, 'the fixture must verify against the test root');
  const product = iapSupplierGiftProductForCode(code);
  assert.ok(product, `no gift product sells ${code}`);
  const id = `30000000000${String(seq++).padStart(5, '0')}`;
  return {
    ...v.tx,
    product,
    appAccountToken: token,
    transactionId: id,
    originalTransactionId: id,
    priceMilliunits: php * 1000,
    currency: 'PHP',
    revocationDate: null,
    revocationReason: null,
  };
}

async function shopIntent(userId: string, shop: string, code: string): Promise<string> {
  const r = await fulfil.createPurchaseIntent(admin, { userId, vendorProfileId: shop, product: iapSupplierGiftProductForCode(code)! });
  assert.ok(r.ok, 'the shop intent was not written');
  return r.token;
}

const ordersOf = async (shop: string) =>
  (
    await db.query<{ order_id: string; status: string; platform: string; service_key: string; event_id: string | null }>(
      `SELECT order_id, status::text AS status, platform, service_key, event_id FROM public.orders WHERE vendor_profile_id = $1`,
      [shop],
    )
  ).rows;

const packBalance = async (shop: string, code: string) =>
  Number(
    (await db.query<{ balance: number }>(`SELECT balance FROM public.shop_gift_pack_stock_status($1, NULL) WHERE pack_code = $2`, [shop, code]))
      .rows[0]?.balance ?? 0,
  );

const unitBalance = async (shop: string, kind: string) =>
  Number(
    (await db.query<{ balance: number }>(`SELECT balance FROM public.shop_gift_stock_status($1, NULL) WHERE gift_kind = $2`, [shop, kind]))
      .rows[0]?.balance ?? 0,
  );

test('1 · a Papic gift is ONE paid iOS gift order on the shop, its gift row, and ONE pack in stock — once', async () => {
  const { userId, shop } = await newShop();
  const token = await shopIntent(userId, shop, P150);
  const t = giftTx(P150, token, 99);

  const out = await fulfil.fulfilAppleTransaction(admin, t, { expectUserId: userId });
  assert.equal(out.status, 'on', JSON.stringify(out));
  assert.ok(out.status === 'on' && out.eventId === null && out.vendorProfileId === shop, 'a gift is reported as the shop’s, with no event');

  const orders = await ordersOf(shop);
  assert.equal(orders.length, 1);
  assert.deepEqual(
    { status: orders[0]!.status, platform: orders[0]!.platform, key: orders[0]!.service_key, event: orders[0]!.event_id },
    { status: 'paid', platform: 'ios', key: `vendor_gift__${P150}`, event: null },
  );
  const row = await db.query<{ quantity: number; credits_each: number; packs_each: number; price_basis: string; unit: string; kind: string }>(
    `SELECT quantity, credits_each, packs_each, price_basis, unit_price_php::text AS unit, gift_kind AS kind
       FROM public.shop_gift_purchases WHERE order_id = $1`,
    [orders[0]!.order_id],
  );
  assert.deepEqual(row.rows[0], { quantity: 1, credits_each: 150, packs_each: 1, price_basis: 'list', unit: '99.00', kind: 'papic' });
  assert.equal(await packBalance(shop, P150), 1, 'the gift did not land in the shop’s stock');

  const again = await fulfil.fulfilAppleTransaction(admin, t);
  assert.equal(again.status, 'on');
  assert.equal(again.status === 'on' && again.activatedNow, false, 'a repeat must never re-run activation');
  assert.equal((await ordersOf(shop)).length, 1);
  assert.equal(await packBalance(shop, P150), 1, 'a repeat landed a second pack');
});

test('2 · an Event Plus gift lands ONE Event Plus unit', async () => {
  const { userId, shop } = await newShop();
  const token = await shopIntent(userId, shop, PLUS);
  const out = await fulfil.fulfilAppleTransaction(admin, giftTx(PLUS, token, 2990), { expectUserId: userId });
  assert.equal(out.status, 'on', JSON.stringify(out));
  assert.equal((await ordersOf(shop))[0]!.service_key, `vendor_gift__${PLUS}`);
  assert.equal(await unitBalance(shop, 'event_plus'), 1);
});

test('3 · Apple’s refund takes the gift back out of the stock', async () => {
  const { userId, shop } = await newShop();
  const token = await shopIntent(userId, shop, P150);
  const t = giftTx(P150, token, 99);
  assert.equal((await fulfil.fulfilAppleTransaction(admin, t, { expectUserId: userId })).status, 'on');
  assert.equal(await packBalance(shop, P150), 1);
  const r = await fulfil.revokeAppleTransaction(admin, { ...t, revocationDate: new Date(), revocationReason: 1 }, 'REFUND');
  assert.deepEqual(r, { status: 'revoked' });
  assert.equal((await ordersOf(shop))[0]!.status, 'refunded');
  assert.equal(await packBalance(shop, P150), 0, 'refund the money, keep the gift — never');
});

test('4 · never crossed: a gift is a shop’s only, a couple product is never a shop’s, a deleted shop takes nothing', async () => {
  const { userId, shop } = await newShop();
  const gift = iapSupplierGiftProductForCode(P150)!;
  const couplePack = iapProductById('com.setnayan.app.papic_pack_150')!;
  // The writer refuses both crossings.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, slug) VALUES ('Ana & Ben', 'birthday', $1) RETURNING event_id`,
    [`iap-gift-ev-${seq++}`],
  );
  const eventId = ev.rows[0]!.event_id;
  assert.deepEqual(await fulfil.createPurchaseIntent(admin, { userId, eventId, product: gift }), { ok: false });
  assert.deepEqual(await fulfil.createPurchaseIntent(admin, { userId, vendorProfileId: shop, product: couplePack }), { ok: false });

  // A gift transaction on a COUPLE's intent (written by hand, as an old row would be) is refused.
  const token = (
    await db.query<{ t: string }>(
      `INSERT INTO public.app_store_purchases (user_id, event_id, product_id, service_key)
       VALUES ($1, $2, $3, $4) RETURNING app_account_token AS t`,
      [userId, eventId, gift.productId, P150],
    )
  ).rows[0]!.t;
  const crossed = await fulfil.fulfilAppleTransaction(admin, giftTx(P150, token, 99), { expectUserId: userId });
  assert.deepEqual(crossed, { status: 'refused', reason: 'no_shop' });

  // A shop deleted after it bought: SET NULL on the intent, and the gift is refused — never landed elsewhere.
  const gone = await newShop();
  const goneToken = await shopIntent(gone.userId, gone.shop, P150);
  await db.query(`UPDATE public.app_store_purchases SET vendor_profile_id = NULL WHERE app_account_token = $1`, [goneToken]);
  const refused = await fulfil.fulfilAppleTransaction(admin, giftTx(P150, goneToken, 99));
  assert.deepEqual(refused, { status: 'refused', reason: 'no_shop' });
  assert.equal((await ordersOf(gone.shop)).length, 0);
});

test('5 · every gift product is a LIVE catalogue row the web gift store sells, and a Papic gift’s credits are its tier’s', async () => {
  for (const p of IAP_SUPPLIER_GIFT_PRODUCTS) {
    assert.ok(shopGiftKindOf(p.serviceKey), `${p.productId} sells ${p.serviceKey}, which is not a gift on the web`);
    const r = await db.query<{ is_active: boolean; retired: boolean }>(
      `SELECT is_active, retired_at IS NOT NULL AS retired FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
      [p.serviceKey],
    );
    assert.equal(r.rows.length, 1, `${p.productId}: no catalogue row ${p.serviceKey}`);
    assert.deepEqual(r.rows[0], { is_active: true, retired: false }, `${p.productId}: ${p.serviceKey} is not on sale`);
    if (p.credits !== null) {
      const t = await db.query<{ points: number }>(`SELECT points FROM public.papic_pass_tiers WHERE service_code = $1`, [p.serviceKey]);
      assert.equal(Number(t.rows[0]?.points), p.credits, `${p.productId} promises ${p.credits} credits; the tier grants ${t.rows[0]?.points}`);
    }
  }
});

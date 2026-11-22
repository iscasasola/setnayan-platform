/**
 * 💝 A SHOP'S GIFT IS BOUGHT IN THE APP LIKE A WEB GIFT — the three rules the App Store submission rests on
 * (controller 22 Nov, owner 4 Nov "they can purchase inside apple as well"):
 *
 *   1 · Every `gift_*` product sells a catalogue code the WEB gift store sells (Papic 150 · 1000 · 3000, Event Plus ·
 *       Pro · Ultra) — so an Apple gift can always be delivered exactly like a web gift. Live Watch, Music Maker and
 *       Patiktok are not gifts on the web. (That each code is a LIVE row is the DB test's test 5:
 *       tests/db/a-shop-gift-bought-through-apple-lands-like-a-web-gift.db.test.ts.)
 *   2 · No retired product is sold or asked of StoreKit, and no retired id is named outside the products file.
 *   3 · Inside the app the gift store shows no web price and no GCash / BDO: the web's priced Add 1 / Add 10 + 1 and its
 *       BDO order only when `canBuy` (= not the store shell); in the app Apple's prices, and the cart pays LINE BY LINE.
 *   4 · A gift line is ONE Apple purchase (owner 2026-11-22): quantity 1–10 (couple products exactly 1); a 10 + 1 bundle
 *       is bought as its paid count and lands its catalogue count; delivery follows the quantity APPLE signed.
 *
 * 🛡 Sabotaged 2026-11-22, each red then restored (PR body): re-adding `gift_live_watch` turns 1 red; re-adding
 * `gift_music_maker` to the gift list turns 2 red; drawing the app's foot without `apple ?` turns 3 red; letting a couple
 * product through at quantity 2 turns 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments';
import { IAP_PAPIC_PRODUCTS, IAP_PRODUCT_IDS, IAP_SUPPLIER_GIFT_PRODUCTS, RETIRED_IAP_PRODUCT_IDS } from './products';
import { RETIRED_EVENT_PRODUCT_IDS, RETIRED_PAPIC_CREDIT_PRODUCT_IDS } from './products-delivery';
import { SHOP_GIFT_UNLOCK_CODE, shopGiftKindOf } from '../shop-gifts';
import { appleCanAdd, appleCartLines, appleGiftDelivery, appleMostOf, bundlePaidCount } from './apple-gift-lines';
import { APP_BUNDLE_ID, chargedPhp, readAppleTransaction } from './apple-transaction';
import { hasStoreQuantity } from './iap-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(relative(WEB, full));
  }
  return out;
}

test('1 · every gift_* product sells a code the WEB gift store sells — nothing the web cannot deliver', () => {
  const webGiftCodes = new Set([...IAP_PAPIC_PRODUCTS.map((p) => p.serviceKey), ...Object.values(SHOP_GIFT_UNLOCK_CODE)]);
  assert.ok(IAP_SUPPLIER_GIFT_PRODUCTS.length > 0);
  for (const p of IAP_SUPPLIER_GIFT_PRODUCTS) {
    assert.match(p.productId, /^com\.setnayan\.app\.gift_[a-z0-9_]+$/, `${p.productId} is not a gift id`);
    assert.equal(p.kind, 'supplier-gift', `${p.productId} is not a shop gift`);
    assert.ok(shopGiftKindOf(p.serviceKey), `${p.productId} sells ${p.serviceKey}, which is not a gift on the web`);
    assert.ok(webGiftCodes.has(p.serviceKey), `${p.productId} sells ${p.serviceKey}, which the web gift store does not sell`);
  }
  // One gift product per web gift — none missing, none twice.
  assert.deepEqual(
    [...new Set(IAP_SUPPLIER_GIFT_PRODUCTS.map((p) => p.serviceKey))].sort(),
    [...webGiftCodes].sort(),
  );
  assert.equal(new Set(IAP_SUPPLIER_GIFT_PRODUCTS.map((p) => p.productId)).size, IAP_SUPPLIER_GIFT_PRODUCTS.length);
});

test('2 · no retired product is sold, asked of StoreKit, or named outside the products file', () => {
  const retired = new Set([...RETIRED_IAP_PRODUCT_IDS, ...RETIRED_PAPIC_CREDIT_PRODUCT_IDS, ...RETIRED_EVENT_PRODUCT_IDS]);
  const selling = [...IAP_PRODUCT_IDS, ...IAP_SUPPLIER_GIFT_PRODUCTS.map((p) => p.productId)];
  for (const id of selling) assert.ok(!retired.has(id), `${id} is retired and still sold`);
  for (const id of ['gift_music_maker', 'gift_patiktok', 'papic_thank_you', 'hub_part_reveal']) {
    assert.ok(RETIRED_IAP_PRODUCT_IDS.includes(`com.setnayan.app.${id}`), `${id} left the retired list — ids are forever`);
  }
  // The dead hub-part table and its exports are gone for good.
  const sources = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib')), ...walk(join(WEB, 'components'))];
  const allowed = new Set(['lib/iap/products.ts', 'lib/iap/products-delivery.ts']);
  const named = /RETIRED_HUB_PART|hub_part_|gift_music_maker|gift_patiktok|gift_live_watch|papic_thank_you|mood_board_renders_50/;
  const offenders = sources.filter((f) => !allowed.has(f) && named.test(code(f)));
  assert.deepEqual(offenders, [], 'a retired product id is named outside the products files');
});

test('3 · inside the app the gift store shows no web price and no GCash / BDO — Apple prices, one payment per line', () => {
  const store = code('app/vendor-dashboard/shop/promote/_components/gift-store.tsx');
  const sheet = store.slice(store.indexOf('export function GiftTicketSheet'), store.indexOf('function AddButton'));
  assert.ok(sheet.length > 0, 'GiftTicketSheet moved');
  // Every web price in the sheet sits inside the web's buy block (`canBuy` = not the store shell).
  const webBlock = sheet.indexOf('{canBuy ? (');
  const webBlockEnd = sheet.indexOf(') : null}', webBlock);
  assert.ok(webBlock > 0 && webBlockEnd > webBlock, 'the web buy block moved');
  for (const m of sheet.matchAll(/formatPhp\(/g)) {
    assert.ok(m.index! > webBlock && m.index! < webBlockEnd, 'a web price is drawn outside the web buy block');
  }
  assert.doesNotMatch(sheet, /GCash|BDO|openRails|PaymentsPausedNote/, 'the ticket sheet names a web rail');
  // The app's Add buttons only where the web's are NOT drawn, worded from Apple's prices.
  assert.match(sheet, /\{!canBuy && appleWords \? \(/);
  assert.match(sheet, /const appleWords = apple \? appleSheetPrices\(pack, appleBundle, apple\) : null;/);

  // The store: in the app every price line is Apple's, and the foot is the line-by-line Apple cart — never BDO.
  const giftStore = store.slice(store.indexOf('export function GiftStore'), store.indexOf('export function GiftHistory'));
  assert.ok(giftStore.length > 0, 'GiftStore moved');
  assert.match(giftStore, /apple \? appleSingleNote\(p, apple\.prices\) : `\$\{formatPhp\(p\.srpCentavos \/ 100\)\} each`/);
  assert.match(giftStore, /apple \? appleBundleNote\(b, apple\.prices\) : <>/);
  assert.match(giftStore, /const foot = apple \? \(\s*<AppleGiftCartFoot\b/);
  assert.equal((giftStore.match(/formatPhp\(/g) ?? []).length, 6, 'a new web price in the store — is it behind `apple ?`');
  assert.match(giftStore, /const v = apple \? appleCanAdd\(/, 'the in-app cart has no web money cap and Apple’s per-purchase limit');

  // The section: the web store's BDO order only when buying on the web; the app's store only in the app.
  const section = code('app/vendor-dashboard/shop/promote/_components/shop-gifts-section.tsx');
  assert.match(section, /const canOffer = data\.canBuy && /);
  assert.match(section, /const appleOffer = Boolean\(data\.appleGifts\) && !data\.canBuy && /);
  assert.match(section, /apple=\{appleStore \? \{ prices: applePrices, silent: appleRead\.state === 'silent' \} : null\}/);
  const data = code('app/vendor-dashboard/shop/promote/_components/shop-gifts-data.ts');
  assert.match(data, /canBuy: !gate\.storeShell,/);
  assert.match(data, /appleGifts: gate\.iapQuantity,/, 'gifts in the app need a build whose plugin passes a quantity');

  // The Apple pieces themselves: StoreKit's price only.
  for (const f of ['app/_components/iap/iap-gift-buy.tsx', 'app/vendor-dashboard/shop/promote/_components/apple-gift-cart.tsx']) {
    const src = code(f);
    assert.doesNotMatch(src, /formatPhp|@\/lib\/php'|retail_price_php|srpCentavos|priceCentavos \/|GCash|BDO|href=|\/pay\b|on the web/i, `${f} shows a web price or rail`);
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a price`);
  }
  const cart = code('app/vendor-dashboard/shop/promote/_components/apple-gift-cart.tsx');
  assert.match(cart, /quantity=\{l\.appleQuantity\}/, 'each line is ONE Apple purchase of its quantity');
});

test('4 · a gift line is ONE Apple purchase: quantity 1–10, a 10 + 1 bundle is bought as its paid count and lands its whole count', () => {
  const pack = { code: 'PAPIC_GUEST_150', title: 'Papic 150', kind: 'papic' as const, credits: 150, srpCentavos: 9_900 };
  // A bundle whose catalogue price is ten list prices and whose count is eleven (figures here are test inputs only).
  const bundle = { code: 'GIFT_BUNDLE_PAPIC_GUEST_150', title: 'Papic 150 · 10 + 1', pack, quantity: 11, priceCentavos: 99_000 };
  assert.equal(bundlePaidCount(bundle), 10);
  assert.deepEqual(appleGiftDelivery(pack.code, 1, [bundle]), { quantity: 1, packsEach: 1, bundleCode: null, priceBasis: 'list' });
  assert.deepEqual(appleGiftDelivery(pack.code, 3, [bundle]), { quantity: 3, packsEach: 1, bundleCode: null, priceBasis: 'list' });
  assert.deepEqual(appleGiftDelivery(pack.code, 10, [bundle]), { quantity: 1, packsEach: 11, bundleCode: bundle.code, priceBasis: 'bundle' });
  // No live bundle → ten singles, never an invented free one.
  assert.deepEqual(appleGiftDelivery(pack.code, 10, []), { quantity: 10, packsEach: 1, bundleCode: null, priceBasis: 'list' });
  for (const bad of [0, 11, 2.5, -1]) assert.equal(appleGiftDelivery(pack.code, bad, [bundle]), null);

  // The in-app cart: singles stop at 9, a "pay 10" bundle at 1 (Apple sells 10 at a time); each line's Apple quantity.
  assert.equal(appleMostOf(pack.code, [bundle]), 9);
  assert.equal(appleMostOf(bundle.code, [bundle]), 1);
  assert.equal(appleCanAdd({ [bundle.code]: 1 }, bundle.code, [pack], [bundle]), 'most_each');
  const lines = appleCartLines({ [pack.code]: 3, [bundle.code]: 1 }, [pack], [bundle]);
  assert.deepEqual(lines.map((l) => [l.code, l.appleQuantity, l.tickets]), [[pack.code, 3, 3], [bundle.code, 10, 11]]);

  // Apple's signed quantity: 1–10 for a gift, exactly 1 for a couple product; charged = unit price × quantity.
  const gift = IAP_SUPPLIER_GIFT_PRODUCTS[0]!;
  const couple = IAP_PRODUCT_IDS[0]!;
  const tx = (productId: string, quantity?: number) =>
    readAppleTransaction({
      transactionId: '1',
      bundleId: APP_BUNDLE_ID,
      productId,
      type: 'Consumable',
      appAccountToken: '11111111-1111-4111-8111-111111111111',
      environment: 'Sandbox',
      price: 99_000,
      currency: 'PHP',
      ...(quantity === undefined ? {} : { quantity }),
    });
  const ten = tx(gift.productId, 10);
  assert.ok(ten.ok && ten.tx.quantity === 10);
  assert.equal(ten.ok ? chargedPhp(ten.tx) : null, 990);
  const one = tx(gift.productId);
  assert.ok(one.ok && one.tx.quantity === 1);
  assert.deepEqual(tx(gift.productId, 11), { ok: false, reason: 'bad_quantity' });
  assert.deepEqual(tx(couple, 2), { ok: false, reason: 'bad_quantity' }, 'a couple product is one per purchase');
  const coupleOne = tx(couple, 1);
  assert.ok(coupleOne.ok);

  // Only a build whose plugin passes a quantity is shown the gift store.
  assert.equal(hasStoreQuantity('Mozilla SetnayanApp SetnayanIAP/2'), false);
  assert.equal(hasStoreQuantity('Mozilla SetnayanApp SetnayanIAP/3'), true);
  assert.equal(hasStoreQuantity('Mozilla SetnayanApp SetnayanIAP/12'), true);
  const plugin = readFileSync(join(WEB, '..', 'mobile', 'ios', 'App', 'App', 'SetnayanStorePlugin.swift'), 'utf8');
  assert.match(plugin, /options\.insert\(\.quantity\(quantity\)\)/, 'the plugin does not pass the quantity to StoreKit');
  assert.match(code('lib/iap/native-store.ts'), /quantity: started\.quantity/, 'the phone asks StoreKit for the SERVER’s quantity');
});

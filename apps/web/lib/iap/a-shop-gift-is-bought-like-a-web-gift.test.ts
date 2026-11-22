/**
 * 💝 A SHOP'S GIFT IS BOUGHT IN THE APP LIKE A WEB GIFT — the three rules the App Store submission rests on
 * (controller 22 Nov, owner 4 Nov "they can purchase inside apple as well"):
 *
 *   1 · Every `gift_*` product sells a catalogue code the WEB gift store sells (Papic 150 · 1000 · 3000, Event Plus ·
 *       Pro · Ultra) — so an Apple gift can always be delivered exactly like a web gift. Live Watch, Music Maker and
 *       Patiktok are not gifts on the web. (That each code is a LIVE row is the DB test's test 5:
 *       tests/db/a-shop-gift-bought-through-apple-lands-like-a-web-gift.db.test.ts.)
 *   2 · No retired product is sold or asked of StoreKit, and no retired id is named outside the products file.
 *   3 · Inside the app the gift sheet shows no web price and no GCash / BDO: the web's Add 1 / Add 10 + 1 (priced) and
 *       its store (BDO) are drawn only when `canBuy` (= not the store shell); the Apple button only when NOT `canBuy`.
 *
 * 🛡 Sabotaged 2026-11-22, each red then restored (PR body): re-adding `gift_live_watch` turns 1 red; re-adding
 * `gift_music_maker` to the gift list turns 2 red; drawing `<IapGiftBuy>` without `!canBuy &&` turns 3 red.
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

test('3 · inside the app the gift sheet shows no web price and no GCash / BDO', () => {
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
  // The Apple button only where the web's buy is NOT drawn.
  assert.equal((sheet.match(/<IapGiftBuy\b/g) ?? []).length, 1);
  assert.match(sheet, /\{!canBuy && appleProductId \? <IapGiftBuy productId=\{appleProductId\} \/> : null\}/);

  // The web's store (the cart, BDO) is mounted only when the web's buy is offered; the Apple door only in the app.
  const section = code('app/vendor-dashboard/shop/promote/_components/shop-gifts-section.tsx');
  assert.match(section, /const canOffer = data\.canBuy && /);
  assert.match(section, /\{canOffer \? \(\s*<GiftStore\b/);
  assert.equal((section.match(/<GiftStore\b/g) ?? []).length, 1);
  assert.match(section, /const appleOffer = Boolean\(data\.appleGifts\) && !data\.canBuy && /);
  const data = code('app/vendor-dashboard/shop/promote/_components/shop-gifts-data.ts');
  assert.match(data, /canBuy: !gate\.storeShell,/);
  assert.match(data, /appleGifts: gate\.iap,/);

  // The Apple button itself: StoreKit's price only.
  const buy = code('app/_components/iap/iap-gift-buy.tsx');
  assert.doesNotMatch(buy, /formatPhp|@\/lib\/php'|retail_price_php|GCash|BDO|href=|\/pay\b|on the web/i);
  assert.doesNotMatch(buy, /₱\s?\d/, 'the Apple gift button types a price');
  assert.match(buy, /prices\.products\.get\(product\.productId\)\?\.displayPrice/);
});

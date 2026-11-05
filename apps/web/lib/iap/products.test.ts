/**
 * 🍎 The App Store product list holds the owner's five rulings (DECISION_LOG
 * 2026-10-18 "IN-APP PURCHASE — THE FIVE DECISIONS"); ruling 4 is superseded by
 * "ONE PRICE EVERYWHERE" (2026-10-28): an App Store sale must BE the website
 * price, within half a peso — never a typed number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments';
import {
  IAP_PRODUCTS,
  IAP_PAPIC_PRODUCTS,
  appStorePriceMatchesWeb,
  APP_STORE_PRICE_TOLERANCE_PHP,
  iapProductById,
  iapProductForServiceKey,
  papicCreditsMatch,
  IAP_PRODUCT_IDS,
  RETIRED_HUB_PART_PRODUCT_IDS,
  RETIRED_IAP_PRODUCT_IDS,
  RETIRED_HUB_PART_SERVICE_KEYS,
  iapPriceRowFor,
  iapSetnayanAiProductForTier,
  iapProductIsRepeatable,
  IAP_SUPPLIER_GIFT_PRODUCTS,
} from './products';
import { COUPLE_WEBSITE_PRO_SERVICE_KEY } from '@/lib/couple-website-pro';
import { RETIRED_EVENT_PRODUCT_IDS, RETIRED_PAPIC_CREDIT_PRODUCT_IDS, iapProductForDelivery } from './products-delivery';
import { HUB_PARTS } from '../hub-parts';
import { hasNativeStore, iapAvailable, NATIVE_STORE_UA_MARKER } from './iap-gate';

const HERE = dirname(fileURLToPath(import.meta.url));

test('💰 2026-11-04 final sheet — Event Plus, Event Pro, three Papic packs, Live Watch, Music Maker, Patiktok; no supplier plan, no Setnayan AI', () => {
  const keys = IAP_PRODUCTS.map((p) => p.serviceKey).sort();
  assert.deepEqual(keys, [
    // 🗑 The eleven Event Hub Pro PART products (2026-10-22) are retired, never sold (owner 2026-10-26, "just have the
    // upgrade event hub pro") — Event Hub Pro is the one Event Hub product. See RETIRED_HUB_PART_PRODUCT_IDS.
    // 💰 Event Pro (`event_pro`, replaces `event_hub_pro`) and Event Plus (`event_plus`) — owner 2026-11-02 / 2026-11-04.
    'COUPLE_WEBSITE_PRO',
    'EVENT_PLUS',
    'LIVE_STUDIO',
    // 🍎 The second wave — owner 2026-10-23, verbatim: "Add Setnayan AI, Music Maker, Patiktok, Thank You and Mood
    // Board pack as Apple products before submitting build 6." This SUPERSEDES the first wave's "no Setnayan AI"
    // assertion that stood here (ruling 1, 2026-10-18: "Setnayan AI is a second wave").
    // 🗑 MOODBOARD_RENDER_PACK left with Mood Board renders (owner 2026-10-26, "can we delete that?").
    'PAKANTA',
    // 🗑 PAPIC_ADDON_THANK_YOU left — the Thank-You Video is free for every event (owner 2026-10-26).
    // 📸 The three Papic packs (owner 2026-11-03): 3,000 · 150 · 1,000. The five credit products are retired.
    'PAPIC_GUEST',
    'PAPIC_GUEST_150',
    'PAPIC_GUEST_1K',
    'PATIKTOK_COMPILER',
    // 🗑 Setnayan AI's four tier products left sale 2026-11-04 — owner: "Setnayan ai no separate purchase will be part
    // of event plus and event pro". They still deliver an already-charged transaction (products-delivery.ts).
  ]);
  for (const p of IAP_PRODUCTS) {
    // Supplier plans stay web-only (ruling 1) — and so does every per-USER or tier-only Setnayan AI row.
    assert.ok(!/VENDOR|vendor_/i.test(p.serviceKey), `${p.serviceKey} is a supplier plan`);
    assert.ok(!/^SETNAYAN_AI_/.test(p.serviceKey), `${p.serviceKey} is a band price row, not a product`);
  }
});

test('ids are exactly the ruled ones (FOREVER), kinds and the owner’s display names (2026-11-04)', () => {
  const want: Array<[string, string, string, string, number | null]> = [
    ['com.setnayan.app.event_plus', 'EVENT_PLUS', 'event-plus', 'Event Plus', null],
    ['com.setnayan.app.event_pro', 'COUPLE_WEBSITE_PRO', 'event-hub-pro', 'Event Pro', null],
    ['com.setnayan.app.papic_pack_150', 'PAPIC_GUEST_150', 'papic-credits', 'Papic 150', 150], // gitleaks:allow — catalog service_codes, not secrets
    ['com.setnayan.app.papic_pack_1000', 'PAPIC_GUEST_1K', 'papic-credits', 'Papic 1000', 1_000], // gitleaks:allow — catalog service_codes, not secrets
    ['com.setnayan.app.papic_pack_3000', 'PAPIC_GUEST', 'papic-credits', 'Papic 3000', 3_000], // gitleaks:allow — catalog service_codes, not secrets
    ['com.setnayan.app.live_watch', 'LIVE_STUDIO', 'live-watch', 'Live Watch', null],
    ['com.setnayan.app.music_maker', 'PAKANTA', 'event-unlock', 'Music Maker', null],
    ['com.setnayan.app.patiktok', 'PATIKTOK_COMPILER', 'event-unlock', 'Patiktok', null],
    // 🗑 com.setnayan.app.papic_thank_you is RETIRED (owner 2026-10-26) — held by the test below.
  ];
  for (const [id, key, kind, name, credits] of want) {
    const p = iapProductById(id);
    assert.ok(p, `${id} missing`);
    assert.deepEqual([p!.serviceKey, p!.kind, p!.appStoreName, p!.credits, p!.appleType], [key, kind, name, credits, 'consumable'], id);
  }
  // Repeatable = never "owned", hidden from Restore's list: the Papic packs, nothing else.
  assert.deepEqual(
    IAP_PRODUCTS.filter((p) => iapProductIsRepeatable(p)).map((p) => p.kind).filter((k, i, a) => a.indexOf(k) === i),
    ['papic-credits'],
  );
  assert.equal(iapProductIsRepeatable(null), false);
});

test('🗑 the retired Mood Board render pack is sold by no product, and its id is never reused (owner 2026-10-26)', () => {
  assert.equal(iapProductById('com.setnayan.app.mood_board_renders_50'), null);
  assert.equal(iapProductForServiceKey('MOODBOARD_RENDER_PACK'), null);
  assert.ok(!IAP_PRODUCTS.some((p) => /mood_board|MOODBOARD/i.test(p.productId + p.serviceKey)), 'a Mood Board product is back');
});

test('🗑 Thank You is sold by no product — free for every event — and its id is kept, never reused (owner 2026-10-26)', () => {
  /* "let us remove thank you from the inapp purchase" → "make it free for now". */
  assert.equal(iapProductById('com.setnayan.app.papic_thank_you'), null, 'the Thank You product is sold again');
  assert.equal(iapProductForServiceKey('PAPIC_ADDON_THANK_YOU'), null, 'Thank You has an App Store product again');
  assert.ok(RETIRED_IAP_PRODUCT_IDS.includes('com.setnayan.app.papic_thank_you'), 'the retired id is no longer listed — it could be reused');
  for (const id of RETIRED_IAP_PRODUCT_IDS) {
    assert.equal(iapProductById(id), null, `${id} is retired and sold again`);
    assert.ok(!IAP_PRODUCT_IDS.includes(id), `${id} is asked of StoreKit`);
  }
  assert.ok(RETIRED_HUB_PART_PRODUCT_IDS.every((id) => RETIRED_IAP_PRODUCT_IDS.includes(id)), 'a retired part id is missing from the one retired list');
});

test('ruling 3 — every product is a CONSUMABLE (one purchase for the current event)', () => {
  for (const p of IAP_PRODUCTS) assert.equal(p.appleType, 'consumable', p.productId);
});

test('ruling 5, superseded 2026-11-03 — Papic is THREE packs: 150 · 1,000 · 3,000, smallest first', () => {
  assert.deepEqual(
    IAP_PAPIC_PRODUCTS.map((p) => [p.productId, p.serviceKey, p.credits]),
    [
      ['com.setnayan.app.papic_pack_150', 'PAPIC_GUEST_150', 150], // gitleaks:allow — catalog service_codes, not secrets
      ['com.setnayan.app.papic_pack_1000', 'PAPIC_GUEST_1K', 1_000], // gitleaks:allow — catalog service_codes, not secrets
      ['com.setnayan.app.papic_pack_3000', 'PAPIC_GUEST', 3_000], // gitleaks:allow — catalog service_codes, not secrets
    ],
  );
});

test('2026-11-03 — the five papic_credits_* products are retired: never sold, never asked of StoreKit, never reused', () => {
  for (const credits of [100, 500, 1_000, 5_000, 10_000]) {
    const id = `com.setnayan.app.papic_credits_${credits}`;
    assert.ok(RETIRED_PAPIC_CREDIT_PRODUCT_IDS.includes(id), `${id} is not on the retired list — it could be reused`);
    assert.ok(!IAP_PRODUCT_IDS.includes(id), `${id} is asked of StoreKit`);
    assert.equal(iapProductById(id), null, `${id} is sold again`);
  }
});

test('product ids are unique, reverse-DNS under the app bundle, and resolve both ways', () => {
  const ids = IAP_PRODUCTS.map((p) => p.productId);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of IAP_PRODUCTS) {
    assert.match(p.productId, /^com\.setnayan\.app\.[a-z0-9_]+$/);
    assert.equal(iapProductById(p.productId), p);
    // One code, several products only for Setnayan AI's tiers — each found by its tier; the code itself finds Tier A.
    if (p.aiTier) assert.equal(iapSetnayanAiProductForTier(p.aiTier), p);
    else assert.equal(iapProductForServiceKey(p.serviceKey), p);
  }
  assert.equal(iapProductById('com.setnayan.app.unknown'), null);
  assert.equal(iapProductById(null), null);
});

test('ruling 4 (2026-10-28) — ONE price: the App Store sale must equal the website price, ± half a peso', () => {
  // Owner: "we make the price in app store and website same". The owner's own example: Papic · 100 credits at ₱95 in
  // App Store Connect means ₱95 on the website.
  assert.equal(appStorePriceMatchesWeb(95, 95), true);
  assert.equal(appStorePriceMatchesWeb(6_588, 6_588), true);
  // Centavo rounding of Apple's milli-units is the same price…
  assert.equal(appStorePriceMatchesWeb(95, 95.01), true);
  assert.equal(appStorePriceMatchesWeb(94.6, 95), true);
  // …a different whole-peso point is not, in EITHER direction (the old ÷0.85 floor only ever looked below).
  assert.equal(appStorePriceMatchesWeb(96, 95), false, 'above the website price is a mismatch too');
  assert.equal(appStorePriceMatchesWeb(94, 95), false);
  assert.equal(appStorePriceMatchesWeb(95 + APP_STORE_PRICE_TOLERANCE_PHP, 95), false, 'the tolerance is strict');
  // The old rule's figures are now MISMATCHES — under one price, ₱82.36 for a ₱70 row is the error.
  assert.equal(appStorePriceMatchesWeb(82.36, 70), false);
  // Below the smallest real gap between two PH price points (₱1).
  assert.ok(APP_STORE_PRICE_TOLERANCE_PHP > 0 && APP_STORE_PRICE_TOLERANCE_PHP < 1);
  // Nothing to compare → no verdict, never a guessed one.
  assert.equal(appStorePriceMatchesWeb(null, 95), null);
  assert.equal(appStorePriceMatchesWeb(95, 0), null);
  assert.equal(appStorePriceMatchesWeb(Number.NaN, 95), null);
});

test('the fulfilment holds a sale to the ONE-price check, never the retired ÷0.85 floor', () => {
  const src = stripComments(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fulfil.server.ts'), 'utf8'));
  assert.match(src, /appStorePriceMatchesWeb\(/, 'the sale is no longer checked against the website price');
  assert.ok(!/0\.85|PriceFloor/.test(src), 'the ÷0.85 floor is back — under one price it fires on every sale');
});

test('a Papic product is on sale only while its tier grants exactly the credits its name promises', () => {
  const p1000 = IAP_PAPIC_PRODUCTS.find((p) => p.credits === 1_000)!;
  assert.equal(papicCreditsMatch(p1000, 1_000), true);
  assert.equal(papicCreditsMatch(p1000, 1_100), false);
  assert.equal(papicCreditsMatch(p1000, null), false);
  const pro = iapProductForServiceKey('COUPLE_WEBSITE_PRO')!;
  assert.equal(papicCreditsMatch(pro, null), true);
});

test('NO PRICE IS TYPED in the product file — the app shows StoreKit’s, the web the catalogue’s', () => {
  const src = readFileSync(resolve(HERE, 'products.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.ok(!/₱|\bphp\s*:|price\w*\s*:\s*\d/i.test(src), 'a price was typed into lib/iap/products.ts');
});

test('the Apple gate needs the store shell AND the plugin build AND the owner’s switch', () => {
  const ua = `Mozilla/5.0 (iPhone) SetnayanApp SetnayanSignIn/1 ${NATIVE_STORE_UA_MARKER}`;
  assert.equal(hasNativeStore(ua), true);
  assert.equal(hasNativeStore('Mozilla/5.0 (iPhone) SetnayanApp SetnayanSignIn/1'), false);
  assert.equal(iapAvailable({ storeShell: true, userAgent: ua, enabled: true }), true);
  assert.equal(iapAvailable({ storeShell: false, userAgent: ua, enabled: true }), false, 'the web never sells via Apple');
  assert.equal(iapAvailable({ storeShell: true, userAgent: ua, enabled: false }), false, 'switch off = as before');
  assert.equal(
    iapAvailable({ storeShell: true, userAgent: 'SetnayanApp SetnayanSignIn/1', enabled: true }),
    false,
    'an old build without the plugin never sees a buy button',
  );
});

test('Event Pro’s product sells THE Pro key (the client-safe spelling equals the shipped constant)', () => {
  assert.equal(iapProductForServiceKey(COUPLE_WEBSITE_PRO_SERVICE_KEY)?.productId, 'com.setnayan.app.event_pro');
});

test('🗑 2026-11-04 — event_hub_pro and the four Setnayan AI products are retired from sale but still DELIVER', () => {
  const want: Array<[string, string, string | undefined]> = [
    ['com.setnayan.app.event_hub_pro', 'COUPLE_WEBSITE_PRO', undefined],
    ['com.setnayan.app.setnayan_ai', 'SETNAYAN_AI', 'A'],
    ['com.setnayan.app.setnayan_ai_tier_b', 'SETNAYAN_AI', 'B'],
    ['com.setnayan.app.setnayan_ai_tier_c', 'SETNAYAN_AI', 'C'],
    ['com.setnayan.app.setnayan_ai_tier_d', 'SETNAYAN_AI', 'D'],
  ];
  assert.deepEqual([...RETIRED_EVENT_PRODUCT_IDS].sort(), want.map(([id]) => id).sort());
  for (const [id, key, tier] of want) {
    assert.equal(iapProductById(id), null, `${id} is sold again`);
    assert.ok(!IAP_PRODUCT_IDS.includes(id), `${id} is asked of StoreKit`);
    const d = iapProductForDelivery(id);
    assert.ok(d, `${id} no longer delivers an already-charged transaction`);
    assert.equal(d!.serviceKey, key, `${id} delivers the wrong order`);
    assert.equal(d!.aiTier, tier, `${id} lost its tier — its delivery would price-check against the wrong row`);
  }
  // Every retired Papic credit product still delivers too, and nothing on sale is shadowed by a retired one.
  for (const id of RETIRED_PAPIC_CREDIT_PRODUCT_IDS) assert.ok(iapProductForDelivery(id), `${id} no longer delivers`);
  for (const p of IAP_PRODUCTS) assert.equal(iapProductForDelivery(p.productId), p);
  assert.equal(iapProductForDelivery('com.setnayan.app.unknown'), null);
});

test('🗑 the eleven part products are retired — sold by nothing, their ids kept so none is ever reused (owner 2026-10-26)', () => {
  /* "and just have the upgrade event hub pro" … "i mean no more by part as well on the website." Held against the parts
     table, so the retired list stays the one that was made in App Store Connect: one id a part, never drifted. */
  assert.deepEqual(RETIRED_HUB_PART_SERVICE_KEYS, HUB_PARTS.map((p) => p.sku));
  assert.deepEqual(RETIRED_HUB_PART_PRODUCT_IDS, HUB_PARTS.map((p) => `com.setnayan.app.hub_part_${p.id}`), 'a retired part id drifted — ids are forever');
  for (const id of RETIRED_HUB_PART_PRODUCT_IDS) {
    assert.equal(iapProductById(id), null, `${id} is sold again — Event Hub Pro is sold whole`);
    assert.ok(!IAP_PRODUCT_IDS.includes(id), `${id} is asked of StoreKit`);
  }
  for (const key of RETIRED_HUB_PART_SERVICE_KEYS) assert.equal(iapProductForServiceKey(key), null, `${key} has an App Store product again`);
  assert.ok(!IAP_PRODUCTS.some((p) => /hub_part|COUPLE_HUB_PART/.test(p.productId + p.serviceKey)), 'a part product is back');
});

test('🗑 Setnayan AI is sold by no product (2026-11-04) — the tier lookup answers null; a delivered tier product is priced from its tier row', async () => {
  const { AI_TIER_SKU } = await import('../setnayan-ai-type-pricing');
  for (const tier of ['A', 'B', 'C', 'D', 'E', null] as const) assert.equal(iapSetnayanAiProductForTier(tier), null, `tier ${tier} is sold again`);
  assert.equal(iapProductForServiceKey('SETNAYAN_AI'), null, 'Setnayan AI has an App Store product again');
  assert.ok(!IAP_PRODUCTS.some((p) => p.serviceKey === 'SETNAYAN_AI' || p.aiTier), 'a Setnayan AI product is back on sale');
  for (const [id, tier] of [['com.setnayan.app.setnayan_ai', 'A'], ['com.setnayan.app.setnayan_ai_tier_d', 'D']] as const) {
    assert.equal(iapPriceRowFor(iapProductForDelivery(id)!), AI_TIER_SKU[tier]);
  }
  assert.equal(iapPriceRowFor(iapProductForServiceKey('PAKANTA')!), 'PAKANTA', 'a product with no tier is checked against its own code');
});

test('💝 the eight supplier gift products exist, are unique, and are NOT sellable through the couple path', () => {
  assert.deepEqual(
    IAP_SUPPLIER_GIFT_PRODUCTS.map((p) => p.serviceKey),
    ['PAPIC_GUEST_150', 'PAPIC_GUEST_1K', 'PAPIC_GUEST', 'EVENT_PLUS', COUPLE_WEBSITE_PRO_SERVICE_KEY, 'LIVE_STUDIO', 'PAKANTA', 'PATIKTOK_COMPILER'],
  );
  const ids = IAP_SUPPLIER_GIFT_PRODUCTS.map((p) => p.productId);
  assert.equal(new Set(ids).size, 8);
  for (const id of ids) {
    // A couple must never reach the gift price: no gift id is asked of StoreKit or resolved for a purchase.
    assert.equal(IAP_PRODUCT_IDS.includes(id), false, `${id} is in the sellable list`);
    assert.equal(iapProductById(id), null, `${id} resolves for the couple purchase path`);
    assert.equal(RETIRED_IAP_PRODUCT_IDS.includes(id), false, `${id} reuses a retired id`);
    assert.equal(iapProductForDelivery(id), null, `${id} delivers — no supplier gift delivery is built`);
  }
});

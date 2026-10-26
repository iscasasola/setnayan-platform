/**
 * 🍎 The App Store product list holds the owner's five rulings (DECISION_LOG
 * 2026-10-18 "IN-APP PURCHASE — THE FIVE DECISIONS"), and the price floor is
 * web ÷ 0.85 rounded UP — never a typed number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IAP_PRODUCTS,
  IAP_PAPIC_PRODUCTS,
  appStorePriceFloorPhp,
  iapProductById,
  iapProductForServiceKey,
  papicCreditsMatch,
  IAP_PRODUCT_IDS,
  RETIRED_HUB_PART_PRODUCT_IDS,
  RETIRED_HUB_PART_SERVICE_KEYS,
  iapPriceRowFor,
  iapProductFitsAiTier,
  iapSetnayanAiProductForTier,
  iapProductIsRepeatable,
} from './products';
import { COUPLE_WEBSITE_PRO_SERVICE_KEY } from '@/lib/couple-website-pro';
import { HUB_PARTS } from '../hub-parts';
import { hasNativeStore, iapAvailable, NATIVE_STORE_UA_MARKER } from './iap-gate';

const HERE = dirname(fileURLToPath(import.meta.url));

test('ruling 1 + 23 Oct — Papic credits, Event Hub Pro, Live Watch and the five more; no supplier plan', () => {
  const keys = IAP_PRODUCTS.map((p) => p.serviceKey).sort();
  assert.deepEqual(keys, [
    // 🗑 The eleven Event Hub Pro PART products (2026-10-22) are retired, never sold (owner 2026-10-26, "just have the
    // upgrade event hub pro") — Event Hub Pro is the one Event Hub product. See RETIRED_HUB_PART_PRODUCT_IDS.
    'COUPLE_WEBSITE_PRO',
    'LIVE_STUDIO',
    // 🍎 The second wave — owner 2026-10-23, verbatim: "Add Setnayan AI, Music Maker, Patiktok, Thank You and Mood
    // Board pack as Apple products before submitting build 6." This SUPERSEDES the first wave's "no Setnayan AI"
    // assertion that stood here (ruling 1, 2026-10-18: "Setnayan AI is a second wave").
    // 🗑 MOODBOARD_RENDER_PACK left with Mood Board renders (owner 2026-10-26, "can we delete that?").
    'PAKANTA',
    'PAPIC_ADDON_THANK_YOU',
    'PAPIC_GUEST_100',
    'PAPIC_GUEST_10K',
    'PAPIC_GUEST_1K',
    'PAPIC_GUEST_500',
    'PAPIC_GUEST_5K',
    'PATIKTOK_COMPILER',
    // ✦ Setnayan AI — FOUR products, one per web tier (owner 2026-10-23), all selling the one SETNAYAN_AI order.
    'SETNAYAN_AI',
    'SETNAYAN_AI',
    'SETNAYAN_AI',
    'SETNAYAN_AI',
  ]);
  for (const p of IAP_PRODUCTS) {
    // Supplier plans stay web-only (ruling 1) — and so does every per-USER or tier-only Setnayan AI row.
    assert.ok(!/VENDOR|vendor_/i.test(p.serviceKey), `${p.serviceKey} is a supplier plan`);
    assert.ok(!/^SETNAYAN_AI_/.test(p.serviceKey), `${p.serviceKey} is a band price row, not a product`);
  }
});

test('🍎 23 Oct — the five more: ids are exactly the controller’s (FOREVER), kinds and names as ruled', () => {
  const want: Array<[string, string, string, string, number | null]> = [
    ['com.setnayan.app.setnayan_ai', 'SETNAYAN_AI', 'event-unlock', 'Setnayan AI', null],
    ['com.setnayan.app.setnayan_ai_tier_b', 'SETNAYAN_AI', 'event-unlock', 'Setnayan AI', null],
    ['com.setnayan.app.setnayan_ai_tier_c', 'SETNAYAN_AI', 'event-unlock', 'Setnayan AI', null],
    ['com.setnayan.app.setnayan_ai_tier_d', 'SETNAYAN_AI', 'event-unlock', 'Setnayan AI', null],
    ['com.setnayan.app.music_maker', 'PAKANTA', 'event-unlock', 'Music Maker', null],
    ['com.setnayan.app.patiktok', 'PATIKTOK_COMPILER', 'event-unlock', 'Patiktok', null],
    ['com.setnayan.app.papic_thank_you', 'PAPIC_ADDON_THANK_YOU', 'event-unlock', 'Thank You', null],
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

test('ruling 3 — every product is a CONSUMABLE (one purchase for the current event)', () => {
  for (const p of IAP_PRODUCTS) assert.equal(p.appleType, 'consumable', p.productId);
});

test('ruling 5 — the Papic packs are 100 · 500 · 1,000 · 5,000 · 10,000, smallest first', () => {
  assert.deepEqual(
    IAP_PAPIC_PRODUCTS.map((p) => p.credits),
    [100, 500, 1_000, 5_000, 10_000],
  );
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

test('ruling 4 — the App Store floor is web ÷ 0.85, rounded UP to the centavo', () => {
  // The live catalogue figures on 2026-10-18 (platform_retail_catalog_v2, read-only).
  const cases: Array<[number, number]> = [
    [70, 82.36],
    [350, 411.77],
    [700, 823.53],
    [2_500, 2_941.18],
    [2_800, 3_294.12],
    [4_500, 5_294.12],
    [5_000, 5_882.36],
    // An exact multiple stays exact — no phantom centavo.
    [85, 100],
  ];
  for (const [web, floor] of cases) {
    assert.equal(appStorePriceFloorPhp(web), floor, `₱${web}`);
    // The floor always nets AT LEAST the web price after Apple's 15 %.
    assert.ok(floor * 0.85 >= web - 1e-9, `₱${web} → ₱${floor} nets ${floor * 0.85}`);
  }
  assert.equal(appStorePriceFloorPhp(0), null);
  assert.equal(appStorePriceFloorPhp(null), null);
  assert.equal(appStorePriceFloorPhp(Number.NaN), null);
});

test('a Papic product is on sale only while its tier grants exactly the credits its name promises', () => {
  const p500 = IAP_PAPIC_PRODUCTS.find((p) => p.credits === 500)!;
  assert.equal(papicCreditsMatch(p500, 500), true);
  assert.equal(papicCreditsMatch(p500, 600), false);
  assert.equal(papicCreditsMatch(p500, null), false);
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

test('Event Hub Pro’s product sells THE Pro key (the client-safe spelling equals the shipped constant)', () => {
  assert.equal(iapProductForServiceKey(COUPLE_WEBSITE_PRO_SERVICE_KEY)?.productId, 'com.setnayan.app.event_hub_pro');
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

test('✦ Setnayan AI: one product per web tier — A keeps `setnayan_ai` (never renamed), E has none, each floored on its own row', async () => {
  const { AI_TIER_SKU } = await import('../setnayan-ai-type-pricing');
  const tiers = [['A', 'com.setnayan.app.setnayan_ai'], ['B', 'com.setnayan.app.setnayan_ai_tier_b'], ['C', 'com.setnayan.app.setnayan_ai_tier_c'], ['D', 'com.setnayan.app.setnayan_ai_tier_d']] as const;
  for (const [tier, id] of tiers) {
    const p = iapSetnayanAiProductForTier(tier)!;
    assert.equal(p.productId, id, `tier ${tier} sells the wrong product — ids are forever`);
    assert.equal(p.serviceKey, 'SETNAYAN_AI', 'every tier sells the ONE SETNAYAN_AI order (one activation, one ownership)');
    // The Apple floor row is the tier's own catalogue row — the web's one tier → row map, not a second one.
    assert.equal(iapPriceRowFor(p), AI_TIER_SKU[tier]);
  }
  assert.equal(iapSetnayanAiProductForTier('E'), null, 'Tier E is not offered — on the web or in the app');
  assert.equal(iapSetnayanAiProductForTier(null), null);
  assert.equal(iapProductForServiceKey('SETNAYAN_AI')?.productId, 'com.setnayan.app.setnayan_ai', 'the code alone still means Tier A');
  assert.equal(iapPriceRowFor(iapProductForServiceKey('PAKANTA')!), 'PAKANTA', 'a product with no tier is floored on its own code');
});

test('✦ a tier product fits ONLY an event of its tier — a Tier D product never unlocks a wedding', () => {
  const T = ['A', 'B', 'C', 'D'] as const;
  for (const sold of T) {
    const p = iapSetnayanAiProductForTier(sold)!;
    for (const event of [...T, 'E' as const]) {
      assert.equal(iapProductFitsAiTier(p, event), sold === event, `tier ${sold} product vs a tier ${event} event`);
    }
    assert.equal(iapProductFitsAiTier(p, null), false, 'an unread tier fits nothing');
  }
  // Every other product has no tier and is unaffected.
  assert.equal(iapProductFitsAiTier(iapProductForServiceKey('PAKANTA')!, null), true);
});

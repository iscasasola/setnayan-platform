/**
 * the-sheet-price-is-storekits.test.ts — 💱 EVERY PRICE AN APPLE SHEET DRAWS IS STOREKIT'S OWN LOCALIZED STRING, IN
 * THE MONEY ITS STOREFRONT CHARGES — NEVER A FIGURE OR A CURRENCY OF OURS.
 *
 * Measured on 1.0 (build 6), 2026-10-25, a Philippine App Store account: our "Add credits" sheet said
 * "$1.99 · adds 100 credits" while Apple's own purchase sheet for the same product charged "₱ 95.00". The web never
 * typed "$1.99" — it was StoreKit's `displayPrice`, priced for another storefront than the one Apple then charged.
 * So two rules, both held here:
 *
 *   1 · the ONLY price source is StoreKit (`Product.displayPrice` → plugin → `loadAppStoreProducts` →
 *       `useAppStorePrices`); no sheet types a currency, a peso figure or a catalogue price;
 *   2 · a StoreKit price whose currency is not its own storefront's (`priceMatchesStorefront`) is withheld — no figure
 *       at all rather than a number Apple will not charge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { priceMatchesStorefront } from './storefront-price';
import { stripComments } from '../strip-comments';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Every client surface that draws an Apple price. */
const SHEETS = [
  'app/_components/iap/iap-papic-sheet.tsx',
  'app/_components/iap/iap-unlock-sheet.tsx',
  'app/_components/iap/iap-live-watch-sheet.tsx',
  'app/_components/iap/apple-pro-screen.tsx',
];

test('2 · a price in another money than its storefront charges is withheld; an older build is trusted as before', () => {
  assert.equal(priceMatchesStorefront({ currencyCode: 'USD', storefront: 'PHL' }), false, '"$1.99" on a Philippine storefront');
  assert.equal(priceMatchesStorefront({ currencyCode: 'usd', storefront: 'phl' }), false);
  assert.equal(priceMatchesStorefront({ currencyCode: 'PHP', storefront: 'PHL' }), true, 'the peso price Apple charges there');
  assert.equal(priceMatchesStorefront({ currencyCode: 'USD', storefront: 'USA' }), true, 'a storefront not listed is StoreKit’s word');
  assert.equal(priceMatchesStorefront({}), true, '1.0 (6) sends neither field');
  assert.equal(priceMatchesStorefront({ currencyCode: 'USD', storefront: '' }), true, 'StoreKit did not say the storefront');
  // …and the one loader applies it to every product before any sheet sees one.
  const ns = code('lib/iap/native-store.ts');
  assert.match(ns, /p\.displayPrice\.length > 0 && priceMatchesStorefront\(p\)\) \{\s*map\.set\(p\.id, p\);/, 'loadAppStoreProducts no longer withholds a wrong-money price');
  assert.match(code('lib/iap/use-app-store-prices.ts'), /loadAppStoreProducts\(/, 'the prices hook reads another source');
});

test('1 · every sheet draws StoreKit’s `displayPrice` only — no typed currency, peso figure or catalogue price', () => {
  for (const rel of SHEETS) {
    const src = code(rel);
    assert.match(src, /\.displayPrice\b/, `${rel} draws no StoreKit price`);
    assert.match(src, /useAppStorePrices\(|loadAppStoreProducts\(/, `${rel} reads its price from somewhere other than StoreKit`);
    for (const [what, re] of [
      ['a typed dollar figure', /\$\s?\d/],
      ['a peso sign', /₱/],
      ['a currency code', /\b(?:USD|PHP)\b/],
      ['a peso formatter', /\bformatPhp\b|\bpeso\(/],
      ['a catalogue price', /getCustomerSkuPriceLabel|platform_retail_catalog|pricePhp:\s*[1-9]/],
    ] as const) {
      assert.doesNotMatch(src, re, `${rel} carries ${what} — the app shows only Apple's price`);
    }
  }
  // Papic's ladder: every rung is a pack StoreKit priced, and its label IS StoreKit's string.
  assert.match(code('app/_components/iap/iap-papic-sheet.tsx'), /priceLabel: sk\.displayPrice/);
  // The plugin hands the web Apple's string, untouched, with the two facts the check needs.
  const swift = readFileSync(join(WEB, '..', 'mobile', 'ios', 'App', 'App', 'SetnayanStorePlugin.swift'), 'utf8');
  assert.match(swift, /"displayPrice": product\.displayPrice,/);
  assert.match(swift, /"currencyCode": product\.priceFormatStyle\.currencyCode,/);
  assert.match(swift, /let storefront = await Storefront\.current\?\.countryCode \?\? ""/);
});

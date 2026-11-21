/**
 * 💰 THE GIFT STORE TYPES NO PRICE — and its buy path is priced and capped ON THE SERVER (2026-11-17, prototype v16).
 *
 *   1 · no ₱ amount and no 100,000 is typed in the store's code: every price is the catalogue's (`srpCentavos`,
 *       `priceCentavos`) and the ceiling is the admin setting (`maxPaymentPhp`), handed in;
 *   2 · the buy action prices the posted cart itself (`priceCart` against the catalogue IT read), reads the ceiling
 *       (`getMaxPaymentPhp`) and checks it BEFORE a rail is picked — on the cart branch and the single-gift branch alike;
 *       and it never reads a price, total or amount out of the form.
 *
 * Sabotage: typing `₱2,990` into gift-store.tsx turns 1 red; deleting the `withinMaxPayment` check in the single-gift
 * branch turns 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const STORE_FILES = [
  'app/vendor-dashboard/shop/promote/_components/gift-store.tsx',
  'app/vendor-dashboard/shop/promote/_components/gift-store-copy.ts',
  'app/vendor-dashboard/shop/promote/_components/shop-gifts-section.tsx',
  'lib/shop-gift-cart.ts',
  'lib/shop-gift-history.ts',
];
const ACTION = 'app/vendor-dashboard/on-the-day/live/[eventId]/papic/portfolio-pack-actions.ts';

test('1 · the store types no price and no ceiling', () => {
  for (const f of STORE_FILES) {
    const src = read(f);
    assert.doesNotMatch(src, /₱\s?\d/, `${f} types a ₱ amount`);
    assert.doesNotMatch(src, /\b100[,_]?000\b/, `${f} types the ceiling instead of reading the setting`);
    assert.doesNotMatch(src, /\b(?:pricePhp|priceCentavos|srpCentavos|unitCentavos)\s*[:=]\s*[1-9]/, `${f} assigns a price literal`); // 0 marks an off-sale tile, never a price
  }
});

test('2 · the buy action prices and caps on the server, before the rail', () => {
  const src = read(ACTION);
  const cartAt = src.indexOf('async function mintShopGiftCart');
  assert.ok(cartAt > 0, 'the cart branch is gone');
  const cart = src.slice(cartAt);
  const single = src.slice(0, cartAt);

  assert.match(single, /=== 'gift_cart'\)\s*\{\s*return mintShopGiftCart\(/, 'the cart is not routed to its minter');

  // The cart: the catalogue + the setting are read here, priceCart decides, then the rail.
  assert.match(cart, /getMaxPaymentPhp\(admin\)/);
  const pricedAt = cart.indexOf("priceCart(formData.get('cart')");
  const railAt = cart.indexOf('railForNewOrder(');
  assert.ok(pricedAt > 0 && railAt > pricedAt, 'the cart reaches a rail before it is priced');

  // The single-gift path: the ceiling is checked before its rail too.
  const capAt = single.indexOf('withinMaxPayment(');
  const singleRailAt = single.indexOf('railForNewOrder(');
  assert.ok(capAt > 0 && singleRailAt > capAt, 'the single-gift path reaches a rail before the most-in-one-payment check');

  // Nothing about money is read from the browser.
  assert.doesNotMatch(src, /formData\.get\(\s*['"](?:price|total|amount|unit|price_php|total_php)/i);
});

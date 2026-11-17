/**
 * 🛒 THE GIFT STORE'S CART — the math the store draws and the buy action re-runs (owner-approved prototype
 * `gifts-interactive` v16, 2026-11-17). Every price here is a FIXTURE handed in as the catalogue would hand it in; the
 * cart never knows a price of its own.
 *
 *   1 · total, tickets, free and save for a mixed cart (singles + bundles in ONE order);
 *   2 · a single stops at 9 (and a bundle too — the prototype's stepper runs 0 … 9);
 *   3 · + is refused when the ORDER would pass the most in one payment; equal to it is allowed ("above" is refused);
 *   4 · the form carries codes and counts only, and the server's `priceCart` refuses anything malformed, off sale or over.
 *
 * Sabotage: `>` → `>=` in `canAdd`'s ceiling test turns test 3 red (an order exactly at the most refused);
 * dropping the `over_max` branch from `priceCart` turns test 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { shopGiftBundlesFrom, shopGiftPacksFrom } from '@/lib/shop-gifts';
import {
  SHOP_GIFT_STORE_MOST_EACH,
  bump,
  canAdd,
  encodeCart,
  parseCart,
  priceCart,
  summarizeCart,
} from '@/lib/shop-gift-cart';

/** Catalogue codes, one per line (a code beside another code in one array reads as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const P1K = 'PAPIC_GUEST_1K';
const PLUS = 'EVENT_PLUS';
const ULTRA = 'EVENT_ULTRA';
const B150 = 'GIFT_BUNDLE_PAPIC_150';
const B1K = 'GIFT_BUNDLE_PAPIC_1K';
const BULTRA = 'GIFT_BUNDLE_EVENT_ULTRA';

const PACKS = shopGiftPacksFrom([
  { code: P150, title: 'Papic 150', credits: 150, pricePhp: 99 },
  { code: P1K, title: 'Papic 1000', credits: 1000, pricePhp: 499 },
  { code: PLUS, title: 'Event Plus', credits: 1, pricePhp: 2990 },
  { code: ULTRA, title: 'Event Ultra', credits: 1, pricePhp: 9990 },
]);
const BUNDLES = shopGiftBundlesFrom(
  [
    { code: B150, title: '11 × Papic 150', pricePhp: 990, bundleOf: P150, bundleQuantity: 11 },
    { code: B1K, title: '11 × Papic 1000', pricePhp: 4990, bundleOf: P1K, bundleQuantity: 11 },
    { code: BULTRA, title: '11 × Event Ultra', pricePhp: 99900, bundleOf: ULTRA, bundleQuantity: 11 },
  ],
  PACKS,
);
const MAX = 100_000;

test('1 · a mixed cart: total, tickets, free and save are the catalogue’s, in ONE order', () => {
  const sum = summarizeCart({ [P150]: 2, [B1K]: 1, [PLUS]: 1 }, PACKS, BUNDLES);
  // 2 × ₱99 + 1 × ₱4,990 + 1 × ₱2,990
  assert.equal(sum.totalCentavos, 2 * 9_900 + 499_000 + 299_000);
  assert.equal(sum.tickets, 2 + 11 + 1);
  assert.equal(sum.free, 1);
  // The bundle saves one pack at list price (11 × ₱499 − ₱4,990 = ₱499); singles save nothing.
  assert.equal(sum.saveCentavos, 49_900);
  // Lines come out in the store's order: singles (Papic, then Event), then bundles.
  assert.deepEqual(
    sum.lines.map((l) => l.code),
    [P150, PLUS, B1K],
  );
  assert.equal(sum.lines.find((l) => l.code === B1K)?.pack.code, P1K);
  // An empty cart, and a code nobody sells, add nothing.
  assert.equal(summarizeCart({}, PACKS, BUNDLES).totalCentavos, 0);
  assert.equal(summarizeCart({ NOT_ON_SALE: 3 }, PACKS, BUNDLES).lines.length, 0);
});

test('2 · nine is the most of one item; − never goes below 0', () => {
  let cart = {};
  for (let i = 0; i < SHOP_GIFT_STORE_MOST_EACH; i += 1) {
    assert.equal(canAdd(cart, P150, PACKS, BUNDLES, MAX), 'ok');
    cart = bump(cart, P150, 1);
  }
  assert.equal((cart as Record<string, number>)[P150], 9);
  assert.equal(canAdd(cart, P150, PACKS, BUNDLES, MAX), 'most_each');
  assert.equal(canAdd(cart, B150, PACKS, BUNDLES, MAX), 'ok', 'the bundle is the way to 10');
  assert.equal((bump(cart, P150, 5) as Record<string, number>)[P150], 9, 'bump never passes the most');
  assert.deepEqual(bump({ [P150]: 1 }, P150, -1), {}, 'back to 0 drops the line');
  assert.deepEqual(bump({}, P150, -1), {});
  assert.equal(canAdd({}, 'NOT_ON_SALE', PACKS, BUNDLES, MAX), 'not_on_sale');
});

test('3 · + is refused when the ORDER would pass the most in one payment — equal is allowed', () => {
  // One Event Ultra 10 + 1 bundle is ₱99,900.
  const cart = { [BULTRA]: 1 };
  assert.equal(summarizeCart(cart, PACKS, BUNDLES).totalCentavos, 9_990_000);
  // ₱99,900 + ₱99 = ₱99,999 ≤ ₱100,000 → fits.
  assert.equal(canAdd(cart, P150, PACKS, BUNDLES, MAX), 'ok');
  // A ceiling of exactly ₱99,999 still fits it (equal is allowed) …
  assert.equal(canAdd(cart, P150, PACKS, BUNDLES, 99_999), 'ok');
  // … and a ceiling one peso lower refuses it.
  assert.equal(canAdd(cart, P150, PACKS, BUNDLES, 99_998), 'over_max');
  // A ₱499 pack on top passes ₱100,000.
  assert.equal(canAdd(cart, P1K, PACKS, BUNDLES, MAX), 'over_max');
  // A second Ultra bundle passes it by far.
  assert.equal(canAdd(cart, BULTRA, PACKS, BUNDLES, MAX), 'over_max');
});

test('3b · the ceiling is the setting handed in, not a typed number', () => {
  // An admin who lowers the most to ₱5,000: a ₱4,990 bundle + ₱99 = ₱5,089 is refused.
  assert.equal(canAdd({ [B1K]: 1 }, P150, PACKS, BUNDLES, 5_000), 'over_max');
  assert.equal(canAdd({ [B1K]: 1 }, P150, PACKS, BUNDLES, 6_000), 'ok');
});

test('4 · the form carries codes and counts only; the server re-prices and refuses what it must', () => {
  const posted = encodeCart({ [P150]: 2, [B1K]: 1 });
  assert.equal(posted, `${P150}:2,${B1K}:1`, 'the form carries codes and counts, nothing else');
  assert.deepEqual(parseCart(posted), [
    { code: P150, qty: 2 },
    { code: B1K, qty: 1 },
  ]);

  const ok = priceCart(posted, PACKS, BUNDLES, MAX);
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.summary.totalCentavos, 2 * 9_900 + 499_000);

  // Malformed: empty, a count of 10 (the store stops at 9), 0, a code twice, a price smuggled in, junk.
  for (const bad of ['', `${P150}:10`, `${P150}:0`, `${P150}:1,${P150}:2`, `${P150}:1:99`, 'drop table', null, 42]) {
    const r = priceCart(bad, PACKS, BUNDLES, MAX);
    assert.equal(r.ok, false, `accepted ${String(bad)}`);
    if (!r.ok) assert.equal(r.reason, 'malformed');
  }
  // Off sale: a code the catalogue did not hand in (a switched-off gift, or one invented by hand).
  const off = priceCart('GIFT_BUNDLE_EVENT_PLUS:1', PACKS, BUNDLES, MAX);
  assert.equal(off.ok, false);
  if (!off.ok) assert.equal(off.reason, 'not_on_sale');
  // Over the most: two Ultra bundles = ₱199,800.
  const over = priceCart(`${BULTRA}:2`, PACKS, BUNDLES, MAX);
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.reason, 'over_max');
  // Exactly at the most is allowed.
  const at = priceCart(`${BULTRA}:1`, PACKS, BUNDLES, 99_900);
  assert.ok(at.ok);
});

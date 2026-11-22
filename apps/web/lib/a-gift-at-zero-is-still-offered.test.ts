/**
 * 🎟 A GIFT AT 0 STOCK IS STILL OFFERED — owner 21 Nov 2026: *"even if the run out of gifts, they can still purchase."*
 * and *"make them jump to the page where to buy gifts. after theybuy, we can return to the booking fee"*. On top of
 * 20 Nov: every booking carries at least one Setnayan gift, no exceptions (enforced at Agree by #7823).
 *
 * Replaces the 17 Nov "0 stock blocks only that gift" build, so this pins the reversal:
 *   · the shop page never reads gift stock to decide whether a bundle promises its gift (running out never takes a
 *     gift off a booking — the supplier buys more);
 *   · the couple's request door never reads gift stock — a booking is never blocked by it;
 *   · the ticket sheet says the 18 Nov hold rule (one per service card on a quote) and, behind its ⓘ, the ≥1 rule —
 *     never the retired "comes off your bookings" line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  GIFT_AT_LEAST_ONE,
  GIFT_HOLD_RULE,
  GIFT_ZERO_LEFT,
} from '../app/vendor-dashboard/shop/promote/_components/gift-store-copy';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

test('the shop page promises a bundle’s gift without reading stock', () => {
  const src = read('app/v/[slug]/page.tsx');
  assert.doesNotMatch(src, /bundleGiftOnOffer|fetchShopGiftStock/);
  assert.match(src, /giftPack: packs\?\.find\(\(x\) => x\.code === gift\) \?\? null/);
});

test('the couple’s request door never reads gift stock — the booking is not blocked', () => {
  const src = read('app/v/[slug]/inquiry-actions.ts');
  assert.doesNotMatch(src, /fetchShopGiftStock|shop_gift_stock_status|shop_gift_pack_stock_status|freeByKind/);
});

test('the ticket sheet says the hold rule and the ≥1 rule, never the retired line', () => {
  assert.equal(GIFT_HOLD_RULE, '1 is held for each service card on a quote.');
  assert.equal(GIFT_AT_LEAST_ONE, 'Every booking needs at least 1 gift. Bought gifts go on your gift bill.');
  assert.equal(GIFT_ZERO_LEFT, '0 left · Buy more ›');
  const sheet = read('app/vendor-dashboard/shop/promote/_components/gift-store.tsx');
  assert.match(sheet, /<InfoTip label=\{GIFT_HOLD_RULE\}[^>]*>\s*\{GIFT_AT_LEAST_ONE\}/);
  for (const src of [sheet, read('app/vendor-dashboard/shop/promote/_components/gift-store-copy.ts')]) {
    assert.doesNotMatch(src, /comes off your bookings|can still request to book|can’t request to book/);
  }
});

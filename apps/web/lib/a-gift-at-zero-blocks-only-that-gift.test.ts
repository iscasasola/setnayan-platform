/**
 * 🎟 0 STOCK BLOCKS ONLY THAT GIFT — owner 17 Nov 2026 (DECISION_LOG "1 gift held per booking"): *"1 will be held for
 * all your bookings. for that gift item. if you run out, they cannot request to book."*
 *
 * ⚠ OPEN with the owner: whether 0 stock blocks the WHOLE booking request or only that gift. This build takes ONLY THAT
 * GIFT. This file pins both halves, so a later ruling for "the whole booking" is a deliberate edit here, never drift:
 *   · the gift is blocked — the shop page stops promising it (`bundleGiftOnOffer`), a quote refuses it (`short`);
 *   · the booking is not — the couple's request door never reads gift stock;
 *   · the supplier is told so on the ticket sheet (`GIFT_HOLD_RULE`), never the drawing's stronger line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { bundleGiftOnOffer } from './package-gift';
import type { FreeByKind, ShopGiftPack } from './shop-gifts';
import { GIFT_HOLD_RULE } from '../app/vendor-dashboard/shop/promote/_components/gift-store-copy';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

const PAPIC: ShopGiftPack = { code: 'PACK_A', title: 'Papic 1000', kind: 'papic', credits: 1000, srpCentavos: 100 };
const PLUS: ShopGiftPack = { code: 'PACK_B', title: 'Event Plus', kind: 'event_plus', credits: 1, srpCentavos: 100 };
const free = (papic: number, plus: number): FreeByKind => ({
  papic: papic * 1000,
  event_plus: plus,
  event_pro: 0,
  event_ultra: 0,
  packs: { [PAPIC.code]: papic },
});

test('a gift with stock is promised; at 0 — or unread — it is not', () => {
  assert.equal(bundleGiftOnOffer(PAPIC, free(1, 0)), PAPIC);
  assert.equal(bundleGiftOnOffer(PLUS, free(0, 2)), PLUS);
  assert.equal(bundleGiftOnOffer(PAPIC, free(0, 2)), null, 'Papic is counted in its own packs');
  assert.equal(bundleGiftOnOffer(PLUS, free(3, 0)), null);
  assert.equal(bundleGiftOnOffer(PAPIC, null), null, 'a stock nobody read promises nothing');
  assert.equal(bundleGiftOnOffer(null, free(5, 5)), null);
});

test('the shop page reads the stock and drops only the gift, never the bundle', () => {
  const src = read('app/v/[slug]/page.tsx');
  assert.match(src, /fetchShopGiftStock\(admin, vendorProfileId\)/);
  assert.match(src, /giftPack: bundleGiftOnOffer\(/);
  // The bundle is still returned — nothing filters packages on stock.
  assert.doesNotMatch(src, /\.filter\([^)]*bundleGiftOnOffer/);
});

test('a quote refuses a gift the stock cannot cover', () => {
  assert.match(read('lib/shop-gifts.server.ts'), /v\.state === 'short'\) return \{ ok: false/);
});

test('the couple’s request door never reads gift stock — the booking is not blocked', () => {
  const src = read('app/v/[slug]/inquiry-actions.ts');
  assert.doesNotMatch(src, /fetchShopGiftStock|shop_gift_stock_status|shop_gift_pack_stock_status|freeByKind/);
});

test('the ticket sheet says what this build does, not the drawing’s whole-booking line', () => {
  assert.match(GIFT_HOLD_RULE, /^1 is held for each booking\./);
  assert.match(GIFT_HOLD_RULE, /can still request to book/);
  assert.doesNotMatch(GIFT_HOLD_RULE, /can’t request|cannot request/);
  assert.match(read('app/vendor-dashboard/shop/promote/_components/gift-store.tsx'), /\{GIFT_HOLD_RULE\}/);
});

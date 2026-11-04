/**
 * SUPPLIER GIFTS — the rules (`lib/shop-gifts.ts`), owner 2026-11-04.
 *
 * What each block holds, and the sabotage that turns it red (run 2026-11-04):
 *   • the limit is 40% of the booking fee from `bookingFeePhp` under the LIVE schedule — computed here through the same
 *     two exports, never a re-typed rate (sabotage: `GIFT_SHARE_OF_FEE_PCT` → 50 in giftLimitCentavos → red);
 *   • the smallest pack is always allowed, even over the limit (sabotage: drop `!alwaysAllowed &&` → red);
 *   • "buy first": a gift that stock cannot cover is refused, and an UNREAD stock refuses too (sabotage: `free ?? 0`
 *     → `free ?? Infinity` → red);
 *   • a Free shop pays the list price; a gift price above the list never applies.
 *
 * The packs below are TEST FIXTURES, not prices — the app reads them from `platform_retail_catalog_v2`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKING_FEE, bookingFeePhp } from './booking-fee';
import { GIFT_SHARE_OF_FEE_PCT } from './setnayan-gift';
import {
  addGiftMenu,
  alwaysAllowedPack,
  coupleGiftHeadline,
  freeCredits,
  giftLimitCentavos,
  giftUnitPrice,
  judgeQuoteGifts,
  shopGiftCodeOf,
  shopGiftPacksFrom,
  shopGiftServiceKey,
  stockSubline,
} from './shop-gifts';

const PACKS = shopGiftPacksFrom([
  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 499, giftPricePhp: 449 },
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99, giftPricePhp: 90 },
  { code: 'PAPIC_GUEST', title: 'Papic Unlimited', credits: 3000, pricePhp: 999, giftPricePhp: null },
]);

const limitFor = (totalCentavos: number) =>
  Math.floor((Math.round(bookingFeePhp(totalCentavos / 100, BOOKING_FEE) * 100) * GIFT_SHARE_OF_FEE_PCT) / 100);

describe('the order key', () => {
  it('round-trips only the couple Papic packs', () => {
    assert.equal(shopGiftCodeOf(shopGiftServiceKey('PAPIC_GUEST_150')), 'PAPIC_GUEST_150');
    assert.equal(shopGiftCodeOf(shopGiftServiceKey('PAPIC_GUEST')), 'PAPIC_GUEST');
    assert.equal(shopGiftCodeOf('vendor_gift__EVENT_PLUS'), null);
    assert.equal(shopGiftCodeOf('vendor_papic_pack__PAPIC_GUEST_150'), null);
    assert.equal(shopGiftCodeOf(null), null);
  });
});

describe('packs', () => {
  it('sorts smallest first, and the smallest is the always-allowed one', () => {
    assert.deepEqual(PACKS.map((p) => p.code), ['PAPIC_GUEST_150', 'PAPIC_GUEST_1K', 'PAPIC_GUEST']);
    assert.equal(alwaysAllowedPack(PACKS)?.code, 'PAPIC_GUEST_150');
    assert.equal(alwaysAllowedPack([]), null);
  });
  it('drops rows with no credits or no price', () => {
    assert.deepEqual(shopGiftPacksFrom([{ code: 'X', title: 'X', credits: 0, pricePhp: 10 }]), []);
    assert.deepEqual(shopGiftPacksFrom([{ code: 'X', title: 'X', credits: 5, pricePhp: 0 }]), []);
  });
});

describe('what a shop pays', () => {
  const p150 = PACKS[0]!;
  it('Verified-and-up pays the gift price; Free pays the list', () => {
    assert.deepEqual(giftUnitPrice(p150, true), { centavos: 9000, basis: 'gift' });
    assert.deepEqual(giftUnitPrice(p150, false), { centavos: 9900, basis: 'list' });
  });
  it('a pack with no gift price, or one not below the list, is the list price for everyone', () => {
    assert.equal(giftUnitPrice(PACKS[2]!, true).basis, 'list');
    const odd = { ...p150, giftPriceCentavos: 12_000 };
    assert.deepEqual(giftUnitPrice(odd, true), { centavos: 9900, basis: 'list' });
  });
});

describe('the gift limit', () => {
  it('is the Setnayan gift share of the live booking fee, floored', () => {
    for (const total of [1_00, 5_000_00, 100_000_00, 250_000_00, 1_234_567]) {
      assert.equal(giftLimitCentavos(total, BOOKING_FEE), limitFor(total));
    }
    assert.equal(giftLimitCentavos(0, BOOKING_FEE), 0);
  });
});

describe('judging a quote', () => {
  const big = 100_000_00; // a ₱100,000 quote
  it('says none with no gifts', () => {
    assert.equal(judgeQuoteGifts([], PACKS, big, BOOKING_FEE, 5000).state, 'none');
  });
  it('accepts what fits the limit and the stock', () => {
    const v = judgeQuoteGifts(['PAPIC_GUEST_1K'], PACKS, big, BOOKING_FEE, 5000);
    assert.equal(v.state, 'ok');
    assert.equal(v.credits, 1000);
    assert.equal(v.valueCentavos, 49_900);
  });
  it('refuses gifts over the limit', () => {
    const v = judgeQuoteGifts(['PAPIC_GUEST', 'PAPIC_GUEST', 'PAPIC_GUEST'], PACKS, 10_000_00, BOOKING_FEE, 99_999);
    assert.ok(v.valueCentavos > v.limitCentavos);
    assert.equal(v.state, 'over_limit');
  });
  it('always allows ONE smallest pack, even on a tiny quote', () => {
    const v = judgeQuoteGifts(['PAPIC_GUEST_150'], PACKS, 1_00, BOOKING_FEE, 500);
    assert.ok(v.valueCentavos > v.limitCentavos);
    assert.equal(v.alwaysAllowed, true);
    assert.equal(v.state, 'ok');
    // …but two of them are not the always-allowed gift any more
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_150', 'PAPIC_GUEST_150'], PACKS, 1_00, BOOKING_FEE, 500).state, 'over_limit');
  });
  it('buy first: refuses what stock cannot cover, and an unread stock covers nothing', () => {
    const short = judgeQuoteGifts(['PAPIC_GUEST_1K'], PACKS, big, BOOKING_FEE, 400);
    assert.equal(short.state, 'short');
    assert.equal(short.shortBy, 600);
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_150'], PACKS, big, BOOKING_FEE, null).state, 'short');
  });
  it('a pack no longer on sale is refused', () => {
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_9X'], PACKS, big, BOOKING_FEE, 5000).state, 'unknown_pack');
  });
});

describe('the add menu', () => {
  it('says why each pack cannot go on now', () => {
    const menu = addGiftMenu(['PAPIC_GUEST_1K'], PACKS, 100_000_00, BOOKING_FEE, 1200);
    assert.equal(menu.find((o) => o.code === 'PAPIC_GUEST_150')?.ok, true);
    const k1 = menu.find((o) => o.code === 'PAPIC_GUEST_1K');
    assert.equal(k1?.ok, false);
    assert.match(k1?.why ?? '', /buy first/);
    const tiny = addGiftMenu([], PACKS, 1_00, BOOKING_FEE, 99_999);
    const big = tiny.find((o) => o.code === 'PAPIC_GUEST');
    assert.equal(big?.ok, false);
    assert.match(big?.why ?? '', /limit/);
  });
});

describe('words', () => {
  it('an unread stock says so, never "0 free"', () => {
    assert.match(stockSubline(null), /Couldn’t read/);
    assert.equal(freeCredits(null), null);
    assert.equal(stockSubline({ balance: 1150, held: 300 }), '850 free to offer · 300 on sent quotes');
  });
  it('the couple headline names the shop and is silent at zero', () => {
    assert.equal(coupleGiftHeadline(1150, 'Saysay Studio'), 'Gift from Saysay Studio 🎁 · 1,150 Papic credits');
    assert.equal(coupleGiftHeadline(0, 'Saysay Studio'), null);
  });
});

/**
 * SUPPLIER GIFTS — the rules (`lib/shop-gifts.ts`), owner 2026-11-04.
 *
 * What each block holds, and the sabotage that turns it red (run 2026-11-04):
 *   • the limit is 40% of the booking fee from `bookingFeePhp` under the LIVE schedule — computed here through the same
 *     two exports, never a re-typed rate (sabotage: ignore `limitPct` and type 50 in giftLimitCentavos → red);
 *   • the smallest pack is always allowed, even over the limit (sabotage: drop `!alwaysAllowed &&` → red);
 *   • "buy first": a gift that stock cannot cover is refused, and an UNREAD stock refuses too (sabotage:
 *     `free?.[k] ?? 0` → `free?.[k] ?? Infinity` → red);
 *   • 💎 slice 2 (2026-11-05): Event Plus / Event Pro are counted from their OWN stock (sabotage: judge every kind against
 *     `free.papic` → red), and an event that already has Event Pro cannot take either (sabotage: drop the
 *     `eventHas === 'pro'` line → red);
 *   • 📦 2026-11-14: ONE price per gift (the list price — no gift price); BUY 10, GET 1 FREE bundles come from the
 *     catalogue rows, never typed; Papic is COUNTED IN PACKS — each pack's lines against that pack's own free count
 *     (sabotage: judge Papic against `free.papic` credits again → the per-pack cases go red).
 *
 * The packs below are TEST FIXTURES, not prices — the app reads them from `platform_retail_catalog_v2`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKING_FEE, bookingFeePhp } from './booking-fee';
import { GIFT_LIMIT_PCT_DEFAULT } from './setnayan-gift';

/** The ruled default of the admin setting (platform_settings.gift_limit_pct) — the limit these cases run at. */
const LIMIT = GIFT_LIMIT_PCT_DEFAULT;
import {
  addGiftMenu,
  alwaysAllowedPack,
  coupleGiftHeadline,
  freeCredits,
  allocateRewardLines,
  bundleFreePacks,
  bundleListNote,
  freeOfPack,
  giftItemsOf,
  giftLimitCentavos,
  isShopGiftBundleCode,
  judgeQuoteGifts,
  shopGiftBundlesFrom,
  shopGiftCodeOf,
  shopGiftKindOf,
  shopGiftPacksFrom,
  shopGiftServiceKey,
  stockSubline,
} from './shop-gifts';

const PACKS = shopGiftPacksFrom([
  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 499 },
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99 },
  { code: 'PAPIC_GUEST', title: 'Papic Unlimited', credits: 3000, pricePhp: 999 },
]);

/**
 * What is free to offer — 🔢 `n` of EVERY Papic pack (counted in packs since 2026-11-14), then Event Plus / Pro / Ultra.
 * `papic` (the credit total) is deliberately NOT what the judge reads; it is set to a number that would mislead.
 */
/** Catalogue codes, one per line (a code beside another code in one array reads as a key to the secret scan). */
const P150 = 'PAPIC_GUEST_150';
const P1K = 'PAPIC_GUEST_1K';
const P3K = 'PAPIC_GUEST';
const PAPIC_CODES = [P150, P1K, P3K];
const F = (n: number, event_plus = 0, event_pro = 0, event_ultra = 0) => ({
  papic: 999_999,
  event_plus,
  event_pro,
  event_ultra,
  packs: Object.fromEntries(PAPIC_CODES.map((c) => [c, n])),
});

const UNLOCKS = shopGiftPacksFrom([
  ...[
    { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99 },
    { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', credits: 1, pricePhp: 5690 },
    { code: 'EVENT_PLUS', title: 'Event Plus', credits: 1, pricePhp: 2990 },
  ],
]);

const limitFor = (totalCentavos: number, pct: number = LIMIT) =>
  Math.floor((Math.round(bookingFeePhp(totalCentavos / 100, BOOKING_FEE) * 100) * pct) / 100);

describe('the order key', () => {
  it('round-trips the couple Papic packs, Event Plus and Event Pro — nothing else', () => {
    assert.equal(shopGiftCodeOf(shopGiftServiceKey('PAPIC_GUEST_150')), 'PAPIC_GUEST_150');
    assert.equal(shopGiftCodeOf(shopGiftServiceKey('PAPIC_GUEST')), 'PAPIC_GUEST');
    assert.equal(shopGiftCodeOf('vendor_gift__EVENT_PLUS'), 'EVENT_PLUS');
    assert.equal(shopGiftCodeOf('vendor_gift__COUPLE_WEBSITE_PRO'), 'COUPLE_WEBSITE_PRO');
    assert.equal(shopGiftCodeOf('vendor_gift__SETNAYAN_AI'), null);
    assert.equal(shopGiftKindOf('EVENT_PLUS'), 'event_plus');
    assert.equal(shopGiftKindOf('COUPLE_WEBSITE_PRO'), 'event_pro');
    assert.equal(shopGiftKindOf('PAPIC_GUEST_1K'), 'papic');
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

describe('📦 one price per gift, and the bundles (2026-11-14)', () => {
  it('a pack carries ONE price — the list price; there is no gift price on it', () => {
    const p150 = PACKS[0]!;
    assert.equal(p150.srpCentavos, 9900);
    assert.deepEqual(Object.keys(p150).sort(), ['code', 'credits', 'kind', 'srpCentavos', 'title']);
  });
  const BUNDLE_ROWS = [
    { code: 'GIFT_BUNDLE_PAPIC_1K', title: '11 × Papic 1000', pricePhp: 4990, bundleOf: 'PAPIC_GUEST_1K', bundleQuantity: 11 },
    { code: 'GIFT_BUNDLE_PAPIC_150', title: '11 × Papic 150', pricePhp: 990, bundleOf: 'PAPIC_GUEST_150', bundleQuantity: 11 },
    // dropped: a pack that is not on sale · not a bundle code · a count of 1 · no price · an unlock
    { code: 'GIFT_BUNDLE_X', title: 'x', pricePhp: 100, bundleOf: 'PAPIC_GUEST_9X', bundleQuantity: 11 },
    { code: 'PAPIC_GUEST_1K', title: 'x', pricePhp: 100, bundleOf: 'PAPIC_GUEST_1K', bundleQuantity: 11 },
    { code: 'GIFT_BUNDLE_ONE', title: 'x', pricePhp: 100, bundleOf: 'PAPIC_GUEST_1K', bundleQuantity: 1 },
    { code: 'GIFT_BUNDLE_FREE', title: 'x', pricePhp: 0, bundleOf: 'PAPIC_GUEST_1K', bundleQuantity: 11 },
    { code: 'GIFT_BUNDLE_PLUS', title: 'x', pricePhp: 100, bundleOf: 'EVENT_PLUS', bundleQuantity: 11 },
  ];
  it('bundles are read from the catalogue rows — which pack, how many, what price — smallest pack first', () => {
    const b = shopGiftBundlesFrom(BUNDLE_ROWS, [...PACKS, ...UNLOCKS]);
    assert.deepEqual(b.map((x) => [x.code, x.pack.code, x.quantity, x.priceCentavos]), [
      ['GIFT_BUNDLE_PAPIC_150', P150, 11, 99_000],
      ['GIFT_BUNDLE_PAPIC_1K', P1K, 11, 499_000],
    ]);
  });
  it('the free pack and the admin note are worked out from the catalogue, never typed', () => {
    const [b150, b1k] = shopGiftBundlesFrom(BUNDLE_ROWS, PACKS);
    assert.equal(bundleFreePacks(b1k!), 1);
    assert.equal(bundleFreePacks(b150!), 1);
    assert.equal(bundleListNote(b1k!).ok, true);
    assert.match(bundleListNote(b1k!).text, /^10 at today’s list price · 1 free$/);
    // The admin moved the pack's list price: the bundle no longer equals whole packs — the note warns.
    const drifted = { ...b1k!, pack: { ...b1k!.pack, srpCentavos: 52_000 } };
    assert.equal(bundleListNote(drifted).ok, false);
    assert.equal(bundleFreePacks(drifted), 1);
  });
  it('a bundle order key round-trips; a bundle code is a namespace, not a list', () => {
    assert.equal(isShopGiftBundleCode('GIFT_BUNDLE_PAPIC_3000'), true);
    assert.equal(isShopGiftBundleCode('PAPIC_GUEST_1K'), false);
    assert.equal(shopGiftCodeOf(shopGiftServiceKey('GIFT_BUNDLE_PAPIC_1K')), 'GIFT_BUNDLE_PAPIC_1K');
    // a bundle is never a gift kind of its own — it only fills the stock with its pack
    assert.equal(shopGiftKindOf('GIFT_BUNDLE_PAPIC_1K'), null);
  });
});

describe('🔢 Papic counted in packs (2026-11-14)', () => {
  const big = 100_000_00;
  it('each pack is judged against ITS OWN free count, never the credit total', () => {
    const free = { papic: 999_999, event_plus: 0, event_pro: 0, event_ultra: 0, packs: { PAPIC_GUEST_150: 3 } };
    const v = judgeQuoteGifts(['PAPIC_GUEST_1K'], PACKS, big, BOOKING_FEE, LIMIT, free);
    assert.equal(v.state, 'short');
    assert.equal(v.shortKind, 'papic');
    assert.equal(v.shortPack, 'PAPIC_GUEST_1K');
    assert.equal(v.shortBy, 1);
    assert.equal(judgeQuoteGifts([P150, P150], PACKS, big, BOOKING_FEE, LIMIT, free).state, 'ok');
    assert.equal(judgeQuoteGifts(Array(4).fill('PAPIC_GUEST_150'), PACKS, big, BOOKING_FEE, LIMIT, free).shortBy, 1);
  });
  it('freeOfPack answers per pack for Papic and per kind for an unlock; null when unread', () => {
    const free = F(2, 1);
    assert.equal(freeOfPack(free, PACKS[1]!), 2);
    assert.equal(freeOfPack(free, UNLOCKS.find((p) => p.kind === 'event_plus')!), 1);
    assert.equal(freeOfPack(null, PACKS[0]!), null);
    assert.equal(freeOfPack({ ...free, packs: {} }, PACKS[0]!), 0);
  });
  it('the couple reads whole packs: "2 × Papic 1000 · Event Ultra"', () => {
    assert.deepEqual(
      giftItemsOf([
        { title: 'Papic 1000', kind: 'papic' },
        { title: 'Event Ultra', kind: 'event_ultra' },
        { title: 'Papic 1000', kind: 'papic' },
      ]),
      ['2 × Papic 1000', 'Event Ultra'],
    );
  });
  it('🏅 a badge reward (Papic 150 packs) pays only lines of the smallest pack', () => {
    const lines = [PACKS[1]!, PACKS[0]!];
    const reward = { papic: 1000, event_plus: 0, event_pro: 0, event_ultra: 0, packs: {} };
    assert.deepEqual(allocateRewardLines(lines, reward, 'PAPIC_GUEST_150'), [false, true]);
  });
});

describe('the gift limit', () => {
  it('is the Setnayan gift share of the live booking fee, floored', () => {
    for (const total of [1_00, 5_000_00, 100_000_00, 250_000_00, 1_234_567]) {
      assert.equal(giftLimitCentavos(total, BOOKING_FEE, LIMIT), limitFor(total));
      // ⚖ 8 Nov 2026: the % is the admin setting passed in — at 25 the limit is 25% of the fee.
      assert.equal(giftLimitCentavos(total, BOOKING_FEE, 25), limitFor(total, 25));
    }
    assert.equal(giftLimitCentavos(0, BOOKING_FEE, LIMIT), 0);
  });
});

describe('judging a quote', () => {
  const big = 100_000_00; // a ₱100,000 quote
  it('says none with no gifts', () => {
    assert.equal(judgeQuoteGifts([], PACKS, big, BOOKING_FEE, LIMIT, F(5000)).state, 'none');
  });
  it('accepts what fits the limit and the stock', () => {
    const v = judgeQuoteGifts(['PAPIC_GUEST_1K'], PACKS, big, BOOKING_FEE, LIMIT, F(5000));
    assert.equal(v.state, 'ok');
    assert.equal(v.credits, 1000);
    assert.equal(v.valueCentavos, 49_900);
  });
  it('refuses gifts over the limit', () => {
    const v = judgeQuoteGifts(['PAPIC_GUEST', 'PAPIC_GUEST', 'PAPIC_GUEST'], PACKS, 10_000_00, BOOKING_FEE, LIMIT, F(99_999));
    assert.ok(v.valueCentavos > v.limitCentavos);
    assert.equal(v.state, 'over_limit');
  });
  it('always allows ONE smallest pack, even on a tiny quote', () => {
    const v = judgeQuoteGifts(['PAPIC_GUEST_150'], PACKS, 1_00, BOOKING_FEE, LIMIT, F(500));
    assert.ok(v.valueCentavos > v.limitCentavos);
    assert.equal(v.alwaysAllowed, true);
    assert.equal(v.state, 'ok');
    // …but two of them are not the always-allowed gift any more
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_150', 'PAPIC_GUEST_150'], PACKS, 1_00, BOOKING_FEE, LIMIT, F(500)).state, 'over_limit');
  });
  it('buy first: refuses what stock cannot cover, and an unread stock covers nothing', () => {
    const short = judgeQuoteGifts(['PAPIC_GUEST_1K'], PACKS, big, BOOKING_FEE, LIMIT, F(0));
    assert.equal(short.state, 'short');
    assert.equal(short.shortBy, 1);
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_150'], PACKS, big, BOOKING_FEE, LIMIT, null).state, 'short');
  });
  it('a pack no longer on sale is refused', () => {
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_9X'], PACKS, big, BOOKING_FEE, LIMIT, F(5000)).state, 'unknown_pack');
  });
});

describe('💎 Event Plus and Event Pro (slice 2)', () => {
  const big = 2_000_000_00; // a ₱2,000,000 quote — its limit fits Pro
  it('sort after the Papic packs; the always-allowed gift stays the smallest PAPIC pack; an unlock is one each', () => {
    assert.deepEqual(UNLOCKS.map((p) => p.code), ['PAPIC_GUEST_150', 'EVENT_PLUS', 'COUPLE_WEBSITE_PRO']);
    assert.equal(alwaysAllowedPack(UNLOCKS)?.code, 'PAPIC_GUEST_150');
    assert.deepEqual(shopGiftPacksFrom([{ code: 'EVENT_PLUS', title: 'Event Plus', credits: 100, pricePhp: 2990 }]), []);
  });
  it('are counted from their own stock, never from the Papic credits', () => {
    assert.equal(judgeQuoteGifts(['EVENT_PLUS'], UNLOCKS, big, BOOKING_FEE, LIMIT, F(99_999, 0)).state, 'short');
    const v = judgeQuoteGifts(['EVENT_PLUS', 'EVENT_PLUS'], UNLOCKS, big, BOOKING_FEE, LIMIT, F(0, 1));
    assert.equal(v.state, 'short');
    assert.equal(v.shortKind, 'event_plus');
    assert.equal(v.shortBy, 1);
    const ok = judgeQuoteGifts(['EVENT_PLUS', 'PAPIC_GUEST_150'], UNLOCKS, big, BOOKING_FEE, LIMIT, F(150, 1));
    assert.equal(ok.state, 'ok');
    assert.equal(ok.credits, 150, 'Papic credits only');
    assert.deepEqual(ok.unlocks, { event_plus: 1, event_pro: 0, event_ultra: 0 });
  });
  it('count toward the 40% limit at the price couples pay', () => {
    const v = judgeQuoteGifts(['COUPLE_WEBSITE_PRO'], UNLOCKS, 100_000_00, BOOKING_FEE, LIMIT, F(0, 0, 1));
    assert.equal(v.valueCentavos, 569_000);
    assert.equal(v.state, v.valueCentavos > v.limitCentavos ? 'over_limit' : 'ok');
  });
  it('cannot go to an event that already has Event Pro; Event Plus on an event with Plus is fine (it becomes Pro)', () => {
    assert.equal(judgeQuoteGifts(['EVENT_PLUS'], UNLOCKS, big, BOOKING_FEE, LIMIT, F(0, 1), 'pro').state, 'already_has');
    assert.equal(judgeQuoteGifts(['PAPIC_GUEST_150'], UNLOCKS, big, BOOKING_FEE, LIMIT, F(150), 'pro').state, 'ok');
    assert.equal(judgeQuoteGifts(['EVENT_PLUS'], UNLOCKS, big, BOOKING_FEE, LIMIT, F(0, 1), 'plus').state, 'ok');
    const menu = addGiftMenu([], UNLOCKS, big, BOOKING_FEE, LIMIT, F(150, 1, 1), 'pro');
    assert.match(menu.find((o) => o.code === 'COUPLE_WEBSITE_PRO')?.why ?? '', /already has Event Pro/);
    assert.equal(menu.find((o) => o.code === 'PAPIC_GUEST_150')?.ok, true);
  });
  it('the couple reads the unlock in the same line', () => {
    assert.equal(
      coupleGiftHeadline(['1 × Papic 150', 'Event Plus'], 'Saysay Studio'),
      'Gift from Saysay Studio 🎁 · 1 × Papic 150 · Event Plus',
    );
    assert.equal(coupleGiftHeadline(['Event Pro'], 'Saysay Studio'), 'Gift from Saysay Studio 🎁 · Event Pro');
  });
});

describe('the add menu', () => {
  it('says why each pack cannot go on now', () => {
    const menu = addGiftMenu(['PAPIC_GUEST_1K'], PACKS, 100_000_00, BOOKING_FEE, LIMIT, F(1));
    assert.equal(menu.find((o) => o.code === 'PAPIC_GUEST_150')?.ok, true);
    const k1 = menu.find((o) => o.code === 'PAPIC_GUEST_1K');
    assert.equal(k1?.ok, false);
    assert.match(k1?.why ?? '', /buy first/);
    const tiny = addGiftMenu([], PACKS, 1_00, BOOKING_FEE, LIMIT, F(99_999));
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
    assert.equal(coupleGiftHeadline(['1 × Papic 1000', '1 × Papic 150'], 'Saysay Studio'), 'Gift from Saysay Studio 🎁 · 1 × Papic 1000 · 1 × Papic 150');
    assert.equal(coupleGiftHeadline([], 'Saysay Studio'), null);
  });
});

/**
 * setnayan-gift.test.ts — the RULES of the gift, on a SYNTHETIC ladder.
 *
 * ⚠ No real rung price appears in this file, on purpose. The live ladder is
 * `platform_retail_catalog_v2` × `papic_pass_tiers`; the owner's sanity numbers
 * (₱20k → 571 … ₱3.35M → 50,000) are asserted against the REPLAYED catalog in
 * tests/db/the-gift-reaches-the-couple.db.test.ts, where a reprice moves the
 * data and the test together. Here the ladder is invented, so every assertion
 * is about a RULE — proportional, capped on credits, floored, 40% a ceiling.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GIFT_CAP_CREDITS,
  GIFT_LIMIT_PCT_DEFAULT,
  giftChargeAtGiftPrice,
  giftLadderFrom,
  giftQuoteCopy,
  setnayanGiftForFee,
  type GiftRung,
} from './setnayan-gift';
import { bookingFeePhp } from './booking-fee';

// An invented ladder: 100 cr ₱100 · 1,000 cr ₱500 · 50,000 cr ₱10,000.
const LADDER: GiftRung[] = [
  { credits: 100, priceCentavos: 10_000 },
  { credits: 1_000, priceCentavos: 50_000 },
  { credits: GIFT_CAP_CREDITS, priceCentavos: 1_000_000 },
];

const feeFor = (bookingPhp: number) => Math.round(bookingFeePhp(bookingPhp) * 100);

test('40% of the fee, floored to the centavo — a ceiling, never exceeded', () => {
  // ⚖ 8 Nov 2026: 40 is the ruled DEFAULT of the admin setting (platform_settings.gift_limit_pct).
  assert.equal(GIFT_LIMIT_PCT_DEFAULT, 40);
  // fee 1,000.00 → budget 400.00 (between the 100 and 1,000 rungs)
  const g = setnayanGiftForFee(100_000, LADDER);
  assert.equal(g.chargeCentavos, 40_000);
  // an odd centavo fee floors: 40% of 12,345 = 4,938.0 exactly; of 12,346 = 4,938.4 → 4,938
  assert.equal(setnayanGiftForFee(1_234_600, LADDER).chargeCentavos, 493_840);
  for (const fee of [25_001, 25_002, 25_003, 99_999, 777_777]) {
    const c = setnayanGiftForFee(fee, LADDER).chargeCentavos;
    assert.ok(c * 100 <= fee * 40, `charge ${c} exceeds 40% of ${fee}`);
  }
});

test('PROPORTIONAL — interpolated between rungs, not whole bundles', () => {
  // budget ₱300 sits exactly half way between ₱100 (100 cr) and ₱500 (1,000 cr)
  const g = setnayanGiftForFee(75_000, LADDER);
  assert.equal(g.chargeCentavos, 30_000);
  assert.equal(g.credits, 550); // a whole-bundle fit would say 100
  // and it lands exactly ON a rung when the budget equals its price
  assert.equal(setnayanGiftForFee(125_000, LADDER).credits, 1_000);
});

test('rounds the photo count half up — the SQL mirror does the same', () => {
  // A ladder where one centavo past a rung is exactly half a credit.
  const two: GiftRung[] = [
    { credits: 100, priceCentavos: 100 },
    { credits: 101, priceCentavos: 102 },
    { credits: GIFT_CAP_CREDITS, priceCentavos: 1_000_000 },
  ];
  // charge 101 → 100 + round(1·1/2) = 100 + 1 (half UP)
  const fee = Math.ceil((101 * 100) / 40); // 253 → floor(253·40/100) = 101
  const g = setnayanGiftForFee(fee, two);
  assert.equal(g.chargeCentavos, 101);
  assert.equal(g.credits, 101);
});

test('THE CAP is on CREDITS, and the charge caps with it', () => {
  // budget exactly the cap rung's price → 50,000, capped
  const at = setnayanGiftForFee(2_500_000, LADDER);
  assert.deepEqual(at, { credits: GIFT_CAP_CREDITS, chargeCentavos: 1_000_000, capped: true });
  // far above → still 50,000 and still only the cap rung's price
  const above = setnayanGiftForFee(99_000_000, LADDER);
  assert.deepEqual(above, { credits: GIFT_CAP_CREDITS, chargeCentavos: 1_000_000, capped: true });
  // REPRICE the 50,000 rung → the cap is still 50,000 photos, at the new price
  const repriced = LADDER.map((r) =>
    r.credits === GIFT_CAP_CREDITS ? { ...r, priceCentavos: 1_200_000 } : r,
  );
  const r = setnayanGiftForFee(99_000_000, repriced);
  assert.equal(r.credits, GIFT_CAP_CREDITS);
  assert.equal(r.chargeCentavos, 1_200_000);
});

test('no 50,000 rung on the ladder ⇒ the gift stops at the TOP PACK ON SALE, priced from it (2026-11-03)', () => {
  // Papic became three packs and the 50,000 rung went off sale. Requiring it would zero every gift; extrapolating
  // past the top pack would invent a price. So the cap is the top live rung, and the charge never exceeds its price.
  const noCap = LADDER.filter((r) => r.credits !== GIFT_CAP_CREDITS);
  const top = noCap[noCap.length - 1]!;
  assert.deepEqual(setnayanGiftForFee(99_000_000, noCap), {
    credits: top.credits,
    chargeCentavos: top.priceCentavos,
    capped: true,
  });
  // …and an empty ladder still gives nothing (never an uncapped gift).
  assert.deepEqual(setnayanGiftForFee(99_000_000, []), { credits: 0, chargeCentavos: 0, capped: false });
});

test('the three packs (150 ₱90 · 1,000 ₱490 · 3,000 ₱990): 40% of the fee, proportional, capped at 3,000', () => {
  const PACKS: GiftRung[] = [
    { credits: 150, priceCentavos: 9_000 },
    { credits: 1_000, priceCentavos: 49_000 },
    { credits: 3_000, priceCentavos: 99_000 },
  ];
  // budget ₱89.99 → below the 150 pack → nothing
  assert.equal(setnayanGiftForFee(22_499, PACKS).credits, 0);
  // budget exactly ₱90 → 150
  assert.deepEqual(setnayanGiftForFee(22_500, PACKS), { credits: 150, chargeCentavos: 9_000, capped: false });
  // budget ₱290 → halfway 150↔1,000 → 575
  assert.deepEqual(setnayanGiftForFee(72_500, PACKS), { credits: 575, chargeCentavos: 29_000, capped: false });
  // budget ≥ ₱990 → the top pack, charge stops at ₱990
  assert.deepEqual(setnayanGiftForFee(1_000_000, PACKS), { credits: 3_000, chargeCentavos: 99_000, capped: true });
});

test('THE FLOOR — below the smallest rung there is no gift and no charge', () => {
  // budget ₱99.99 < ₱100 rung
  assert.deepEqual(setnayanGiftForFee(24_999, LADDER), { credits: 0, chargeCentavos: 0, capped: false });
  // budget exactly ₱100 → the smallest rung, 100 photos
  assert.equal(setnayanGiftForFee(25_000, LADDER).credits, 100);
  assert.equal(setnayanGiftForFee(0, LADDER).credits, 0);
  assert.equal(setnayanGiftForFee(-5, LADDER).credits, 0);
  assert.equal(setnayanGiftForFee(Number.NaN, LADDER).credits, 0);
});

test('monotonic — a bigger fee never buys fewer photos', () => {
  let prev = 0;
  for (let booking = 0; booking <= 5_000_000; booking += 7_919) {
    const c = setnayanGiftForFee(feeFor(booking), LADDER).credits;
    assert.ok(c >= prev, `booking ₱${booking}: ${c} < ${prev}`);
    prev = c;
  }
});

test('the ladder: regular price, PAPIC_GUEST* only, active only, 100,000 rung OFF', () => {
  const ladder = giftLadderFrom(
    [
      { service_code: 'PAPIC_GUEST_100', retail_price_php: '1.00', is_active: true },
      { service_code: 'PAPIC_GUEST_50K', retail_price_php: '100.00', is_active: true },
      { service_code: 'PAPIC_GUEST_100K', retail_price_php: '150.00', is_active: true },
      { service_code: 'PAPIC_GUEST_RETIRED', retail_price_php: '2.00', is_active: true, retired_at: '2026-01-01' },
      { service_code: 'PAPIC_GUEST_OFF', retail_price_php: '3.00', is_active: false },
      { service_code: 'LIVE_STUDIO', retail_price_php: '5.00', is_active: true },
    ],
    [
      { service_code: 'PAPIC_GUEST_100', points: 100, is_active: true },
      { service_code: 'PAPIC_GUEST_50K', points: 50_000, is_active: true },
      { service_code: 'PAPIC_GUEST_100K', points: 100_000, is_active: true },
      { service_code: 'PAPIC_GUEST_RETIRED', points: 200, is_active: true },
      { service_code: 'PAPIC_GUEST_OFF', points: 300, is_active: true },
      { service_code: 'LIVE_STUDIO', points: 400, is_active: true },
    ],
  );
  assert.deepEqual(ladder, [
    { credits: 100, priceCentavos: 100 },
    { credits: 50_000, priceCentavos: 10_000 },
  ]);
});

test('a ladder whose price does not rise with credits is refused, not guessed', () => {
  const ladder = giftLadderFrom(
    [
      { service_code: 'PAPIC_GUEST_A', retail_price_php: 10, is_active: true },
      { service_code: 'PAPIC_GUEST_B', retail_price_php: 10, is_active: true },
    ],
    [
      { service_code: 'PAPIC_GUEST_A', points: 100, is_active: true },
      { service_code: 'PAPIC_GUEST_B', points: 200, is_active: true },
    ],
  );
  assert.deepEqual(ladder, []);
});

test('SAID IN PHOTOGRAPHS — and the COUPLE is never told pesos', () => {
  // ⚖ Owner 2026-09-09: the couple is told photographs, never pesos. The
  // SUPPLIER is the one paying, so their own line carries the charge — and
  // owner 2026-09-15, asked whether the composer should show the upside alone:
  // "show both". The old version of this test forbade pesos for BOTH
  // audiences, which would have made that instruction unbuildable.
  const gift = { credits: 1_429, chargeCentavos: 100_000 };
  const couple = giftQuoteCopy(gift, 'couple', { businessName: 'Studio Vera' });
  const supplier = giftQuoteCopy(gift, 'supplier');
  assert.ok(couple);
  assert.ok(supplier);

  // Both headlines speak in photographs and never in money.
  for (const c of [couple, supplier]) {
    assert.match(c.headline, /1,429 free Papic photos/);
    assert.doesNotMatch(c.headline, /₱|PHP|peso/i);
  }

  // 🔒 THE COUPLE'S WHOLE BLOCK IS MONEY-FREE — headline and detail.
  assert.doesNotMatch(couple.detail, /₱|PHP|peso|credit/i);
  assert.match(couple.detail, /Studio Vera/);

  // 🔒 AND THE SUPPLIER IS TOLD WHAT IT COSTS — this is the "show both" half,
  // and its absence is what made the composer one-sided.
  assert.match(supplier.detail, /₱1,000/);

  // No gift ⇒ say NOTHING. Never "0 photos", which advertises an absence.
  assert.equal(giftQuoteCopy({ credits: 0, chargeCentavos: 0 }, 'couple'), null);
  assert.equal(giftQuoteCopy(null, 'supplier'), null);
});

// 💝 GIFT PRICE (owner 2026-11-04) — an invented gift ladder beside the list one.
const GIFT_LADDER: GiftRung[] = [
  { credits: 100, priceCentavos: 10_000, giftPriceCentavos: 9_000 },
  { credits: 1_000, priceCentavos: 50_000, giftPriceCentavos: 45_000 },
  { credits: GIFT_CAP_CREDITS, priceCentavos: 1_000_000, giftPriceCentavos: 900_000 },
];

test('💝 the gift price charges the SAME photos less; absent the option, the list charge', () => {
  for (const fee of [25_000, 100_000, 1_234_600, 50_000_000, 999_999_999]) {
    const list = setnayanGiftForFee(fee, GIFT_LADDER);
    const gift = setnayanGiftForFee(fee, GIFT_LADDER, { giftPrice: true });
    assert.equal(gift.credits, list.credits, 'the couple gets the same photos');
    assert.equal(gift.capped, list.capped);
    assert.ok(gift.chargeCentavos <= list.chargeCentavos, 'never above the list');
    if (list.credits > 0) assert.ok(gift.chargeCentavos < list.chargeCentavos, `cheaper at fee ${fee}`);
  }
  // exactly on a rung → that rung's gift price; at the cap → the top rung's gift price
  assert.equal(giftChargeAtGiftPrice(1_000, GIFT_LADDER), 45_000);
  assert.equal(setnayanGiftForFee(999_999_999, GIFT_LADDER, { giftPrice: true }).chargeCentavos, 900_000);
  // between rungs → interpolated, rounded half up: 550 credits = 9,000 + 450×36,000/900 = 27,000
  assert.equal(giftChargeAtGiftPrice(550, GIFT_LADDER), 27_000);
});

test('💝 a ladder with any rung missing its gift price charges the list price — never a guess', () => {
  const holed = GIFT_LADDER.map((r, i) => (i === 1 ? { ...r, giftPriceCentavos: null } : r));
  assert.equal(giftChargeAtGiftPrice(550, holed), null);
  assert.deepEqual(setnayanGiftForFee(100_000, holed, { giftPrice: true }), setnayanGiftForFee(100_000, holed));
  const flat = GIFT_LADDER.map((r, i) => (i === 1 ? { ...r, giftPriceCentavos: 9_000 } : r));
  assert.equal(giftChargeAtGiftPrice(550, flat), null, 'a gift price that does not rise is refused');
});

test('💝 giftLadderFrom reads gift_price_php off the row', () => {
  const ladder = giftLadderFrom(
    [
      { service_code: 'PAPIC_GUEST_A', retail_price_php: 100, gift_price_php: '90', is_active: true },
      { service_code: 'PAPIC_GUEST_B', retail_price_php: 500, gift_price_php: null, is_active: true },
    ],
    [
      { service_code: 'PAPIC_GUEST_A', points: 100, is_active: true },
      { service_code: 'PAPIC_GUEST_B', points: 1000, is_active: true },
    ],
  );
  assert.deepEqual(ladder.map((r) => r.giftPriceCentavos), [9_000, null]);
});

test('the gift limit is the ADMIN SETTING passed in (owner 8 Nov 2026) — 25% sizes a smaller gift than 40%', () => {
  // fee 1,000.00: at 40% the budget is 400.00; at 25% it is 250.00.
  assert.equal(setnayanGiftForFee(100_000, LADDER).chargeCentavos, 40_000, 'absent → the ruled default');
  assert.equal(setnayanGiftForFee(100_000, LADDER, { limitPct: 40 }).chargeCentavos, 40_000);
  assert.equal(setnayanGiftForFee(100_000, LADDER, { limitPct: 25 }).chargeCentavos, 25_000);
  assert.ok(
    setnayanGiftForFee(100_000, LADDER, { limitPct: 25 }).credits < setnayanGiftForFee(100_000, LADDER, { limitPct: 40 }).credits,
  );
  // 0 is a real setting (no gift), and anything outside 0–100 falls back to the default — never to more.
  assert.equal(setnayanGiftForFee(100_000, LADDER, { limitPct: 0 }).credits, 0);
  assert.equal(setnayanGiftForFee(100_000, LADDER, { limitPct: 400 }).chargeCentavos, 40_000);
  assert.equal(setnayanGiftForFee(100_000, LADDER, { limitPct: Number.NaN }).chargeCentavos, 40_000);
});

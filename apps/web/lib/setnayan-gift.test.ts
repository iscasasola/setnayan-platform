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
  GIFT_SHARE_OF_FEE_PCT,
  giftLadderFrom,
  giftQuoteLine,
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
  assert.equal(GIFT_SHARE_OF_FEE_PCT, 40);
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

test('no 50,000 rung on the ladder ⇒ no gift (never an uncapped one)', () => {
  const noCap = LADDER.filter((r) => r.credits !== GIFT_CAP_CREDITS);
  assert.deepEqual(setnayanGiftForFee(99_000_000, noCap), {
    credits: 0,
    chargeCentavos: 0,
    capped: false,
  });
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

test('SAID IN PHOTOGRAPHS — the quote line has a count and never a peso sign', () => {
  const couple = giftQuoteLine({ credits: 1_429 }, 'couple');
  const supplier = giftQuoteLine({ credits: 1_429 }, 'supplier');
  for (const line of [couple, supplier]) {
    assert.ok(line);
    assert.match(line, /1,429 free Papic photos/);
    assert.doesNotMatch(line, /₱|PHP|peso|credit/i);
  }
  assert.equal(giftQuoteLine({ credits: 0 }, 'couple'), null);
});

/**
 * lib/offers.test.ts — 🔒 THE OFFER MAKER'S SETTLED RULES (Build 6 · Lane D; DECISION_LOG 2026-11-09 → 11).
 *
 * Every rule the owner settled for offers is a test here, and each test can go red:
 *   1. one offer mixes % and ₱: the % comes off the card price FIRST, then the ₱ off what is left; never below ₱0;
 *   2. offers never stack — the single best price result wins, through the ONE function (`pickBestDiscount`);
 *   3. the lowest first payment wins, and it rides WITH the best price result (it never cuts the price);
 *   4. the supplier's OWN gifts have no gift limit — only Setnayan gifts count (10 Nov "all yes");
 *   5. the stocked gift price is Verified-and-up only; a Free shop pays the list price (10 Nov "all yes");
 *   6. the same gift from two offers is given ONCE (10 Nov "all yes");
 *   7. "Event date in a season" (the off-season offer, 11 Nov) is about the EVENT date, How long is about booking;
 *   8. How long: NULL = until switched off; a date = the last day to book, then Ended.
 * The fixture numbers below are TEST data for the arithmetic, never a price anything charges.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestFirstPayment,
  blankOffer,
  checkGifts,
  giftsFor,
  offerCandidatesFor,
  offerProblem,
  offerStatus,
  priceSteps,
  seasonFromLeanMonths,
  stockLine,
  whoLine,
  workedLine,
  type GiftContext,
  type Offer,
} from './offers';
import { pickBestDiscount } from './vendor-service-public';
import { shopGiftPacksFrom, tierPaysGiftPrice } from './shop-gifts';
import type { BookingFeeSchedule } from './booking-fee';

const TODAY = '2026-11-12';
const NOW = new Date('2026-11-12T04:00:00.000Z');
const offer = (p: Partial<Offer>): Offer => ({ ...blankOffer('o1'), name: 'Test', ...p });

// Test fixtures for the arithmetic only — the build reads the live schedule, limit and catalogue.
const SCHEDULE: BookingFeeSchedule = { rate: 0.05, tailRate: 0.01, tier1LimitPhp: 100_000, minPhp: 50 };
const PACKS = shopGiftPacksFrom([
  { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99, giftPricePhp: 90 },
  { code: 'PAPIC_GUEST_1K', title: 'Papic 1000', credits: 1000, pricePhp: 499, giftPricePhp: 449 },
  { code: 'PAPIC_GUEST', title: 'Papic 3000', credits: 3000, pricePhp: 999, giftPricePhp: 899 },
]);
const ctx = (p: Partial<GiftContext> = {}): GiftContext => ({
  packs: PACKS,
  schedule: SCHEDULE,
  limitPct: 40,
  paysGiftPrice: true,
  free: { papic: 6000, event_plus: 0, event_pro: 0, event_ultra: 0 },
  addons: [{ id: 7, cardId: 'c1', label: 'Extra hour', fromPhp: 8000 }],
  ...p,
});

test('1 · % first, then ₱ off what is left — ₱110,000 → ₱99,000 → ₱94,000, never below ₱0', () => {
  const o = offer({ pctOff: 10, phpOff: 5000 });
  assert.deepEqual(priceSteps(o, 110_000), [110_000, 99_000, 94_000]);
  assert.equal(workedLine(o, 110_000), '₱110,000 → ₱99,000 → ₱94,000');
  assert.deepEqual(priceSteps(offer({ phpOff: 50_000 }), 20_000), [20_000, 0]);
});

test('2 · offers never stack — the single best price result wins, in pickBestDiscount', () => {
  const a = offer({ id: 'a', name: 'Shop-wide 10%', pctOff: 10 });
  const b = offer({ id: 'b', name: 'Launch', pctOff: 10, phpOff: 5000 });
  const c = offer({ id: 'c', name: '₱3,000 off', phpOff: 3000 });
  const best = pickBestDiscount(offerCandidatesFor([a, b, c], 'c1', TODAY), 110_000, { now: NOW });
  assert.ok(best);
  assert.equal(best.offerId, 'b');
  // 16,000 = the Launch offer alone; 10% + Launch + ₱3,000 stacked would be far more.
  assert.equal(best.savingsPhp, 16_000);
  assert.equal(best.label, '10% + ₱5,000 off');
});

test('2b · a card discount row and an offer compete — still one winner', () => {
  const row = { vendor_service_id: 'c1', discount_type: 'promo' as const, rate: 20, unit: 'pct' as const, min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 };
  const best = pickBestDiscount([row, ...offerCandidatesFor([offer({ pctOff: 10 })], 'c1', TODAY)], 100_000, { now: NOW });
  assert.equal(best?.savingsPhp, 20_000);
  assert.equal(best?.offerId, null);
});

test('2c · Off, Ended and all-taken offers give couples nothing', () => {
  const list = [
    offer({ id: 'off', pctOff: 50, isOn: false }),
    offer({ id: 'ended', pctOff: 50, untilDate: '2026-11-11' }),
    offer({ id: 'taken', pctOff: 50, who: 'first_n', firstNCap: 5, firstNTaken: 5 }),
  ];
  assert.equal(offerCandidatesFor(list, 'c1', TODAY).length, 0);
  assert.equal(offerStatus(list[0]!, TODAY).label, 'Off');
  assert.equal(offerStatus(list[1]!, TODAY).label, 'Ended');
  assert.equal(offerStatus(list[2]!, TODAY).label, 'All 5 taken');
  // The last day to book is still bookable.
  assert.equal(offerStatus(offer({ untilDate: TODAY }), TODAY).k, 'run');
});

test('2d · an offer reaches only the cards it was given', () => {
  const o = offer({ pctOff: 10, reachesAll: false, cards: ['c2'] });
  assert.equal(offerCandidatesFor([o], 'c1', TODAY).length, 0);
  assert.equal(offerCandidatesFor([o], 'c2', TODAY).length, 1);
});

test('3 · the lowest first payment wins and never changes the price', () => {
  const a = offer({ id: 'a', firstPayment: 5000 });
  const b = offer({ id: 'b', firstPayment: 10, firstPaymentUnit: 'pct' });
  const fp = bestFirstPayment([a, b], 'c1', 94_000, TODAY);
  assert.equal(fp?.offer.id, 'a');
  assert.equal(fp?.amount, 5000);
  // A first-payment-only offer is not a price candidate.
  assert.equal(offerCandidatesFor([a], 'c1', TODAY).length, 0);
});

test('4 · own gifts have NO limit; Setnayan gifts are summed against the live limit', () => {
  // ₱20,000 → fee ₱1,000 → limit 40% = ₱400. Papic 150 always allowed; Papic 1000 (₱499) does not fit.
  const chk = checkGifts(
    [
      { kind: 'addon', addonId: 7 },
      { kind: 'typed', label: 'Free tasting for two', worthPhp: 1500 },
      { kind: 'sn', code: 'PAPIC_GUEST_150' },
      { kind: 'sn', code: 'PAPIC_GUEST_1K' },
    ],
    20_000,
    ctx(),
  );
  assert.equal(chk.limitCentavos, 40_000);
  assert.deepEqual(chk.items.map((x) => x.ok), [true, true, true, false]);
  assert.match(chk.items[0]!.why, /no limit/);
  assert.match(chk.items[1]!.why, /no limit/);
  assert.match(chk.items[2]!.why, /always allowed/);
  assert.match(chk.items[3]!.why, /doesn’t fit/);
});

test('5 · the stocked gift price is Verified-and-up only — a Free shop pays the list price', () => {
  assert.equal(tierPaysGiftPrice('free'), false);
  assert.equal(tierPaysGiftPrice('verified'), true);
  const p1k = PACKS.find((p) => p.code === 'PAPIC_GUEST_1K')!;
  assert.match(stockLine(p1k, ctx({ paysGiftPrice: true })), /₱449 each from stock · ₱499 on the booking fee/);
  assert.doesNotMatch(stockLine(p1k, ctx({ paysGiftPrice: false })), /₱449/);
  assert.match(stockLine(p1k, ctx({ free: null })), /Couldn’t read your stock/);
});

test('6 · the same gift from two offers is given once', () => {
  const a = offer({ id: 'a', gifts: [{ kind: 'addon', addonId: 7 }] });
  const b = offer({ id: 'b', gifts: [{ kind: 'addon', addonId: 7 }, { kind: 'sn', code: 'PAPIC_GUEST_150' }] });
  const got = giftsFor([a, b], 'c1', 110_000, TODAY, ctx());
  assert.deepEqual(got.map((g) => `${g.offer.id}:${g.gift.kind}`), ['a:addon', 'b:sn']);
});

test('7 · "Event date in a season" is the EVENT window — the off-season offer', () => {
  const o = offer({ pctOff: 15, who: 'season', seasonFrom: '2027-06-01', seasonTo: '2027-08-31' });
  const cands = offerCandidatesFor([o], 'c1', TODAY);
  assert.equal(pickBestDiscount(cands, 100_000, { now: NOW, eventDate: '2027-07-10' })?.savingsPhp, 15_000);
  assert.equal(pickBestDiscount(cands, 100_000, { now: NOW, eventDate: '2027-12-10' }), null);
  // Anonymous: the badge names the window instead of claiming they qualify.
  assert.match(pickBestDiscount(cands, 100_000, { now: NOW })!.label, /^15% off · events /);
  assert.match(whoLine(o), /^Events /);
  assert.equal(offerProblem({ ...o, seasonTo: null }), 'Pick the first and last day of the season.');
});

test('8 · How long — until switched off by default; the last day to book includes that day', () => {
  const forever = offer({ pctOff: 10 });
  assert.equal(offerCandidatesFor([forever], 'c1', TODAY)[0]!.expires_at, null);
  const dated = offer({ pctOff: 10, untilDate: '2026-11-30' });
  assert.equal(offerCandidatesFor([dated], 'c1', TODAY)[0]!.expires_at, '2026-11-30T23:59:59+08:00');
});

test('an early-bird offer joins the shipped ladder and names its rung', () => {
  const o = offer({ pctOff: 15, who: 'early_bird', minLeadMonths: 12 });
  const best = pickBestDiscount(offerCandidatesFor([o], 'c1', TODAY), 100_000, { now: NOW, eventDate: '2028-03-01' });
  assert.equal(best?.leadTier, 12);
  assert.equal(best?.offerId, 'o1');
});

test('a new offer asks for every answer before it saves — nothing is guessed', () => {
  const o = blankOffer();
  assert.equal(o.pctOff, null);
  assert.equal(o.phpOff, null);
  assert.equal(o.firstPayment, null);
  assert.equal(offerProblem(o), 'Give it a name couples will read.');
  assert.equal(offerProblem({ ...o, name: 'X' }), 'Choose what they get under 3.');
  assert.equal(offerProblem({ ...o, name: 'X', pctOff: 10 }), null);
});

test('the season starts from the shop’s slow months — the next window, never in the past', () => {
  assert.deepEqual(seasonFromLeanMonths([6, 7, 8], '2026-11-12', 'June, July, and August', 'ph_default'), {
    from: '2027-06-01',
    to: '2027-08-31',
    monthsLabel: 'June, July, and August',
    source: 'ph_default',
  });
  // November itself is under way → next November; December is still ahead this year.
  assert.equal(seasonFromLeanMonths([11, 12], '2026-11-12', '', 'own_calendar')?.from, '2026-12-01');
  assert.equal(seasonFromLeanMonths([], '2026-11-12', '', 'ph_default'), null);
});

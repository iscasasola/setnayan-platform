/**
 * 🧺 THE BUNDLE MAKER'S SUMS (owner 9 Nov 2026 — each card at its lowest · an extra discount in pesos only, above ₱0
 * and below the total · the new total is the bundle's one price · its plan adds up to it · inclusions gathered and
 * labelled). Prototype: specs `prototypes/shop_discounts_bundle_card_open_2026-11-09/bundle-maker.html` v3.
 *
 * The figures below are test fixtures, not prices: every bundle price is computed from the shop's own card prices.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleProblems,
  bundleSums,
  cardLowest,
  countsForEveryCouple,
  gatherInclusions,
  parseBundlePlan,
  pinnedTotalLine,
  planDraftsOrDefault,
  resolveBundlePlan,
  totalCentavos,
  type BundleCardFacts,
} from './bundle-sums';
import { DEFAULT_QUOTE_PLAN } from './proposal-payment-schedule';
import type { VendorServiceDiscount } from './vendor-services';

const NOW = new Date('2026-11-10T00:00:00Z');
const php = (n: number) => `₱${n.toLocaleString('en-PH')}`;

const disc = (over: Partial<VendorServiceDiscount>): VendorServiceDiscount => ({
  vendor_service_id: 'c1',
  discount_type: 'promo',
  rate: 10,
  unit: 'pct',
  min_lead_months: null,
  expires_at: null,
  conditions_md: null,
  sort_order: 0,
  ...over,
});

const bar: BundleCardFacts = {
  id: 'c1',
  name: 'Mobile Bar',
  pricePhp: 110000,
  discounts: [disc({ rate: 10 })],
  inclusions: [
    { label: '2 bartenders' },
    { label: 'Glassware' },
  ],
};
const mocktail: BundleCardFacts = {
  id: 'c4',
  name: 'Mocktail station',
  pricePhp: 45000,
  discounts: [],
  inclusions: [{ label: '2 Bartenders' }, { label: '4 hours' }],
};

test('a card counts at its price minus its best discount that is on', () => {
  const l = cardLowest(bar, NOW);
  assert.equal(l.pricePhp, 110000);
  assert.equal(l.lowestPhp, 99000);
  assert.match(l.offer ?? '', /10%/);
  assert.equal(cardLowest(mocktail, NOW).lowestPhp, 45000, 'no discount on → the card price');
});

test('the best discount wins and never stacks', () => {
  const two = { ...bar, discounts: [disc({ rate: 10 }), disc({ discount_type: 'bundle', unit: 'php', rate: 15000 })] };
  assert.equal(cardLowest(two, NOW).lowestPhp, 95000, '₱15,000 beats 10% (₱11,000) — and only one applies');
});

test('only a discount every couple gets lowers a fixed bundle price', () => {
  for (const t of ['early_booking', 'off_peak', 'returning'] as const) {
    assert.equal(countsForEveryCouple(disc({ discount_type: t }), NOW), false, `${t} depends on the couple`);
    assert.equal(cardLowest({ ...bar, discounts: [disc({ discount_type: t, rate: 30 })] }, NOW).lowestPhp, 110000);
  }
  assert.equal(countsForEveryCouple(disc({ discount_type: 'promo', expires_at: '2026-11-01T00:00:00Z' }), NOW), false, 'an ended promo is off');
  assert.equal(countsForEveryCouple(disc({ discount_type: 'bundle' }), NOW), true);
});

test('the new total is the cards at their lowest minus the extra discount', () => {
  const s = bundleSums([bar, mocktail], 9000, NOW);
  assert.equal(s.cardsTotalPhp, 144000);
  assert.equal(s.cardsListPhp, 155000);
  assert.equal(s.newTotalPhp, 135000);
  assert.equal(totalCentavos(s), 13500000);
  assert.equal(pinnedTotalLine(s, php), '2 cards · ₱144,000 − ₱9,000');
  assert.equal(pinnedTotalLine(bundleSums([bar, mocktail], 0, NOW), php), '2 cards · at their lowest');
  assert.equal(pinnedTotalLine(bundleSums([], 0, NOW), php), 'Pick cards to see it');
});

test('the extra discount must sit below the total; 0 means none', () => {
  const ok = bundleSums([bar, mocktail], 0, NOW);
  assert.deepEqual(bundleProblems(ok, null, php), []);
  const at = bundleSums([bar, mocktail], 144000, NOW);
  assert.ok(bundleProblems(at, null, php).some((p) => p.code === 'bundle_extra_not_below_total'));
  assert.equal(bundleSums([bar], -500, NOW).extraPhp, 0, 'a negative extra never adds to the price');
});

test('a bundle is two or more cards, and every card needs a price', () => {
  assert.ok(bundleProblems(bundleSums([bar], 0, NOW), null, php).some((p) => p.code === 'bundle_needs_two_cards'));
  const unpriced = bundleProblems(bundleSums([bar, { ...mocktail, pricePhp: null }], 0, NOW), null, php);
  assert.ok(unpriced.some((p) => p.code === 'bundle_card_unpriced' && p.message.startsWith('Mocktail station')));
});

test('the plan is a COPY of the default and its last payment balances to the new total', () => {
  const d = planDraftsOrDefault(null);
  assert.deepEqual(d.manual, DEFAULT_QUOTE_PLAN.manual);
  d.manual[0]!.percent = 50;
  assert.notEqual(DEFAULT_QUOTE_PLAN.manual[0]!.percent, 50, 'editing the bundle plan never edits the default');
  const r = resolveBundlePlan(planDraftsOrDefault(null), 135000);
  assert.equal(r.balances, true);
  assert.equal(r.total_centavos, 13500000);
  assert.equal(r.installments.at(-1)?.is_auto_balance, true, 'the last payment is the automatic balance');
});

test('a plan that pays more than the new total is refused with words', () => {
  const over = { manual: [{ label: 'First payment', kind: 'fixed' as const, amountPhp: 200000, percent: null, due: 'on_lock' as const, offsetDays: 0 }], autoBalance: DEFAULT_QUOTE_PLAN.autoBalance };
  const s = bundleSums([bar, mocktail], 0, NOW);
  const probs = bundleProblems(s, resolveBundlePlan(over, s.newTotalPhp), php);
  assert.ok(probs.some((p) => p.code === 'bundle_plan_over_total' && p.message.includes('₱144,000')));
});

test('a stored plan of an unknown shape reads as no plan of its own', () => {
  assert.equal(parseBundlePlan(null), null);
  assert.equal(parseBundlePlan({ manual: [] , autoBalance: {} }), null);
  assert.equal(parseBundlePlan('x'), null);
  assert.ok(parseBundlePlan({ manual: [DEFAULT_QUOTE_PLAN.manual[0]], autoBalance: DEFAULT_QUOTE_PLAN.autoBalance }));
});

test('what the couple gets is merged, de-duplicated and labelled with its card', () => {
  const g = gatherInclusions([bar, mocktail]);
  assert.deepEqual(
    g.map((x) => `${x.label}|${x.card}`),
    ['2 bartenders|Mobile Bar', 'Glassware|Mobile Bar', '4 hours|Mocktail station'],
  );
});

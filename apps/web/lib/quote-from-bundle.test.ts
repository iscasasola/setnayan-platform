/**
 * 🧺 DOOR 3 · "START FROM A BUNDLE" ON THE QUOTE (owner 11 Nov 2026: *"they can load a bundle also and edit from it."*).
 *
 * Fails if a bundle loaded into the quote stops coming to the Bundle Maker's New total (each card at its lowest, the
 * extra discount off the sum — `bundleSums`, #7479), loses the cards' gathered inclusions, invents a discount the bundle
 * has not got, or drops the bundle's own plan / the default copy. The figures are fixtures, not prices.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleSums, type BundleCardFacts } from './bundle-sums';
import { DEFAULT_QUOTE_PLAN } from './proposal-payment-schedule';
import { quoteSeedFromBundle } from './quote-from-bundle';

const NOW = new Date('2026-11-11T00:00:00Z');
const cardA: BundleCardFacts = {
  id: 'a',
  name: 'Garden Set · full day',
  pricePhp: 45000,
  discounts: [{ vendor_service_id: 'a', discount_type: 'promo', rate: 10, unit: 'pct', min_lead_months: null, expires_at: null, conditions_md: null, sort_order: 0 }],
  inclusions: [{ label: 'Online gallery' }, { label: 'Second shooter' }],
};
const cardB: BundleCardFacts = { id: 'b', name: 'Engagement shoot', pricePhp: 8000, discounts: [], inclusions: [{ label: 'online gallery' }] };

const total = (s: ReturnType<typeof quoteSeedFromBundle>) => s.lines.reduce((a, l) => a + (l.free ? 0 : l.flatPhp), 0) - s.discountPhp;

test('the quote opens at the Bundle Maker’s New total — each card at its lowest, minus the extra', () => {
  const seed = quoteSeedFromBundle({ name: 'Wedding day pair', extraDiscountCentavos: 300000, plan: null, savedTotalCentavos: 4650000 }, [cardA, cardB], NOW);
  const sums = bundleSums([cardA, cardB], 3000, NOW);
  assert.equal(seed.totalPhp, sums.newTotalPhp);
  assert.equal(total(seed), sums.newTotalPhp, 'the quote’s lines and discount do not come to the bundle’s total');
  assert.deepEqual(seed.lines.filter((l) => !l.free).map((l) => [l.label, l.flatPhp]), [
    ['Garden Set · full day', 40500],
    ['Engagement shoot', 8000],
  ]);
  assert.equal(seed.discountPhp, 3000);
  assert.equal(seed.discountReason, 'Wedding day pair · bundle price');
  assert.deepEqual(seed.cardIds, ['a', 'b']);
  assert.equal(seed.savedTotalPhp, 46500);
});

test('what the couple gets rides along as complimentary lines, merged', () => {
  const seed = quoteSeedFromBundle({ name: 'Pair', extraDiscountCentavos: 0, plan: null, savedTotalCentavos: null }, [cardA, cardB], NOW);
  assert.deepEqual(seed.lines.filter((l) => l.free).map((l) => [l.label, l.flatPhp]), [
    ['Online gallery', 0],
    ['Second shooter', 0],
  ]);
  assert.equal(seed.discountPhp, 0);
  assert.equal(seed.discountReason, null, 'a bundle with no extra discount gave the quote a reason for none');
});

test('the plan is the bundle’s own, else a copy of the one default', () => {
  const own = { manual: [{ label: 'First payment', kind: 'percent' as const, amountPhp: null, percent: 30, due: 'on_lock' as const, offsetDays: 0 }], autoBalance: { ...DEFAULT_QUOTE_PLAN.autoBalance } };
  assert.deepEqual(quoteSeedFromBundle({ name: 'P', extraDiscountCentavos: 0, plan: own, savedTotalCentavos: null }, [cardA, cardB], NOW).plan, own);
  const copy = quoteSeedFromBundle({ name: 'P', extraDiscountCentavos: 0, plan: null, savedTotalCentavos: null }, [cardA, cardB], NOW).plan;
  assert.deepEqual(copy.manual, DEFAULT_QUOTE_PLAN.manual);
  assert.notEqual(copy.manual, DEFAULT_QUOTE_PLAN.manual, 'the quote would edit the shared default in place');
});

test('an unpriced card is named, never priced at ₱0 silently', () => {
  const seed = quoteSeedFromBundle({ name: 'P', extraDiscountCentavos: 0, plan: null, savedTotalCentavos: null }, [cardA, { ...cardB, pricePhp: null }], NOW);
  assert.deepEqual(seed.unpriced, ['Engagement shoot']);
});

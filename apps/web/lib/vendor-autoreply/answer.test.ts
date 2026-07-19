import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAnswer, formatPhp, formatCentavosPhp } from './answer';
import type { EngineInput, StoreService, VendorStoreSnapshot } from './types';

const baseService: StoreService = {
  serviceId: 's1',
  category: 'wedding_photography',
  title: 'Wedding Signature',
  startingPricePhp: 48000,
  pricingBasis: 'per_pax',
  perPaxPricePhp: 320,
  minPax: 150,
  basePax: 150,
  hourBasePhp: null,
  minHours: null,
  extraHourPhp: null,
  addedPaxPricePhp: 200,
  crewSize: 4,
  crewMealIncluded: true,
  transportIncluded: false,
  transportFlatFeePhp: null,
  recommendedLeadTimeMonths: 6,
  lastMinuteEndMonths: 1,
  lastMinuteSurchargePct: 15,
  dailyCapacity: 1,
  inclusions: [
    { label: 'Pre-nup shoot', worthPhp: 5000 },
    { label: '2 photographers', worthPhp: null },
  ],
  discounts: [{ type: 'early_booking', rate: 10, unit: 'pct' }],
  addons: [{ label: 'Extra album', fromPricePhp: 3000 }],
};

function store(overrides: Partial<VendorStoreSnapshot> = {}): VendorStoreSnapshot {
  return {
    businessName: 'Blooms & Co.',
    services: [baseService],
    packages: [],
    coverages: [
      { canonicalService: 'wedding_photography', eventTypes: ['wedding'], faiths: [], label: 'Metro Manila' },
    ],
    reviews: [{ ratingOverall: 5, body: 'Amazing team, highly recommend!', createdAt: '2027-01-01' }],
    avgRating: 4.8,
    reviewCount: 32,
    ...overrides,
  };
}

function input(s: VendorStoreSnapshot = store(), extra: Partial<EngineInput> = {}): EngineInput {
  return { inquiryText: '', store: s, ...extra };
}

test('formatPhp / formatCentavosPhp', () => {
  assert.equal(formatPhp(48000), '₱48,000');
  assert.equal(formatPhp(null), '');
  assert.equal(formatCentavosPhp(4800000), '₱48,000');
});

test('price answer quotes the real per-pax rate', () => {
  const a = buildAnswer('price', input());
  assert.ok(a, 'expected a price answer');
  assert.ok(a.includes('₱48,000'), a);
  assert.ok(a.includes('₱320/guest'), a);
  assert.ok(a.includes('min 150 pax'), a);
});

test('price returns null when nothing is priced', () => {
  const s = store({ services: [{ ...baseService, startingPricePhp: null }], packages: [] });
  assert.equal(buildAnswer('price', input(s)), null);
});

test('inclusions: package items first, else service inclusions', () => {
  const withPkg = store({
    packages: [
      {
        packageId: 'p1',
        name: 'Signature',
        description: null,
        totalPriceCentavos: 4800000,
        items: [
          { description: 'Full-day coverage', included: true },
          { description: 'Drone', included: false },
        ],
      },
    ],
  });
  const a = buildAnswer('inclusions', input(withPkg));
  assert.ok(a && a.includes('Full-day coverage'), a ?? 'null');
  assert.ok(!a.includes('Drone'), a);

  const a2 = buildAnswer('inclusions', input(store({ packages: [] })));
  assert.ok(a2 && a2.includes('Pre-nup shoot'), a2 ?? 'null');
});

test('coverage / discount / social_proof / capability / lead_time', () => {
  assert.ok(buildAnswer('coverage', input())?.includes('Wedding'));
  assert.ok(buildAnswer('discount', input())?.includes('10% off'));
  const sp = buildAnswer('social_proof', input());
  assert.ok(sp?.includes('4.8★') && sp.includes('32 review'), sp ?? 'null');
  assert.ok(buildAnswer('capability', input())?.includes('Wedding Signature'));
  const lt = buildAnswer('lead_time', input());
  assert.ok(lt?.includes('6 month') && lt.includes('15% rush'), lt ?? 'null');
});

test('discount with no promos is still a truthful answer', () => {
  const s = store({ services: [{ ...baseService, discounts: [] }] });
  assert.ok(buildAnswer('discount', input(s))?.includes("don't have a running promo"));
});

test('availability depends on the date + signal', () => {
  const withDate: Partial<EngineInput> = {
    event: { primaryDate: '2027-06-14', candidateDates: ['2027-06-14'], pax: 150, budgetPerHeadPhp: null, region: 'NCR' },
  };
  assert.ok(
    buildAnswer('availability', input(store(), { ...withDate, signals: { dateAvailable: true } }))?.includes('looks open'),
  );
  assert.ok(
    buildAnswer('availability', input(store(), { ...withDate, signals: { dateAvailable: false } }))?.includes('already booked'),
  );
  assert.ok(buildAnswer('availability', input(store(), withDate))?.includes('confirm'));
  assert.ok(buildAnswer('availability', input())?.includes('which date'));
});

test('price: per_hour with no minHours never invents a duration', () => {
  const s = store({
    services: [
      { ...baseService, pricingBasis: 'per_hour', startingPricePhp: 15000, hourBasePhp: 15000, minHours: null, extraHourPhp: 3000, perPaxPricePhp: null, minPax: null, basePax: null },
    ],
  });
  const a = buildAnswer('price', input(s));
  assert.ok(a?.includes('₱15,000'), a ?? 'null');
  assert.ok(!/covers \d+ hr/.test(a ?? ''), `must not fabricate a duration: ${a}`);
  assert.ok(a?.includes('+₱3,000/extra hr'), a ?? 'null');
});

test('price: per_hour with minHours states the covered hours', () => {
  const s = store({
    services: [
      { ...baseService, pricingBasis: 'per_hour', startingPricePhp: 20000, hourBasePhp: 20000, minHours: 4, extraHourPhp: 3000, perPaxPricePhp: null, minPax: null, basePax: null },
    ],
  });
  assert.ok(buildAnswer('price', input(s))?.includes('covers 4 hrs'));
});

test('price: fixed service quotes basePax', () => {
  const s = store({
    services: [{ ...baseService, pricingBasis: 'fixed', startingPricePhp: 60000, perPaxPricePhp: null, minPax: null, basePax: 100 }],
  });
  assert.ok(buildAnswer('price', input(s))?.includes('up to 100 pax'));
});

test('price: package line converts centavos to PHP', () => {
  const s = store({
    services: [],
    packages: [{ packageId: 'p1', name: 'Gold', description: null, totalPriceCentavos: 4800000, items: [] }],
  });
  assert.ok(buildAnswer('price', input(s))?.includes('Gold package is ₱48,000'));
});

test('price: multiple services -> starting rates, capped at 3', () => {
  const mk = (id: string, title: string, php: number): StoreService => ({
    ...baseService, serviceId: id, title, startingPricePhp: php, pricingBasis: 'fixed', perPaxPricePhp: null, minPax: null, basePax: null,
  });
  const s = store({ services: [mk('a', 'A', 1000), mk('b', 'B', 2000), mk('c', 'C', 3000), mk('d', 'D', 4000)] });
  const a = buildAnswer('price', input(s));
  assert.ok(a?.startsWith('Our starting rates'), a ?? 'null');
  assert.ok(a?.includes('A starts at ₱1,000') && a.includes('C starts at ₱3,000'), a ?? 'null');
  assert.ok(!a?.includes('D starts at'), `should cap at 3: ${a}`);
});

test('coverage: describes event types, never a service-as-place', () => {
  const a = buildAnswer('coverage', input());
  assert.ok(a?.includes('Wedding'), a ?? 'null');
  assert.ok(!a?.includes('Photography'), `must not print a service category as an area: ${a}`);
});

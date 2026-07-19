import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStoreSnapshot, toEventBriefLite, type SnapshotSources } from './adapter';
import type { EventBrief } from '../event-brief';
import type { VendorServiceRow } from '../vendor-services';
import type { VendorPackageWithItems } from '../vendor-packages';
import type { VendorCoverageRow } from '../vendor-coverages';

function mkService(p: Partial<VendorServiceRow> = {}): VendorServiceRow {
  return {
    vendor_service_id: 's1',
    public_id: 'S89S-0000000000',
    vendor_profile_id: 'v1',
    category: 'wedding_photography',
    title: 'Wedding Signature',
    starting_price_php: 48000,
    added_pax_price_php: 200,
    pricing_basis: 'per_pax',
    per_pax_price_php: 320,
    min_pax: 150,
    hour_base_php: null,
    min_hours: null,
    extra_hour_php: null,
    crew_size: 4,
    crew_meal_required: false,
    crew_meal_included: true,
    transport_included: false,
    transport_flat_fee_php: null,
    primary_photo_r2_key: null,
    showcase_video_r2_key: null,
    showcase_photo_r2_keys: [],
    is_active: true,
    branch_id: null,
    recommended_lead_time_months: 6,
    last_minute_end_months: 1,
    last_minute_surcharge_pct: 15,
    daily_capacity: 1,
    exclusive_perk_text: null,
    base_pax: 150,
    coverage_id: null,
    created_at: '2027-01-01',
    updated_at: '2027-01-01',
    ...p,
  };
}

function pkg(p: Partial<VendorPackageWithItems> = {}): VendorPackageWithItems {
  return {
    package_id: 'p1',
    vendor_profile_id: 'v1',
    package_name: 'Gold',
    description: 'Full day',
    total_price_centavos: 4800000,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    primary_canonical_service: 'wedding_photography',
    is_active: true,
    created_at: '2027-01-01',
    updated_at: '2027-01-01',
    items: [
      { item_id: 'i1', package_id: 'p1', canonical_service: 'wedding_photography', service_description: 'Full-day coverage', is_default_included: true, replacement_value_centavos: 0, display_order: 0, created_at: '2027-01-01' },
      { item_id: 'i2', package_id: 'p1', canonical_service: 'drone', service_description: 'Drone', is_default_included: false, replacement_value_centavos: 0, display_order: 1, created_at: '2027-01-01' },
    ],
    ...p,
  };
}

const coverage: VendorCoverageRow = {
  id: 1,
  public_id: 'S89V-0000000001',
  canonical_service: 'wedding_photography',
  event_types: ['wedding'],
  faiths: [],
  created_at: '2027-01-01',
};

function sources(p: Partial<SnapshotSources> = {}): SnapshotSources {
  return {
    businessName: 'Blooms & Co.',
    services: [mkService()],
    inclusionsByService: new Map([['s1', [{ vendor_service_id: 's1', label: 'Pre-nup shoot', worth_php: 5000, sort_order: 0 }]]]),
    discountsByService: new Map([
      ['s1', [
        { vendor_service_id: 's1', discount_type: 'early_booking', rate: 10, unit: 'pct', expires_at: null, conditions_md: null, sort_order: 0 },
        { vendor_service_id: 's1', discount_type: 'promo', rate: 5, unit: 'pct', expires_at: '2027-01-01', conditions_md: null, sort_order: 1 },
      ]],
    ]),
    addonsByService: new Map([['s1', [{ id: 1, label: 'Extra album', from_price_php: 3000 }]]]),
    packages: [pkg()],
    coverages: [coverage],
    reviews: [{ rating_overall: 5, body: 'Amazing!', created_at: '2027-01-02' }],
    avgRating: 4.8,
    reviewCount: 32,
    ...p,
  };
}

const NOW = Date.parse('2027-06-01T00:00:00Z');

/** Assert an indexed lookup actually returned a value (strict-null-safe test access). */
function must<T>(value: T | undefined, what = 'value'): T {
  assert.ok(value !== undefined, `expected ${what} to be present`);
  return value;
}

test('maps service pricing + inclusions + addons', () => {
  const snap = toStoreSnapshot(sources(), NOW);
  assert.equal(snap.businessName, 'Blooms & Co.');
  assert.equal(snap.services.length, 1);
  const s = must(snap.services[0], 'service');
  assert.equal(s.serviceId, 's1');
  assert.equal(s.startingPricePhp, 48000);
  assert.equal(s.pricingBasis, 'per_pax');
  assert.equal(s.perPaxPricePhp, 320);
  assert.equal(s.basePax, 150);
  assert.equal(s.crewMealIncluded, true);
  assert.deepEqual(s.inclusions, [{ label: 'Pre-nup shoot', worthPhp: 5000 }]);
  assert.deepEqual(s.addons, [{ label: 'Extra album', fromPricePhp: 3000 }]);
});

test('expired discounts are pruned; active ones kept', () => {
  const s = must(toStoreSnapshot(sources(), NOW).services[0], 'service');
  assert.deepEqual(s.discounts, [{ type: 'early_booking', rate: 10, unit: 'pct' }]);
});

test('inactive services and packages are dropped', () => {
  const snap = toStoreSnapshot(
    sources({ services: [mkService({ is_active: false })], packages: [pkg({ is_active: false })] }),
    NOW,
  );
  assert.equal(snap.services.length, 0);
  assert.equal(snap.packages.length, 0);
});

test('package maps items + keeps centavos', () => {
  const p = must(toStoreSnapshot(sources(), NOW).packages[0], 'package');
  assert.equal(p.name, 'Gold');
  assert.equal(p.totalPriceCentavos, 4800000);
  assert.deepEqual(p.items, [
    { description: 'Full-day coverage', included: true },
    { description: 'Drone', included: false },
  ]);
});

test('coverage + reviews mapped; label optional', () => {
  const withLabel = toStoreSnapshot(sources({ coverageLabels: new Map([['wedding_photography', 'Wedding Photography']]) }), NOW);
  const cov = must(withLabel.coverages[0], 'coverage');
  assert.equal(cov.label, 'Wedding Photography');
  assert.deepEqual(cov.eventTypes, ['wedding']);
  assert.equal(must(withLabel.reviews[0], 'review').ratingOverall, 5);
  assert.equal(withLabel.avgRating, 4.8);
  assert.equal(must(toStoreSnapshot(sources(), NOW).coverages[0], 'coverage').label, null);
});

test('toEventBriefLite maps constraints + centavos->PHP per head', () => {
  const brief = {
    constraints: {
      date: { mode: 'specific', candidates: ['2027-06-14', '2027-06-21'], windowStart: null, windowEnd: null, primary: '2027-06-14' },
      location: { region: 'NCR', lat: null, lng: null, hasPin: false, searchAreas: [] },
      pax: 150,
      budget: { band: null, amountCentavos: 45000000, perHeadCentavos: 300000 },
      ceremony: { type: null, secondaryType: null, isMixed: false, subType: null, venueSetting: null, faiths: [] },
    },
  } as unknown as EventBrief;
  const lite = toEventBriefLite(brief);
  assert.equal(lite.primaryDate, '2027-06-14');
  assert.deepEqual(lite.candidateDates, ['2027-06-14', '2027-06-21']);
  assert.equal(lite.pax, 150);
  assert.equal(lite.region, 'NCR');
  assert.equal(lite.budgetPerHeadPhp, 3000);
});

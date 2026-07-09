/**
 * Unit suite for the reason-labeled bench sort (2026-07-09).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortWithReasons, fitScore, BENCH_SORTS } from './bench-sort';
import type { ShortlistVendor } from './shortlist-taxonomy';

function vendor(p: Partial<ShortlistVendor> & { vendorId: string }): ShortlistVendor {
  return {
    name: p.vendorId,
    status: 'considering',
    totalCostPhp: null,
    photoUrl: null,
    city: null,
    rating: null,
    reviewCount: null,
    isVerified: false,
    isSetnayan: false,
    href: '#',
    reachesVenue: null,
    serviceRadiusKm: null,
    budgetFit: null,
    budgetEstimated: false,
    ...p,
  };
}

test('three sort lenses are exposed', () => {
  assert.deepEqual(BENCH_SORTS.map((s) => s.key), ['fit', 'price', 'rating']);
});

test('fitScore counts reach + budget passes only (warn/unknown = 0)', () => {
  assert.equal(fitScore(vendor({ vendorId: 'a', reachesVenue: true, budgetFit: 'fits' })), 2);
  assert.equal(fitScore(vendor({ vendorId: 'b', reachesVenue: true, budgetFit: 'over' })), 1);
  assert.equal(fitScore(vendor({ vendorId: 'c', reachesVenue: false, budgetFit: null })), 0);
});

test('fit lens: strongest fit leads and is labeled "Best fit"', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'weak', reachesVenue: false, budgetFit: 'over', rating: 4.9 }),
      vendor({ vendorId: 'strong', reachesVenue: true, budgetFit: 'fits', rating: 4.1 }),
      vendor({ vendorId: 'mid', reachesVenue: true, budgetFit: 'over', rating: 4.5 }),
    ],
    'fit',
  );
  assert.deepEqual(out.map((r) => r.v.vendorId), ['strong', 'mid', 'weak']);
  assert.deepEqual(out[0]!.reason, { label: 'Best fit', tone: 'ok' });
  assert.equal(out[1]!.reason?.label, 'Fair fit', 'one-of-two passes → Fair fit');
  assert.equal(out[2]!.reason, null, 'zero passes → no pill (calm)');
});

test('price lens: cheapest leads and is the only "Lowest price"; unpriced sink', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'dear', totalCostPhp: 90000 }),
      vendor({ vendorId: 'na', totalCostPhp: null }),
      vendor({ vendorId: 'cheap', totalCostPhp: 20000 }),
    ],
    'price',
  );
  assert.deepEqual(out.map((r) => r.v.vendorId), ['cheap', 'dear', 'na']);
  assert.deepEqual(out[0]!.reason, { label: 'Lowest price', tone: 'ok' });
  assert.equal(out[1]!.reason, null, 'only the leader is labeled under price');
});

test('rating lens: top rated leads; others show a soft rating readout', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'good', rating: 4.4 }),
      vendor({ vendorId: 'best', rating: 4.9 }),
      vendor({ vendorId: 'unrated', rating: null }),
    ],
    'rating',
  );
  assert.deepEqual(out.map((r) => r.v.vendorId), ['best', 'good', 'unrated']);
  assert.deepEqual(out[0]!.reason, { label: 'Top rated', tone: 'ok' });
  assert.deepEqual(out[1]!.reason, { label: '4.4★', tone: 'soft' });
  assert.equal(out[2]!.reason, null, 'no rating → no readout');
});

test('never mutates the input array', () => {
  const input = [
    vendor({ vendorId: 'a', totalCostPhp: 50000 }),
    vendor({ vendorId: 'b', totalCostPhp: 10000 }),
  ];
  const before = input.map((v) => v.vendorId);
  sortWithReasons(input, 'price');
  assert.deepEqual(input.map((v) => v.vendorId), before, 'original order preserved');
});

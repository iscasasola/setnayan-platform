/**
 * Unit suite for the reason-labeled bench sort.
 *
 * Rewritten 2026-07-27 when "Best fit" stopped being three binary flags and
 * started calling the real composite scorer (`lib/compat-score.ts`). Most of the
 * cases below are stated as the DEFECT they lock out — see
 * `Explore_Replan_BUILD_SPEC_2026-07-27.md` §13.4 / §14.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortWithReasons, benchFitScore, BENCH_SORTS } from './bench-sort';
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
    // Undeclared travel rings (§17) — the default, so every existing bench-sort
    // case keeps measuring the tier-derived path it was written for.
    innerRadiusKm: null,
    outerRadiusKm: null,
    distanceKm: null,
    budgetFitRatio: null,
    faithMatch: null,
    budgetFit: null,
    budgetEstimated: false,
    dateFit: null,
    ...p,
  };
}

const order = (out: { v: ShortlistVendor }[]) => out.map((r) => r.v.vendorId);

test('three sort lenses are exposed', () => {
  assert.deepEqual(BENCH_SORTS.map((s) => s.key), ['fit', 'price', 'rating']);
});

// ─────────────────────────────────────────────────────────────────────────────
// §13.4 · THE LIVE DEFECT this change exists to remove.
// ─────────────────────────────────────────────────────────────────────────────

test('§13.4 regression: a FREE-tier vendor 2 km away is not ranked below an identical one 40 km away', () => {
  // Free tier has serviceRadiusKm 0 (vendor-tier-caps.ts:185), so `within_radius`
  // can never resolve → reachesVenue is permanently null for them. The old
  // fitScore scored `reachesVenue === true ? 1 : 0`, so BOTH of these lost the
  // reach point and their identical remaining flags left them tied — distance,
  // the only thing that actually differed, was invisible to the ranking.
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'far40', reachesVenue: null, serviceRadiusKm: null, distanceKm: 40 }),
      vendor({ vendorId: 'near2', reachesVenue: null, serviceRadiusKm: null, distanceKm: 2 }),
    ],
    'fit',
  );
  assert.deepEqual(order(out), ['near2', 'far40']);
  assert.ok(
    benchFitScore(out[0]!.v) > benchFitScore(out[1]!.v),
    'the nearer free-tier vendor must score strictly higher, not merely tie',
  );
});

test('§13.4 regression: a free-tier vendor 2 km away outranks a PRO vendor 40 km away', () => {
  // The sharpest form of the defect. Old behaviour: the Pro vendor has a finite
  // 50 km radius so `reachesVenue: true` → +1 point; the free-tier vendor two
  // kilometres from the venue scored 0 for reach and lost. The badge refused to
  // SAY the free vendor was far; the sort ASSUMED it.
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'pro40', reachesVenue: true, serviceRadiusKm: 50, distanceKm: 40 }),
      vendor({ vendorId: 'free2', reachesVenue: null, serviceRadiusKm: null, distanceKm: 2 }),
    ],
    'fit',
  );
  assert.deepEqual(order(out), ['free2', 'pro40']);
});

test('unknown inputs score NEUTRAL, never 0 — a vendor with no reviews is not buried', () => {
  const unrated = vendor({ vendorId: 'unrated' });
  const score = benchFitScore(unrated);
  assert.ok(score >= 55, `all-unknown vendor should sit near the neutral baseline, got ${score}`);

  // And "unknown" must beat "known bad": the only difference here is that
  // `overBudget` has a REAL budget signal that is poor, while `unrated` has none.
  const overBudget = vendor({ vendorId: 'over', budgetFitRatio: 0 });
  assert.ok(
    benchFitScore(unrated) > benchFitScore(overBudget),
    'missing data must not be treated as a zero score',
  );
  assert.deepEqual(order(sortWithReasons([overBudget, unrated], 'fit')), ['unrated', 'over']);
});

test('distance is CONTINUOUS — 2 km outranks 19 km inside the same radius (was binary)', () => {
  // Both are "within radius" (Verified tier, 20 km) so the old flag scored them
  // identically and the tie-break decided. Now the 17 km difference is priced.
  const near = vendor({ vendorId: 'near', reachesVenue: true, serviceRadiusKm: 20, distanceKm: 2 });
  const edge = vendor({ vendorId: 'edge', reachesVenue: true, serviceRadiusKm: 20, distanceKm: 19 });
  assert.notEqual(
    benchFitScore(near),
    benchFitScore(edge),
    'two in-radius distances must not produce the same score',
  );
  assert.deepEqual(order(sortWithReasons([edge, near], 'fit')), ['near', 'edge']);
});

test('budget fit is CONTINUOUS — a closer fit outranks a looser one (both "fits")', () => {
  const snug = vendor({ vendorId: 'snug', budgetFit: 'fits', budgetFitRatio: 0.95 });
  const loose = vendor({ vendorId: 'loose', budgetFit: 'fits', budgetFitRatio: 0.45 });
  assert.deepEqual(order(sortWithReasons([loose, snug], 'fit')), ['snug', 'loose']);
});

test('a booked date still down-ranks (the old signal survives the rewrite)', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'booked', dateFit: 'booked' }),
      vendor({ vendorId: 'free', dateFit: 'free' }),
    ],
    'fit',
  );
  assert.deepEqual(order(out), ['free', 'booked']);
});

// ─────────────────────────────────────────────────────────────────────────────
// Explainability (§14.4-3) — the pill names the dimension, never a number.
// ─────────────────────────────────────────────────────────────────────────────

test('fit reason: names the top-contributing dimension in couple-facing words', () => {
  assert.equal(
    sortWithReasons([vendor({ vendorId: 'close', serviceRadiusKm: 20, distanceKm: 1 })], 'fit')[0]!
      .reason?.label,
    'Closest to your venue',
  );
  assert.equal(
    sortWithReasons([vendor({ vendorId: 'cheap', budgetFitRatio: 1 })], 'fit')[0]!.reason?.label,
    'Fits your budget',
  );
  assert.equal(
    sortWithReasons([vendor({ vendorId: 'loved', rating: 4.9, reviewCount: 100 })], 'fit')[0]!
      .reason?.label,
    'Most reviewed',
  );
  assert.equal(
    sortWithReasons([vendor({ vendorId: 'open', dateFit: 'free' })], 'fit')[0]!.reason?.label,
    'Free on your date',
  );
  assert.equal(
    sortWithReasons([vendor({ vendorId: 'faith', faithMatch: true })], 'fit')[0]!.reason?.label,
    'Fits your ceremony',
  );
});

test('fit reason: the GENUINELY largest weighted lift wins, not the first positive dim', () => {
  // budgetFit 1.0 lifts 0.20 × (1.00 − 0.60) = 0.080.
  // distance 5 km inside a 20 km radius lifts 0.18 × (0.841 − 0.60) = 0.043.
  // Both are real positives; budget must be the one named.
  const out = sortWithReasons(
    [vendor({ vendorId: 'both', budgetFitRatio: 1, serviceRadiusKm: 20, distanceKm: 5 })],
    'fit',
  );
  assert.equal(out[0]!.reason?.label, 'Fits your budget');
});

test('fit reason: renders NOTHING when every input is neutral (no invented reason)', () => {
  const out = sortWithReasons(
    [vendor({ vendorId: 'blank-a' }), vendor({ vendorId: 'blank-b' })],
    'fit',
  );
  assert.equal(out[0]!.reason, null, 'the leader gets no pill when it has no real signal');
  assert.equal(out[1]!.reason, null);
});

test('fit reason: never renders a bare score or percentage', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'a', serviceRadiusKm: 20, distanceKm: 3, rating: 4.7, reviewCount: 40 }),
      vendor({ vendorId: 'b', budgetFitRatio: 0.9, dateFit: 'free' }),
      vendor({ vendorId: 'c' }),
    ],
    'fit',
  );
  for (const { reason } of out) {
    if (!reason) continue;
    assert.ok(
      !/\d/.test(reason.label),
      `fit pill must be words, not a number — got "${reason.label}"`,
    );
  }
});

test('fit reason: the superlative form is only used by the vendor that earns it', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'ten', serviceRadiusKm: 20, distanceKm: 10 }),
      vendor({ vendorId: 'one', serviceRadiusKm: 20, distanceKm: 1 }),
    ],
    'fit',
  );
  assert.deepEqual(order(out), ['one', 'ten']);
  assert.deepEqual(out[0]!.reason, { label: 'Closest to your venue', tone: 'ok' });
  assert.deepEqual(
    out[1]!.reason,
    { label: 'Near your venue', tone: 'soft' },
    'a runner-up must not claim to be the closest',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// The two linear lenses are untouched by this change.
// ─────────────────────────────────────────────────────────────────────────────

test('price lens: cheapest leads and is the only "Lowest price"; unpriced sink', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'dear', totalCostPhp: 90000 }),
      vendor({ vendorId: 'na', totalCostPhp: null }),
      vendor({ vendorId: 'cheap', totalCostPhp: 20000 }),
    ],
    'price',
  );
  assert.deepEqual(order(out), ['cheap', 'dear', 'na']);
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
  assert.deepEqual(order(out), ['best', 'good', 'unrated']);
  assert.deepEqual(out[0]!.reason, { label: 'Top rated', tone: 'ok' });
  assert.deepEqual(out[1]!.reason, { label: '4.4★', tone: 'soft' });
  assert.equal(out[2]!.reason, null, 'no rating → no readout');
});

test('the linear lenses ignore the composite entirely', () => {
  // A vendor that would lose badly on fit must still win the price lens.
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'perfect-fit', totalCostPhp: 90000, distanceKm: 1, serviceRadiusKm: 20 }),
      vendor({ vendorId: 'bad-fit-cheap', totalCostPhp: 20000, distanceKm: 300, budgetFitRatio: 0 }),
    ],
    'price',
  );
  assert.deepEqual(order(out), ['bad-fit-cheap', 'perfect-fit']);
});

test('never mutates the input array', () => {
  const input = [
    vendor({ vendorId: 'a', totalCostPhp: 50000, distanceKm: 40, serviceRadiusKm: 20 }),
    vendor({ vendorId: 'b', totalCostPhp: 10000, distanceKm: 1, serviceRadiusKm: 20 }),
  ];
  const before = input.map((v) => v.vendorId);
  sortWithReasons(input, 'price');
  sortWithReasons(input, 'fit');
  assert.deepEqual(input.map((v) => v.vendorId), before, 'original order preserved');
});

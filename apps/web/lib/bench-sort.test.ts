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
import {
  sortWithReasons,
  benchFitScore,
  formatDistanceKm,
  BENCH_SORTS,
  BENCH_LENSES,
  BENCH_PLAIN_SORTS,
} from './bench-sort';
import { COMPAT_WEIGHTS } from './compat-score';
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
    // Lens inputs (§15) — null by default so every pre-existing case keeps
    // measuring exactly the dimensions it was written for.
    firstVerifiedAt: null,
    demandCoupleCount: null,
    budgetFit: null,
    budgetEstimated: false,
    dateFit: null,
    // Three-action card inputs (slice D) — no marketplace link, no thread, no
    // group, no price basis. The sort never reads them; they are here so the
    // fixture stays a complete ShortlistVendor.
    marketplaceVendorId: null,
    threadId: null,
    inquiryStatus: null,
    planGroupId: null,
    priceBasisPhp: null,
    verifiedState: null,
    // Schedule convergence (PR-G1) — NO verdict is the default everywhere, so
    // the sort keeps ranking exactly as it did before that tier existed. The
    // sink is a partition applied AFTER this sort, never a term inside it.
    buildFit: null,
    buildClashWith: null,
    freeDaysLine: null,
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

// ── Same-date demand pill (Explore_Replan §15.3/§15.4) ──────────────────────

test('demand is INERT under "Best fit" — it carries weight only in its own lens', () => {
  // demandPressure is 0 in COMPAT_WEIGHTS, so a busy vendor can neither out-rank
  // a quiet one nor claim a demand pill here. "In demand" is a lens the couple
  // chooses, never a thumb on the default scale.
  const busy = vendor({ vendorId: 'busy', demandCoupleCount: 12 });
  const quiet = vendor({ vendorId: 'quiet', demandCoupleCount: null });
  assert.equal(benchFitScore(busy), benchFitScore(quiet));
  assert.equal(sortWithReasons([busy], 'fit')[0]!.reason, null);
});

test('a below-floor demand count says nothing, even if one somehow reaches the client', () => {
  // Belt-and-braces: the server already refuses to serialise a below-floor
  // count, but if one ever arrived the scorer must still refuse to speak.
  const out = sortWithReasons([vendor({ vendorId: 'quiet', demandCoupleCount: 2 })], 'fit');
  assert.equal(out[0]!.reason, null, 'n=2 must produce no pill at all');
});

test('a vendor with no demand signal is not out-ranked by one with a below-floor signal', () => {
  const none = benchFitScore(vendor({ vendorId: 'a', demandCoupleCount: null }));
  const below = benchFitScore(vendor({ vendorId: 'b', demandCoupleCount: 2 }));
  assert.equal(none, below);
});

test('the budget pill carries the mandatory "est." qualifier when the basis is a starts-at', () => {
  const quoted = sortWithReasons(
    [vendor({ vendorId: 'quoted', budgetFitRatio: 1, budgetEstimated: false })],
    'fit',
  );
  assert.equal(quoted[0]!.reason?.label, 'Fits your budget');
  const estimated = sortWithReasons(
    [vendor({ vendorId: 'est', budgetFitRatio: 1, budgetEstimated: true })],
    'fit',
  );
  assert.equal(estimated[0]!.reason?.label, 'Fits your budget · est.');
});

test('no budget pill ever claims value — "cheapest"/"best value" are unbackable', () => {
  // priceFitScore returns a flat 1.0 for EVERY in-budget vendor, so a ₱30k and
  // an ₱89k vendor tie exactly. Any value language would be a claim the data
  // cannot make.
  const banned = /best value|cheapest|most for your money|lowest price|best price|great deal/i;
  const cards = sortWithReasons(
    [
      vendor({ vendorId: 'a', budgetFitRatio: 1, totalCostPhp: 30_000 }),
      vendor({ vendorId: 'b', budgetFitRatio: 1, totalCostPhp: 89_000, budgetEstimated: true }),
    ],
    'fit',
  );
  assert.equal(benchFitScore(cards[0]!.v), benchFitScore(cards[1]!.v), 'in-budget vendors tie');
  for (const c of cards) assert.ok(!banned.test(c.reason?.label ?? ''), c.reason?.label);
});

// ─────────────────────────────────────────────────────────────────────────────
// §15 · RANKING LENSES — "Best matches" (the default) + "Nearest to your venue".
// A lens is the same scorer under a different weight vector; these cases pin
// the behaviour the couple actually sees.
// ─────────────────────────────────────────────────────────────────────────────

test('the segmented control still exposes the flag-OFF trio unchanged', () => {
  // Flag-off production must be byte-identical: same keys, same labels, same
  // order as before the lens work.
  assert.deepEqual(BENCH_SORTS, [
    { key: 'fit', label: 'Best fit' },
    { key: 'price', label: 'Lowest price' },
    { key: 'rating', label: 'Top rated' },
  ]);
});

test('the flag-ON control separates two lenses from two plain sorts', () => {
  assert.deepEqual(BENCH_LENSES, [
    { key: 'fit', label: 'Best matches' },
    { key: 'near', label: 'Nearest to your venue' },
  ]);
  assert.deepEqual(BENCH_PLAIN_SORTS, [
    { key: 'price', label: 'Lowest price' },
    { key: 'rating', label: 'Top rated' },
  ]);
});

test("'fit' scores identically whether or not a weight vector is passed", () => {
  const v = vendor({ vendorId: 'x', distanceKm: 14, rating: 4.2, reviewCount: 22, isVerified: true });
  assert.equal(benchFitScore(v), benchFitScore(v, COMPAT_WEIGHTS));
});

test('the Nearest lens promotes the closer vendor over the better-reviewed one', () => {
  // A modest distance gap the default vector resolves in favour of the proven
  // vendor (reviews 0.18 vs distance 0.18, and the review lift is bigger here).
  // Raising distance to 0.45 flips it — which is the entire point of the lens.
  const close = vendor({ vendorId: 'close', distanceKm: 2, serviceRadiusKm: 20 });
  const proven = vendor({
    vendorId: 'proven',
    distanceKm: 12,
    serviceRadiusKm: 20,
    rating: 4.9,
    reviewCount: 140,
  });
  assert.deepEqual(order(sortWithReasons([close, proven], 'fit')), ['proven', 'close']);
  assert.deepEqual(order(sortWithReasons([close, proven], 'near')), ['close', 'proven']);
});

test('Nearest states the MEASURED distance on a non-leader card', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'a', distanceKm: 1.5, serviceRadiusKm: 50 }),
      vendor({ vendorId: 'b', distanceKm: 6.25, serviceRadiusKm: 50 }),
      vendor({ vendorId: 'c', distanceKm: 12.4, serviceRadiusKm: 50 }),
    ],
    'near',
  );
  assert.deepEqual(order(out), ['a', 'b', 'c']);
  // Only the genuine category leader on distance may claim the superlative.
  assert.deepEqual(out[0]!.reason, { label: 'Closest to your venue', tone: 'ok' });
  assert.equal(out[1]!.reason!.label, '6.3 km from your venue');
  assert.equal(out[2]!.reason!.label, '12 km from your venue');
});

test('a vendor too far to be a positive signal gets NO pill at all', () => {
  // 41 km against a 20 km radius scores BELOW neutral, so distance is not a
  // reason — it is a drawback. The card must stay silent rather than dress a
  // penalty up as a feature ("41 km from your venue" alongside a leader reading
  // "Closest to your venue" would read as a recommendation).
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'near', distanceKm: 1.5, serviceRadiusKm: 20 }),
      vendor({ vendorId: 'far', distanceKm: 41.4, serviceRadiusKm: 20 }),
    ],
    'near',
  );
  assert.deepEqual(order(out), ['near', 'far']);
  assert.equal(out[1]!.reason, null);
});

test('the distance readout is a measurement, never a reach claim', () => {
  // §15.4: "3.2 km from your venue" is permitted because it is measured;
  // "Reaches your venue" as a RANKING claim is not, because the radius behind
  // it is a paid tier, not a promise.
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'a', distanceKm: 3, serviceRadiusKm: 50 }),
      vendor({ vendorId: 'b', distanceKm: 8, serviceRadiusKm: 50 }),
      vendor({ vendorId: 'c', distanceKm: 30, serviceRadiusKm: 50 }),
    ],
    'near',
  );
  for (const r of out) {
    assert.ok(!/reach/i.test(r.reason?.label ?? ''), `"${r.reason?.label}" makes a reach claim`);
  }
});

test('an all-unknown vendor renders NO pill under either lens', () => {
  // The naive `weight × sub` contribution would hand every blank card
  // "Matches your style" (refinement carries the largest weight at a neutral
  // sub-score). Measuring the LIFT above neutral is what keeps the pill honest.
  for (const lens of ['fit', 'near'] as const) {
    const out = sortWithReasons([vendor({ vendorId: 'blank' })], lens);
    assert.equal(out[0]!.reason, null, `${lens} invented a reason for a blank card`);
  }
});

test('a vendor with no distance never claims a distance reason under Nearest', () => {
  const out = sortWithReasons(
    [
      vendor({ vendorId: 'measured', distanceKm: 3, serviceRadiusKm: 20 }),
      vendor({ vendorId: 'unknown', distanceKm: null, rating: 4.8, reviewCount: 60 }),
    ],
    'near',
  );
  const unknown = out.find((r) => r.v.vendorId === 'unknown')!;
  assert.ok(
    unknown.reason == null || !/venue/i.test(unknown.reason.label),
    `unknown distance claimed "${unknown.reason?.label}"`,
  );
});

test('formatDistanceKm: one decimal under 10 km, whole km above', () => {
  assert.equal(formatDistanceKm(0), '0.0 km');
  assert.equal(formatDistanceKm(3.24), '3.2 km');
  assert.equal(formatDistanceKm(9.96), '10.0 km');
  assert.equal(formatDistanceKm(10), '10 km');
  assert.equal(formatDistanceKm(41.4), '41 km');
});

test('the Nearest lens never mutates the input array either', () => {
  const input = [
    vendor({ vendorId: 'a', distanceKm: 40, serviceRadiusKm: 20 }),
    vendor({ vendorId: 'b', distanceKm: 1, serviceRadiusKm: 20 }),
  ];
  const before = input.map((v) => v.vendorId);
  sortWithReasons(input, 'near');
  assert.deepEqual(input.map((v) => v.vendorId), before);
});

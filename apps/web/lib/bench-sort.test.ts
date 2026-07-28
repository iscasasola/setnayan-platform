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
  benchCompatInputs,
  benchSortStorageKey,
  benchSortWeights,
  persistBenchSort,
  readPersistedBenchSort,
  BENCH_SORTS,
  BENCH_PLAIN_SORTS,
  type BenchSort,
  type BenchSortStore,
} from './bench-sort';
import { COMPAT_WEIGHTS } from './compat-score';
import { LENSES, LENS_ORDER, isLensAvailable, isLensKey, visibleLenses } from './ranking-lenses';
import {
  countInquiringCouples,
  groupHoldsByVendor,
  inquiryPairKey,
  type SameDateHold,
} from './same-date-demand';
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
  // The FLAG-OFF control, frozen. `BENCH_SORTS` is what the bench renders when
  // `isExploreReplanEnabled()` is false, and it must stay production-identical.
  assert.deepEqual(BENCH_SORTS.map((s) => s.key), ['fit', 'price', 'rating']);
  assert.deepEqual(BENCH_SORTS.map((s) => s.label), ['Best fit', 'Lowest price', 'Top rated']);
});

test('the two PLAIN SORTS are separate from the lenses and are not weight vectors', () => {
  assert.deepEqual(BENCH_PLAIN_SORTS.map((s) => s.key), ['price', 'rating']);
  // Neither is a LensKey: "Lowest price" cannot be a weight vector at all —
  // `priceFitScore` ties every in-budget vendor at 1.0 — and "Top rated" as a
  // RECOMMENDATION would be Setnayan vouching for a vendor. As plain sorts they
  // are an honest user job. Keep them out of the registry.
  for (const s of BENCH_PLAIN_SORTS) assert.equal(isLensKey(s.key), false);
  // …and they fall back to the default vector, which is never consulted.
  for (const s of BENCH_PLAIN_SORTS) assert.equal(benchSortWeights(s.key), COMPAT_WEIGHTS);
});

test('all five lenses are reachable through the bench control', () => {
  for (const key of LENS_ORDER) {
    assert.equal(isLensKey(key), true);
    assert.equal(benchSortWeights(key), LENSES[key].weights);
  }
  assert.equal(benchSortWeights('fit'), COMPAT_WEIGHTS, 'the default lens is unchanged');
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
// §15 · THE FIVE RANKING LENSES on the bench
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const NOW = Date.parse('2026-07-27T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * DAY_MS).toISOString();

test('flag-OFF equivalence: the new lens inputs cannot move the "Best fit" order', () => {
  // Both §15 inputs are weight-0 in COMPAT_WEIGHTS, so adding them to the bench
  // projection must be a no-op on the surface the flag does not gate.
  const withSignals = [
    vendor({ vendorId: 'a', rating: 4.2, reviewCount: 10, firstVerifiedAt: daysAgo(2), demandCoupleCount: 9 }),
    vendor({ vendorId: 'b', rating: 4.8, reviewCount: 40 }),
  ];
  const without = [
    vendor({ vendorId: 'a', rating: 4.2, reviewCount: 10 }),
    vendor({ vendorId: 'b', rating: 4.8, reviewCount: 40 }),
  ];
  assert.deepEqual(
    sortWithReasons(withSignals, 'fit', { nowMs: NOW }).map((c) => [c.v.vendorId, c.reason?.label]),
    sortWithReasons(without, 'fit', { nowMs: NOW }).map((c) => [c.v.vendorId, c.reason?.label]),
  );
});

test('"New here": a newcomer leads and its pill names freshness, not reviews', () => {
  const cards = sortWithReasons(
    [
      vendor({ vendorId: 'established', rating: 4.9, reviewCount: 90 }),
      vendor({ vendorId: 'newcomer', firstVerifiedAt: daysAgo(3) }),
    ],
    'new',
    { nowMs: NOW },
  );
  assert.equal(cards[0]!.v.vendorId, 'newcomer');
  // Weight-aware explainability (§15.6): the pill must explain the order the
  // couple is looking at. Under this lens that is freshness.
  assert.equal(cards[0]!.reason?.label, 'Newest on Setnayan');
  // …and the SAME vendor under the default lens must NOT claim to be new,
  // because freshness carries no weight there.
  const underFit = sortWithReasons(
    [vendor({ vendorId: 'newcomer', firstVerifiedAt: daysAgo(3) })],
    'fit',
    { nowMs: NOW },
  );
  assert.notEqual(underFit[0]!.reason?.label, 'Newest on Setnayan');
});

test('"New here" copy never implies vetting, quality or endorsement', () => {
  const banned = /vetted|hand-?picked|curated|endorsed|recommended|rising star|best|top[- ]rated/i;
  const cards = sortWithReasons(
    [
      vendor({ vendorId: 'a', firstVerifiedAt: daysAgo(1) }),
      vendor({ vendorId: 'b', firstVerifiedAt: daysAgo(30) }),
      vendor({ vendorId: 'c', rating: 4.9, reviewCount: 50 }),
    ],
    'new',
    { nowMs: NOW },
  );
  for (const c of cards) assert.ok(!banned.test(c.reason?.label ?? ''), c.reason?.label);
});

test('"Nearest": the closest vendor leads and earns the superlative', () => {
  const cards = sortWithReasons(
    [
      vendor({ vendorId: 'far', distanceKm: 48, serviceRadiusKm: 50, rating: 4.9, reviewCount: 80 }),
      vendor({ vendorId: 'near', distanceKm: 2, serviceRadiusKm: 20 }),
    ],
    'near',
  );
  assert.equal(cards[0]!.v.vendorId, 'near');
  assert.equal(cards[0]!.reason?.label, 'Closest to your venue');
});

test('"In demand": the pill is the MEASUREMENT, never a scarcity claim', () => {
  const banned = /only\s|left|booking fast|almost gone|nearly gone|lock it in|selling fast|hurry|last chance/i;
  const cards = sortWithReasons(
    [
      vendor({ vendorId: 'quiet' }),
      vendor({ vendorId: 'busy', demandCoupleCount: 4 }),
      vendor({ vendorId: 'busier', demandCoupleCount: 7 }),
    ],
    'demand',
  );
  assert.equal(cards[0]!.v.vendorId, 'busier');
  assert.equal(cards[0]!.reason?.label, '7 couples inquired for your date');
  for (const c of cards) assert.ok(!banned.test(c.reason?.label ?? ''), c.reason?.label);
});

test('a saved-but-never-contacted vendor contributes ZERO demand, end to end', () => {
  // The whole chain, because the defect this locks out lived in the JOIN, not
  // in the scorer: `status='considering'` is written by merely SAVING a vendor.
  // Counting that as competition is manufactured scarcity (owner, 2026-06-02).
  const holds: SameDateHold[] = [
    // Three other couples hold this vendor on the same date…
    { marketplaceVendorId: 'v1', eventId: 'e1' },
    { marketplaceVendorId: 'v1', eventId: 'e2' },
    { marketplaceVendorId: 'v1', eventId: 'e3' },
  ];
  // …but NONE of them ever opened a thread. They only bookmarked.
  const noInquiries = countInquiringCouples(groupHoldsByVendor(holds), new Set<string>());
  assert.equal(noInquiries.get('v1'), undefined, 'saves must not produce a count');

  // So the card carries null, the scorer sees no signal, no pill renders, and
  // the lens itself cannot be offered.
  const saved = vendor({ vendorId: 'v1', demandCoupleCount: noInquiries.get('v1') ?? null });
  assert.equal(sortWithReasons([saved], 'demand')[0]!.reason, null);
  assert.equal(isLensAvailable('demand', [saved, saved, saved].map((v) => benchCompatInputs(v))), false);

  // Contrast: the SAME three holds, now genuinely inquiry-backed, do count.
  const inquired = countInquiringCouples(
    groupHoldsByVendor(holds),
    new Set(['e1', 'e2', 'e3'].map((e) => inquiryPairKey(e, 'v1'))),
  );
  assert.equal(inquired.get('v1'), 3);
});

test('an all-neutral vendor renders NO pill under EVERY lens', () => {
  // A vendor we know nothing about must not be handed a manufactured reason.
  // `topCompatDimension` measures the lift ABOVE neutral, so every dimension is
  // exactly 0 here and there is no argmax to report.
  const blank = vendor({ vendorId: 'unknown' });
  for (const key of LENS_ORDER) {
    const [card] = sortWithReasons([blank], key, { nowMs: NOW });
    assert.equal(card!.reason, null, `lens "${key}" invented a reason for an unknown vendor`);
  }
});

test('the bench control offers only the lenses its data can support', () => {
  const rail = [
    vendor({ vendorId: 'a', distanceKm: 3, serviceRadiusKm: 20 }),
    vendor({ vendorId: 'b', distanceKm: 9, serviceRadiusKm: 20 }),
    vendor({ vendorId: 'c' }),
  ];
  const chips = visibleLenses(rail.map((v) => benchCompatInputs(v)));
  assert.deepEqual(chips.filter((c) => !c.disabled).map((c) => c.key), ['fit', 'near']);
  // Budget + New stay visible but disabled, carrying the reason that would fix
  // them; demand is absent entirely.
  assert.equal(chips.find((c) => c.key === 'budget')?.disabled, true);
  assert.equal(chips.find((c) => c.key === 'new')?.disabled, true);
  assert.equal(chips.some((c) => c.key === 'demand'), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// §13.3 · SORT PERSISTENCE — the couple's lens must survive a reload
// ─────────────────────────────────────────────────────────────────────────────

/** A `localStorage` stand-in, so "reload" is a real assertion rather than
 *  something only a browser can prove: the store outlives the page, the
 *  component state does not. */
function fakeStore(seed: Record<string, string> = {}): BenchSortStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

test('sort persistence survives a simulated reload', () => {
  const store = fakeStore();
  // Session 1 — the couple picks "Nearest to your venue".
  persistBenchSort('evt-1', 'near', store);
  // …the page unloads. Component state is gone; only the store remains.
  const restored = readPersistedBenchSort('evt-1', store);
  assert.equal(restored, 'near', 'the bench must come back on the lens they chose');
});

test('persistence is per EVENT — one event’s lens never leaks into another', () => {
  const store = fakeStore();
  persistBenchSort('manila-wedding', 'near', store);
  persistBenchSort('cebu-debut', 'budget', store);
  assert.equal(readPersistedBenchSort('manila-wedding', store), 'near');
  assert.equal(readPersistedBenchSort('cebu-debut', store), 'budget');
  assert.equal(readPersistedBenchSort('never-sorted', store), null);
  assert.notEqual(benchSortStorageKey('a'), benchSortStorageKey('b'));
});

test('a stored lens that can no longer be offered is NOT restored', () => {
  // They sorted by "Nearest", then the venue anchor went away. Restoring it
  // would bring the bench back under a lens whose chip is not even rendered,
  // and the order would look arbitrary.
  const store = fakeStore({ [benchSortStorageKey('evt-1')]: 'near' });
  const offered = (m: BenchSort) => m !== 'near';
  assert.equal(readPersistedBenchSort('evt-1', store, offered), null);
  // The preference is not deleted — if the anchor comes back, so does the lens.
  assert.equal(readPersistedBenchSort('evt-1', store), 'near');
});

test('a corrupt or unknown stored value falls back to the default', () => {
  for (const junk of ['', 'best-fit', 'nearest', '{}', 'FIT', 'demand ']) {
    const store = fakeStore({ [benchSortStorageKey('evt-1')]: junk });
    assert.equal(readPersistedBenchSort('evt-1', store), null, junk);
  }
  // Every legitimate value round-trips, lenses and plain sorts alike.
  for (const mode of [...LENS_ORDER, 'price', 'rating'] as BenchSort[]) {
    const store = fakeStore();
    persistBenchSort('evt-1', mode, store);
    assert.equal(readPersistedBenchSort('evt-1', store), mode);
  }
});

test('persistence never throws when storage is unavailable', () => {
  // Safari private mode throws on getItem/setItem. The sort must still work; it
  // just will not be remembered.
  const hostile: BenchSortStore = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(readPersistedBenchSort('evt-1', hostile), null);
  assert.doesNotThrow(() => persistBenchSort('evt-1', 'near', hostile));
  assert.equal(readPersistedBenchSort('evt-1', null), null);
  assert.doesNotThrow(() => persistBenchSort('evt-1', 'near', undefined));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TIER_BOOST_POINTS,
  MERIT_SCORE_MAX,
  MERIT_WEIGHTS,
  TIER_BOOST_POINTS,
  FEATURED_LABEL,
  FEATURED_DISCLOSURE,
  FEATURED_MERIT_FLOOR_DELTA,
  FEATURED_MIN_TIER,
  FEATURED_SLOT_MAX_DEFAULT,
  FEATURED_SLOT_MAX_SHARE,
  boostedRankScore,
  canBoostOvertake,
  isFeaturedWindowActive,
  meritScore,
  partitionFeatured,
  rankWithCappedBoost,
  tierBoostPoints,
  type FeaturableVendor,
  type MeritSignals,
} from './vendor-rank-boost';
import { VENDOR_TIERS, type VendorTier } from './vendor-tier-caps';
import { badgeMeritPoints, MERIT_BADGE_POINTS, MERIT_BADGE_POINTS_MAX } from './vendor-badges';

/**
 * Vendor_Monetization_Model_LOCKED_2026-07-25 § 5, owner-insisted:
 *   "Organic rank = merit for everyone incl. Free … A better free vendor is
 *    never buried. Paid = a capped boost + clearly-labeled Featured/Sponsored
 *    slots — amplifies quality, never manufactures it."
 *
 * These tests pin BOTH halves so a later edit cannot quietly turn the
 * marketplace pay-to-win:
 *   • the boost has a hard ceiling and a provable non-burial invariant,
 *   • featured slots are capped, quality-floored, tier-gated, verified-gated,
 *     and always carry a label.
 */

const ALL_TIERS = VENDOR_TIERS;
const PAID_TIERS: readonly VendorTier[] = ['solo', 'pro', 'enterprise', 'custom'];
const UNPAID_TIERS: readonly VendorTier[] = ['free', 'verified'];

function signals(partial: Partial<MeritSignals> = {}): MeritSignals {
  return {
    matchToNeed: null,
    trustedReviewCount: 0,
    trustedAvgRating: 0,
    completedBookings: 0,
    respondsFast: false,
    distanceKm: null,
    ...partial,
  };
}

function vendor(partial: Partial<FeaturableVendor> & { id: string }): FeaturableVendor {
  return {
    meritScore: 50,
    tier: 'free',
    verified: false,
    tierExpiresAtMs: null,
    ...partial,
  };
}

// ── 1. The boost ceiling ────────────────────────────────────────────────────

test('every tier boost is within the hard ceiling, and unpaid tiers get zero', () => {
  for (const tier of ALL_TIERS) {
    const points = tierBoostPoints(tier);
    assert.ok(points >= 0, `${tier} boost is negative`);
    assert.ok(points <= MAX_TIER_BOOST_POINTS, `${tier} boost exceeds the ceiling`);
    assert.equal(points, TIER_BOOST_POINTS[tier], `${tier} table/function disagree`);
  }
  for (const tier of UNPAID_TIERS) {
    assert.equal(tierBoostPoints(tier), 0, `${tier} must buy nothing`);
  }
});

test('the tier ladder is monotonic — Solo small, Pro bigger, Enterprise top', () => {
  assert.ok(tierBoostPoints('solo') > tierBoostPoints('free'));
  assert.ok(tierBoostPoints('pro') > tierBoostPoints('solo'));
  assert.ok(tierBoostPoints('enterprise') > tierBoostPoints('pro'));
  // Custom runs as Enterprise everywhere else in the codebase.
  assert.equal(tierBoostPoints('custom'), tierBoostPoints('enterprise'));
  assert.equal(tierBoostPoints('enterprise'), MAX_TIER_BOOST_POINTS);
});

test('unknown / null / garbage tier normalizes to free (no boost), never to max', () => {
  for (const raw of [null, undefined, '', 'platinum', 'PRO', 'enterprise ']) {
    assert.equal(tierBoostPoints(raw), 0, `tier ${JSON.stringify(raw)}`);
  }
});

test('merit is clamped before the boost — a wild score cannot smuggle in lift', () => {
  for (const tier of ALL_TIERS) {
    assert.equal(boostedRankScore(1e9, tier), MERIT_SCORE_MAX + tierBoostPoints(tier));
    assert.equal(boostedRankScore(-50, tier), tierBoostPoints(tier));
    assert.equal(boostedRankScore(Number.NaN, tier), tierBoostPoints(tier));
  }
});

// ── 2. THE non-burial invariant ─────────────────────────────────────────────

test('INVARIANT: a materially better vendor can never be outranked by ANY tier', () => {
  const gap = MAX_TIER_BOOST_POINTS + 0.001;
  for (const betterTier of ALL_TIERS) {
    for (const worseTier of ALL_TIERS) {
      const better = boostedRankScore(50 + gap, betterTier);
      const worse = boostedRankScore(50, worseTier);
      assert.ok(
        better > worse,
        `${worseTier} outranked a materially better ${betterTier}`,
      );
    }
  }
});

test('INVARIANT holds for the worst case: FREE leader vs ENTERPRISE challenger', () => {
  // Sweep the whole merit range, not just one point.
  for (let merit = 0; merit <= MERIT_SCORE_MAX - MAX_TIER_BOOST_POINTS - 1; merit += 1) {
    const freeLeader = boostedRankScore(merit + MAX_TIER_BOOST_POINTS + 1, 'free');
    const paidChallenger = boostedRankScore(merit, 'enterprise');
    assert.ok(freeLeader > paidChallenger, `merit ${merit}`);
  }
});

test('canBoostOvertake marks exactly the band where money may reorder', () => {
  assert.equal(canBoostOvertake(50, 50 - MAX_TIER_BOOST_POINTS), true); // equal after boost
  assert.equal(canBoostOvertake(50, 50 - MAX_TIER_BOOST_POINTS - 0.001), false);
  assert.equal(canBoostOvertake(50, 49), true);
  assert.equal(canBoostOvertake(100, 0), false);
});

test('rankWithCappedBoost: paid may pass a NEAR-equal, never a materially better vendor', () => {
  const nearEqual = rankWithCappedBoost([
    { id: 'free-51', meritScore: 51, tier: 'free' },
    { id: 'pro-50', meritScore: 50, tier: 'pro' },
  ]);
  assert.deepEqual(nearEqual.map((v) => v.id), ['pro-50', 'free-51']);

  const materiallyBetter = rankWithCappedBoost([
    { id: 'free-60', meritScore: 60, tier: 'free' },
    { id: 'ent-50', meritScore: 50, tier: 'enterprise' },
  ]);
  assert.deepEqual(materiallyBetter.map((v) => v.id), ['free-60', 'ent-50']);
});

test('rankWithCappedBoost: a tie on the boosted score is won by RAW merit, not money', () => {
  const ranked = rankWithCappedBoost([
    { id: 'ent-44', meritScore: 44, tier: 'enterprise' }, // 44 + 6 = 50
    { id: 'free-50', meritScore: 50, tier: 'free' }, //      50 + 0 = 50
  ]);
  assert.deepEqual(ranked.map((v) => v.id), ['free-50', 'ent-44']);
});

test('rankWithCappedBoost is deterministic and does not mutate its input', () => {
  const input = [
    { id: 'b', meritScore: 50, tier: 'free' as const },
    { id: 'a', meritScore: 50, tier: 'free' as const },
  ];
  const snapshot = input.map((v) => v.id);
  const first = rankWithCappedBoost(input).map((v) => v.id);
  const second = rankWithCappedBoost(input).map((v) => v.id);
  assert.deepEqual(first, ['a', 'b']); // id tie-break, ascending
  assert.deepEqual(second, first);
  assert.deepEqual(input.map((v) => v.id), snapshot);
});

test('an empty pool ranks to an empty list', () => {
  assert.deepEqual(rankWithCappedBoost([]), []);
});

// ── 3. Merit is blind to money ──────────────────────────────────────────────

test('the proximity horizon must stay tier-independent (regression guard)', () => {
  // A tier-derived horizon (e.g. vendor-tier-caps serviceRadiusKm: 20 for
  // verified vs 50 for pro) would hand higher tiers a wider, UNCAPPED proximity
  // credit — money leaking into merit through the back door. This pins that a
  // wider horizon really does raise the score, which is exactly why the call
  // site must never pass a tier-derived value.
  const at = (proximityHorizonKm: number) =>
    meritScore(signals({ matchToNeed: 0, distanceKm: 20, proximityHorizonKm }));
  assert.ok(at(50) > at(20), 'a wider horizon must score higher');
  // A non-positive / absent horizon falls back to the shared default, so a
  // missing value can never become an accidental advantage either.
  const dflt = meritScore(signals({ matchToNeed: 0, distanceKm: 20 }));
  assert.equal(
    meritScore(signals({ matchToNeed: 0, distanceKm: 20, proximityHorizonKm: 0 })),
    dflt,
  );
  assert.equal(
    meritScore(signals({ matchToNeed: 0, distanceKm: 20, proximityHorizonKm: -5 })),
    dflt,
  );
});

test('meritScore has no tier input at all — the type forbids it', () => {
  // Compile-time: MeritSignals carries none of tier/adRank/subscription. This
  // runtime assertion pins the observable half — identical signals score
  // identically no matter who is paying, because the function never sees it.
  const s = signals({ trustedReviewCount: 25, trustedAvgRating: 5, respondsFast: true });
  assert.equal(meritScore(s), meritScore({ ...s }));
});

test('meritScore stays inside 0–100 across the signal extremes', () => {
  const extremes: MeritSignals[] = [
    signals(),
    signals({ trustedReviewCount: 1e6, trustedAvgRating: 99, completedBookings: 1e6 }),
    signals({ trustedReviewCount: -5, trustedAvgRating: -5, completedBookings: -5 }),
    signals({ distanceKm: -100 }),
    signals({ distanceKm: 1e6 }),
    signals({ badgePoints: 1e6 }),
    signals({ matchToNeed: -5 }),
    signals({ matchToNeed: 1e6 }),
    signals({ matchToNeed: Number.NaN }),
    signals({
      matchToNeed: 1,
      trustedReviewCount: 25,
      trustedAvgRating: 5,
      completedBookings: 20,
      respondsFast: true,
      distanceKm: 0,
      badgePoints: MERIT_BADGE_POINTS_MAX,
    }),
  ];
  for (const s of extremes) {
    const score = meritScore(s);
    assert.ok(Number.isFinite(score), 'score must be finite');
    assert.ok(score >= 0 && score <= MERIT_SCORE_MAX, `out of range: ${score}`);
  }
});

test('meritScore: a perfect vendor scores 100, an empty one scores 0 on evidence', () => {
  assert.equal(
    meritScore(
      signals({
        matchToNeed: 1,
        trustedReviewCount: 25,
        trustedAvgRating: 5,
        completedBookings: 20,
        respondsFast: true,
        distanceKm: 0,
        badgePoints: MERIT_BADGE_POINTS_MAX,
      }),
    ),
    MERIT_SCORE_MAX,
  );
  // No match, no reviews, no bookings, slow, far away, no badges → zero.
  assert.equal(meritScore(signals({ matchToNeed: 0, distanceKm: 1e6 })), 0);
});

test('match-to-need is neutral when unjudgeable, and never a penalty', () => {
  const unjudgeable = meritScore(signals({ matchToNeed: null, distanceKm: 1e6 }));
  const full = meritScore(signals({ matchToNeed: 1, distanceKm: 1e6 }));
  const none = meritScore(signals({ matchToNeed: 0, distanceKm: 1e6 }));
  assert.equal(unjudgeable, MERIT_WEIGHTS.matchToNeed * 0.5);
  assert.ok(none < unjudgeable && unjudgeable < full);
  // undefined + NaN degrade to the same neutral, not to zero.
  assert.equal(meritScore(signals({ matchToNeed: undefined, distanceKm: 1e6 })), unjudgeable);
  assert.equal(meritScore(signals({ matchToNeed: Number.NaN, distanceKm: 1e6 })), unjudgeable);
});

test('meritScore is monotonic in every signal', () => {
  const base = signals({ trustedReviewCount: 5, trustedAvgRating: 4, completedBookings: 2 });
  assert.ok(meritScore({ ...base, trustedReviewCount: 10 }) > meritScore(base));
  assert.ok(meritScore({ ...base, trustedAvgRating: 5 }) > meritScore(base));
  assert.ok(meritScore({ ...base, completedBookings: 10 }) > meritScore(base));
  assert.ok(meritScore({ ...base, respondsFast: true }) > meritScore(base));
  assert.ok(
    meritScore({ ...base, distanceKm: 1 }) > meritScore({ ...base, distanceKm: 40 }),
  );
  assert.ok(meritScore({ ...base, badgePoints: 5 }) > meritScore(base));
  assert.ok(
    meritScore({ ...base, matchToNeed: 1 }) > meritScore({ ...base, matchToNeed: 0 }),
  );
});

test('an unknown distance is NEUTRAL (half credit), never a penalty', () => {
  // matchToNeed pinned to 0 so proximity is the only non-zero term.
  const at = (distanceKm: number | null) =>
    meritScore(signals({ matchToNeed: 0, distanceKm }));
  const unknown = at(null);
  assert.equal(unknown, MERIT_WEIGHTS.proximity * 0.5);
  assert.ok(unknown < at(0) && unknown > at(1e6));
  // NaN degrades the same way, not to a penalty.
  assert.equal(at(Number.NaN), unknown);
});

test('zero trusted reviews earns zero review credit even at a 5.0 average', () => {
  assert.equal(
    meritScore(signals({ trustedReviewCount: 0, trustedAvgRating: 5 })),
    meritScore(signals({ trustedReviewCount: 0, trustedAvgRating: 0 })),
  );
});

test('MERIT_WEIGHTS sum to the 0-100 scale', () => {
  const total = Object.values(MERIT_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.equal(total, MERIT_SCORE_MAX);
});

// ── 4. The organic badge bridge (lib/vendor-badges) ─────────────────────────

test('badgeMeritPoints is bounded, deduped, and empty-safe', () => {
  assert.equal(badgeMeritPoints(null), 0);
  assert.equal(badgeMeritPoints(undefined), 0);
  assert.equal(badgeMeritPoints([]), 0);
  assert.equal(badgeMeritPoints(['verified']), MERIT_BADGE_POINTS.verified);
  assert.equal(
    badgeMeritPoints(['verified', 'verified', 'verified']),
    MERIT_BADGE_POINTS.verified,
  );
  const everything = badgeMeritPoints([
    'new',
    'verified',
    'couple_trusted',
    'most_booking',
    'top_pick',
  ]);
  assert.equal(everything, MERIT_BADGE_POINTS_MAX);
  for (const key of Object.keys(MERIT_BADGE_POINTS)) {
    assert.ok(
      MERIT_BADGE_POINTS[key as keyof typeof MERIT_BADGE_POINTS] <= MERIT_BADGE_POINTS_MAX,
      `${key} alone exceeds the badge ceiling`,
    );
  }
});

// ── 5. Featured / Sponsored slots ───────────────────────────────────────────

const NOW = Date.UTC(2026, 6, 25);

/** A pool big enough that the 25% share cap is not the binding constraint. */
function pool(overrides: ReadonlyArray<Partial<FeaturableVendor> & { id: string }>) {
  const filler = Array.from({ length: 12 }, (_, i) =>
    vendor({ id: `filler-${i}`, meritScore: 40 }),
  );
  return [...overrides.map((o) => vendor(o)), ...filler];
}

test('the label + disclosure are non-empty and unambiguous', () => {
  assert.equal(FEATURED_LABEL, 'Sponsored');
  assert.ok(FEATURED_DISCLOSURE.toLowerCase().includes('paid'));
  assert.ok(FEATURED_DISCLOSURE.length > 20);
});

test('a qualified paid vendor takes a labeled slot and leaves the organic list', () => {
  const { featured, organic, featuredIds } = partitionFeatured(
    pool([
      { id: 'pro', meritScore: 70, tier: 'pro', verified: true },
      { id: 'free-best', meritScore: 72, tier: 'free' },
    ]),
    { nowMs: NOW },
  );
  assert.deepEqual(featured.map((v) => v.id), ['pro']);
  assert.ok(featuredIds.has('pro'));
  // No double exposure — one paying vendor occupies one row, not two.
  assert.ok(!organic.some((v) => v.id === 'pro'));
  // The better FREE vendor still leads the organic list.
  assert.equal(organic[0]?.id, 'free-best');
});

test('FREE and VERIFIED are never featured, no matter their merit', () => {
  for (const tier of UNPAID_TIERS) {
    const { featured } = partitionFeatured(
      pool([{ id: 'x', meritScore: 100, tier, verified: true }]),
      { nowMs: NOW },
    );
    assert.deepEqual(featured, [], `${tier} bought a slot it never paid for`);
  }
  assert.equal(FEATURED_MIN_TIER, 'solo');
});

test('an UNVERIFIED paid vendor is never featured — money cannot outrun vetting', () => {
  for (const tier of PAID_TIERS) {
    const { featured } = partitionFeatured(
      pool([{ id: 'x', meritScore: 100, tier, verified: false }]),
      { nowMs: NOW },
    );
    assert.deepEqual(featured, [], `unverified ${tier} was featured`);
  }
});

test('QUALITY FLOOR: a materially worse paid vendor cannot buy the top slot', () => {
  const belowFloor = partitionFeatured(
    pool([
      { id: 'weak-ent', meritScore: 90 - FEATURED_MERIT_FLOOR_DELTA - 1, tier: 'enterprise', verified: true },
      { id: 'free-star', meritScore: 90, tier: 'free' },
    ]),
    { nowMs: NOW },
  );
  assert.deepEqual(belowFloor.featured, []);
  assert.equal(belowFloor.organic[0]?.id, 'free-star');

  // Exactly ON the floor still qualifies — the boundary is inclusive.
  const onFloor = partitionFeatured(
    pool([
      { id: 'ok-ent', meritScore: 90 - FEATURED_MERIT_FLOOR_DELTA, tier: 'enterprise', verified: true },
      { id: 'free-star', meritScore: 90, tier: 'free' },
    ]),
    { nowMs: NOW },
  );
  assert.deepEqual(onFloor.featured.map((v) => v.id), ['ok-ent']);
});

test('slots are capped by BOTH the hard cap and the share of the page', () => {
  const paid = Array.from({ length: 8 }, (_, i) => ({
    id: `pro-${i}`,
    meritScore: 80,
    tier: 'pro' as const,
    verified: true,
  }));
  const big = partitionFeatured(pool(paid), { nowMs: NOW });
  assert.equal(big.featured.length, FEATURED_SLOT_MAX_DEFAULT);

  // A tiny page: floor(4 * 0.25) = 1 slot.
  const small = partitionFeatured(paid.slice(0, 4).map((p) => vendor(p)), { nowMs: NOW });
  assert.equal(small.featured.length, Math.floor(4 * FEATURED_SLOT_MAX_SHARE));

  // A 3-result page gets ZERO slots — it stays entirely organic.
  const tiny = partitionFeatured(paid.slice(0, 3).map((p) => vendor(p)), { nowMs: NOW });
  assert.deepEqual(tiny.featured, []);
  assert.equal(tiny.organic.length, 3);
});

test('slots go to the highest tier first, then the highest merit, then id', () => {
  const { featured } = partitionFeatured(
    pool([
      { id: 'solo-hi', meritScore: 85, tier: 'solo', verified: true },
      { id: 'ent-lo', meritScore: 80, tier: 'enterprise', verified: true },
      { id: 'pro-hi', meritScore: 84, tier: 'pro', verified: true },
    ]),
    { nowMs: NOW, maxSlots: 3, maxShare: 1 },
  );
  assert.deepEqual(featured.map((v) => v.id), ['ent-lo', 'pro-hi', 'solo-hi']);
});

test('a LAPSED paid tier loses its slot; null expiry (prod reality) keeps it', () => {
  const lapsed = partitionFeatured(
    pool([{ id: 'x', meritScore: 90, tier: 'pro', verified: true, tierExpiresAtMs: NOW - 1 }]),
    { nowMs: NOW },
  );
  assert.deepEqual(lapsed.featured, []);

  const active = partitionFeatured(
    pool([{ id: 'x', meritScore: 90, tier: 'pro', verified: true, tierExpiresAtMs: NOW + 1 }]),
    { nowMs: NOW },
  );
  assert.deepEqual(active.featured.map((v) => v.id), ['x']);

  const noExpiry = partitionFeatured(
    pool([{ id: 'x', meritScore: 90, tier: 'pro', verified: true, tierExpiresAtMs: null }]),
    { nowMs: NOW },
  );
  assert.deepEqual(noExpiry.featured.map((v) => v.id), ['x']);
});

test('isFeaturedWindowActive: null active · future active · past + corrupt lapsed', () => {
  assert.equal(isFeaturedWindowActive(null, NOW), true);
  assert.equal(isFeaturedWindowActive(undefined, NOW), true);
  assert.equal(isFeaturedWindowActive(NOW + 1, NOW), true);
  assert.equal(isFeaturedWindowActive(NOW, NOW), false);
  assert.equal(isFeaturedWindowActive(NOW - 1, NOW), false);
  assert.equal(isFeaturedWindowActive(Number.NaN, NOW), false);
  assert.equal(isFeaturedWindowActive(Number.POSITIVE_INFINITY, NOW), false);
});

test('with nothing eligible, the partition degrades to a plain merit-first list', () => {
  const vendors = pool([{ id: 'free-a', meritScore: 90 }, { id: 'free-b', meritScore: 80 }]);
  const { featured, organic, featuredIds } = partitionFeatured(vendors, { nowMs: NOW });
  assert.deepEqual(featured, []);
  assert.equal(featuredIds.size, 0);
  assert.deepEqual(
    organic.map((v) => v.id),
    rankWithCappedBoost(vendors).map((v) => v.id),
  );
});

test('featured + organic always partition the pool exactly — nothing is lost', () => {
  const vendors = pool([
    { id: 'pro', meritScore: 88, tier: 'pro', verified: true },
    { id: 'ent', meritScore: 86, tier: 'enterprise', verified: true },
    { id: 'solo', meritScore: 84, tier: 'solo', verified: true },
    { id: 'free', meritScore: 90 },
  ]);
  const { featured, organic } = partitionFeatured(vendors, { nowMs: NOW });
  const ids = [...featured, ...organic].map((v) => v.id).sort();
  assert.deepEqual(ids, vendors.map((v) => v.id).sort());
  assert.equal(new Set(ids).size, ids.length, 'a vendor appeared twice');
});

test('maxSlots: 0 disables featuring entirely', () => {
  const { featured, organic } = partitionFeatured(
    pool([{ id: 'ent', meritScore: 95, tier: 'enterprise', verified: true }]),
    { nowMs: NOW, maxSlots: 0 },
  );
  assert.deepEqual(featured, []);
  assert.ok(organic.some((v) => v.id === 'ent'));
});

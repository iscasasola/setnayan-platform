/**
 * BADGE REWARDS — the one table and its words (`lib/badge-rewards.ts`), owner 2026-11-05; and the 40% exemption on a
 * quote (`judgeQuoteGifts`, `lib/shop-gifts.ts`).
 *
 * What each block holds, and the sabotage that turns it red (run 2026-11-05):
 *   • the table IS the ruling — every Events step has its reward, 1,000 and up are free booking fees, 1st Pick pays per
 *     LADDER STEP (sabotage: `25: plus(1)` → `papic(1)` → red);
 *   • exactly-once keys are stable and distinct per step / period / item (sabotage: drop the period from the award key
 *     → red, two months collide);
 *   • NOTHING is owed for an unread or unmeasured badge (sabotage: `count ?? 0` in ladderOwed → red);
 *   • the badge page lines read like the owner's examples ("Next: 100 events · Gold · 4 to go → 2 × Event Plus");
 *   • ⚖ THE APPROVED PER-STEP TABLE (owner 8 Nov, "Rewards yes"): Service cards 3·6·10·20, Inspiration box
 *     10·25·50·100·250 and Branches 2·3·5·10 pay Papic 150 at EACH step (never per card / per branch), and the five
 *     firsts pay Papic 150 each (sabotage run 2026-11-08: `INSPIRATION_STEPS.slice(-2)` back as the paying steps → red;
 *     Branches back to one reward per branch id → red; first_review dropped from rewardsOwed → red);
 *   • 🏅 THE 40% EXEMPTION: a line paid from badge-reward stock is not measured against the limit, bought lines still
 *     are (sabotage: measure `valueCentavos` instead of `boughtCentavos` → red).
 *
 * Pack titles and prices below are TEST FIXTURES, not prices — the app reads them from `platform_retail_catalog_v2`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONE_THRESHOLDS } from './service-card-record';
import { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, TIER_KEYS } from './badge-tiers';
import { formatCount } from './format-number';
import { BOOKING_FEE } from './booking-fee';
import { GIFT_LIMIT_PCT_DEFAULT } from './setnayan-gift';
import { judgeQuoteGifts, rewardFreeByKind, shopGiftPacksFrom } from './shop-gifts';
import {
  BADGE_REWARDS,
  FIRST_FREE_FEE_STEP,
  FREE_FEE_LINE,
  FREE_FEE_SUBLINE,
  GRANTABLE_KINDS,
  PAPIC_PACK_CODE,
  TIER_REWARDS,
  badgeAwardOf,
  badgeRowsWithRewards,
  tierOfRewardKey,
  freeFeeSummary,
  rewardKey,
  rewardLineFor,
  rewardSourceWords,
  rewardWords,
  notYetPaid,
  paidTiers,
  rewardsOwed,
  type BadgeRewardFacts,
  type GrantedReward,
  type RewardNames,
} from './badge-rewards';
import { badgeTracker, type TrackerFacts } from './shop-badges';
import { IAP_PRODUCTS } from './iap/products';

const NAMES: RewardNames = {
  papic: 'Papic 150',
  papic_1000: 'Papic 1000',
  papic_3000: 'Papic 3000',
  event_plus: 'Event Plus',
  event_pro: 'Event Pro',
  event_ultra: 'Event Ultra',
  papicByCredits: { 150: 'Papic 150', 1000: 'Papic 1000', 3000: 'Papic 3000' },
};

/** A ladder's [step, kind, pack] — the pack only for the two bigger Papic packs. */
const ladderOf = (b: keyof typeof BADGE_REWARDS) => {
  const r = BADGE_REWARDS[b];
  assert.equal(r.shape, 'ladder', `${b} is not a ladder`);
  return r.shape === 'ladder' ? r.steps.map((s) => [s.step, s.tier, s.reward?.kind, s.reward?.pack ?? null]) : [];
};

const NONE: BadgeRewardFacts = {
  verified: null,
  completedEvents: null,
  trustedReviews: null,
  firstSourcedBooking: null,
  branchIds: null,
  serviceCards: null,
  inspirationPhotos: null,
  awards: null,
};

function granted(key: string, kind: GrantedReward['kind'], units = 1, extra: Partial<GrantedReward> = {}): GrantedReward {
  return {
    rewardId: `r-${key}`,
    key,
    badge: key.split(':')[0]!,
    kind,
    units,
    grantedAt: '2026-11-05T02:00:00Z',
    revokedAt: null,
    usedAt: null,
    usedOn: null,
    ...extra,
  };
}

describe('the one table is the ruling', () => {
  it('⚖ 15 Nov: ONE ladder for every badge — the owner\'s words, tier by tier', () => {
    // "bronze - papic 150 · silver - papic 150 · gold - papic 1000 · ruby - papic 3000 · emerald - event plus ·
    //  diamond - event pro · black diamond - event ultra"
    assert.deepEqual(TIER_REWARDS, {
      tier1: { kind: 'papic', units: 1 },
      tier2: { kind: 'papic', units: 1 },
      tier3: { kind: 'papic', units: 1, pack: 'papic_1000' },
      tier4: { kind: 'papic', units: 1, pack: 'papic_3000' },
      tier5: { kind: 'event_plus', units: 1 },
      tier6: { kind: 'event_pro', units: 1 },
      tier7: { kind: 'event_ultra', units: 1 },
    });
  });

  it('every laddered badge pays its tier, by position on ITS OWN ladder (the 8 Nov per-step table is gone)', () => {
    const P = 'papic';
    assert.deepEqual(ladderOf('events'), [
      [10, 'tier1', P, null],
      [50, 'tier2', P, null],
      [100, 'tier3', P, 'papic_1000'],
      [500, 'tier4', P, 'papic_3000'],
      [1000, 'tier5', 'event_plus', null],
      [5000, 'tier6', 'event_pro', null],
      [10000, 'tier7', 'event_ultra', null],
    ]);
    for (const s of MILESTONE_THRESHOLDS) assert.ok(ladderOf('events').some(([step]) => step === s), `${s} lost its step`);
    for (const b of ['reviews', 'first_pick', 'booked_loop', 'trusted_by'] as const) {
      assert.deepEqual(ladderOf(b).map((x) => x.slice(1)), ladderOf('events').map((x) => x.slice(1)), `${b} climbs the one ladder`);
    }
    assert.deepEqual(ladderOf('service_cards'), [
      [3, 'tier1', P, null],
      [6, 'tier2', P, null],
      [10, 'tier3', P, 'papic_1000'],
      [20, 'tier4', P, 'papic_3000'],
    ]);
    assert.deepEqual(ladderOf('branches').map((x) => x[0]), [2, 3, 5, 10]);
    assert.deepEqual(ladderOf('inspiration').map((x) => x.slice(0, 2)), [[10, 'tier1'], [25, 'tier2'], [50, 'tier3'], [100, 'tier4'], [250, 'tier5']]);
    assert.deepEqual(ladderOf('trusted_by').map((x) => x[0]), [...SHOP_BADGE_STEPS.trusted_by]);
  });

  it('no NEW free booking fee is earned; one already earned still waits and is still worded', () => {
    assert.equal(FIRST_FREE_FEE_STEP, 0);
    assert.equal(FREE_FEE_SUBLINE, 'Your next customer');
    assert.equal(FREE_FEE_LINE, 'Free booking fee · your next customer');
  });

  it('💎 Black Diamond grants the real Event Ultra — every reward kind is grantable (owner 15 Nov)', () => {
    for (const k of ['papic', 'event_plus', 'event_pro', 'event_ultra', 'fee_waiver'] as const) assert.ok(GRANTABLE_KINDS.has(k), k);
  });

  it('Papic 1000 / 3000 are named by the catalogue CODES the app already sells under those names — never a size', () => {
    const byName = (n: string) => IAP_PRODUCTS.find((p) => p.appStoreName === n)?.serviceKey;
    assert.equal(byName('Papic 1000'), PAPIC_PACK_CODE.papic_1000);
    assert.equal(byName('Papic 3000'), PAPIC_PACK_CODE.papic_3000);
  });

  it('the monthly awards, Verified, and the one badge with no counter yet (Invites)', () => {
    const a = BADGE_REWARDS.award;
    assert.equal(a.shape, 'period');
    if (a.shape === 'period') {
      assert.deepEqual(a.rewards, {
        most_booked: { kind: 'event_plus', units: 1 },
        top_pick: { kind: 'event_plus', units: 1 },
        rising: { kind: 'event_plus', units: 1 },
      });
    }
    assert.deepEqual(BADGE_REWARDS.verified.shape === 'once' && BADGE_REWARDS.verified.reward, { kind: 'papic', units: 1 });
    const unmeasured = Object.values(BADGE_REWARDS).filter((r) => !r.measured && !r.retired).map((r) => r.badge).sort();
    // Invites ships "Not counted yet": nothing records one supplier adding another (219fb192).
    assert.deepEqual(unmeasured, ['invites']);
  });

  it('🏅 the five shop badges and their own steps, exactly (v86 · bc148e4e · 50566f42)', () => {
    const steps = (b: keyof typeof BADGE_REWARDS) => ladderOf(b).map((x) => x[0]);
    // The numbers live ONLY in SHOP_BADGE_STEPS (lib/badge-tiers.ts); this checks each ladder is built from it.
    for (const b of SHOP_BADGE_KEYS) {
      assert.deepEqual(steps(b), [...SHOP_BADGE_STEPS[b]], `${b} pays on the table's steps`);
      assert.equal(SHOP_BADGE_STEPS[b].length, TIER_KEYS.length, `${b} has one step per tier`);
      assert.ok(SHOP_BADGE_STEPS[b].every((n, i, a) => Number.isInteger(n) && n > 0 && (i === 0 || n > a[i - 1]!)), `${b} climbs`);
    }
    for (const b of ['completed_bookings', 'five_star_reviews', 'gifts_given', 'trusted_by', 'invites'] as const) {
      assert.deepEqual(
        ladderOf(b).map((x) => x[1]),
        ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7'],
        `${b} climbs Bronze → Black Diamond`,
      );
    }
  });

  it('🗄 every other badge is retired (4b8cc3a3): nothing new is ever granted for it', () => {
    const retired = Object.values(BADGE_REWARDS).filter((r) => r.retired).map((r) => r.badge).sort();
    assert.deepEqual(retired, [
      'booked_loop',
      'branches',
      'events',
      'first_booking',
      'first_first_pick',
      'first_five_star',
      'first_loop',
      'first_pick',
      'first_review',
      'inspiration',
      'reviews',
      'service_cards',
    ]);
    const everything = rewardsOwed({
      ...NONE,
      verified: false,
      firstSourcedBooking: true,
      completedEvents: 10_000, // the retired Events ladder pays nothing, however high
      completedBookings: SHOP_BADGE_STEPS.completed_bookings[0]! - 1,
      trustedReviews: 900,
      branchIds: ['b1', 'b2', 'b3'],
      serviceCards: 20,
      inspirationPhotos: 250,
      bookedLoops: 0,
      fiveStarReviews: SHOP_BADGE_STEPS.five_star_reviews[0]! - 1,
    });
    assert.deepEqual(everything, [], 'a retired ladder pays nothing, however high its count');
  });
});

describe('exactly-once keys', () => {
  it('a tiered badge is keyed by its TIER; a period by its month', () => {
    assert.equal(rewardKey('verified'), 'verified');
    assert.equal(rewardKey('completed_bookings', 'tier3'), 'completed_bookings:tier3');
    const owed = rewardsOwed({
      ...NONE,
      awards: [
        { type: 'rising', periodMonth: '2026-10-01' },
        { type: 'rising', periodMonth: '2026-11-01' },
        { type: 'rising', periodMonth: '2026-11-01' },
      ],
    });
    assert.deepEqual(owed.map((o) => o.key), ['award:rising:2026-10-01', 'award:rising:2026-11-01'], 'one per award per month');
  });

  it('♾ a tier pays ONCE, EVER — an existing row blocks it, an old-ladder row blocks the tier it was told (3cbf12c1)', () => {
    // Counts taken from the table: Completed bookings at its 3rd step, Five-star reviews at its 2nd.
    const owed = rewardsOwed({
      ...NONE,
      completedBookings: SHOP_BADGE_STEPS.completed_bookings[2]!,
      fiveStarReviews: SHOP_BADGE_STEPS.five_star_reviews[1]!,
    });
    assert.deepEqual(owed.map((o) => o.key), [
      'completed_bookings:tier1',
      'completed_bookings:tier2',
      'completed_bookings:tier3',
      'five_star_reviews:tier1',
      'five_star_reviews:tier2',
    ]);
    // The same tier already paid under its own key — never again.
    assert.deepEqual(
      notYetPaid(owed, ['completed_bookings:tier1']).map((o) => o.key),
      ['completed_bookings:tier2', 'completed_bookings:tier3', 'five_star_reviews:tier1', 'five_star_reviews:tier2'],
    );
    // An OLD payment: `events:50` was Silver on the old Events ladder → Silver Completed bookings is spent;
    // `reviews:5` was Bronze on the old Reviews ladder → Bronze Five-star reviews is spent.
    assert.deepEqual(
      notYetPaid(owed, ['events:50', 'reviews:5']).map((o) => o.key),
      ['completed_bookings:tier1', 'completed_bookings:tier3', 'five_star_reviews:tier2'],
    );
    // A retired badge with no successor blocks nothing (what it paid simply stays).
    assert.equal(notYetPaid(owed, ['booked_loop:1', 'service_cards:3', 'first_loop', 'verified']).length, owed.length);
    assert.deepEqual([...paidTiers(['events:10', 'events:999', 'trusted_by:5', 'gifts_given:tier7'])].sort(), [
      'completed_bookings:tier1',
      'gifts_given:tier7',
    ]);
  });
});

describe('what a shop is owed', () => {
  it('nothing for an unread or unmeasured badge — never a zero, never a guess', () => {
    assert.deepEqual(rewardsOwed(NONE), []);
    assert.deepEqual(rewardsOwed({ ...NONE, fiveStarReviews: null, trustedBy: null, giftPoints: null, invites: null }), []);
    assert.deepEqual(rewardsOwed({ ...NONE, fiveStarReviews: 0, trustedBy: 0, giftPoints: 0, completedBookings: 0 }), []);
    // ✅ Completed bookings reads its OWN import-free count, never the public completed-events number (owner 16 Nov).
    assert.deepEqual(rewardsOwed({ ...NONE, completedEvents: 10_000, completedBookings: null }), []);
    // Invites has no counter yet: even a count handed in pays nothing.
    assert.deepEqual(rewardsOwed({ ...NONE, invites: SHOP_BADGE_STEPS.invites[SHOP_BADGE_STEPS.invites.length - 1]! }), []);
  });

  it('every reached tier, each paying the one ladder', () => {
    // Counts from the table: every Completed bookings step, 3 Gifts given steps, 3 Trusted by steps.
    const S = SHOP_BADGE_STEPS;
    const owed = rewardsOwed({
      ...NONE,
      verified: true,
      completedBookings: S.completed_bookings[S.completed_bookings.length - 1]!,
      giftPoints: S.gifts_given[2]!,
      trustedBy: S.trusted_by[2]!,
    });
    const byKey = Object.fromEntries(owed.map((o) => [o.key, o.reward]));
    const tiers = (b: string, n: number) => TIER_KEYS.slice(0, n).map((t) => `${b}:${t}`);
    assert.deepEqual(Object.keys(byKey).sort(), [
      ...tiers('completed_bookings', TIER_KEYS.length),
      ...tiers('gifts_given', 3),
      ...tiers('trusted_by', 3),
      'verified',
    ].sort());
    assert.deepEqual(byKey['completed_bookings:tier1'], { kind: 'papic', units: 1 });
    assert.deepEqual(byKey['gifts_given:tier3'], { kind: 'papic', units: 1, pack: 'papic_1000' });
    assert.deepEqual(byKey['completed_bookings:tier4'], { kind: 'papic', units: 1, pack: 'papic_3000' });
    assert.deepEqual(byKey['completed_bookings:tier5'], { kind: 'event_plus', units: 1 });
    assert.deepEqual(byKey['completed_bookings:tier6'], { kind: 'event_pro', units: 1 });
    assert.deepEqual(byKey['completed_bookings:tier7'], { kind: 'event_ultra', units: 1 });
    assert.equal(owed.find((o) => o.key === 'gifts_given:tier2')!.note, 'Badge reward · Gifts given · Silver');
  });
});

describe('the badge page lines', () => {
  it('a ladder names its next REWARDING step and how far, like the owner’s example', () => {
    const l = rewardLineFor('events', 96, null, [granted('events:50', 'event_plus')], NAMES);
    assert.equal(l.gave, 'Gave you: Event Plus · in your gifts');
    assert.equal(l.next, 'Next: 100 events · Gold · 4 to go → Papic 1000');
    assert.equal(rewardLineFor('events', 999, null, [], NAMES).next, 'Next: 1,000 events · Emerald · 1 to go → Event Plus');
    assert.equal(rewardLineFor('events', 9999, null, [], NAMES).next, 'Next: 10,000 events · Black Diamond · 1 to go → Event Ultra');
    assert.equal(rewardLineFor('events', 10000, null, [], NAMES).next, null, 'nothing after the top of the ladder');
  });

  it('one-time badges say what they give when earned; unmeasured ones name their first reward with no count', () => {
    assert.equal(rewardLineFor('verified', null, false, [], NAMES).next, 'When you earn it → Papic 150');
    assert.equal(rewardLineFor('verified', null, true, [granted('verified', 'papic')], NAMES).next, null);
    assert.equal(rewardLineFor('first_pick', null, null, null, NAMES).next, 'First reward: 1 booking → Papic 150');
    assert.equal(rewardLineFor('first_pick', null, null, null, NAMES).gave, null, 'unread rewards say nothing, not "nothing given"');
    assert.equal(rewardLineFor('inspiration', null, null, [], NAMES).next, 'First reward: 10 photos → Papic 150');
    assert.equal(rewardLineFor('inspiration', 12, null, [], NAMES).next, 'Next: 25 photos · Silver · 13 to go → Papic 150');
    assert.equal(rewardLineFor('branches', 1, null, [], NAMES).next, 'Next: 2 branches · Bronze · 1 to go → Papic 150');
    assert.equal(
      rewardLineFor('trusted_by', SHOP_BADGE_STEPS.trusted_by[2]! - 1, null, [], NAMES).next,
      `Next: ${formatCount(SHOP_BADGE_STEPS.trusted_by[2]!)} clients who came back · Gold · 1 to go → Papic 1000`,
    );
    assert.equal(
      rewardLineFor('gifts_given', SHOP_BADGE_STEPS.gifts_given[0]! - 1, null, [], NAMES).next,
      `Next: ${formatCount(SHOP_BADGE_STEPS.gifts_given[0]!)} gift points · Bronze · 1 to go → Papic 150`,
    );
    assert.equal(rewardLineFor('first_five_star', null, null, null, NAMES).next, 'When you earn it → Papic 150');
  });

  it('every row carries its reward; Rating and Years say nothing about rewards', () => {
    const f: TrackerFacts = {
      verified: true,
      completedEvents: 96,
      trusted: { trusted_avg_rating: 4.8, trusted_review_count: 12 },
      inBusinessSinceYear: 2019,
      awards: [],
      nowYear: 2026,
      unreviewed: 0,
    };
    const rows = badgeRowsWithRewards(badgeTracker(f), {
      facts: { ...NONE, verified: true, completedEvents: 96, trustedReviews: 12, firstSourcedBooking: true, branchIds: [], serviceCards: 4, inspirationPhotos: 0, awards: [] },
      granted: [granted('verified', 'papic'), granted('events:50', 'event_plus')],
      names: NAMES,
      awardTypeByTitle: {},
      periodMonth: '2026-11-01',
    });
    const by = (k: string) => rows.find((r) => r.key === k || r.kind === k)!;
    assert.equal(by('verified').reward?.gave, 'Gave you: Papic 150 · in your gifts');
    assert.equal(by('milestone').reward?.next, 'Next: 100 events · Gold · 4 to go → Papic 1000');
    assert.equal(by('rating').reward, undefined);
    assert.equal(by('years').reward, undefined);
    const fp = rows.find((r) => r.key === 'reward:first_pick')!;
    assert.equal(fp.state, 'not_counted');
    assert.equal(fp.stateWord, 'Soon');
    assert.equal(rows.find((r) => r.key === 'reward:reviews')!.reward?.next, 'Next: 25 reviews · Gold · 13 to go → Papic 1000');
    assert.equal(rows.find((r) => r.key === 'reward:service_cards')!.reward?.next, 'Next: 6 cards · Silver · 2 to go → Papic 150');
    assert.equal(rows.find((r) => r.key === 'reward:first_review')!.state, 'earned');
    // ⭐ 15 Nov: counted now — an UNREAD count says so, never "not yet".
    assert.equal(rows.find((r) => r.key === 'reward:first_five_star')!.state, 'unread');
    assert.equal(rows.find((r) => r.key === 'reward:trusted_by')!.state, 'unread');
    assert.equal(rows.at(-1)!.title, 'Monthly awards');
  });
});

describe('🏅 award dates (owner 15 Nov: "seal shows awarded on X")', () => {
  it('a ladder key knows its step and its tier on its own ladder; a once-badge has none', () => {
    assert.deepEqual(tierOfRewardKey('events:100'), { step: 100, tier: 'tier3' });
    assert.deepEqual(tierOfRewardKey('service_cards:20'), { step: 20, tier: 'tier4' });
    assert.deepEqual(tierOfRewardKey('trusted_by:250'), { step: 250, tier: 'tier7' });
    assert.equal(tierOfRewardKey('verified'), null);
    assert.equal(tierOfRewardKey('award:rising:2026-11-01'), null);
    assert.equal(tierOfRewardKey('events:77'), null, 'not a step');
  });

  it('shapes a grant and its claim for the UI', () => {
    const a = badgeAwardOf(granted('events:100', 'papic', 1, { creditsEach: 1000, grantedAt: '2026-01-12T02:00:00Z' }), null, NAMES);
    assert.deepEqual(a, {
      rewardId: 'r-events:100',
      key: 'events:100',
      badge: 'events',
      step: 100,
      tier: 'tier3',
      tierName: 'Gold',
      badgeLabel: '100 events · Gold',
      rewardLabel: 'Papic 1000',
      kind: 'papic',
      units: 1,
      grantedAt: '2026-01-12T02:00:00Z',
      claimedAt: null,
    });
    const v = badgeAwardOf(granted('verified', 'papic', 1, { creditsEach: 150 }), '2026-11-06T00:00:00Z', NAMES);
    assert.equal(v.tier, null);
    assert.equal(v.badgeLabel, 'SETNAYAN Verified');
    assert.equal(v.rewardLabel, 'Papic 150');
    assert.equal(v.claimedAt, '2026-11-06T00:00:00Z');
  });
});

describe('the gifts list', () => {
  it('words a reward and its source', () => {
    assert.equal(rewardWords({ kind: 'papic', units: 2 }, NAMES), '2 × Papic 150');
    assert.equal(rewardWords({ kind: 'papic', units: 1, pack: 'papic_3000' }, NAMES), 'Papic 3000');
    assert.equal(rewardWords({ kind: 'event_ultra', units: 1 }, NAMES), 'Event Ultra');
    // A reward already granted reads as the pack it actually WAS (its credits), not what the ladder says today.
    assert.equal(rewardWords({ kind: 'papic', units: 1, creditsEach: 150 }, NAMES), 'Papic 150');
    assert.equal(rewardWords({ kind: 'papic', units: 1, creditsEach: 1000 }, NAMES), 'Papic 1000');
    assert.equal(rewardWords({ kind: 'papic', units: 1, pack: 'papic_1000' }, { papic: 'Papic 150', event_plus: 'Event Plus', event_pro: 'Event Pro' }), 'Papic pack', 'an unread pack name is product words, never a size');
    assert.equal(rewardWords({ kind: 'fee_waiver', units: 1 }, NAMES), 'Free booking fee · your next customer');
    assert.equal(rewardSourceWords('events:500'), '500 events · Ruby');
    assert.equal(rewardSourceWords('trusted_by:5'), 'Trusted by · 5');
    assert.equal(rewardSourceWords('award:most_booked:2026-11-01'), 'Most Booked · Nov 2026');
    assert.equal(rewardSourceWords('branches:2'), 'Branches · 2');
    assert.equal(rewardSourceWords('first_review'), 'First review');
  });

  it('the free booking fee shows its history: earned when, used on which booking', () => {
    const s = freeFeeSummary([
      granted('events:1000', 'fee_waiver', 1, {
        usedAt: '2026-11-09T03:00:00Z',
        usedOn: { coupleName: 'Maria & Juan', wouldHaveBeenPhp: 2500 },
      }),
      granted('events:5000', 'fee_waiver', 1, { grantedAt: '2026-11-10T03:00:00Z' }),
      granted('events:10', 'papic', 2),
    ]);
    assert.equal(s.waiting, 1);
    assert.equal(s.history.length, 2, 'stock rewards are not free fees');
    assert.equal(s.history[0]!.title, '₱0 fee · Maria & Juan');
    assert.equal(s.history[0]!.line, '1,000 events · earned Nov 5 · used Nov 9');
    assert.equal(s.history[0]!.sentence, 'Earned Nov 5, 2026 · 1,000 events · used Nov 9, 2026 on Maria & Juan · ₱0 fee · Badge reward');
    assert.equal(s.history[1]!.state, 'waiting');
  });
});

describe('🏅 badge rewards sit outside the 40% gift limit; bought gifts keep it', () => {
  const PACKS = shopGiftPacksFrom([
    { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99 },
    { code: 'EVENT_PLUS', title: 'Event Plus', credits: 1, pricePhp: 2990 },
    { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', credits: 1, pricePhp: 5690 },
  ]);
  // 🔢 Papic counted in packs (2026-11-14): `papic` credits of Papic 150 are that many / 150 packs.
  const F = (papic: number, event_plus = 0, event_pro = 0, event_ultra = 0) => ({
    papic,
    event_plus,
    event_pro,
    event_ultra,
    packs: { PAPIC_GUEST_150: Math.floor(papic / 150) },
  });
  // A small booking: its 40% limit is far below Event Pro's price.
  const TOTAL = 2_000_000;

  it('an Event Pro from badge rewards goes on a small booking; the same Event Pro BOUGHT does not', () => {
    const fromReward = judgeQuoteGifts(['COUPLE_WEBSITE_PRO'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(0, 0, 1), 'none', F(0, 0, 1));
    assert.equal(fromReward.state, 'ok');
    assert.deepEqual(fromReward.fromReward, [true]);
    assert.ok(fromReward.rewardCentavos > fromReward.limitCentavos, 'the fixture does not exceed the limit');

    const bought = judgeQuoteGifts(['COUPLE_WEBSITE_PRO'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(0, 0, 1), 'none', F(0, 0, 0));
    assert.equal(bought.state, 'over_limit', 'a bought Event Pro escaped the limit');
  });

  it('reward stock pays whole lines, the most valuable first; the rest is measured', () => {
    // One Event Plus from rewards + one bought Event Plus: the bought one is measured, and is over.
    const v = judgeQuoteGifts(['EVENT_PLUS', 'EVENT_PLUS'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(0, 2), 'none', F(0, 1), 9);
    assert.deepEqual(v.fromReward, [true, false]);
    assert.equal(v.state, 'over_limit');
    // 150 reward credits cover one Papic 150 line; a second one (bought) is still the always-allowed pack.
    const p = judgeQuoteGifts(['PAPIC_GUEST_150', 'PAPIC_GUEST_150'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(300), 'none', F(150), 9);
    assert.deepEqual(p.fromReward, [true, false]);
    assert.equal(p.state, 'ok');
  });

  it('reward stock never counts for more than is free to offer, and an unread one counts as none', () => {
    assert.deepEqual(rewardFreeByKind({ papic: { earned: 300, used: 0 }, event_plus: { earned: 1, used: 1 }, event_pro: { earned: 0, used: 0 }, event_ultra: { earned: 0, used: 0 } }, F(150, 3)), { ...F(150, 0, 0), packs: {} });
    assert.equal(rewardFreeByKind(null, F(150)), null);
    const v = judgeQuoteGifts(['COUPLE_WEBSITE_PRO'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(0, 0, 1), 'none', null);
    assert.equal(v.state, 'over_limit', 'an unread reward stock exempted a line');
  });
});

describe('🏅 owner 2026-11-05 on the draft — the gift stays, a cancelled booking gives the fee back', () => {
  it('the quote reads a badge-paid booking as the gift ON with nothing billed, and the switch keeps that', async () => {
    const { standingForGiftArm, standingForQuoteSwitch, papicTopUpForQuote, giftBasisFrom } = await import('./papic-on-a-quote');
    const { giftQuoteCopy } = await import('./setnayan-gift');
    const basis = { schedule: BOOKING_FEE, ladder: [] as never[] } as never;
    const on = standingForGiftArm('badge_reward', basis);
    assert.deepEqual(on, { kind: 'included', basis, freeWithBadge: true });
    assert.ok(giftBasisFrom(on), 'a badge-paid booking does not promise the couple the gift');
    const off = standingForGiftArm('badge_reward_card_says_no', basis);
    assert.equal(off.kind, 'available');
    const switched = standingForQuoteSwitch(off, true);
    assert.equal(switched.kind === 'included' && switched.freeWithBadge, true, 'switching on lost the badge reward');
    assert.equal(standingForGiftArm('badge_reward', null).kind, 'unreadable');
    const words = giftQuoteCopy({ credits: 1000, chargeCentavos: 50000 }, 'supplier', { freeWithBadge: true })!;
    assert.doesNotMatch(words.detail, /bill:/, 'a free gift still reads as added to a bill');
    assert.match(words.detail, /badge reward/);
    void papicTopUpForQuote;
  });

  it('a free fee given back when its booking was cancelled reads as waiting again, with when', () => {
    const s = freeFeeSummary([
      granted('events:1000', 'fee_waiver', 1, { returnedAt: '2026-11-08T03:00:00Z' }),
      granted('events:5000', 'fee_waiver', 1, {
        usedAt: '2026-11-09T03:00:00Z',
        usedOn: { coupleName: 'Ana & Leo', wouldHaveBeenPhp: 2500 },
        setnayanGiftCredits: 1000,
      }),
    ]);
    assert.equal(s.waiting, 1);
    assert.equal(s.history[0]!.state, 'waiting');
    assert.equal(s.history[0]!.line, '1,000 events · earned Nov 5 · back Nov 8');
    assert.match(s.history[1]!.sentence, /your couple still got the Setnayan gift, 1,000 Papic photos$/);
  });
});

describe('🏅 a tier-keyed reward reads its tier and step (award dates)', () => {
  it('completed_bookings:tier3 is Gold at 50', () => {
    assert.deepEqual(tierOfRewardKey('completed_bookings:tier3'), { step: 50, tier: 'tier3' });
    assert.deepEqual(tierOfRewardKey('gifts_given:tier7'), { step: 20000, tier: 'tier7' });
    assert.equal(rewardSourceWords('five_star_reviews:tier2'), 'Five-star reviews · Silver');
  });
});

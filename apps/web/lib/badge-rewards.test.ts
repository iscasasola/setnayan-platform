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
import { BOOKING_FEE } from './booking-fee';
import { GIFT_LIMIT_PCT_DEFAULT } from './setnayan-gift';
import { judgeQuoteGifts, rewardFreeByKind, shopGiftPacksFrom } from './shop-gifts';
import {
  BADGE_REWARDS,
  EVENTS_STEP_REWARDS,
  FIRST_FREE_FEE_STEP,
  FREE_FEE_LINE,
  badgeRowsWithRewards,
  freeFeeSummary,
  rewardKey,
  rewardLineFor,
  rewardSourceWords,
  rewardWords,
  rewardsOwed,
  type BadgeRewardFacts,
  type GrantedReward,
  type RewardNames,
} from './badge-rewards';
import { badgeTracker, type TrackerFacts } from './shop-badges';

const NAMES: RewardNames = { papic: 'Papic 150', event_plus: 'Event Plus', event_pro: 'Event Pro' };

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
  it('Events on Setnayan: every shipped step pays, and 1,000 / 5,000 / 10,000 pay a free booking fee', () => {
    for (const s of MILESTONE_THRESHOLDS) assert.ok(EVENTS_STEP_REWARDS[s], `the ${s}-event step pays nothing`);
    // ⚖ 6 Nov 2026 (owner approved the table): Event Plus replaced 2 × Papic 150 at 10 events.
    assert.deepEqual(EVENTS_STEP_REWARDS[10], { kind: 'event_plus', units: 1 });
    assert.deepEqual(EVENTS_STEP_REWARDS[50], { kind: 'event_plus', units: 1 });
    assert.deepEqual(EVENTS_STEP_REWARDS[100], { kind: 'event_plus', units: 2 });
    assert.deepEqual(EVENTS_STEP_REWARDS[500], { kind: 'event_pro', units: 1 });
    for (const s of [1000, 5000, 10000]) assert.deepEqual(EVENTS_STEP_REWARDS[s], { kind: 'fee_waiver', units: 1 });
    assert.equal(FIRST_FREE_FEE_STEP, 1000);
    assert.equal(FREE_FEE_LINE, 'Free booking fee · your next customer · from 1,000 events');
  });

  it('1st Pick pays at each LADDER STEP, never per booking', () => {
    const r = BADGE_REWARDS.first_pick;
    assert.equal(r.shape, 'ladder');
    if (r.shape !== 'ladder') return;
    assert.deepEqual(
      r.steps.map((s) => [s.step, s.reward?.kind, s.reward?.units]),
      [
        [1, 'papic', 1],
        [5, 'papic', 1],
        [10, 'papic', 1],
        [25, 'event_plus', 1], // ⚖ 6 Nov 2026: was 2 × Papic 150
        [50, 'event_plus', 1],
        [100, 'event_plus', 1],
        [250, 'event_plus', 1],
      ],
    );
  });

  it('the monthly awards, the once-badges, and which badges have no counter yet', () => {
    const a = BADGE_REWARDS.award;
    assert.equal(a.shape, 'period');
    if (a.shape === 'period') {
      assert.deepEqual(a.rewards, {
        most_booked: { kind: 'event_plus', units: 1 },
        top_pick: { kind: 'event_plus', units: 1 },
        rising: { kind: 'event_plus', units: 1 }, // ⚖ 6 Nov 2026: was 2 × Papic 150
      });
    }
    assert.deepEqual(BADGE_REWARDS.verified.shape === 'once' && BADGE_REWARDS.verified.reward, { kind: 'papic', units: 1 });
    assert.deepEqual(BADGE_REWARDS.first_booking.shape === 'once' && BADGE_REWARDS.first_booking.reward, { kind: 'papic', units: 1 });
    const unmeasured = Object.values(BADGE_REWARDS).filter((r) => !r.measured).map((r) => r.badge).sort();
    // THE ONE BUILD (spec §9 #11): the Booked Loop and its first are counted since C2's `shop_booked_loop_count`.
    assert.deepEqual(unmeasured, ['first_first_pick', 'first_five_star', 'first_pick']);
  });

  it('⚖ 8 Nov: Service cards, Inspiration box and Branches pay Papic 150 at EVERY step of their approved ladders', () => {
    const ladder = (b: 'service_cards' | 'inspiration' | 'branches') => {
      const r = BADGE_REWARDS[b];
      assert.equal(r.shape, 'ladder', `${b} is not a ladder`);
      assert.equal(r.measured, true, `${b} has no counter`);
      return r.shape === 'ladder' ? r.steps.map((s) => [s.step, s.reward?.kind, s.reward?.units]) : [];
    };
    assert.deepEqual(ladder('service_cards'), [3, 6, 10, 20].map((n) => [n, 'papic', 1]));
    assert.deepEqual(ladder('inspiration'), [10, 25, 50, 100, 250].map((n) => [n, 'papic', 1]));
    assert.deepEqual(ladder('branches'), [2, 3, 5, 10].map((n) => [n, 'papic', 1]));
  });

  it('⚖ 8 Nov: the five firsts pay Papic 150 each; Reviews and Booked Loop keep their approved steps', () => {
    for (const b of ['first_booking', 'first_review', 'first_five_star', 'first_loop', 'first_first_pick'] as const) {
      const r = BADGE_REWARDS[b];
      assert.equal(r.shape, 'once', `${b} is not a one-time first`);
      assert.deepEqual(r.shape === 'once' && r.reward, { kind: 'papic', units: 1 }, `${b} does not pay Papic 150`);
    }
    const rv = BADGE_REWARDS.reviews;
    assert.deepEqual(rv.shape === 'ladder' && rv.steps.map((s) => [s.step, s.reward?.kind]), [5, 10, 25, 50, 100, 250, 500].map((n) => [n, 'papic']));
    const bl = BADGE_REWARDS.booked_loop;
    assert.deepEqual(bl.shape === 'ladder' && bl.steps.map((s) => [s.step, s.reward?.kind]), [1, 5, 10, 25, 50, 100, 250].map((n) => [n, 'event_plus']));
  });
});

describe('exactly-once keys', () => {
  it('name the badge and its step, period or item — distinct, stable', () => {
    assert.equal(rewardKey('verified'), 'verified');
    assert.equal(rewardKey('events', 50), 'events:50');
    assert.equal(rewardKey('branches', 2), 'branches:2');
    assert.equal(rewardKey('service_cards', 3), 'service_cards:3');
    assert.equal(rewardKey('first_review'), 'first_review');
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
});

describe('what a shop is owed', () => {
  it('nothing for an unread or unmeasured badge — never a zero, never a guess', () => {
    assert.deepEqual(rewardsOwed(NONE), []);
    // 🔁 THE ONE BUILD (spec §9 #11): the Booked Loop pays Event Plus at each step reached, and its first Papic 150 —
    // only from a READ count; unread (null or absent) pays nothing.
    const loop = rewardsOwed({ ...NONE, bookedLoops: 5 });
    assert.deepEqual(loop.map((o) => o.key).sort(), ['booked_loop:1', 'booked_loop:5', 'first_loop']);
    assert.ok(loop.filter((o) => o.badge === 'booked_loop').every((o) => o.reward.kind === 'event_plus'));
    assert.deepEqual(rewardsOwed({ ...NONE, bookedLoops: null }), []);
    assert.deepEqual(rewardsOwed({ ...NONE, bookedLoops: 0 }), []);
    assert.deepEqual(rewardsOwed({ ...NONE, verified: false, firstSourcedBooking: false, completedEvents: 9, trustedReviews: 0, serviceCards: 2, inspirationPhotos: 9, branchIds: ['b1'] }), []);
    // ⚖ 8 Nov: 4 reviews is below the Reviews ladder, but the FIRST review already paid.
    assert.deepEqual(rewardsOwed({ ...NONE, trustedReviews: 4 }).map((o) => o.key), ['first_review']);
  });

  it('every reached step, each with its own reward', () => {
    const owed = rewardsOwed({
      ...NONE,
      verified: true,
      firstSourcedBooking: true,
      completedEvents: 1200,
      trustedReviews: 12,
      branchIds: ['b1', 'b1', 'b2'],
      serviceCards: 6,
      inspirationPhotos: 30,
    });
    const byKey = Object.fromEntries(owed.map((o) => [o.key, o.reward]));
    assert.deepEqual(Object.keys(byKey).sort(), [
      'branches:2',
      'events:10',
      'events:100',
      'events:1000',
      'events:50',
      'events:500',
      'first_booking',
      'first_review',
      'inspiration:10',
      'inspiration:25',
      'reviews:10',
      'reviews:5',
      'service_cards:3',
      'service_cards:6',
      'verified',
    ]);
    for (const k of ['branches:2', 'service_cards:6', 'inspiration:25', 'first_review']) assert.deepEqual(byKey[k], { kind: 'papic', units: 1 });
    assert.deepEqual(byKey['events:1000'], { kind: 'fee_waiver', units: 1 });
    assert.equal(owed.find((o) => o.key === 'events:50')!.note, 'Badge reward · 50 events · Silver');
  });
});

describe('the badge page lines', () => {
  it('a ladder names its next REWARDING step and how far, like the owner’s example', () => {
    const l = rewardLineFor('events', 96, null, [granted('events:50', 'event_plus')], NAMES);
    assert.equal(l.gave, 'Gave you: Event Plus · in your gifts');
    assert.equal(l.next, 'Next: 100 events · Gold · 4 to go → 2 × Event Plus');
    assert.equal(rewardLineFor('events', 999, null, [], NAMES).next, 'Next: 1,000 events · Diamond · 1 to go → Free booking fee · your next customer');
    assert.equal(rewardLineFor('events', 10000, null, [], NAMES).next, null, 'nothing after the top of the ladder');
  });

  it('one-time badges say what they give when earned; unmeasured ones name their first reward with no count', () => {
    assert.equal(rewardLineFor('verified', null, false, [], NAMES).next, 'When you earn it → Papic 150');
    assert.equal(rewardLineFor('verified', null, true, [granted('verified', 'papic')], NAMES).next, null);
    assert.equal(rewardLineFor('first_pick', null, null, null, NAMES).next, 'First reward: 1 booking → Papic 150');
    assert.equal(rewardLineFor('first_pick', null, null, null, NAMES).gave, null, 'unread rewards say nothing, not "nothing given"');
    assert.equal(rewardLineFor('inspiration', null, null, [], NAMES).next, 'First reward: 10 photos → Papic 150');
    assert.equal(rewardLineFor('inspiration', 12, null, [], NAMES).next, 'Next: 25 photos · 13 to go → Papic 150');
    assert.equal(rewardLineFor('branches', 1, null, [], NAMES).next, 'Next: 2 branches · 1 to go → Papic 150');
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
    assert.equal(by('milestone').reward?.next, 'Next: 100 events · Gold · 4 to go → 2 × Event Plus');
    assert.equal(by('rating').reward, undefined);
    assert.equal(by('years').reward, undefined);
    const fp = rows.find((r) => r.key === 'reward:first_pick')!;
    assert.equal(fp.state, 'not_counted');
    assert.equal(fp.stateWord, 'Soon');
    assert.equal(rows.find((r) => r.key === 'reward:reviews')!.reward?.next, 'Next: 25 reviews · 13 to go → Papic 150');
    assert.equal(rows.find((r) => r.key === 'reward:service_cards')!.reward?.next, 'Next: 6 cards · 2 to go → Papic 150');
    assert.equal(rows.find((r) => r.key === 'reward:first_review')!.state, 'earned');
    assert.equal(rows.find((r) => r.key === 'reward:first_five_star')!.state, 'not_counted');
    assert.equal(rows.at(-1)!.title, 'Monthly awards');
  });
});

describe('the gifts list', () => {
  it('words a reward and its source', () => {
    assert.equal(rewardWords({ kind: 'papic', units: 2 }, NAMES), '2 × Papic 150');
    assert.equal(rewardWords({ kind: 'fee_waiver', units: 1 }, NAMES), 'Free booking fee · your next customer');
    assert.equal(rewardSourceWords('events:500'), '500 events · Platinum');
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
    { code: 'PAPIC_GUEST_150', title: 'Papic 150', credits: 150, pricePhp: 99, giftPricePhp: 90 },
    { code: 'EVENT_PLUS', title: 'Event Plus', credits: 1, pricePhp: 2990, giftPricePhp: 2690 },
    { code: 'COUPLE_WEBSITE_PRO', title: 'Event Pro', credits: 1, pricePhp: 5690, giftPricePhp: 5190 },
  ]);
  const F = (papic: number, event_plus = 0, event_pro = 0) => ({ papic, event_plus, event_pro });
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
    const v = judgeQuoteGifts(['EVENT_PLUS', 'EVENT_PLUS'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(0, 2), 'none', F(0, 1));
    assert.deepEqual(v.fromReward, [true, false]);
    assert.equal(v.state, 'over_limit');
    // 150 reward credits cover one Papic 150 line; a second one (bought) is still the always-allowed pack.
    const p = judgeQuoteGifts(['PAPIC_GUEST_150', 'PAPIC_GUEST_150'], PACKS, TOTAL, BOOKING_FEE, GIFT_LIMIT_PCT_DEFAULT, F(300), 'none', F(150));
    assert.deepEqual(p.fromReward, [true, false]);
    assert.equal(p.state, 'ok');
  });

  it('reward stock never counts for more than is free to offer, and an unread one counts as none', () => {
    assert.deepEqual(rewardFreeByKind({ papic: { earned: 300, used: 0 }, event_plus: { earned: 1, used: 1 }, event_pro: { earned: 0, used: 0 } }, F(150, 3)), F(150, 0, 0));
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

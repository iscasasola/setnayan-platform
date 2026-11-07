/**
 * 🔒 THE ONE BADGE ROW (lib/shop-badge-row.ts) — THE ONE BUILD, lane C4 (A3 §5 guard 3, as cut by spec §9).
 *   · the ladders ARE the engine's APPROVED numbers (events = MILESTONE_THRESHOLDS; reviews 5…500; cards 3·6·10·20;
 *     inspiration 10…250; branches 2·3·5·10) — read from `BADGE_REWARDS`, never typed in the row;
 *   · the closest badge sorts first and says "N to go"; Rating has no goal;
 *   · an unread count is "Couldn't load" with "—", never "0"; 1st Pick says "Not counted yet";
 *   · the Booked Loop (and the first loop) is HIDDEN until C2's counter exists (spec §9 #11);
 *   · the reward text comes only from the engine's rows (`lib/badge-rewards.ts`), never from this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { badgeTracker, type TrackerFacts } from './shop-badges';
import { badgeRowsWithRewards, BADGE_REWARDS, FALLBACK_REWARD_NAMES, type BadgeRewardFacts, type TrackerRewardInput } from './badge-rewards';
import { MILESTONE_THRESHOLDS } from './service-card-record';
import { ladderOf, nextGoalLine, nowLine, shopBadgeRow, COULDNT_LOAD, NOT_COUNTED_YET, type BadgeRowInput } from './shop-badge-row';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'shop-badge-row.ts'), 'utf8'));

const FACTS: TrackerFacts = {
  verified: true,
  completedEvents: 120,
  trusted: { trusted_avg_rating: 4.8, trusted_review_count: 38 },
  inBusinessSinceYear: 2020,
  awards: [],
  nowYear: 2026,
  unreviewed: 2,
};
const COUNTS: BadgeRewardFacts = {
  verified: true,
  completedEvents: 120,
  trustedReviews: 38,
  firstSourcedBooking: true,
  branchIds: ['hq'],
  serviceCards: 4,
  inspirationPhotos: 18,
  awards: [],
};
const REWARDS: TrackerRewardInput = {
  facts: COUNTS,
  granted: [],
  names: FALLBACK_REWARD_NAMES,
  awardTypeByTitle: {},
  periodMonth: '2026-11-01',
};

function input(over: Partial<BadgeRowInput> = {}): BadgeRowInput {
  return {
    rows: badgeRowsWithRewards(badgeTracker(FACTS), REWARDS),
    counts: COUNTS,
    completedEvents: FACTS.completedEvents,
    trusted: FACTS.trusted,
    inBusinessSinceYear: FACTS.inBusinessSinceYear,
    founding: { isFounder: true, joinedYear: 2026 },
    bookedLoopMeasured: false,
    ...over,
  };
}

const steps = (b: keyof typeof BADGE_REWARDS) => {
  const r = BADGE_REWARDS[b];
  return r.shape === 'ladder' ? r.steps.map((s) => s.step) : [];
};

test('the ladders are the APPROVED numbers, read from the engine', () => {
  assert.deepEqual([...MILESTONE_THRESHOLDS], [10, 50, 100, 500, 1000, 5000, 10000]);
  assert.deepEqual(steps('reviews'), [5, 10, 25, 50, 100, 250, 500]);
  assert.deepEqual(steps('service_cards'), [3, 6, 10, 20]);
  assert.deepEqual(steps('inspiration'), [10, 25, 50, 100, 250]);
  assert.deepEqual(steps('branches'), [2, 3, 5, 10]);
  assert.deepEqual(steps('booked_loop'), [1, 5, 10, 25, 50, 100, 250]);
  // No ladder number is typed in the row file.
  assert.doesNotMatch(SRC, /\[\s*5,\s*10,\s*25|\[\s*3,\s*6,\s*10|\[\s*10,\s*25,\s*50|\[\s*2,\s*3,\s*5/);
});

test('the closest badge comes first, with "N to go" — the v113 SetnaProd case', () => {
  const row = shopBadgeRow(input())!;
  // Furthest along its rung: inspiration (18−10)/(25−10)=53% > reviews 52% > branches 50% > cards 33% > events 5%.
  assert.equal(row[0]!.key, 'reward:inspiration', 'inspiration is furthest along its rung');
  assert.equal(row[0]!.ladder!.pct, 53);
  assert.equal(row[0]!.sub, '7 to go');
  assert.equal(row[0]!.goal, true);
  assert.equal(row.filter((t) => t.goal).length, 1, 'only one goal stands out');
  assert.equal(row[0]!.face, 'bronze');
  assert.equal(nextGoalLine(row[0]!), 'Next goal: 25 photos — 7 to go.');
  assert.equal(nowLine(row[0]!), 'Now · 18 photos · Bronze');
  // ladders before the earned/live set
  const firstNonLadder = row.findIndex((t) => !(t.ladder && t.ladder.toGo !== null));
  assert.ok(row.slice(firstNonLadder).every((t) => !(t.ladder && t.ladder.toGo !== null)));
});

test('Rating has no goal; Events wears the rung it reached', () => {
  const row = shopBadgeRow(input())!;
  const rating = row.find((t) => t.key === 'rating')!;
  assert.equal(rating.ladder, null);
  assert.equal(nextGoalLine(rating), null);
  assert.equal(rating.num, '4.8');
  const events = row.find((t) => t.title === 'Events')!;
  assert.equal(events.face, 'gold', '120 events reached the 100 step — Gold');
  assert.equal(events.sub, 'Gold', 'a ladder that is not the closest says where it stands');
  assert.equal(events.ladder!.pct, 5, '(120 − 100) / (500 − 100)');
});

test('an unread count is "Couldn’t load" on a grey "—", never 0', () => {
  const row = shopBadgeRow(input({ counts: null, completedEvents: null }))!;
  for (const k of ['reward:inspiration', 'reward:reviews', 'reward:service_cards', 'reward:branches']) {
    const t = row.find((x) => x.key === k)!;
    assert.equal(t.sub, COULDNT_LOAD, k);
    assert.equal(t.num, '—', k);
    assert.equal(t.on, false, k);
  }
  assert.equal(shopBadgeRow(input({ rows: null })), null, 'no rows → the whole row is unread, never an empty shelf');
});

test('1st Pick is shown but not counted; the Booked Loop is hidden until its counter exists', () => {
  const row = shopBadgeRow(input())!;
  assert.equal(row.find((t) => t.key === 'reward:first_pick')!.sub, NOT_COUNTED_YET);
  assert.equal(row.find((t) => t.key === 'reward:booked_loop'), undefined);
  assert.equal(row.find((t) => t.key === 'reward:first_loop'), undefined);
  assert.ok(!row.some((t) => /booked loop/i.test(t.title)));
  // not-counted and unread sort last
  const last = row.slice(-3).map((t) => t.sub);
  assert.ok(last.every((s) => s === NOT_COUNTED_YET || s === COULDNT_LOAD), last.join(','));
});

test('reward words come from the engine rows, never from the row file', () => {
  const row = shopBadgeRow(input())!;
  const insp = row[0]!;
  assert.match(insp.row.reward?.next ?? '', /Next: 25 photos · 7 to go → /);
  assert.doesNotMatch(SRC, /Papic 150|Event Plus|Event Pro|free booking fee/i);
  assert.ok(row.every((t) => !t.row.reward || t.row.reward === row.find((x) => x.key === t.key)!.row.reward));
});

test('ladderOf at the edges', () => {
  assert.deepEqual(ladderOf(0, [3, 6, 10, 20], ['card', 'cards']).reached, null);
  assert.equal(ladderOf(0, [3, 6, 10, 20], ['card', 'cards']).toGo, 3);
  assert.equal(ladderOf(25, [3, 6, 10, 20], ['card', 'cards']).next, null);
  assert.equal(ladderOf(25, [3, 6, 10, 20], ['card', 'cards']).pct, 100);
});

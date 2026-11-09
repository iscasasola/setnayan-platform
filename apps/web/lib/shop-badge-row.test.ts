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

test('completed first, then in progress with the closest saying "N to go" — Lane E, 9 Nov', () => {
  const row = shopBadgeRow(input())!;
  const climbing = (t: (typeof row)[number]) => Boolean(t.ladder && t.ladder.toGo !== null);
  // Completed (earned or live, not a ladder still climbing) sit far left.
  const firstClimbing = row.findIndex(climbing);
  assert.ok(firstClimbing > 0, 'nothing completed sits before the ladders');
  assert.ok(row.slice(0, firstClimbing).every((t) => t.on && !climbing(t)), 'something not completed sits far left');
  // Then the in-progress ladders, furthest along its rung first:
  // inspiration (18−10)/(25−10)=53% > reviews 52% > branches 50% > cards 33% > events 5%.
  const g = row[firstClimbing]!;
  assert.equal(g.key, 'reward:inspiration', 'inspiration is furthest along its rung');
  assert.equal(g.ladder!.pct, 53);
  assert.equal(g.sub, '7 to go');
  assert.equal(g.goal, true);
  assert.equal(row.filter((t) => t.goal).length, 1, 'only one goal stands out');
  assert.equal(g.face, 'bronze');
  assert.equal(nextGoalLine(g), 'Next goal: 25 photos — 7 to go.');
  assert.equal(nowLine(g), 'Now · 18 photos · Bronze');
  // After the in-progress run, no completed badge appears again.
  const afterRun = row.slice(firstClimbing).findIndex((t) => !climbing(t));
  assert.ok(row.slice(firstClimbing + Math.max(afterRun, 0)).every((t) => !(t.on && !climbing(t)) || afterRun < 0));
});

test('a ladder at zero sits with "not yet", never with the ones in progress (owner: "Yes")', () => {
  const zero = { ...COUNTS, serviceCards: 0 };
  const row = shopBadgeRow(input({ counts: zero, rows: badgeRowsWithRewards(badgeTracker(FACTS), { ...REWARDS, facts: zero }) }))!;
  const cards = row.findIndex((t) => t.key === 'reward:service_cards');
  const lastInProgress = row.reduce((at, t, i) => (t.ladder && t.ladder.toGo !== null && t.ladder.reached !== null ? i : at), -1);
  assert.ok(cards > lastInProgress, 'a ladder at 0 sorts among the in-progress ones');
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

test('1st Pick is shown but not counted; the Booked Loop is hidden while its counter is unread', () => {
  const row = shopBadgeRow(input())!; // COUNTS has no `bookedLoops` — not read
  assert.equal(row.find((t) => t.key === 'reward:first_pick')!.sub, NOT_COUNTED_YET);
  assert.equal(row.find((t) => t.key === 'reward:booked_loop'), undefined);
  assert.equal(row.find((t) => t.key === 'reward:first_loop'), undefined);
  assert.ok(!row.some((t) => /booked loop/i.test(t.title)));
  // …and once C2's counter is read, the loop is a ladder like the others (spec §9 #11)
  const counted = shopBadgeRow(input({ counts: { ...COUNTS, bookedLoops: 3 }, rows: badgeRowsWithRewards(badgeTracker(FACTS), { ...REWARDS, facts: { ...COUNTS, bookedLoops: 3 } }) }))!;
  const loop = counted.find((t) => t.key === 'reward:booked_loop')!;
  assert.equal(loop.num, '3');
  assert.equal(loop.face, 'bronze', '3 families reached the 1 step');
  assert.equal(counted.find((t) => t.key === 'reward:first_loop')!.on, true);
  assert.equal(shopBadgeRow(input({ counts: { ...COUNTS, bookedLoops: null } }))!.find((t) => t.key === 'reward:booked_loop'), undefined);
  // not-counted and unread sort last
  const last = row.slice(-3).map((t) => t.sub);
  assert.ok(last.every((s) => s === NOT_COUNTED_YET || s === COULDNT_LOAD), last.join(','));
});

test('reward words come from the engine rows, never from the row file', () => {
  const row = shopBadgeRow(input())!;
  const insp = row.find((t) => t.key === 'reward:inspiration')!;
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

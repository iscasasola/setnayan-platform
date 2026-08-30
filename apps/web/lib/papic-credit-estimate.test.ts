/**
 * THE ESTIMATE, AND THE ONE RULE THE OWNER STATED IN WORDS: recommend a top-up
 * only when the celebration is actually short.
 *
 * Run: cd apps/web && npx tsx --test lib/papic-credit-estimate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CAPTURE_MIX,
  estimateCreditsNeeded,
  papicCreditVerdict,
  smallestRungCovering,
  type CreditWeights,
} from './papic-credit-estimate';
import { PAPIC_POINTS_PER_CLIP, PAPIC_POINTS_PER_PHOTO } from './papic-cameras-pure';

/** The real weights, read from their one home — never retyped here. */
const WEIGHTS: CreditWeights = {
  pointsPerPhoto: PAPIC_POINTS_PER_PHOTO,
  pointsPerClip: PAPIC_POINTS_PER_CLIP,
};
/** Stand-in for the live 16-rung PAPIC_GUEST* pool ladder (admin-editable). */
const LADDER = [300, 1000, 2500, 5000, 10000];

test('the estimate is guests × (photos + clips) + the flat base', () => {
  const perGuest =
    DEFAULT_CAPTURE_MIX.photosPerGuest * PAPIC_POINTS_PER_PHOTO +
    DEFAULT_CAPTURE_MIX.clipsPerGuest * PAPIC_POINTS_PER_CLIP;
  assert.equal(
    estimateCreditsNeeded(100, WEIGHTS),
    100 * perGuest + DEFAULT_CAPTURE_MIX.baseCredits,
  );
});

test('a zero-guest event still needs the couple-coverage base, not nothing', () => {
  assert.equal(estimateCreditsNeeded(0, WEIGHTS), DEFAULT_CAPTURE_MIX.baseCredits);
});

test('an unusable guest count or weight is null — never a zero dressed as "needs nothing"', () => {
  assert.equal(estimateCreditsNeeded(-1, WEIGHTS), null);
  assert.equal(estimateCreditsNeeded(Number.NaN, WEIGHTS), null);
  assert.equal(estimateCreditsNeeded(100, { pointsPerPhoto: 0, pointsPerClip: 8 }), null);
  assert.equal(estimateCreditsNeeded(100, { pointsPerPhoto: 1, pointsPerClip: -8 }), null);
});

test('the estimate reads the SHARED clip weight, so an owner reprice moves it', () => {
  // The clip weight has moved twice by owner call. If this module ever grew its
  // own literal, this pair would stop differing.
  const cheap = estimateCreditsNeeded(50, { pointsPerPhoto: 1, pointsPerClip: 4 })!;
  const dear = estimateCreditsNeeded(50, { pointsPerPhoto: 1, pointsPerClip: 8 })!;
  assert.ok(dear > cheap, 'a dearer clip must raise the estimate');
});

test('COVERED CARRIES NO RECOMMENDATION — the owner rule, enforced by the type', () => {
  const needed = estimateCreditsNeeded(100, WEIGHTS)!;
  const v = papicCreditVerdict(needed + 500, 100, WEIGHTS);
  assert.equal(v.status, 'covered');
  assert.ok(!('recommend' in v), 'a covered celebration must not carry a top-up figure at all');
});

test('exactly enough is COVERED, not short by one', () => {
  const needed = estimateCreditsNeeded(100, WEIGHTS)!;
  assert.equal(papicCreditVerdict(needed, 100, WEIGHTS).status, 'covered');
  assert.equal(papicCreditVerdict(needed - 1, 100, WEIGHTS).status, 'short');
});

test('short reports the exact gap, and nothing it cannot stand behind', () => {
  const needed = estimateCreditsNeeded(100, WEIGHTS)!;
  const v = papicCreditVerdict(needed - 400, 100, WEIGHTS);
  assert.equal(v.status, 'short');
  if (v.status !== 'short') return;
  assert.equal(v.shortfall, 400);
});

test('no guest count yet ⇒ unknown, so a new event is never told it is short', () => {
  assert.equal(papicCreditVerdict(0, Number.NaN, WEIGHTS).status, 'unknown');
});

test('the recommended rung is the SMALLEST that covers the gap — not over, not under', () => {
  assert.equal(smallestRungCovering(1, LADDER), 300);
  assert.equal(smallestRungCovering(300, LADDER), 300, 'an exact rung must not push up one');
  assert.equal(smallestRungCovering(301, LADDER), 1000);
  assert.equal(smallestRungCovering(4999, LADDER), 5000);
});

test('the rung comes from the LADDER, never from rounding to a fixed increment', () => {
  // The pool sells on an admin-editable 16-rung ladder whose sizes are not
  // multiples of anything. An earlier draft rounded to a fixed 150 (the Papic
  // ONE *camera* rung) and would have named figures the checkout cannot sell.
  const odd = [222, 777, 4321];
  assert.equal(smallestRungCovering(100, odd), 222);
  assert.equal(smallestRungCovering(800, odd), 4321);
  assert.ok(
    smallestRungCovering(100, odd)! % 150 !== 0,
    'a recommendation must be able to be a non-multiple — it is catalog data, not arithmetic',
  );
});

test('a gap past the top rung recommends the largest — rungs are additive and repeatable', () => {
  assert.equal(smallestRungCovering(999999, LADDER), 10000);
});

test('an empty ladder or a non-positive gap yields no recommendation at all', () => {
  assert.equal(smallestRungCovering(500, []), null);
  assert.equal(smallestRungCovering(0, LADDER), null);
  assert.equal(smallestRungCovering(-5, LADDER), null);
});

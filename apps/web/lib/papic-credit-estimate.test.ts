/**
 * THE ESTIMATE INVENTS NOTHING, AND RECOMMENDS ONLY WHEN SHORT.
 *
 * Two owner rules are pinned here:
 *   • 2026-08-31 "don't guess" — every figure about what an event NEEDS comes
 *     from the admin-editable pool config, never from a constant in our module.
 *   • 2026-08-30 "not over not under … if their count is good, then do not
 *     recommend."
 *
 * Run: cd apps/web && npx tsx --test lib/papic-credit-estimate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateCreditsNeeded,
  papicCreditVerdict,
  smallestRungCovering,
} from './papic-credit-estimate';
import { computeEventPool, DEFAULT_EVENT_POOL_CONFIG } from './papic-event-pool';

/** Stand-in for the live 16-rung PAPIC_GUEST* pool ladder (admin-editable). */
const LADDER = [300, 1000, 2500, 5000, 10000];

test('THE ESTIMATE IS THE OWNER-CONFIGURED POOL FORMULA — not our own sum', () => {
  // If this module ever re-grows arithmetic of its own, this equality breaks.
  for (const guests of [1, 12, 50, 180, 400, 5000]) {
    assert.equal(
      estimateCreditsNeeded(guests),
      computeEventPool(guests).basePoints,
      `${guests} guests must defer to computeEventPool`,
    );
  }
});

test('an admin change to points_per_guest MOVES the estimate', () => {
  // The whole point of deferring: these numbers are the owner's to tune, and
  // tuning them must reach the couple's home page.
  const cheap = estimateCreditsNeeded(200, { pointsPerGuest: 50, floorPoints: 0 })!;
  const dear = estimateCreditsNeeded(200, { pointsPerGuest: 300, floorPoints: 0 })!;
  assert.ok(dear > cheap, 'a raised per-guest figure must raise what we say they need');
});

test('the floor and ceiling are honoured, because the formula honours them', () => {
  const tiny = estimateCreditsNeeded(1, { pointsPerGuest: 10, floorPoints: 5000 })!;
  assert.equal(tiny, 5000, 'a small event is lifted to the configured floor');
  const huge = estimateCreditsNeeded(100000, { ceilingPoints: 30000 })!;
  assert.equal(huge, 30000, 'a fat-tail event is clamped to the configured ceiling');
});

test('no guest count ⇒ unknown, so a new event is never told it is short', () => {
  assert.equal(estimateCreditsNeeded(0), null);
  assert.equal(estimateCreditsNeeded(-1), null);
  assert.equal(estimateCreditsNeeded(Number.NaN), null);
  assert.equal(papicCreditVerdict(0, 0).status, 'unknown');
  assert.equal(papicCreditVerdict(1240, Number.NaN).status, 'unknown');
});

test('COVERED CARRIES NO RECOMMENDATION — the owner rule, enforced by the type', () => {
  const needed = estimateCreditsNeeded(180)!;
  const v = papicCreditVerdict(needed + 500, 180);
  assert.equal(v.status, 'covered');
  assert.ok(!('shortfall' in v), 'a covered celebration must carry no gap at all');
});

test('exactly enough is COVERED, not short by one', () => {
  const needed = estimateCreditsNeeded(180)!;
  assert.equal(papicCreditVerdict(needed, 180).status, 'covered');
  assert.equal(papicCreditVerdict(needed - 1, 180).status, 'short');
});

test('short reports the exact gap against the configured figure', () => {
  const needed = estimateCreditsNeeded(180)!;
  const v = papicCreditVerdict(needed - 400, 180);
  assert.equal(v.status, 'short');
  if (v.status !== 'short') return;
  assert.equal(v.shortfall, 400);
  assert.equal(v.needed, needed);
});

test('a negative or unusable balance is treated as zero held, never as covered', () => {
  const v = papicCreditVerdict(-50, 180);
  assert.equal(v.status, 'short');
  if (v.status !== 'short') return;
  assert.equal(v.held, 0);
});

test('the recommended rung is the SMALLEST that covers the gap — not over, not under', () => {
  assert.equal(smallestRungCovering(1, LADDER), 300);
  assert.equal(smallestRungCovering(300, LADDER), 300, 'an exact rung must not push up one');
  assert.equal(smallestRungCovering(301, LADDER), 1000);
  assert.equal(smallestRungCovering(4999, LADDER), 5000);
});

test('the rung comes from the LADDER, never from rounding to a fixed increment', () => {
  // The pool sells on an admin-editable ladder whose sizes are not multiples of
  // anything. An earlier draft rounded to a fixed 150 (the Papic ONE *camera*
  // rung) and would have named figures the checkout cannot sell.
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

test('the module states no capture-mix constant of its own', async () => {
  // The guard for "don't guess": this module must never re-grow a number about
  // how much a guest shoots. Those live in papic_event_pool_config, where the
  // owner can edit them without a deploy.
  const fs = await import('node:fs/promises');
  const src = await fs.readFile(new URL('./papic-credit-estimate.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // 0 and 1 are STRUCTURAL — validity checks (`n > 0`) and array indexing
  // (`length - 1`). A domain assumption about credits or captures cannot be
  // expressed in them, and banning them would only teach the next author to
  // work around the guard. Anything ≥ 2 in this module is a magic number.
  const domainNumbers = (code.match(/\b\d+\b/g) ?? []).filter((d) => Number(d) > 1);
  assert.deepEqual(
    domainNumbers,
    [],
    `this module must contain no domain constant — found ${domainNumbers.join(', ')}. ` +
      'Every figure about what an event needs belongs in papic_event_pool_config.',
  );
  assert.ok(
    !/photosPerGuest|clipsPerGuest|CAPTURE_MIX|baseCredits/.test(code),
    'a capture-mix assumption has come back — that is the guess the owner rejected',
  );
});

test('our last-resort path is the pool module\'s documented one, not a second opinion', () => {
  // We pass config straight through, so an absent config resolves to the SAME
  // fallback every other caller of the formula uses. No parallel default set.
  assert.equal(
    estimateCreditsNeeded(200),
    computeEventPool(200, DEFAULT_EVENT_POOL_CONFIG).basePoints,
  );
});

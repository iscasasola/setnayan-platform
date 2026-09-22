/**
 * THE LEARNING LOOP DOES NOT SPIRAL, AND IT DOES NOT START FROM NOTHING.
 *
 * Two owner-stated traps, both fatal as naively specified, each with the
 * fixture that makes it visible. 🔑 BOTH ARE INVISIBLE UNDER GENEROUS FIXTURES
 * — every celebration comfortably under its pool makes the naive mean look
 * correct — so the fixtures here are deliberately mean ones.
 *
 * Run: cd apps/web && npx tsx --test lib/papic-pool-learning.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LEARNING_MIN_SAMPLE,
  isExhausted,
  learnPointsPerGuest,
  type PoolUsageSample,
} from './papic-pool-learning';

/** A closed celebration of `n` guests that spent `used` of `total`. */
function ev(
  used: number,
  total: number,
  guests = 100,
  eventType = 'wedding',
  windowClosed = true,
): PoolUsageSample {
  return { eventType, guestCount: guests, usedPoints: used, totalPoints: total, windowClosed };
}

test('TRAP 1 — PROD TODAY TEACHES IT NOTHING, AND IT SAYS SO', () => {
  /*
    Measured 2026-09-22: nine weddings, 100,362 credits granted, ONE used. The
    naive mean over that is ~0.0001 a head, which on a screen reads "your
    wedding needs no credits".
  */
  const prodToday = [
    ...Array.from({ length: 8 }, () => ev(0, 11_151, 100)),
    ev(1, 11_151, 100),
  ];
  const v = learnPointsPerGuest('wedding', prodToday, { initial: 150 });

  assert.equal(v.source, 'initial');
  assert.equal(v.pointsPerGuest, 150, "the owner's figure must survive an empty world");
  assert.equal(v.sampleSize, 9);
  assert.match(v.reason, /too few uncensored observations \(9 of 12\)/);

  // And the naive answer really is the catastrophe, so this is not a straw man.
  const naive = prodToday.reduce((a, s) => a + s.usedPoints / s.guestCount, 0) / 9;
  assert.ok(naive < 1, `sanity: the unguarded mean is ${naive}, i.e. nothing`);
});

test('TRAP 2 — EXHAUSTING A POOL NEVER LOWERS THE RECOMMENDATION', () => {
  /*
    🛑 THE FIXTURE THE RULING ASKS FOR, and the whole reason this module exists.

    Twelve celebrations finish at 80 credits a head with room to spare, so the
    learned figure is 80. Now add twelve more that RAN OUT at 40 a head — they
    each held only 4,000 and spent every one of it. Their demand is unobserved;
    they wanted at least 40 and plausibly much more.

    A mean over all twenty-four gives 60 — and that is the downward spiral: we
    would recommend less to exactly the couples who already ran short.
  */
  const roomy = Array.from({ length: 12 }, () => ev(8_000, 30_000, 100));
  const base = learnPointsPerGuest('wedding', roomy, { initial: 150 });
  assert.equal(base.source, 'learned');
  assert.equal(base.pointsPerGuest, 80);

  const ranDry = Array.from({ length: 12 }, () => ev(4_000, 4_000, 100));
  const after = learnPointsPerGuest('wedding', [...roomy, ...ranDry], { initial: 150 });

  assert.equal(after.pointsPerGuest, 80, 'an exhausted pool must not lower the figure');
  assert.equal(after.sampleSize, 12, 'exhausted events are not counted as observations');
  assert.equal(after.censoredCount, 12);
  assert.equal(after.censoredFloor, 40);

  // The naive answer, spelled out, so a future reader can see what was avoided.
  const naive =
    [...roomy, ...ranDry].reduce((a, s) => a + s.usedPoints / s.guestCount, 0) / 24;
  assert.equal(naive, 60);
  assert.ok(after.pointsPerGuest > naive, 'the guarded answer must beat the spiral');
});

test('AN EXHAUSTED CELEBRATION CAN PUSH THE FIGURE UP', () => {
  /*
    The other direction of the same rule. Twelve roomy events settle at 20 a
    head; one celebration ran dry at 95. That one is evidence of "wanted at
    least 95", so the answer is raised to 95 — never averaged down to ~26.
  */
  const roomy = Array.from({ length: 12 }, () => ev(2_000, 30_000, 100));
  const withCensored = [...roomy, ev(9_500, 9_500, 100)];

  const v = learnPointsPerGuest('wedding', withCensored, { initial: 150 });
  assert.equal(v.pointsPerGuest, 95, 'the lower bound wins when it exceeds the mean');
  assert.match(v.reason, /raised by 1 exhausted celebration/);
  assert.equal(v.censoredFloor, 95);
});

test('A CELEBRATION STILL SHOOTING IS NOT AN OBSERVATION', () => {
  const closed = Array.from({ length: 12 }, () => ev(5_000, 30_000, 100));
  const live = Array.from({ length: 40 }, () =>
    ev(10, 30_000, 100, 'wedding', /* windowClosed */ false),
  );
  const v = learnPointsPerGuest('wedding', [...closed, ...live], { initial: 150 });
  assert.equal(v.sampleSize, 12, 'live events must not dilute the mean');
  assert.equal(v.pointsPerGuest, 50);
});

test('IT LEARNS PER TYPE — a debut never teaches a wedding', () => {
  const debuts = Array.from({ length: 12 }, () => ev(1_000, 30_000, 100, 'debut'));
  const v = learnPointsPerGuest('wedding', debuts, { initial: 150 });
  assert.equal(v.source, 'initial');
  assert.equal(v.sampleSize, 0);
  assert.equal(learnPointsPerGuest('debut', debuts, { initial: 120 }).pointsPerGuest, 10);
});

test('THE MINIMUM SAMPLE IS REAL AND IS THE DEFAULT', () => {
  assert.equal(DEFAULT_LEARNING_MIN_SAMPLE, 12);
  const eleven = Array.from({ length: 11 }, () => ev(9_000, 30_000, 100));
  assert.equal(learnPointsPerGuest('wedding', eleven, { initial: 150 }).source, 'initial');
  assert.equal(
    learnPointsPerGuest('wedding', [...eleven, ev(9_000, 30_000, 100)], { initial: 150 })
      .source,
    'learned',
  );
});

test('EXHAUSTION IS >= AND A ZERO POOL IS NOT EXHAUSTED', () => {
  assert.equal(isExhausted(ev(100, 100)), true);
  assert.equal(isExhausted(ev(101, 100)), true);
  assert.equal(isExhausted(ev(99, 100)), false);
  assert.equal(isExhausted(ev(0, 0)), false, 'no pool is not a spent pool');
});

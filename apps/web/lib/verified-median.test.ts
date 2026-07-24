import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_MEDIAN_SAMPLE,
  medianPhp,
  computeVerifiedMedian,
  roundToTypicalBand,
  formatMedianPhp,
  type MedianSample,
} from './verified-median';

// ---------------------------------------------------------------------------
// medianPhp — the raw math
// ---------------------------------------------------------------------------

test('medianPhp: odd count → the middle value', () => {
  assert.equal(medianPhp([10, 30, 20]), 20);
  assert.equal(medianPhp([5]), 5);
});

test('medianPhp: even count → mean of the two middle values (rounded)', () => {
  assert.equal(medianPhp([10, 20, 30, 40]), 25);
  // 20 and 30 → 25; ordering must not matter
  assert.equal(medianPhp([40, 10, 30, 20]), 25);
});

test('medianPhp: even count with odd mean rounds to integer peso', () => {
  // 25 and 30 → 27.5 → 28
  assert.equal(medianPhp([25, 30]), 28);
  // 25 and 26 → 25.5 → 26
  assert.equal(medianPhp([25, 26]), 26);
});

test('medianPhp: empty → null', () => {
  assert.equal(medianPhp([]), null);
});

test('medianPhp: does not mutate its input', () => {
  const input = [30, 10, 20];
  medianPhp(input);
  assert.deepEqual(input, [30, 10, 20]);
});

// ---------------------------------------------------------------------------
// computeVerifiedMedian — the guarded result envelope
// ---------------------------------------------------------------------------

const s = (pricePhp: number, excluded = false): MedianSample => ({ pricePhp, excluded });

test('MIN_MEDIAN_SAMPLE is 3 (the flagged decision)', () => {
  assert.equal(MIN_MEDIAN_SAMPLE, 3);
});

test('below min count → not_established with the true qualifying count', () => {
  assert.deepEqual(computeVerifiedMedian([]), { status: 'not_established', sampleN: 0 });
  assert.deepEqual(computeVerifiedMedian([s(50_000)]), {
    status: 'not_established',
    sampleN: 1,
  });
  assert.deepEqual(computeVerifiedMedian([s(50_000), s(60_000)]), {
    status: 'not_established',
    sampleN: 2,
  });
});

test('single booking never yields a number', () => {
  const r = computeVerifiedMedian([s(120_000)]);
  assert.equal(r.status, 'not_established');
});

test('exactly min count (odd) → established', () => {
  const r = computeVerifiedMedian([s(40_000), s(50_000), s(60_000)]);
  assert.deepEqual(r, {
    status: 'established',
    medianPhp: 50_000,
    sampleN: 3,
    lowPhp: 40_000,
    highPhp: 60_000,
  });
});

test('even qualifying count → averaged middle two', () => {
  const r = computeVerifiedMedian([s(40_000), s(50_000), s(60_000), s(70_000)]);
  assert.equal(r.status, 'established');
  if (r.status === 'established') {
    assert.equal(r.medianPhp, 55_000); // (50k + 60k) / 2
    assert.equal(r.sampleN, 4);
    assert.equal(r.lowPhp, 40_000);
    assert.equal(r.highPhp, 70_000);
  }
});

test('excluded (comp/barter) samples are dropped and do not skew the median', () => {
  // A ₱1 barter lock flagged excluded must not pull the median down.
  const withBarter = computeVerifiedMedian([
    s(40_000),
    s(50_000),
    s(60_000),
    s(1, true), // excluded barter
  ]);
  assert.equal(withBarter.status, 'established');
  if (withBarter.status === 'established') {
    assert.equal(withBarter.medianPhp, 50_000);
    assert.equal(withBarter.sampleN, 3); // barter not counted
    assert.equal(withBarter.lowPhp, 40_000); // barter not the low
  }
});

test('excluded samples do not count toward the min-count floor', () => {
  // 2 real + 1 excluded = 2 qualifying → still not_established.
  const r = computeVerifiedMedian([s(40_000), s(60_000), s(50_000, true)]);
  assert.deepEqual(r, { status: 'not_established', sampleN: 2 });
});

test('non-positive / non-finite prices are dropped even without an explicit flag', () => {
  const r = computeVerifiedMedian([
    s(40_000),
    s(50_000),
    s(60_000),
    s(0), // ₱0 comp, no flag
    s(-5), // nonsense
    { pricePhp: Number.NaN },
    { pricePhp: Number.POSITIVE_INFINITY },
  ]);
  assert.equal(r.status, 'established');
  if (r.status === 'established') {
    assert.equal(r.sampleN, 3);
    assert.equal(r.medianPhp, 50_000);
    assert.equal(r.lowPhp, 40_000);
  }
});

test('all excluded → not_established (sampleN 0)', () => {
  const r = computeVerifiedMedian([s(40_000, true), s(50_000, true), s(60_000, true)]);
  assert.deepEqual(r, { status: 'not_established', sampleN: 0 });
});

test('minSample override is honored', () => {
  const two = computeVerifiedMedian([s(40_000), s(60_000)], { minSample: 2 });
  assert.equal(two.status, 'established');
  if (two.status === 'established') assert.equal(two.medianPhp, 50_000);
});

test('duplicate identical locks → median equals that value', () => {
  const r = computeVerifiedMedian([s(50_000), s(50_000), s(50_000)]);
  assert.equal(r.status, 'established');
  if (r.status === 'established') {
    assert.equal(r.medianPhp, 50_000);
    assert.equal(r.lowPhp, 50_000);
    assert.equal(r.highPhp, 50_000);
  }
});

// ---------------------------------------------------------------------------
// roundToTypicalBand — the public-facing privacy rounding
// ---------------------------------------------------------------------------

test('roundToTypicalBand: scales granularity with magnitude', () => {
  assert.equal(roundToTypicalBand(8_450), 8_500); // <10k → nearest 100
  assert.equal(roundToTypicalBand(47_800), 48_000); // <100k → nearest 500 (47800/500=95.6→96)
  assert.equal(roundToTypicalBand(233_400), 233_000); // >=100k → nearest 1000
});

test('roundToTypicalBand: guards non-positive/non-finite', () => {
  assert.equal(roundToTypicalBand(0), 0);
  assert.equal(roundToTypicalBand(-1), 0);
  assert.equal(roundToTypicalBand(Number.NaN), 0);
});

// ---------------------------------------------------------------------------
// formatMedianPhp
// ---------------------------------------------------------------------------

test('formatMedianPhp: peso, grouped, no centavos', () => {
  assert.equal(formatMedianPhp(50_000), '₱50,000');
  assert.equal(formatMedianPhp(1_234_567), '₱1,234,567');
});

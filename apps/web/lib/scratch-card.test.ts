/**
 * `<ScratchCard>`'s reveal rules (lib/scratch-card.ts): when is a scratch-off done.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REVEAL_THRESHOLD,
  brushRadiusFor,
  clearedFraction,
  estimatedFraction,
  isRevealed,
  normaliseThreshold,
  pointsAlong,
  sampleStepFor,
} from './scratch-card';

/** RGBA bytes for `n` pixels, the first `cleared` of them transparent. */
function rgba(n: number, cleared: number, clearedAlpha = 0): Uint8ClampedArray {
  const a = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i += 1) {
    a[i * 4] = 201;
    a[i * 4 + 1] = 162;
    a[i * 4 + 2] = 106;
    a[i * 4 + 3] = i < cleared ? clearedAlpha : 255;
  }
  return a;
}

test('1. the default threshold is 55%, and a bad one is clamped, never trusted', () => {
  assert.equal(DEFAULT_REVEAL_THRESHOLD, 0.55);
  assert.equal(normaliseThreshold(undefined), 0.55);
  assert.equal(normaliseThreshold(Number.NaN), 0.55);
  assert.equal(normaliseThreshold(0.7), 0.7);
  assert.equal(normaliseThreshold(5), 1);
  assert.equal(normaliseThreshold(0), 0.01);
  assert.equal(normaliseThreshold(-3), 0.01);
});

test('2. cleared fraction counts pixels under half alpha', () => {
  assert.equal(clearedFraction(rgba(100, 0)), 0);
  assert.equal(clearedFraction(rgba(100, 100)), 1);
  assert.equal(clearedFraction(rgba(100, 55)), 0.55);
  // 127 is "mostly gone", 128 is not yet
  assert.equal(clearedFraction(rgba(10, 10, 127)), 1);
  assert.equal(clearedFraction(rgba(10, 10, 128)), 0);
});

test('3. an empty buffer is 0, never NaN', () => {
  assert.equal(clearedFraction(new Uint8ClampedArray(0)), 0);
  assert.equal(isRevealed(Number.NaN), false);
});

test('4. sampling keeps the answer close and caps the work', () => {
  const big = rgba(200_000, 120_000);
  const step = sampleStepFor(200_000);
  assert.equal(step, 5);
  assert.ok(Math.abs(clearedFraction(big, step) - 0.6) < 0.01);
  assert.equal(sampleStepFor(1000), 1);
  assert.equal(sampleStepFor(0), 1);
});

test('5. reveal fires at the threshold, not before', () => {
  assert.equal(isRevealed(0.549), false);
  assert.equal(isRevealed(0.55), true);
  assert.equal(isRevealed(0.4, 0.3), true);
  assert.equal(isRevealed(0.99, 1), false);
});

test('6. the stroke estimate is conservative and bounded', () => {
  // one 300px stroke with a 24px brush over a 320×320 card
  const est = estimatedFraction(300, 1, 24, 320, 320);
  const sweptRaw = (300 * 48 + Math.PI * 24 * 24) / (320 * 320);
  assert.ok(est > 0 && est < sweptRaw, 'counts less than the raw swept area');
  assert.equal(estimatedFraction(1e9, 50, 24, 320, 320), 1);
  assert.equal(estimatedFraction(300, 1, 24, 0, 320), 0);
});

test('7. the brush scales with the card and stays within 16–48px', () => {
  assert.equal(brushRadiusFor(310, 310), 310 * 0.08);
  assert.equal(brushRadiusFor(100, 100), 16);
  assert.equal(brushRadiusFor(2000, 1200), 48);
  assert.equal(brushRadiusFor(0, 0), 16);
});

test('8. points along a fast swipe are evenly spaced and include both ends', () => {
  const pts = pointsAlong({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
  assert.equal(pts.length, 11);
  assert.deepEqual(pts[0], { x: 0, y: 0 });
  assert.deepEqual(pts.at(-1), { x: 100, y: 0 });
  for (let i = 1; i < pts.length; i += 1) assert.ok(pts[i]!.x - pts[i - 1]!.x <= 10);
  // a tap (no movement) still yields its point
  assert.equal(pointsAlong({ x: 5, y: 5 }, { x: 5, y: 5 }, 10).length, 2);
});

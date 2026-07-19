/**
 * Auto-Recap selection invariants (Node test runner via tsx). Pure function, so
 * no DB/box needed — we assert coverage, the 30s budget, clip-cap clamping, and
 * the tag-count quality pick.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectAutoRecapSlots, type RecapCandidate } from './recap-select';

function photos(n: number, startMs = 0, stepMs = 60_000): RecapCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    inputRef: `p${i}`,
    type: 'photo' as const,
    capturedAtMs: startMs + i * stepMs,
    tagCount: 1,
  }));
}

test('selection never exceeds the 30s budget', () => {
  const slots = selectAutoRecapSlots(photos(50));
  const total = slots.reduce((n, s) => n + s.durationMs, 0);
  assert.ok(total <= 30_000, `total ${total} must be <= 30000`);
  assert.ok(slots.length > 0);
});

test('covers the timeline (spread), not one busy moment', () => {
  // 11 quiet photos across the day + a cluster of 6 heavily-tagged at one instant.
  const quiet = photos(11, 0, 600_000); // every 10 min
  const cluster: RecapCandidate[] = Array.from({ length: 6 }, (_, i) => ({
    inputRef: `c${i}`,
    type: 'photo',
    capturedAtMs: 3_000_000 + i, // all at ~same instant
    tagCount: 9, // very "good" by tag count
  }));
  const slots = selectAutoRecapSlots([...quiet, ...cluster]);
  const fromCluster = slots.filter((s) => s.inputRef.startsWith('c')).length;
  // windowing must stop the cluster from dominating — at most a couple of picks.
  assert.ok(fromCluster <= 2, `cluster took ${fromCluster} slots — should be spread`);
  assert.ok(slots.length >= 8);
});

test('picks the most-tagged capture within a window', () => {
  const cands: RecapCandidate[] = [
    { inputRef: 'lo', type: 'photo', capturedAtMs: 10, tagCount: 0 },
    { inputRef: 'hi', type: 'photo', capturedAtMs: 20, tagCount: 5 },
  ];
  // one window (tiny budget) → the single pick must be the high-tag one.
  const slots = selectAutoRecapSlots(cands, { targetDurationMs: 2_500, photoSlotMs: 2_500 });
  assert.equal(slots.length, 1);
  assert.equal(slots[0]?.inputRef, 'hi');
});

test('clip slots are clamped to the 5s cap', () => {
  const slots = selectAutoRecapSlots(
    [{ inputRef: 'clip', type: 'clip', capturedAtMs: 0, tagCount: 3, clipDurationMs: 99_000 }],
    { targetDurationMs: 30_000 },
  );
  assert.equal(slots.length, 1);
  assert.equal(slots[0]?.durationMs, 5_000);
});

test('empty in → empty out; slots stay chronological', () => {
  assert.deepEqual(selectAutoRecapSlots([]), []);
  const slots = selectAutoRecapSlots(photos(12));
  const times = slots.map((s) => Number(s.inputRef.slice(1)));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
});

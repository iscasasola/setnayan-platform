import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickClipSampleTimes, unionClipFaceVectors } from './face-embed-clip';

// ── pickClipSampleTimes ──────────────────────────────────────────────────────

test('5s clip → ~5 interior samples, sorted, all inside (0, duration)', () => {
  const t = pickClipSampleTimes(5);
  assert.equal(t.length, 5); // ~1/sec, under the maxFrames=6 cap
  assert.ok(t.every((x) => x > 0 && x < 5), 'no black first/last frame');
  const sorted = [...t].sort((a, b) => a - b);
  assert.deepEqual(t, sorted, 'ascending');
});

test('caps at maxFrames even for a long clip', () => {
  const t = pickClipSampleTimes(30, { fps: 1, maxFrames: 6 });
  assert.equal(t.length, 6);
});

test('respects a higher fps', () => {
  const t = pickClipSampleTimes(4, { fps: 2, maxFrames: 10 });
  assert.equal(t.length, 8); // 4s × 2/sec
});

test('zero / invalid duration → a single [0] (never empty)', () => {
  assert.deepEqual(pickClipSampleTimes(0), [0]);
  assert.deepEqual(pickClipSampleTimes(NaN), [0]);
  assert.deepEqual(pickClipSampleTimes(-3), [0]);
});

test('very short clip → one middle-frame sample', () => {
  const t = pickClipSampleTimes(0.2);
  assert.equal(t.length, 1);
  const [only] = t;
  assert.ok(only !== undefined && only > 0 && only < 0.2);
});

// ── unionClipFaceVectors ─────────────────────────────────────────────────────
// Short synthetic descriptors: near-identical vectors are "the same person"
// (Euclidean distance ≤ 0.5), far-apart vectors are distinct people.

const A = [0, 0, 0, 0];
const A2 = [0.1, 0, 0.1, 0]; // ≈0.14 from A → same person
const A3 = [0, 0.1, 0, 0.1]; // ≈0.14 from A → same person
const B = [5, 5, 5, 5]; // far → distinct person
const C = [-5, 5, -5, 5]; // far from A and B → third person

test('same person across 3 frames → ONE unioned vector', () => {
  const out = unionClipFaceVectors([[A], [A2], [A3]]);
  assert.equal(out.length, 1);
});

test('two distinct people → two vectors', () => {
  const out = unionClipFaceVectors([[A], [B]]);
  assert.equal(out.length, 2);
});

test('everyone who appears in ANY frame is included (A in f1-2, B only in f3)', () => {
  const out = unionClipFaceVectors([[A], [A2], [B]]);
  assert.equal(out.length, 2); // A (merged) + B
});

test('multiple people in a single frame are all kept', () => {
  const out = unionClipFaceVectors([[A, B, C]]);
  assert.equal(out.length, 3);
});

test('empty / malformed input → []', () => {
  assert.deepEqual(unionClipFaceVectors([]), []);
  assert.deepEqual(unionClipFaceVectors([[]]), []);
  // malformed descriptors are skipped, valid ones kept
  assert.equal(
    unionClipFaceVectors([[[] as number[], A]]).length,
    1,
  );
});

test('a custom (looser) threshold merges more aggressively', () => {
  // A and B are ~10 apart; a threshold of 20 collapses them to one cluster.
  const out = unionClipFaceVectors([[A], [B]], { threshold: 20 });
  assert.equal(out.length, 1);
});

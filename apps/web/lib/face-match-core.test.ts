/**
 * Unit suite for the Papic face auto-tagging matcher core (Node built-in test
 * runner via tsx — `pnpm test:unit`; CI runs it in the "unit tests" step).
 *
 * Locks the policy that has to be exactly right (it decides who gets tagged in a
 * couple's wedding photos): the ≥0.85 auto / 0.65–0.85 suggest / <0.65 untagged
 * bands, the 10-tag-per-photo cap COMBINED with existing tags, dedupe of one
 * guest matched by two faces, and never re-tagging an already-tagged guest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  cosineSimilarity,
  planAutoTags,
  FACE_AUTO_THRESHOLD,
  FACE_SUGGEST_THRESHOLD,
  MAX_TAGS_PER_PHOTO,
} from './face-match-core';

test('cosineSimilarity: identical / orthogonal / opposite / invalid', () => {
  assert.ok(Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3]) - 1) < 1e-12, 'identical → 1');
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0, 'orthogonal → 0');
  assert.ok(Math.abs(cosineSimilarity([1, 0], [-1, 0]) + 1) < 1e-12, 'opposite → -1');
  assert.equal(cosineSimilarity([1, 2], [1]), 0, 'length mismatch → 0 (no match)');
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0, 'zero magnitude → 0 (no signal)');
});

test('a strong match (≥0.85) auto-tags the guest', () => {
  // cosine([1,0],[10,1]) = 10/sqrt(101) ≈ 0.995
  const plan = planAutoTags({
    faceVectors: [[10, 1]],
    enrollments: [{ guestId: 'gA', vector: [1, 0] }],
  });
  assert.equal(plan.autoTags.length, 1);
  assert.equal(plan.autoTags[0]?.guestId, 'gA');
  assert.ok(plan.autoTags[0]!.confidence >= FACE_AUTO_THRESHOLD);
  assert.equal(plan.suggestions.length, 0);
});

test('a borderline match (0.65–0.85) is a suggestion, not an auto-tag', () => {
  // cosine([1,0],[1,1]) = 1/sqrt(2) ≈ 0.707
  const plan = planAutoTags({
    faceVectors: [[1, 1]],
    enrollments: [{ guestId: 'gA', vector: [1, 0] }],
  });
  assert.equal(plan.autoTags.length, 0);
  assert.equal(plan.suggestions.length, 1);
  assert.equal(plan.suggestions[0]?.guestId, 'gA');
  const c = plan.suggestions[0]!.confidence;
  assert.ok(c >= FACE_SUGGEST_THRESHOLD && c < FACE_AUTO_THRESHOLD);
});

test('a weak match (<0.65) is neither auto-tagged nor suggested', () => {
  // cosine([1,0],[1,2]) = 1/sqrt(5) ≈ 0.447
  const plan = planAutoTags({
    faceVectors: [[1, 2]],
    enrollments: [{ guestId: 'gA', vector: [1, 0] }],
  });
  assert.equal(plan.autoTags.length, 0);
  assert.equal(plan.suggestions.length, 0);
});

test('two faces matching the same guest collapse to one tag at the higher confidence', () => {
  // both ≥0.85 vs gA=[1,0]: [10,1]≈0.995, [8,2]≈0.970
  const plan = planAutoTags({
    faceVectors: [[10, 1], [8, 2]],
    enrollments: [{ guestId: 'gA', vector: [1, 0] }],
  });
  assert.equal(plan.autoTags.length, 1, 'one guest → one tag');
  assert.equal(plan.autoTags[0]?.guestId, 'gA');
  assert.ok(plan.autoTags[0]!.confidence > 0.99, 'keeps the higher-confidence face');
});

test('an already-tagged guest is never re-tagged', () => {
  const plan = planAutoTags({
    faceVectors: [[10, 1]],
    enrollments: [{ guestId: 'gA', vector: [1, 0] }],
    alreadyTaggedGuestIds: ['gA'],
  });
  assert.equal(plan.autoTags.length, 0, 'gA already tagged → skipped');
  assert.equal(plan.suggestions.length, 0);
});

test('the 10-tag cap is combined with existing tags; auto-tags take remaining slots by confidence', () => {
  const existing = Array.from({ length: MAX_TAGS_PER_PHOTO - 1 }, (_, i) => `x${i}`); // 9 existing
  // Three auto-grade matches, distinct confidences: gA=1.0 > gB≈0.958 > gC≈0.894
  const plan = planAutoTags({
    faceVectors: [
      [1, 0, 0],   // gA → 1.0
      [0.3, 1, 0], // gB → 1/sqrt(1.09) ≈ 0.958
      [0, 0.5, 1], // gC → 1/sqrt(1.25) ≈ 0.894
    ],
    enrollments: [
      { guestId: 'gA', vector: [1, 0, 0] },
      { guestId: 'gB', vector: [0, 1, 0] },
      { guestId: 'gC', vector: [0, 0, 1] },
    ],
    alreadyTaggedGuestIds: existing,
  });
  assert.equal(plan.autoTags.length, 1, 'only one slot left under the 10-tag cap');
  assert.equal(plan.autoTags[0]?.guestId, 'gA', 'the highest-confidence match wins the slot');
  // gB and gC qualified for auto but were truncated by the cap — NOT demoted to suggestions.
  assert.equal(plan.suggestions.length, 0);
});

test('no faces or no enrollments → empty plan', () => {
  assert.deepEqual(
    planAutoTags({ faceVectors: [], enrollments: [{ guestId: 'gA', vector: [1, 0] }] }),
    { autoTags: [], suggestions: [] },
  );
  assert.deepEqual(
    planAutoTags({ faceVectors: [[1, 0]], enrollments: [] }),
    { autoTags: [], suggestions: [] },
  );
});

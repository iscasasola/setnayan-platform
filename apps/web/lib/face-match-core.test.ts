/**
 * Unit suite for the Papic face auto-tagging matcher core (Node built-in test
 * runner via tsx — `pnpm test:unit`; CI runs it in the "unit tests" step).
 *
 * Locks the policy that has to be exactly right (it decides who gets tagged in a
 * couple's wedding photos): the EUCLIDEAN-distance bands calibrated on the
 * validated dlib/face-api.js model (2026-06-17 real-faces run: same-person
 * 0.40–0.47, different-person 0.79–0.90) — ≤0.50 auto / 0.50–0.60 suggest /
 * >0.60 untagged — plus the 10-tag-per-photo cap combined with existing tags,
 * dedupe of one guest matched by two faces, and never re-tagging an
 * already-tagged guest.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  euclideanDistance,
  planAutoTags,
  FACE_AUTO_MAX_DISTANCE,
  FACE_SUGGEST_MAX_DISTANCE,
  MAX_TAGS_PER_PHOTO,
} from './face-match-core';

test('euclideanDistance: identical / known / invalid', () => {
  assert.equal(euclideanDistance([1, 2, 3], [1, 2, 3]), 0, 'identical → 0');
  assert.equal(euclideanDistance([0, 0], [3, 4]), 5, '3-4-5 triangle → 5');
  assert.equal(euclideanDistance([1, 2], [1]), Infinity, 'length mismatch → Infinity (no match)');
  assert.equal(euclideanDistance([], []), Infinity, 'empty → Infinity (no signal)');
});

test('a close match (≤0.50) auto-tags the guest', () => {
  const plan = planAutoTags({
    faceVectors: [[0.4, 0]], // distance 0.4 to gA
    enrollments: [{ guestId: 'gA', vector: [0, 0] }],
  });
  assert.equal(plan.autoTags.length, 1);
  assert.equal(plan.autoTags[0]?.guestId, 'gA');
  assert.ok(plan.autoTags[0]!.distance <= FACE_AUTO_MAX_DISTANCE);
  assert.equal(plan.suggestions.length, 0);
});

test('a borderline match (0.50–0.60) is a suggestion, not an auto-tag', () => {
  const plan = planAutoTags({
    faceVectors: [[0.55, 0]], // distance 0.55
    enrollments: [{ guestId: 'gA', vector: [0, 0] }],
  });
  assert.equal(plan.autoTags.length, 0);
  assert.equal(plan.suggestions.length, 1);
  assert.equal(plan.suggestions[0]?.guestId, 'gA');
  const d = plan.suggestions[0]!.distance;
  assert.ok(d > FACE_AUTO_MAX_DISTANCE && d <= FACE_SUGGEST_MAX_DISTANCE);
});

test('a far match (>0.60, like a different person) is neither tagged nor suggested', () => {
  const plan = planAutoTags({
    faceVectors: [[0.85, 0]], // distance 0.85 — in the validated different-person range
    enrollments: [{ guestId: 'gA', vector: [0, 0] }],
  });
  assert.equal(plan.autoTags.length, 0);
  assert.equal(plan.suggestions.length, 0);
});

test('two faces matching the same guest collapse to one tag at the closer distance', () => {
  const plan = planAutoTags({
    faceVectors: [[0.45, 0], [0.30, 0]], // both ≤0.5 vs gA; closer is 0.30
    enrollments: [{ guestId: 'gA', vector: [0, 0] }],
  });
  assert.equal(plan.autoTags.length, 1, 'one guest → one tag');
  assert.equal(plan.autoTags[0]?.guestId, 'gA');
  assert.ok(Math.abs(plan.autoTags[0]!.distance - 0.30) < 1e-9, 'keeps the closer face');
});

test('an already-tagged guest is never re-tagged', () => {
  const plan = planAutoTags({
    faceVectors: [[0.4, 0]],
    enrollments: [{ guestId: 'gA', vector: [0, 0] }],
    alreadyTaggedGuestIds: ['gA'],
  });
  assert.equal(plan.autoTags.length, 0, 'gA already tagged → skipped');
  assert.equal(plan.suggestions.length, 0);
});

test('the 10-tag cap is combined with existing tags; auto-tags take remaining slots by closeness', () => {
  const existing = Array.from({ length: MAX_TAGS_PER_PHOTO - 1 }, (_, i) => `x${i}`); // 9 existing
  // Three auto-grade matches at distinct distances: gA 0.10 < gB 0.30 < gC 0.45.
  // Enrollments are distinct unit axes so each face matches exactly one guest.
  const plan = planAutoTags({
    faceVectors: [[1.10, 0, 0], [0, 1.30, 0], [0, 0, 1.45]],
    enrollments: [
      { guestId: 'gA', vector: [1, 0, 0] },
      { guestId: 'gB', vector: [0, 1, 0] },
      { guestId: 'gC', vector: [0, 0, 1] },
    ],
    alreadyTaggedGuestIds: existing,
  });
  assert.equal(plan.autoTags.length, 1, 'only one slot left under the 10-tag cap');
  assert.equal(plan.autoTags[0]?.guestId, 'gA', 'the closest match wins the slot');
  // gB and gC qualified for auto but were truncated by the cap — NOT demoted to suggestions.
  assert.equal(plan.suggestions.length, 0);
});

test('no faces or no enrollments → empty plan', () => {
  assert.deepEqual(
    planAutoTags({ faceVectors: [], enrollments: [{ guestId: 'gA', vector: [0, 0] }] }),
    { autoTags: [], suggestions: [] },
  );
  assert.deepEqual(
    planAutoTags({ faceVectors: [[0, 0]], enrollments: [] }),
    { autoTags: [], suggestions: [] },
  );
});

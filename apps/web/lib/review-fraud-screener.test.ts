/**
 * Unit suite for the deterministic review-fraud + ghost-listing scorers (Node
 * built-in test runner via tsx — `pnpm test:unit`; CI runs it in the "unit
 * tests" step).
 *
 * Locks the scoring CONTRACT the whole /admin/integrity-watch queue rests on:
 * that a clean review/listing scores below the flag threshold and each fraud
 * signal, on its own, is strong enough to matter — deterministic + monotonic,
 * no LLM. Only the pure scorers are exercised (no DB / no I/O).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreReviewFraud,
  REVIEW_FRAUD_FLAG_THRESHOLD,
} from './review-fraud-scoring';
import {
  scoreGhostListing,
  GHOST_LISTING_FLAG_THRESHOLD,
  normalizeIdentity,
} from './ghost-listing-scoring';

// ── review-fraud scorer ─────────────────────────────────────────────────────

test('a perfectly on-norm, no-burst, unlinked review scores 0', () => {
  const { score, reason } = scoreReviewFraud({
    ratingOverall: 5,
    othersInWindow: 0,
    vendorMean: 5, // exactly on norm → zero anomaly
    priorCount: 20,
    peerReviewerCount: 0,
  });
  assert.equal(score, 0);
  assert.equal(reason, 'low_signal');
});

test('a near-norm clean review stays well below the flag threshold', () => {
  const { score } = scoreReviewFraud({
    ratingOverall: 5,
    othersInWindow: 0,
    vendorMean: 4.9, // 0.1 off norm → a point or two, never a flag
    priorCount: 20,
    peerReviewerCount: 0,
  });
  assert.ok(score < REVIEW_FRAUD_FLAG_THRESHOLD);
});

test('a single shared-device peer alone crosses the flag threshold', () => {
  const { score, reason } = scoreReviewFraud({
    ratingOverall: 5,
    othersInWindow: 0,
    vendorMean: 5,
    priorCount: 10,
    peerReviewerCount: 1,
  });
  assert.ok(score >= REVIEW_FRAUD_FLAG_THRESHOLD);
  assert.equal(reason, 'reviewer_device_cluster');
});

test('rating anomaly is suppressed below min-N, active above it', () => {
  const belowN = scoreReviewFraud({
    ratingOverall: 1,
    othersInWindow: 0,
    vendorMean: 5,
    priorCount: 2, // < ANOMALY_MIN_N (4)
    peerReviewerCount: 0,
  });
  assert.equal(belowN.detail.anomaly.points, 0);

  const aboveN = scoreReviewFraud({
    ratingOverall: 1,
    othersInWindow: 0,
    vendorMean: 5,
    priorCount: 10,
    peerReviewerCount: 0,
  });
  assert.ok(aboveN.detail.anomaly.points > 0);
  assert.ok(aboveN.detail.anomaly.delta === 4);
});

test('burst points ramp monotonically with volume and cap at 100', () => {
  const low = scoreReviewFraud({
    ratingOverall: 5,
    othersInWindow: 1,
    vendorMean: null,
    priorCount: 1,
    peerReviewerCount: 0,
  }).detail.burst.points;
  const high = scoreReviewFraud({
    ratingOverall: 5,
    othersInWindow: 4,
    vendorMean: null,
    priorCount: 4,
    peerReviewerCount: 0,
  }).detail.burst.points;
  assert.ok(high > low);

  // All signals maxed → clamped to 100, never above.
  const maxed = scoreReviewFraud({
    ratingOverall: 1,
    othersInWindow: 99,
    vendorMean: 5,
    priorCount: 99,
    peerReviewerCount: 99,
  });
  assert.equal(maxed.score, 100);
});

// ── ghost-listing scorer ────────────────────────────────────────────────────

test('a complete, active, answered, fresh listing does not flag', () => {
  const { score } = scoreGhostListing({
    hasLogo: true,
    activeServiceCount: 3,
    inboundMessageCount: 5,
    vendorReplyCount: 5,
    dormantDays: 3,
    duplicateOfCount: 0,
  });
  assert.ok(score < GHOST_LISTING_FLAG_THRESHOLD);
});

test('duplicate identity alone crosses the flag threshold', () => {
  const { score, reason } = scoreGhostListing({
    hasLogo: true,
    activeServiceCount: 2,
    inboundMessageCount: 0,
    vendorReplyCount: 0,
    dormantDays: 1,
    duplicateOfCount: 1,
  });
  assert.ok(score >= GHOST_LISTING_FLAG_THRESHOLD);
  assert.equal(reason, 'duplicate_identity');
});

test('never-answered requires inbound messages AND zero replies', () => {
  // inbound present, zero replies → counts.
  const unanswered = scoreGhostListing({
    hasLogo: true,
    activeServiceCount: 1,
    inboundMessageCount: 3,
    vendorReplyCount: 0,
    dormantDays: 1,
    duplicateOfCount: 0,
  });
  assert.equal(unanswered.detail.unanswered, true);

  // inbound present but the vendor replied → does NOT count.
  const answered = scoreGhostListing({
    hasLogo: true,
    activeServiceCount: 1,
    inboundMessageCount: 3,
    vendorReplyCount: 1,
    dormantDays: 1,
    duplicateOfCount: 0,
  });
  assert.equal(answered.detail.unanswered, false);

  // zero inbound → a brand-new empty inbox is NOT "never answered".
  const fresh = scoreGhostListing({
    hasLogo: true,
    activeServiceCount: 1,
    inboundMessageCount: 0,
    vendorReplyCount: 0,
    dormantDays: 1,
    duplicateOfCount: 0,
  });
  assert.equal(fresh.detail.unanswered, false);
});

test('placeholder shell (no logo + no services) flags', () => {
  const { score } = scoreGhostListing({
    hasLogo: false,
    activeServiceCount: 0,
    inboundMessageCount: 0,
    vendorReplyCount: 0,
    dormantDays: 1,
    duplicateOfCount: 0,
  });
  assert.ok(score >= GHOST_LISTING_FLAG_THRESHOLD);
});

test('normalizeIdentity lower-cases, trims, and collapses whitespace', () => {
  assert.equal(normalizeIdentity('  Ace  Studios '), 'ace studios');
  assert.equal(normalizeIdentity('ACE STUDIOS'), 'ace studios');
  assert.equal(normalizeIdentity(null), '');
  assert.equal(normalizeIdentity(undefined), '');
});

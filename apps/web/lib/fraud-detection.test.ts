/**
 * Unit suite for the pure vendor-level fraud scorers (Anti-Fraud Phase 3, § 4).
 * Deterministic — every I/O-derived number is passed in, no clock/random. The
 * load-bearing invariants: a CLEAN vendor scores ~0 on every signal, and each
 * of the five anomaly shapes lights up its own detector without false-tripping
 * the others.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreRing,
  scoreVelocity,
  scoreGraphIsolation,
  scoreImportSpike,
  scoreRatingShape,
  scoreVendor,
  VELOCITY_HIGH_STAR_MIN,
  VENDOR_FRAUD_ATTENTION_THRESHOLD,
} from './fraud-detection';

// A fixed "now" so velocity windowing is deterministic.
const NOW = Date.UTC(2026, 6, 5, 12, 0, 0); // 2026-07-05T12:00:00Z
const hoursAgo = (h: number) => NOW - h * 3600_000;

// ── ring ─────────────────────────────────────────────────────────────────────

test('ring: below min-N scores 0', () => {
  const { score, evidence } = scoreRing({ clusterIds: ['a', 'a', 'b'] });
  assert.equal(score, 0);
  assert.equal(evidence.below_min_n, true);
});

test('ring: 8 reviews from 2 clusters scores high', () => {
  // 8 reviews, only 2 distinct clusters → ratio 0.25 → saturates.
  const clusterIds = ['c1', 'c1', 'c1', 'c1', 'c2', 'c2', 'c2', 'c2'];
  const { score, evidence } = scoreRing({ clusterIds });
  assert.equal(evidence.review_count, 8);
  assert.equal(evidence.distinct_clusters, 2);
  assert.ok(score >= 90, `expected high ring score, got ${score}`);
});

test('ring: all-distinct clusters scores 0 (healthy)', () => {
  const clusterIds = ['a', 'b', 'c', 'd', 'e', 'f'];
  const { score } = scoreRing({ clusterIds });
  assert.equal(score, 0);
});

// ── velocity ──────────────────────────────────────────────────────────────────

test('velocity: burst of day-old accounts, all high-star, scores high', () => {
  const reviewers = Array.from({ length: 4 }, (_, i) => ({
    reviewedAtMs: hoursAgo(i * 2), // all within the 72h window
    accountAgeDaysAtReview: 0, // brand new (signed up same day)
    ratingOverall: 5,
  }));
  const { score, evidence } = scoreVelocity({ reviewers, windowEndMs: NOW });
  assert.equal(evidence.brand_new_high_star_in_window, 4);
  assert.ok(score >= 90, `expected high velocity score, got ${score}`);
});

test('velocity: established accounts (old signups) score 0', () => {
  const reviewers = Array.from({ length: 4 }, (_, i) => ({
    reviewedAtMs: hoursAgo(i * 2),
    accountAgeDaysAtReview: 120, // old accounts — organic
    ratingOverall: 5,
  }));
  const { score } = scoreVelocity({ reviewers, windowEndMs: NOW });
  assert.equal(score, 0);
});

test('velocity: brand-new but LOW-star reviews do not trip (not a pump)', () => {
  const reviewers = Array.from({ length: 4 }, () => ({
    reviewedAtMs: hoursAgo(1),
    accountAgeDaysAtReview: 0,
    ratingOverall: VELOCITY_HIGH_STAR_MIN - 1, // below the high-star pump bar
  }));
  const { score } = scoreVelocity({ reviewers, windowEndMs: NOW });
  assert.equal(score, 0);
});

test('velocity: reviews OUTSIDE the window are ignored', () => {
  const reviewers = [
    { reviewedAtMs: hoursAgo(1000), accountAgeDaysAtReview: 0, ratingOverall: 5 },
    { reviewedAtMs: hoursAgo(2000), accountAgeDaysAtReview: 0, ratingOverall: 5 },
  ];
  const { score, evidence } = scoreVelocity({ reviewers, windowEndMs: NOW });
  assert.equal(evidence.reviews_in_window, 0);
  assert.equal(score, 0);
});

// ── graph_isolation ────────────────────────────────────────────────────────────

test('graph_isolation: isolated single-vendor accounts score high', () => {
  const reviewers = Array.from({ length: 4 }, () => ({
    totalVendorLinks: 1, // this vendor is their ONLY link
    otherEventCount: 0, // no other events
  }));
  const { score, evidence } = scoreGraphIsolation({ reviewers });
  assert.equal(evidence.isolated_reviewers, 4);
  assert.ok(score >= 90, `expected high isolation score, got ${score}`);
});

test('graph_isolation: reviewers with organic footprint score 0', () => {
  const reviewers = Array.from({ length: 4 }, () => ({
    totalVendorLinks: 6, // many vendors — organic browsing
    otherEventCount: 2,
  }));
  const { score } = scoreGraphIsolation({ reviewers });
  assert.equal(score, 0);
});

test('graph_isolation: below min-N scores 0', () => {
  const reviewers = [{ totalVendorLinks: 1, otherEventCount: 0 }];
  const { score, evidence } = scoreGraphIsolation({ reviewers });
  assert.equal(score, 0);
  assert.equal(evidence.below_min_n, true);
});

// ── import_spike ────────────────────────────────────────────────────────────────

test('import_spike: many unbacked imported bookings score high', () => {
  const { score, evidence } = scoreImportSpike({
    unbackedImportedCount: 8,
    totalImportedCount: 10,
  });
  assert.equal(evidence.unbacked_imported, 8);
  assert.ok(score >= 90, `expected high import score, got ${score}`);
});

test('import_spike: below min-N scores 0', () => {
  const { score, evidence } = scoreImportSpike({
    unbackedImportedCount: 2,
    totalImportedCount: 5,
  });
  assert.equal(score, 0);
  assert.equal(evidence.below_min_n, true);
});

// ── rating_shape ────────────────────────────────────────────────────────────────

test('rating_shape: all-5-star with no tail scores high', () => {
  const ratings = [5, 5, 5, 5, 5, 5];
  const { score, evidence } = scoreRatingShape({ ratings });
  assert.equal(evidence.has_low_star_tail, false);
  assert.ok(score >= 90, `expected high shape score, got ${score}`);
});

test('rating_shape: presence of ANY 1-4 star tail scores 0 (organic curve)', () => {
  const ratings = [5, 5, 5, 5, 4]; // a real tail
  const { score, evidence } = scoreRatingShape({ ratings });
  assert.equal(evidence.has_low_star_tail, true);
  assert.equal(score, 0);
});

test('rating_shape: below min-N scores 0', () => {
  const ratings = [5, 5, 5];
  const { score, evidence } = scoreRatingShape({ ratings });
  assert.equal(score, 0);
  assert.equal(evidence.below_min_n, true);
});

// ── aggregate: a CLEAN vendor scores ~0 on every signal ─────────────────────────

test('scoreVendor: a clean vendor scores 0 on every signal', () => {
  const result = scoreVendor({
    // 6 reviews, all distinct clusters, old accounts, organic footprint, mixed
    // ratings with a tail.
    ring: { clusterIds: ['a', 'b', 'c', 'd', 'e', 'f'] },
    velocity: {
      reviewers: [
        { reviewedAtMs: hoursAgo(10), accountAgeDaysAtReview: 200, ratingOverall: 5 },
        { reviewedAtMs: hoursAgo(20), accountAgeDaysAtReview: 150, ratingOverall: 4 },
        { reviewedAtMs: hoursAgo(30), accountAgeDaysAtReview: 90, ratingOverall: 5 },
      ],
      windowEndMs: NOW,
    },
    graph_isolation: {
      reviewers: [
        { totalVendorLinks: 5, otherEventCount: 2 },
        { totalVendorLinks: 4, otherEventCount: 1 },
        { totalVendorLinks: 7, otherEventCount: 3 },
      ],
    },
    import_spike: { unbackedImportedCount: 0, totalImportedCount: 4 },
    rating_shape: { ratings: [5, 4, 5, 3, 5, 4] },
  });
  for (const [type, s] of Object.entries(result)) {
    assert.equal(s.score, 0, `clean vendor should score 0 on ${type}, got ${s.score}`);
  }
});

test('scoreVendor: a ring/pump vendor trips ring + velocity + shape above the bar', () => {
  const result = scoreVendor({
    ring: { clusterIds: ['c1', 'c1', 'c1', 'c1', 'c2', 'c2', 'c2', 'c2'] },
    velocity: {
      reviewers: Array.from({ length: 4 }, (_, i) => ({
        reviewedAtMs: hoursAgo(i),
        accountAgeDaysAtReview: 0,
        ratingOverall: 5,
      })),
      windowEndMs: NOW,
    },
    graph_isolation: {
      reviewers: Array.from({ length: 4 }, () => ({
        totalVendorLinks: 1,
        otherEventCount: 0,
      })),
    },
    import_spike: { unbackedImportedCount: 8, totalImportedCount: 8 },
    rating_shape: { ratings: [5, 5, 5, 5, 5, 5, 5, 5] },
  });
  assert.ok(result.ring.score >= VENDOR_FRAUD_ATTENTION_THRESHOLD);
  assert.ok(result.velocity.score >= VENDOR_FRAUD_ATTENTION_THRESHOLD);
  assert.ok(result.graph_isolation.score >= VENDOR_FRAUD_ATTENTION_THRESHOLD);
  assert.ok(result.import_spike.score >= VENDOR_FRAUD_ATTENTION_THRESHOLD);
  assert.ok(result.rating_shape.score >= VENDOR_FRAUD_ATTENTION_THRESHOLD);
});

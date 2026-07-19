// NOTE: deliberately NOT 'server-only'. This module holds the PURE, I/O-free
// vendor-level fraud scorers + their tunable constants/types so the Node test
// runner (`tsx --test`, `pnpm test:unit`) can import them directly (mirrors the
// review-fraud-scoring.ts / review-fraud-screener.ts split, where the pure math
// lives apart from the server-only DB orchestration). The server-only I/O that
// feeds these — scoreVendorFraud + runAllFraudScoring — lives in
// lib/fraud-detection-runner.ts.
//
// Anti-Fraud & Trust Integrity — Phase 3 detection engine.
// Spec: 03_Strategy/Anti_Fraud_Trust_Integrity_2026-07-05.md § 4 (Detection).
//
// FIVE vendor-level anomaly detectors (§ 4). Each is a PURE function of the
// vendor's already-fetched data → { score (0..100), evidence }. Higher score =
// more suspicious. DETECT + SCORE ONLY — nothing here (or in the runner)
// punishes a vendor; enforcement is Phase 4.
//
//   1. ring            — trusted reviews/events concentrated in few identity
//                        clusters (distinct_clusters / count is low).
//   2. velocity        — burst of BRAND-NEW couple accounts all reviewing one
//                        vendor inside a short window, mostly high-star.
//   3. graph_isolation — reviewing couples with no organic footprint (this
//                        vendor is the only thing the account ever touched).
//   4. import_spike    — spike of self-imported / host_manual bookings with
//                        NEITHER a reconciled payment NOR an arm's-length
//                        couple (per § 3 rule 2 — either path missing).
//   5. rating_shape    — degenerate all-5star distribution with no 1–4star
//                        tail, inconsistent with real review curves.
//
// PRIVACY (RA 10173): every `evidence` object carries only NON-PII derived
// values — counts, ratios, opaque cluster labels (bigint/uuid identifiers, not
// device hashes / addresses / payment senders), and booleans. The runner reads
// personal data to derive these tallies; the tallies themselves are safe to
// persist + surface to an admin.

// ── Owner-tunable thresholds (first-pass defaults) ──────────────────────────
// All exported so the runner + tests + a future admin tuning surface share ONE
// source of truth. Tune sensibly as real baseline data accumulates.

// —— ring ——
/** Min trusted reviews before the ring ratio is meaningful (MIN-N gate). */
export const RING_MIN_REVIEWS = 4;
/**
 * distinct_clusters / review_count at/below which the ring signal maxes. At 0.25
 * a vendor with 8 trusted reviews from only 2 identity clusters saturates.
 */
export const RING_MAX_CONCENTRATION_RATIO = 0.25;
/** Points a fully-saturated ring signal contributes. */
export const RING_MAX_POINTS = 100;

// —— velocity ——
/** Trailing window (hours) for the brand-new-account burst. */
export const VELOCITY_WINDOW_HOURS = 72;
/** A couple account is "brand new" if it reviewed within this many days of signup. */
export const VELOCITY_NEW_ACCOUNT_DAYS = 3;
/** A review counts toward the burst only if its rating is >= this (the pump). */
export const VELOCITY_HIGH_STAR_MIN = 4;
/** Brand-new high-star reviews in the window at/above which velocity maxes. */
export const VELOCITY_MAX_AT = 4;
/** Points a fully-saturated velocity signal contributes. */
export const VELOCITY_MAX_POINTS = 100;

// —— graph_isolation ——
/** Min reviewers before isolation is meaningful (MIN-N gate). */
export const ISOLATION_MIN_REVIEWERS = 3;
/**
 * A reviewer is "isolated" when this vendor is the ONLY vendor they ever added
 * (event_vendors count for them === 1) AND they had <= this many other events.
 */
export const ISOLATION_MAX_OTHER_EVENTS = 0;
/** Fraction of reviewers that are isolated at/above which the signal maxes. */
export const ISOLATION_MAX_FRACTION = 1;
/** Points a fully-saturated isolation signal contributes. */
export const ISOLATION_MAX_POINTS = 100;

// —— import_spike ——
/** Min unbacked host_manual/import bookings before the spike is meaningful. */
export const IMPORT_MIN_UNBACKED = 3;
/** Unbacked imported bookings at/above which the spike maxes. */
export const IMPORT_MAX_AT = 8;
/** Points a fully-saturated import spike contributes. */
export const IMPORT_MAX_POINTS = 100;

// —— rating_shape ——
/** Min reviews before the distribution shape is judged (MIN-N gate). */
export const SHAPE_MIN_REVIEWS = 5;
/**
 * Fraction of reviews that are 5star at/above which shape maxes (given no
 * 1–4star tail). 1.0 = literally every review is 5star.
 */
export const SHAPE_MAX_FIVE_STAR_FRACTION = 1;
/** Points a fully-saturated rating-shape signal contributes. */
export const SHAPE_MAX_POINTS = 100;

/**
 * Aggregate score at/above which a vendor is worth an admin's attention. The
 * runner persists ANY signal that scores > 0, but the Phase-4 queue can use this
 * as its default "needs review" bar. NOT an enforcement threshold (Phase 4 owns
 * the auto-suspend cut).
 */
export const VENDOR_FRAUD_ATTENTION_THRESHOLD = 60;

// ── Types ───────────────────────────────────────────────────────────────────

export type FraudSignalType =
  | 'ring'
  | 'velocity'
  | 'graph_isolation'
  | 'import_spike'
  | 'rating_shape';

export const FRAUD_SIGNAL_TYPES: readonly FraudSignalType[] = [
  'ring',
  'velocity',
  'graph_isolation',
  'import_spike',
  'rating_shape',
] as const;

/** Pure scorer result — a 0..100 score + non-PII evidence. */
export type SignalScore = {
  score: number;
  /** Non-PII derived evidence persisted into fraud_signals.evidence. */
  evidence: Record<string, unknown>;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

// ── 1. ring ─────────────────────────────────────────────────────────────────
// Trusted reviews (or completed events) concentrated in a few identity
// clusters. `clusterIds` is the per-review reviewing-couple cluster label
// (repeats when many sockpuppets share a cluster). Low distinct/total → high.

export function scoreRing(inputs: {
  /** One cluster label per COUNTABLE review/event (repeats allowed). */
  clusterIds: ReadonlyArray<string | number>;
}): SignalScore {
  const total = inputs.clusterIds.length;
  const distinct = new Set(inputs.clusterIds).size;
  if (total < RING_MIN_REVIEWS) {
    return {
      score: 0,
      evidence: {
        review_count: total,
        distinct_clusters: distinct,
        below_min_n: true,
        min_n: RING_MIN_REVIEWS,
      },
    };
  }
  const ratio = distinct / total; // 1 = all distinct (healthy), →0 = concentrated
  // Linear ramp: ratio at/above 1.0 → 0 points; at/below MAX_CONCENTRATION → max.
  const severity = clamp(
    (1 - ratio) / (1 - RING_MAX_CONCENTRATION_RATIO),
    0,
    1,
  );
  const score = round(severity * RING_MAX_POINTS);
  return {
    score,
    evidence: {
      review_count: total,
      distinct_clusters: distinct,
      concentration_ratio: Number(ratio.toFixed(3)),
      points: score,
    },
  };
}

// ── 2. velocity ──────────────────────────────────────────────────────────────
// A burst of BRAND-NEW couple accounts, all reviewing this ONE vendor inside a
// short window, mostly high-star. Each reviewer carries the age (days between
// signup and their review) + their rating + the review timestamp (ms).

export type VelocityReviewer = {
  /** ms epoch of the review's created_at. */
  reviewedAtMs: number;
  /** Whole days between the reviewer's account creation and their review. */
  accountAgeDaysAtReview: number;
  ratingOverall: number;
};

export function scoreVelocity(inputs: {
  reviewers: ReadonlyArray<VelocityReviewer>;
  /** End of the scoring window (ms epoch). Usually "now" or the latest review. */
  windowEndMs: number;
}): SignalScore {
  const windowStartMs = inputs.windowEndMs - VELOCITY_WINDOW_HOURS * 3600_000;
  const inWindow = inputs.reviewers.filter(
    (r) => r.reviewedAtMs >= windowStartMs && r.reviewedAtMs <= inputs.windowEndMs,
  );
  const brandNewHighStar = inWindow.filter(
    (r) =>
      r.accountAgeDaysAtReview <= VELOCITY_NEW_ACCOUNT_DAYS &&
      r.ratingOverall >= VELOCITY_HIGH_STAR_MIN,
  ).length;
  const severity = clamp(brandNewHighStar / VELOCITY_MAX_AT, 0, 1);
  const score = round(severity * VELOCITY_MAX_POINTS);
  return {
    score,
    evidence: {
      window_hours: VELOCITY_WINDOW_HOURS,
      reviews_in_window: inWindow.length,
      brand_new_high_star_in_window: brandNewHighStar,
      new_account_days: VELOCITY_NEW_ACCOUNT_DAYS,
      high_star_min: VELOCITY_HIGH_STAR_MIN,
      points: score,
    },
  };
}

// ── 3. graph_isolation ───────────────────────────────────────────────────────
// Real couples have an organic footprint (many vendors, other events).
// Sockpuppets touch only the one vendor. Each reviewer carries their total
// event_vendors count + their other-events count.

export type ReviewerFootprint = {
  /** How many event_vendors rows this couple has TOTAL (across all their events). */
  totalVendorLinks: number;
  /** How many OTHER events this couple has beyond the reviewed one. */
  otherEventCount: number;
};

export function scoreGraphIsolation(inputs: {
  reviewers: ReadonlyArray<ReviewerFootprint>;
}): SignalScore {
  const n = inputs.reviewers.length;
  if (n < ISOLATION_MIN_REVIEWERS) {
    return {
      score: 0,
      evidence: {
        reviewer_count: n,
        below_min_n: true,
        min_n: ISOLATION_MIN_REVIEWERS,
      },
    };
  }
  const isolated = inputs.reviewers.filter(
    (r) =>
      r.totalVendorLinks <= 1 && r.otherEventCount <= ISOLATION_MAX_OTHER_EVENTS,
  ).length;
  const fraction = isolated / n;
  const severity = clamp(fraction / ISOLATION_MAX_FRACTION, 0, 1);
  const score = round(severity * ISOLATION_MAX_POINTS);
  return {
    score,
    evidence: {
      reviewer_count: n,
      isolated_reviewers: isolated,
      isolated_fraction: Number(fraction.toFixed(3)),
      points: score,
    },
  };
}

// ── 4. import_spike ──────────────────────────────────────────────────────────
// A spike of self-imported / host_manual bookings for the vendor with NEITHER a
// reconciled payment NOR an arm's-length couple confirmation (§ 3 rule 2 — a
// countable event needs at least one path; missing BOTH = CRM-only, and a spike
// of these is a fake-event signal). The runner classifies each booking; this
// scores the unbacked count.

export function scoreImportSpike(inputs: {
  /** host_manual/import bookings missing BOTH a reconciled payment AND arm's-length couple. */
  unbackedImportedCount: number;
  /** Total host_manual/import bookings (for context in the evidence). */
  totalImportedCount: number;
}): SignalScore {
  const { unbackedImportedCount, totalImportedCount } = inputs;
  if (unbackedImportedCount < IMPORT_MIN_UNBACKED) {
    return {
      score: 0,
      evidence: {
        unbacked_imported: unbackedImportedCount,
        total_imported: totalImportedCount,
        below_min_n: true,
        min_n: IMPORT_MIN_UNBACKED,
      },
    };
  }
  const severity = clamp(unbackedImportedCount / IMPORT_MAX_AT, 0, 1);
  const score = round(severity * IMPORT_MAX_POINTS);
  return {
    score,
    evidence: {
      unbacked_imported: unbackedImportedCount,
      total_imported: totalImportedCount,
      points: score,
    },
  };
}

// ── 5. rating_shape ──────────────────────────────────────────────────────────
// A degenerate distribution — all 5star, no 1–4star tail — inconsistent with
// real review curves (which always carry SOME lower ratings). `ratings` is every
// overall rating the vendor has.

export function scoreRatingShape(inputs: {
  ratings: ReadonlyArray<number>;
}): SignalScore {
  const n = inputs.ratings.length;
  const fiveStar = inputs.ratings.filter((r) => r >= 5).length;
  const hasTail = inputs.ratings.some((r) => r >= 1 && r <= 4);
  if (n < SHAPE_MIN_REVIEWS) {
    return {
      score: 0,
      evidence: {
        review_count: n,
        five_star_count: fiveStar,
        has_low_star_tail: hasTail,
        below_min_n: true,
        min_n: SHAPE_MIN_REVIEWS,
      },
    };
  }
  // A tail of ANY 1–4star review immediately reads as an organic curve → no
  // signal. The degeneracy is specifically "no tail at all".
  if (hasTail) {
    return {
      score: 0,
      evidence: {
        review_count: n,
        five_star_count: fiveStar,
        has_low_star_tail: true,
        points: 0,
      },
    };
  }
  const fiveStarFraction = fiveStar / n; // 1.0 when every review is 5star
  const severity = clamp(fiveStarFraction / SHAPE_MAX_FIVE_STAR_FRACTION, 0, 1);
  const score = round(severity * SHAPE_MAX_POINTS);
  return {
    score,
    evidence: {
      review_count: n,
      five_star_count: fiveStar,
      five_star_fraction: Number(fiveStarFraction.toFixed(3)),
      has_low_star_tail: false,
      points: score,
    },
  };
}

// ── Aggregate ────────────────────────────────────────────────────────────────

export type VendorSignalInputs = {
  ring: Parameters<typeof scoreRing>[0];
  velocity: Parameters<typeof scoreVelocity>[0];
  graph_isolation: Parameters<typeof scoreGraphIsolation>[0];
  import_spike: Parameters<typeof scoreImportSpike>[0];
  rating_shape: Parameters<typeof scoreRatingShape>[0];
};

export type VendorScoreResult = Record<FraudSignalType, SignalScore>;

/**
 * Score ALL five signals for one vendor from its already-fetched inputs. Pure —
 * the runner does the I/O, this does the math. Returns one SignalScore per type;
 * the runner persists each (upserting into fraud_signals) and refreshes the
 * aggregate matview the P4 queue sorts by.
 */
export function scoreVendor(inputs: VendorSignalInputs): VendorScoreResult {
  return {
    ring: scoreRing(inputs.ring),
    velocity: scoreVelocity(inputs.velocity),
    graph_isolation: scoreGraphIsolation(inputs.graph_isolation),
    import_spike: scoreImportSpike(inputs.import_spike),
    rating_shape: scoreRatingShape(inputs.rating_shape),
  };
}

/** Human copy for each signal type (surfaced by the P4 admin queue). */
export const FRAUD_SIGNAL_LABEL: Record<FraudSignalType, string> = {
  ring: 'Trusted reviews/events concentrated in a few identity clusters (possible sockpuppet ring).',
  velocity:
    'A burst of brand-new couple accounts reviewed this vendor in a short window.',
  graph_isolation:
    'Reviewing couples have no organic footprint — this vendor is the only thing they touched.',
  import_spike:
    'A spike of self-imported bookings with neither a reconciled payment nor an arm’s-length couple.',
  rating_shape:
    'A degenerate all-5-star distribution with no lower-rating tail, unlike real review curves.',
};

// NOTE: deliberately NOT 'server-only'. This module holds the PURE, I/O-free
// review-fraud scorer + its constants/labels/types so the Node test runner
// (`tsx --test`, `pnpm test:unit`) can import it directly (mirrors the
// perceptual-hash.ts / vendor-image-repost-watch.ts split, where the pure math
// lives apart from the server-only orchestration). The server-only I/O that
// calls this — screenReviewForFraud + rescanAllReviewsForFraud — lives in
// lib/review-fraud-screener.ts.

/**
 * Review-fraud scorer — deterministic scoring of a submitted vendor review for
 * signals BEYOND the existing 5-signal self-review hard-gate
 * (lib/self-review-gate.ts). See lib/review-fraud-screener.ts for the full
 * feature docs; this file is only the pure math.
 *
 * Signals (0..100, higher = more suspicious), summed then clamped:
 *   1. VELOCITY / BURST — OTHER reviews for the same vendor in a short window.
 *   2. RATING ANOMALY   — |rating − vendor mean|, min-N gated.
 *   3. REVIEWER LINKAGE — distinct OTHER reviewers of the same vendor sharing a
 *                         device fingerprint (a sockpuppet cluster).
 */

// ── Owner-tunable thresholds (first-pass defaults) ──────────────────────────

/** Trailing window for the burst/velocity signal. */
export const BURST_WINDOW_HOURS = 48;
/** OTHER reviews for the vendor within the window at/above which burst maxes. */
const BURST_MAX_AT = 4;
/** Points contributed by a fully-saturated burst window. */
const BURST_MAX_POINTS = 40;

/** Minimum prior reviews before the vendor's rating norm is trustworthy. */
const ANOMALY_MIN_N = 4;
/** |rating − vendor_mean| at/above which the anomaly signal maxes. */
const ANOMALY_MAX_DELTA = 3;
/** Points contributed by a fully-saturated rating anomaly. */
const ANOMALY_MAX_POINTS = 35;

/**
 * Points per OTHER distinct reviewer sharing a device with this reviewer. Set to
 * the flag threshold so a SINGLE shared-device peer (two accounts on one device
 * reviewing the same vendor — the minimal sockpuppet ring) crosses the bar on
 * its own; it is the strongest fraud signal we have.
 */
const LINKAGE_POINTS_PER_PEER = 45;
/** Cap on the linkage contribution. */
const LINKAGE_MAX_POINTS = 45;

/** Total score at/above which a review is flagged into the queue. */
export const REVIEW_FRAUD_FLAG_THRESHOLD = 45;

// ── Types ───────────────────────────────────────────────────────────────────

/** Non-PII evidence persisted alongside a flag (RA 10173-safe). */
export type ReviewFraudDetail = {
  score: number;
  burst: { others_in_window: number; window_hours: number; points: number };
  anomaly: {
    vendor_mean: number | null;
    prior_count: number;
    delta: number | null;
    points: number;
  };
  linkage: { peer_reviewer_count: number; points: number };
};

export type ReviewFraudScore = {
  score: number;
  reason: string;
  detail: ReviewFraudDetail;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Combine the three signal inputs into a 0..100 score + a primary reason label.
 * Pure + deterministic — every I/O-derived number is passed in, so this is the
 * single place the scoring rule lives.
 */
export function scoreReviewFraud(inputs: {
  ratingOverall: number;
  othersInWindow: number;
  vendorMean: number | null;
  priorCount: number;
  peerReviewerCount: number;
}): ReviewFraudScore {
  const { ratingOverall, othersInWindow, vendorMean, priorCount, peerReviewerCount } =
    inputs;

  // 1. Burst — linear ramp to BURST_MAX_POINTS at BURST_MAX_AT others.
  const burstPoints = Math.round(
    clamp(othersInWindow / BURST_MAX_AT, 0, 1) * BURST_MAX_POINTS,
  );

  // 2. Rating anomaly — only once the vendor has a trustworthy norm (MIN-N).
  let anomalyPoints = 0;
  let delta: number | null = null;
  if (vendorMean !== null && priorCount >= ANOMALY_MIN_N) {
    delta = Math.abs(ratingOverall - vendorMean);
    anomalyPoints = Math.round(
      clamp(delta / ANOMALY_MAX_DELTA, 0, 1) * ANOMALY_MAX_POINTS,
    );
  }

  // 3. Reviewer linkage — points per shared-device peer reviewer, capped.
  const linkagePoints = clamp(
    peerReviewerCount * LINKAGE_POINTS_PER_PEER,
    0,
    LINKAGE_MAX_POINTS,
  );

  const score = clamp(burstPoints + anomalyPoints + linkagePoints, 0, 100);

  // Primary reason = the biggest contributor (linkage wins ties — it's the
  // strongest sockpuppet signal).
  let reason = 'low_signal';
  const contributors: [string, number][] = [
    ['reviewer_device_cluster', linkagePoints],
    ['burst_velocity', burstPoints],
    ['rating_anomaly', anomalyPoints],
  ];
  contributors.sort((a, b) => b[1] - a[1]);
  const top = contributors[0];
  if (top && top[1] > 0) reason = top[0];

  const detail: ReviewFraudDetail = {
    score,
    burst: {
      others_in_window: othersInWindow,
      window_hours: BURST_WINDOW_HOURS,
      points: burstPoints,
    },
    anomaly: {
      vendor_mean: vendorMean,
      prior_count: priorCount,
      delta,
      points: anomalyPoints,
    },
    linkage: { peer_reviewer_count: peerReviewerCount, points: linkagePoints },
  };

  return { score, reason, detail };
}

export const REVIEW_FRAUD_REASON_LABEL: Record<string, string> = {
  reviewer_device_cluster:
    'Reviewer shares a device with another reviewer of this vendor (possible sockpuppet cluster).',
  burst_velocity: 'Part of a burst of reviews for this vendor in a short window.',
  rating_anomaly: "Rating is far from this vendor's established norm.",
  low_signal: 'Low combined suspicion signal.',
};

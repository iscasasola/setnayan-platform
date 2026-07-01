/**
 * Vendor-SAFE business-health composite (My Performance page · Phase 6).
 *
 * A single "how healthy is my business on Setnayan?" read, built ONLY from
 * vendor-facing signals the vendor can already see + act on. It is a
 * PRESENTATION rollup of public metrics — it is emphatically NOT the internal
 * `platform_health_score`, which is HQ-only and must NEVER surface to vendors
 * (same lock the VendorStatsPanel honors). The score here is derived live from
 * the vendor's own `vendor_activity_stats` row; it never reads, mirrors, or
 * approximates the HQ score.
 *
 * FIVE PILLARS (each 0–100, then simple-averaged into the composite):
 *   1. Responsiveness  — response_rate_pct (do you reply, and to how many)
 *   2. Reliability     — booking_completion_rate_pct (do you finish what you book)
 *   3. Reputation      — review score (Bayesian, scaled 0–5 → 0–100) · min-N gated
 *   4. Profile         — profile_completeness_pct (is your storefront complete)
 *   5. Ranking signal  — quality_score (the search-ranking number vendors already see)
 *
 * A pillar with no data yet (e.g. no reviews) is EXCLUDED from the average
 * rather than counted as zero, so a brand-new vendor isn't punished for a metric
 * that simply hasn't accrued. The composite is null until at least one pillar
 * has data.
 */

/** The subset of vendor_activity_stats this composite consumes. */
export type VendorHealthInputs = {
  quality_score: number | null;
  response_rate_pct: number | null;
  booking_completion_rate_pct: number | null;
  profile_completeness_pct: number | null;
  review_avg_bayesian: number | null;
  review_count: number | null;
};

export type HealthPillar = {
  key: 'responsiveness' | 'reliability' | 'reputation' | 'profile' | 'ranking';
  label: string;
  /** 0–100 score, or null when there isn't enough data to rate this pillar. */
  score: number | null;
  /** One-line, action-oriented hint shown under the pillar. */
  hint: string;
};

export type VendorHealthComposite = {
  pillars: HealthPillar[];
  /** Simple average of the pillars that HAVE data (0–100), or null if none do. */
  composite: number | null;
  /** Coarse band for the headline chip. */
  band: 'strong' | 'steady' | 'building' | 'no_data';
};

/** Minimum reviews before the Reputation pillar is considered reliable. */
export const REPUTATION_MIN_REVIEWS = 3;

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

function bandFor(composite: number | null): VendorHealthComposite['band'] {
  if (composite === null) return 'no_data';
  if (composite >= 75) return 'strong';
  if (composite >= 50) return 'steady';
  return 'building';
}

/**
 * Build the vendor-safe health composite from an activity-stats row.
 * Pure + deterministic — no I/O, unit-testable.
 */
export function buildVendorHealthComposite(
  stats: VendorHealthInputs | null,
): VendorHealthComposite {
  if (!stats) {
    return {
      pillars: [
        { key: 'responsiveness', label: 'Responsiveness', score: null, hint: 'Reply to inquiries within 48 hours to build this up.' },
        { key: 'reliability', label: 'Reliability', score: null, hint: 'Complete the bookings you take on.' },
        { key: 'reputation', label: 'Reputation', score: null, hint: 'Ask your couples to leave a review.' },
        { key: 'profile', label: 'Profile strength', score: null, hint: 'Add photos, services, and a bio.' },
        { key: 'ranking', label: 'Ranking signal', score: null, hint: 'Your overall search-ranking score.' },
      ],
      composite: null,
      band: 'no_data',
    };
  }

  // Reputation: Bayesian average is on a 0–5 star scale → scale to 0–100.
  // Only rated once enough reviews have accrued (min-N), else null (excluded).
  const reviewCount = Number(stats.review_count ?? 0);
  const reputationScore =
    reviewCount >= REPUTATION_MIN_REVIEWS && stats.review_avg_bayesian != null
      ? clamp100((Number(stats.review_avg_bayesian) / 5) * 100)
      : null;

  const pillars: HealthPillar[] = [
    {
      key: 'responsiveness',
      label: 'Responsiveness',
      score: stats.response_rate_pct != null ? clamp100(Number(stats.response_rate_pct)) : null,
      hint: 'Share of inquiries you reply to within 48 hours.',
    },
    {
      key: 'reliability',
      label: 'Reliability',
      score:
        stats.booking_completion_rate_pct != null
          ? clamp100(Number(stats.booking_completion_rate_pct))
          : null,
      hint: 'Share of confirmed bookings you complete.',
    },
    {
      key: 'reputation',
      label: 'Reputation',
      score: reputationScore,
      hint:
        reputationScore === null
          ? `Rated once you have ${REPUTATION_MIN_REVIEWS}+ reviews.`
          : 'Your review score, on a fair-average basis.',
    },
    {
      key: 'profile',
      label: 'Profile strength',
      score:
        stats.profile_completeness_pct != null
          ? clamp100(Number(stats.profile_completeness_pct))
          : null,
      hint: 'How complete your public storefront is.',
    },
    {
      key: 'ranking',
      label: 'Ranking signal',
      score: stats.quality_score != null ? clamp100(Number(stats.quality_score)) : null,
      hint: 'Your overall search-ranking score with couples.',
    },
  ];

  const rated = pillars.filter((p): p is HealthPillar & { score: number } => p.score !== null);
  const composite =
    rated.length > 0
      ? Math.round(rated.reduce((acc, p) => acc + p.score, 0) / rated.length)
      : null;

  return { pillars, composite, band: bandFor(composite) };
}

/**
 * Vendor-SAFE business-health composite (My Performance page).
 *
 * A single "how healthy is my business on Setnayan?" read, built ONLY from
 * vendor-facing signals the vendor can already see + act on. It is a
 * PRESENTATION rollup of public metrics — it is emphatically NOT the internal
 * `platform_health_score`, which is HQ-only and must NEVER surface to vendors
 * (same lock the VendorStatsPanel honors). The score here is derived live from
 * the vendor's own `vendor_activity_stats` row; it never reads, mirrors, or
 * approximates the HQ score.
 *
 * FIVE PILLARS (each 0–100, then simple-averaged into the composite) — the
 * finalized My Performance prototype names these:
 *   1. Responsiveness — response_rate_pct (do you reply, and to how many)
 *   2. Reputation     — review score (Bayesian, scaled 0–5 → 0–100) · min-N gated
 *   3. Demand         — top-of-funnel pull (views + inquiries). There is no clean
 *                       0–100 vendor signal for this yet, so it is left as an
 *                       explicit empty pillar (score null) with a Demand-Radar
 *                       pointer rather than a fabricated number. Excluded from the
 *                       average until a real 0–100 demand index exists.
 *   4. Conversion     — inquiry_to_booking_pct (how much of your demand you close)
 *   5. Delivery       — booking_completion_rate_pct (do you finish what you book)
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
  inquiry_to_booking_pct: number | null;
  finalized_booking_count: number | null;
};

export type HealthPillarKey =
  | 'responsiveness'
  | 'reputation'
  | 'demand'
  | 'conversion'
  | 'delivery';

export type HealthPillar = {
  key: HealthPillarKey;
  label: string;
  /** 0–100 score, or null when there isn't enough data to rate this pillar. */
  score: number | null;
  /** One-line, action-oriented hint shown under the pillar. */
  hint: string;
};

/** Coarse per-pillar band → drives the red/amber/green bar color. */
export type PillarBand = 'red' | 'amber' | 'green' | 'none';

export type VendorHealthComposite = {
  pillars: HealthPillar[];
  /** Simple average of the pillars that HAVE data (0–100), or null if none do. */
  composite: number | null;
  /** Coarse band for the headline ring + chip. */
  band: 'strong' | 'steady' | 'building' | 'no_data';
  /** Vendor-safe headline word for the ring ("HEALTHY" / "STEADY" / …). */
  bandLabel: string;
  /** One-line coaching sentence tuned to the weakest actionable pillar. */
  coaching: string;
};

/** Minimum reviews before the Reputation pillar is considered reliable. */
export const REPUTATION_MIN_REVIEWS = 3;

/** Pillar thresholds from the prototype: red < 70, amber 70–85, green > 85. */
export function pillarBand(score: number | null): PillarBand {
  if (score === null) return 'none';
  if (score > 85) return 'green';
  if (score >= 70) return 'amber';
  return 'red';
}

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

function bandFor(composite: number | null): VendorHealthComposite['band'] {
  if (composite === null) return 'no_data';
  if (composite >= 85) return 'strong';
  if (composite >= 70) return 'steady';
  return 'building';
}

const BAND_LABEL: Record<VendorHealthComposite['band'], string> = {
  strong: 'HEALTHY',
  steady: 'STEADY',
  building: 'BUILDING',
  no_data: 'NEW',
};

/**
 * Build the vendor-safe health composite from an activity-stats row.
 * Pure + deterministic — no I/O, unit-testable.
 */
export function buildVendorHealthComposite(
  stats: VendorHealthInputs | null,
): VendorHealthComposite {
  if (!stats) {
    const emptyPillars: HealthPillar[] = [
      { key: 'responsiveness', label: 'Responsiveness', score: null, hint: 'Reply to inquiries within 48 hours to build this up.' },
      { key: 'reputation', label: 'Reputation', score: null, hint: 'Ask your couples to leave a review.' },
      { key: 'demand', label: 'Demand', score: null, hint: 'See where demand is building in Demand Radar.' },
      { key: 'conversion', label: 'Conversion', score: null, hint: 'Turn inquiries into booked events.' },
      { key: 'delivery', label: 'Delivery', score: null, hint: 'Complete every booking you take on.' },
    ];
    return {
      pillars: emptyPillars,
      composite: null,
      band: 'no_data',
      bandLabel: BAND_LABEL.no_data,
      coaching:
        'Your health score fills in as couples find you, inquire, and book.',
    };
  }

  // Reputation: Bayesian average is on a 0–5 star scale → scale to 0–100.
  // Only rated once enough reviews have accrued (min-N), else null (excluded).
  const reviewCount = Number(stats.review_count ?? 0);
  const reputationScore =
    reviewCount >= REPUTATION_MIN_REVIEWS && stats.review_avg_bayesian != null
      ? clamp100((Number(stats.review_avg_bayesian) / 5) * 100)
      : null;

  // Conversion: inquiry→booking rate — only meaningful once the vendor has
  // actually booked something (otherwise 0% reads as a failure, not "no data").
  const bookedCount = Number(stats.finalized_booking_count ?? 0);
  const conversionScore =
    bookedCount > 0 && stats.inquiry_to_booking_pct != null
      ? clamp100(Number(stats.inquiry_to_booking_pct))
      : null;

  // Delivery: completion rate — likewise only once there's a booking to complete.
  const deliveryScore =
    bookedCount > 0 && stats.booking_completion_rate_pct != null
      ? clamp100(Number(stats.booking_completion_rate_pct))
      : null;

  const pillars: HealthPillar[] = [
    {
      key: 'responsiveness',
      label: 'Responsiveness',
      score: stats.response_rate_pct != null ? clamp100(Number(stats.response_rate_pct)) : null,
      hint: 'Share of inquiries you reply to within 48 hours.',
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
      // Demand has no clean 0–100 vendor signal yet — left explicitly empty so
      // the card can point the vendor to Demand Radar instead of inventing a
      // number. Excluded from the composite average.
      key: 'demand',
      label: 'Demand',
      score: null,
      hint: 'See where demand is building in Demand Radar.',
    },
    {
      key: 'conversion',
      label: 'Conversion',
      score: conversionScore,
      hint:
        conversionScore === null
          ? 'Rated once you win your first booking.'
          : 'Share of inquiries you turn into bookings.',
    },
    {
      key: 'delivery',
      label: 'Delivery',
      score: deliveryScore,
      hint:
        deliveryScore === null
          ? 'Rated once you have a booking to complete.'
          : 'Share of confirmed bookings you complete.',
    },
  ];

  const rated = pillars.filter((p): p is HealthPillar & { score: number } => p.score !== null);
  const composite =
    rated.length > 0
      ? Math.round(rated.reduce((acc, p) => acc + p.score, 0) / rated.length)
      : null;

  const band = bandFor(composite);

  // Coaching line — tuned to the weakest RATED pillar so it's always actionable.
  const weakest = rated.length > 0 ? rated.reduce((a, b) => (a.score <= b.score ? a : b)) : null;
  const coaching = buildCoaching(band, weakest);

  return {
    pillars,
    composite,
    band,
    bandLabel: BAND_LABEL[band],
    coaching,
  };
}

/** One vendor-facing coaching sentence, keyed off the weakest pillar. */
function buildCoaching(
  band: VendorHealthComposite['band'],
  weakest: (HealthPillar & { score: number }) | null,
): string {
  if (!weakest) {
    return 'Your health score fills in as couples find you, inquire, and book.';
  }
  if (band === 'strong') {
    return 'You’re in great shape — keep replying fast and delivering, and demand follows.';
  }
  switch (weakest.key) {
    case 'responsiveness':
      return 'Reply to more inquiries within the hour — fast repliers win the most couples.';
    case 'reputation':
      return 'Invite your past couples to leave a review — it’s your strongest trust signal.';
    case 'conversion':
      return 'Sharpen your packages and reply personally to close more of the inquiries you already get.';
    case 'delivery':
      return 'Deliver every booking you accept — reliability protects your ranking most.';
    default:
      return 'Small, steady improvements to how you reply and deliver lift your whole score.';
  }
}

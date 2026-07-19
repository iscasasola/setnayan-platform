/**
 * Vendor "Grow your business" recommendations — pure, deterministic builder for
 * the My Performance page (prototype "🚀 Grow your business · highest impact
 * first" block).
 *
 * Each card is derived from the vendor's OWN gaps in `vendor_activity_stats`, so
 * the list is honest — a vendor who already replies fast never sees "Reply
 * within the hour". Ranked highest-impact first by a coarse weight. This is a
 * presentation sibling of `vendor-profile-tips.ts` (which powers the fix-it
 * nudges) — kept separate so the growth cards can carry their own impact chip +
 * CTA copy + route without bending the tips shape.
 *
 * No ML — rules + weights, framework-free + unit-testable.
 */

export type GrowthRecKey =
  | 'reply_faster'
  | 'add_photos'
  | 'ask_reviews'
  | 'open_saturdays';

/** Coarse expected-impact band → the chip label + tone. */
export type GrowthImpact = 'high' | 'medium' | 'low';

export type GrowthRec = {
  key: GrowthRecKey;
  title: string;
  /** One-line benefit-framed reason. */
  body: string;
  impact: GrowthImpact;
  /** Short chip copy, e.g. "High impact". */
  impactLabel: string;
  ctaLabel: string;
  ctaHref: string;
  /** Higher = ranked first. */
  weight: number;
};

/** The subset of vendor_activity_stats the recs are derived from. */
export type GrowthRecStats = {
  avg_response_minutes: number | null;
  response_rate_pct: number | null;
  review_count: number | null;
  profile_completeness_pct: number | null;
  finalized_booking_count: number | null;
};

const IMPACT_LABEL: Record<GrowthImpact, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Quick win',
};

/**
 * Build the ranked growth recommendations from the vendor's own stats. When
 * there is no stats row yet (brand-new vendor), returns the universal starter
 * set so the block is never empty — every card still routes somewhere real.
 */
export function buildGrowthRecs(stats: GrowthRecStats | null): GrowthRec[] {
  const recs: GrowthRec[] = [];

  const responseRate = Number(stats?.response_rate_pct ?? 0);
  const avgMinutes = Number(stats?.avg_response_minutes ?? 0);
  const reviewCount = Number(stats?.review_count ?? 0);
  const completeness = Number(stats?.profile_completeness_pct ?? 0);
  const hasStats = stats !== null;

  // Reply within the hour — fires when reply time is slow OR response rate is
  // sub-90%. avg===0 means "no data yet" (not instant), so we lean on the rate
  // in that case. Highest lever: fast repliers earn the First-Look head-start.
  if (!hasStats || responseRate < 90 || avgMinutes > 60) {
    const weight = !hasStats ? 70 : Math.max(90 - responseRate, avgMinutes > 60 ? 40 : 0) + 30;
    recs.push({
      key: 'reply_faster',
      title: 'Reply within the hour',
      body: 'Fast repliers earn the First-Look head-start with couples and win more bookings.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Open messages',
      ctaHref: '/vendor-dashboard/messages',
      weight,
    });
  }

  // Add recent photos — fires when the profile isn't ~complete. Complete
  // profiles get roughly 3× more inquiries.
  if (!hasStats || completeness < 90) {
    recs.push({
      key: 'add_photos',
      title: 'Add recent photos',
      body: hasStats
        ? `Your profile is ${Math.round(completeness)}% complete. Fresh photos get about 3× more inquiries.`
        : 'A complete profile with fresh photos gets about 3× more inquiries.',
      impact: 'high',
      impactLabel: IMPACT_LABEL.high,
      ctaLabel: 'Edit profile',
      ctaHref: '/vendor-dashboard/profile',
      weight: !hasStats ? 60 : 100 - completeness,
    });
  }

  // Ask for reviews — fires when reviews are thin. Reviews are the strongest
  // trust signal and lift the Reputation pillar.
  if (!hasStats || reviewCount < 5) {
    recs.push({
      key: 'ask_reviews',
      title: 'Ask for reviews',
      body:
        reviewCount > 0
          ? `You have ${reviewCount} review${reviewCount === 1 ? '' : 's'}. Invite past couples to review you — it lifts your rating and trust.`
          : 'Invite your past couples to review you — reviews are your strongest trust signal.',
      impact: 'medium',
      impactLabel: IMPACT_LABEL.medium,
      ctaLabel: 'See reviews',
      ctaHref: '/vendor-dashboard/reviews',
      weight: (5 - Math.min(reviewCount, 5)) * 8 + 10,
    });
  }

  // Open more Saturdays — a calendar-availability nudge. There's no per-day
  // open-slot signal wired into this surface yet, so it's shown as a steady
  // low-weight prompt that routes to the calendar rather than claiming a number.
  recs.push({
    key: 'open_saturdays',
    title: 'Open more Saturdays',
    body: 'Saturdays are the most-requested wedding day. Opening more dates puts you in front of more couples.',
    impact: 'low',
    impactLabel: IMPACT_LABEL.low,
    ctaLabel: 'Open calendar',
    ctaHref: '/vendor-dashboard/calendar',
    weight: 5,
  });

  return recs.sort((a, b) => b.weight - a.weight);
}

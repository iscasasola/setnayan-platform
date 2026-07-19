/**
 * Vendor profile "fix-it tips" — pure, deterministic builder (Wave 1 · spec B,
 * VENDOR_TIERS_AND_BENEFITS.md §8). Turns the quality-score component metrics
 * (from `vendor_activity_stats`, already fetched by vendor-stats-panel) into a
 * RANKED, actionable checklist: the top drags on the score, each with a concrete
 * current→target and an inquiry-lift reason. No ML — rules + weights, so it's
 * framework-free and unit-testable. The panel maps `key`→icon and renders the
 * top few; when the list is empty the score is already strong → the card hides.
 *
 * Clears the `Profile Score & Fix-It Tips` SOON (Data lens) once wired.
 */

export type ProfileTipKey =
  | 'profile'
  | 'reply_time'
  | 'response_rate'
  | 'reviews'
  | 'completion'
  | 'conversion';

export type ProfileTip = {
  key: ProfileTipKey;
  /** Concrete, vendor-facing: current value → target + why it lifts inquiries. */
  message: string;
  /** Higher = bigger drag on the score / bigger inquiry lift. Used to rank. */
  weight: number;
};

/** The subset of `vendor_activity_stats` the tips are derived from. */
export type ProfileTipStats = {
  avg_response_minutes: number;
  response_rate_pct: number;
  review_count: number;
  profile_completeness_pct: number;
  booking_completion_rate_pct: number;
  inquiry_to_booking_pct: number;
  finalized_booking_count: number;
};

/** How many tips the panel shows at once. */
export const MAX_PROFILE_TIPS = 4;

function fmtDuration(minutes: number): string {
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes)}m`;
}

/**
 * Build the ranked fix-it tips. Each rule fires only when the metric is a real
 * drag (and there's enough data to be honest — e.g. avg_response_minutes === 0
 * is "not enough data yet", not "instant", so the reply-time tip is skipped).
 * Returns the top `MAX_PROFILE_TIPS`, highest-lift first. Empty = strong profile.
 */
export function buildProfileTips(s: ProfileTipStats): ProfileTip[] {
  const tips: ProfileTip[] = [];

  // Profile completeness — usually the single biggest inquiry lever.
  if (s.profile_completeness_pct < 90) {
    tips.push({
      key: 'profile',
      message: `Your profile is ${Math.round(
        s.profile_completeness_pct,
      )}% complete — add more photos and service details. Complete profiles get about 3× more inquiries.`,
      weight: 100 - s.profile_completeness_pct,
    });
  }

  // Reply time — a strong ranking signal (First-Look). avg===0 = no data → skip.
  if (s.avg_response_minutes > 120) {
    tips.push({
      key: 'reply_time',
      message: `You reply in about ${fmtDuration(
        s.avg_response_minutes,
      )} — aim under 2 hours. Fast repliers earn the First-Look head-start and win more couples.`,
      weight: Math.min(90, (s.avg_response_minutes - 120) / 6 + 40),
    });
  }

  // Response rate — hold the ranking floor.
  if (s.response_rate_pct < 90) {
    tips.push({
      key: 'response_rate',
      message: `You answer ${Math.round(
        s.response_rate_pct,
      )}% of inquiries — aim for 90%+. Skipped inquiries drop your ranking with couples.`,
      weight: 90 - s.response_rate_pct,
    });
  }

  // Reviews — the Bayesian rating needs volume to move.
  if (s.review_count < 5) {
    tips.push({
      key: 'reviews',
      message:
        s.finalized_booking_count > 0
          ? `You have ${s.review_count} review${
              s.review_count === 1 ? '' : 's'
            } — invite your past couples to review you. More reviews raise your rating and trust.`
          : `No reviews yet — finish your first bookings, then invite couples to review you. Reviews are your strongest trust signal.`,
      weight: (5 - s.review_count) * 8,
    });
  }

  // Completion rate — protect the rating (only meaningful once you've booked).
  if (s.finalized_booking_count > 0 && s.booking_completion_rate_pct < 90) {
    tips.push({
      key: 'completion',
      message: `Your completion rate is ${Math.round(
        s.booking_completion_rate_pct,
      )}% — deliver every booking you accept. Cancellations hurt your ranking most.`,
      weight: (90 - s.booking_completion_rate_pct) * 0.8,
    });
  }

  // Conversion — close more of what you already get.
  if (
    s.finalized_booking_count > 0 &&
    s.inquiry_to_booking_pct > 0 &&
    s.inquiry_to_booking_pct < 20
  ) {
    tips.push({
      key: 'conversion',
      message: `You book ${Math.round(
        s.inquiry_to_booking_pct,
      )}% of inquiries — sharpen your packages and reply personally to close more. Small gains here compound.`,
      weight: (20 - s.inquiry_to_booking_pct) * 1.5,
    });
  }

  return tips.sort((a, b) => b.weight - a.weight).slice(0, MAX_PROFILE_TIPS);
}

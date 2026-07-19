/**
 * Reputation analytics reader (vendor "My Performance" · Phase B family 3).
 *
 * Bundles two ownership-gated SECURITY DEFINER RPCs (migration
 * 20270423213000_vendor_reputation_analytics_rpcs): rating summary + reply
 * coverage + star distribution, and monthly rating trend / review velocity.
 * OWN-BUSINESS only. Pro tier (canSeePerformanceAdvanced), page-enforced.
 *
 * Sentiment/themes is deliberately absent — needs_capture (no derived column).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ReviewCoverage = {
  totalReviews: number;
  repliedCount: number;
  coveragePct: number | null;
  avgReplyHours: number | null;
  avgRating: number | null;
  distribution: { five: number; four: number; three: number; two: number; one: number };
};

/** One month of review activity. avgRating is null for months with no reviews. */
export type ReviewMonthPoint = {
  month: string;
  label: string;
  count: number;
  avgRating: number | null;
};

export type ReputationAnalytics = {
  coverage: ReviewCoverage;
  monthly: ReviewMonthPoint[];
};

const EMPTY_COVERAGE: ReviewCoverage = {
  totalReviews: 0,
  repliedCount: 0,
  coveragePct: null,
  avgReplyHours: null,
  avgRating: null,
  distribution: { five: 0, four: 0, three: 0, two: 0, one: 0 },
};

const AXIS_FMT = new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' });

function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : AXIS_FMT.format(d);
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchVendorReputationAnalytics(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sinceIso?: string | null,
): Promise<ReputationAnalytics> {
  const [covRes, monRes] = await Promise.all([
    supabase.rpc('vendor_review_coverage', {
      p_vendor_profile_id: vendorProfileId,
      p_since: sinceIso ?? null,
    }),
    supabase.rpc('vendor_review_monthly', {
      p_vendor_profile_id: vendorProfileId,
      p_months: 12,
    }),
  ]);

  if (covRes.error) {
    // eslint-disable-next-line no-console
    console.error('[vendor-reputation-analytics] coverage rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: covRes.error.message,
    });
  }
  if (monRes.error) {
    // eslint-disable-next-line no-console
    console.error('[vendor-reputation-analytics] monthly rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: monRes.error.message,
    });
  }

  const c = (covRes.error ? null : ((covRes.data ?? []) as Record<string, number | string | null>[])[0]) ?? null;

  const coverage: ReviewCoverage = c
    ? {
        totalReviews: Number(c.total_reviews ?? 0),
        repliedCount: Number(c.replied_count ?? 0),
        coveragePct: num(c.coverage_pct),
        avgReplyHours: num(c.avg_reply_hours),
        avgRating: num(c.avg_rating),
        distribution: {
          five: Number(c.five_star ?? 0),
          four: Number(c.four_star ?? 0),
          three: Number(c.three_star ?? 0),
          two: Number(c.two_star ?? 0),
          one: Number(c.one_star ?? 0),
        },
      }
    : EMPTY_COVERAGE;

  const monthlyRows = (monRes.error ? [] : (monRes.data ?? [])) as {
    month_start: string;
    review_count: number | null;
    avg_rating: number | string | null;
  }[];

  const monthly: ReviewMonthPoint[] = monthlyRows.map((r) => ({
    month: r.month_start,
    label: monthLabel(r.month_start),
    count: Number(r.review_count ?? 0),
    avgRating: num(r.avg_rating),
  }));

  return { coverage, monthly };
}

/** Hours → "3h" / "2.5 days". null → em dash handled by caller. */
export function formatReplyLatency(hours: number | null): string {
  if (hours === null || hours < 0) return '—';
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

import {
  Activity,
  Award,
  BookOpen,
  MessageSquare,
  Star,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchFirstLookConfig, isFirstLookEligible } from '@/lib/firstlook';
import { buildProfileTips, type ProfileTipKey } from '@/lib/vendor-profile-tips';

/**
 * vendor-stats-panel.tsx — Vendor performance dashboard panel.
 *
 * WHY (2026-06-17 · PR #1659): Follow-on to the `vendor_activity_stats`
 * migration (PR #1650) and `lib/vendor-activity.ts` score-recomputation
 * module (PR #1653). This panel gives vendors visibility into the metrics
 * that drive their quality score and search ranking — and gives them
 * concrete nudges to improve them.
 *
 * DESIGN DECISIONS:
 *   - Server component only. All data is server-fetched in one query
 *     (LEFT JOIN semantics via `.maybeSingle()` → graceful null if no
 *     row yet). No client-side loading state.
 *   - `platform_health_score` is HQ-internal and is NEVER surfaced here.
 *     Only `quality_score` (the search-ranking signal) and public-facing
 *     metrics are shown.
 *   - `avg_response_minutes === 0` is treated as "not enough data yet"
 *     because the `chat_threads.vendor_first_reply_at` column that feeds
 *     this is still being populated (pending migration). Show "—" to avoid
 *     misleading vendors with a false "0 minutes" reading.
 *   - Experience badge tiers:
 *       New to Setnayan (0) · Established (1-10) · Experienced (11-50) ·
 *       Expert (51-200) · Elite (200+)
 *   - Anonymous benchmark placeholder: shows "Benchmark data coming soon"
 *     until aggregate seeded data exists for percentile computation.
 *
 * PLACED IN: apps/web/app/vendor-dashboard/page.tsx (home overview)
 * as a new section below the stat tiles strip. Natural home since the
 * home page already shows the vendor's "business health at a glance."
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VendorActivityStatsRow = {
  quality_score: number;
  couple_trust_score: number;
  avg_response_minutes: number;
  response_rate_pct: number;
  booking_completion_rate_pct: number;
  vendor_cancellation_count: number;
  inquiry_to_booking_pct: number;
  finalized_booking_count: number;
  review_avg_raw: number | null;
  review_avg_bayesian: number | null;
  review_count: number;
  last_active_at: string | null;
  profile_completeness_pct: number;
  updated_at: string | null;
};

type ExperienceTier = {
  label: string;
  nextTierLabel: string | null;
  nextTierCount: number | null;
  color: string;
  bg: string;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Format average-response-minutes into a human-readable "Xh Ym" string.
 * Returns null if minutes is 0 or negative (stub / no data).
 */
function formatResponseTime(minutes: number): string | null {
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `~${m}m`;
  if (m === 0) return `~${h}h`;
  return `~${h}h ${m}m`;
}

/**
 * Derive experience tier badge from finalized_booking_count.
 * Tiers: New to Setnayan (0) · Established (1–10) · Experienced (11–50) · Expert (51–200) · Elite (200+)
 */
function getExperienceTier(count: number): ExperienceTier {
  if (count >= 200) {
    return {
      label: 'Elite',
      nextTierLabel: null,
      nextTierCount: null,
      color: 'text-amber-800',
      bg: 'bg-amber-100',
    };
  }
  if (count >= 51) {
    return {
      label: 'Expert',
      nextTierLabel: 'Elite',
      nextTierCount: 200 - count,
      color: 'text-violet-800',
      bg: 'bg-violet-100',
    };
  }
  if (count >= 11) {
    return {
      label: 'Experienced',
      nextTierLabel: 'Expert',
      nextTierCount: 51 - count,
      color: 'text-emerald-800',
      bg: 'bg-emerald-100',
    };
  }
  if (count >= 1) {
    return {
      label: 'Established',
      nextTierLabel: 'Experienced',
      nextTierCount: 11 - count,
      color: 'text-blue-800',
      bg: 'bg-blue-100',
    };
  }
  return {
    label: 'New to Setnayan',
    nextTierLabel: 'Established',
    nextTierCount: 1 - count,
    color: 'text-ink/70',
    bg: 'bg-ink/8',
  };
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

/**
 * Fetches the `vendor_activity_stats` row for the given vendor profile ID.
 * Returns null if no row exists yet (the recompute hasn't run for this vendor).
 * Uses LEFT JOIN semantics via `.maybeSingle()` — graceful degradation.
 */
async function fetchVendorActivityStats(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorActivityStatsRow | null> {
  const { data, error } = await supabase
    .from('vendor_activity_stats')
    .select(
      [
        'quality_score',
        'couple_trust_score',
        'avg_response_minutes',
        'response_rate_pct',
        'booking_completion_rate_pct',
        'vendor_cancellation_count',
        'inquiry_to_booking_pct',
        'finalized_booking_count',
        'review_avg_raw',
        'review_avg_bayesian',
        'review_count',
        'last_active_at',
        'profile_completeness_pct',
        'updated_at',
      ].join(','),
    )
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();

  if (error) {
    // Non-fatal: new vendors won't have a stats row yet. Log for Sentry
    // capture but don't crash the page.
    // eslint-disable-next-line no-console
    console.error('[VendorStatsPanel] vendor_activity_stats fetch failed', {
      vendor_profile_id: vendorProfileId,
      error: error.message,
    });
    return null;
  }

  // Supabase maybeSingle() returns null (not an error) when no row exists.
  return data as VendorActivityStatsRow | null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  sub,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  empty?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-2 flex items-center gap-1.5 text-ink/55">
        {icon}
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          {label}
        </span>
      </div>
      <p
        className={`text-2xl font-semibold tabular-nums ${
          empty ? 'text-ink/35' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-1 text-xs text-ink/55">{sub}</p>
      ) : null}
    </div>
  );
}

function QualityScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const color =
    pct >= 75
      ? 'bg-emerald-500'
      : pct >= 50
        ? 'bg-amber-400'
        : 'bg-terracotta';

  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-2 flex items-center gap-1.5 text-ink/55">
        <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Quality score
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tabular-nums text-ink">{pct}</p>
        <span className="mb-1 font-mono text-[10px] text-ink/45">/ 100</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Quality score: ${pct} out of 100`}
        />
      </div>
      <p className="mt-1.5 text-xs text-ink/55">Your search ranking signal</p>
    </div>
  );
}

function ExperienceBadge({ count }: { count: number }) {
  const tier = getExperienceTier(count);
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-2 flex items-center gap-1.5 text-ink/55">
        <Award className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Experience badge
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 items-center rounded-full px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] ${tier.bg} ${tier.color}`}
        >
          {tier.label}
        </span>
        <span className="font-mono text-sm tabular-nums text-ink">
          {count} completed
        </span>
      </div>
      {tier.nextTierLabel && tier.nextTierCount !== null ? (
        <p className="mt-1.5 text-xs text-ink/55">
          {tier.nextTierCount} more until{' '}
          <span className="font-medium">{tier.nextTierLabel}</span>
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink/55">
          Top tier — keep the momentum
        </p>
      )}
    </div>
  );
}

function ReviewScoreCard({
  reviewAvgBayesian,
  reviewAvgRaw,
  reviewCount,
}: {
  reviewAvgBayesian: number | null;
  reviewAvgRaw: number | null;
  reviewCount: number;
}) {
  const hasData = reviewCount > 0 && reviewAvgRaw !== null;
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-2 flex items-center gap-1.5 text-ink/55">
        <Star className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Review score
        </span>
      </div>
      {hasData ? (
        <>
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {reviewAvgBayesian !== null
              ? reviewAvgBayesian.toFixed(1)
              : (reviewAvgRaw ?? 0).toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-ink/55">
            {reviewAvgBayesian !== null
              ? `${reviewAvgBayesian.toFixed(1)} Bayesian`
              : '—'}
            {reviewAvgRaw !== null
              ? ` · ${reviewAvgRaw.toFixed(1)} raw`
              : ''}
            {` · ${reviewCount} review${reviewCount === 1 ? '' : 's'}`}
          </p>
        </>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums text-ink/35">—</p>
          <p className="mt-1 text-xs text-ink/55">No reviews yet</p>
        </>
      )}
    </div>
  );
}

function NudgeCard({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <span className="mt-0.5 shrink-0 text-amber-600">{icon}</span>
      <p className="text-sm text-amber-900">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / loading state
// ---------------------------------------------------------------------------

function EmptyStatsPanel() {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Performance
        </h2>
      </div>
      <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-6 text-center">
        <Activity
          className="mx-auto mb-2 h-6 w-6 text-ink/30"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="text-sm font-medium text-ink/65">
          Calculating your performance stats…
        </p>
        <p className="mt-1 text-xs text-ink/45">
          Stats appear after your first couple interaction. Check back here once
          you start getting inquiries.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main export — server component
// ---------------------------------------------------------------------------

export async function VendorStatsPanel({
  supabase,
  vendorProfileId,
  finalized_booking_count: bookedCount,
}: {
  supabase: SupabaseClient;
  vendorProfileId: string;
  /** Pass-through from the home page's already-loaded data when available,
   *  avoids a duplicate query. Falls back to the stats row value. */
  finalized_booking_count?: number;
}) {
  const stats = await fetchVendorActivityStats(supabase, vendorProfileId);

  if (!stats) {
    return <EmptyStatsPanel />;
  }

  const responseTimeLabel = formatResponseTime(stats.avg_response_minutes);

  // First-Look Window (Wave 2) — the vendor earns the marketplace head-start +
  // "Replies fast" badge when its responsiveness clears the admin SLA + rate
  // floor (lib/firstlook, read defensively — the SLA column may still be
  // mid-apply, falls back to {24h, 0.10}). "Earned" vs "At-risk" mirrors the
  // exact gate the couple-facing matcher uses, so the chip is honest.
  const firstLook = await fetchFirstLookConfig(supabase);
  const firstLookEarned = isFirstLookEligible(
    {
      avg_response_minutes: stats.avg_response_minutes,
      response_rate_pct: stats.response_rate_pct,
    },
    firstLook.slaHours,
  );
  // Use passed-in count (already queried by home page) or fall back to
  // stats row so we don't add an extra DB round-trip.
  const completedCount =
    bookedCount !== undefined ? bookedCount : stats.finalized_booking_count;

  // Fix-it tips (Wave 1 · spec B) — a ranked, actionable checklist of the top
  // drags on the quality score, derived deterministically from the same stats
  // row (lib/vendor-profile-tips.ts). Replaces the old 3-condition nudges with
  // concrete current→target + inquiry-lift framing, ranked by impact. Empty =
  // strong profile → the card hides.
  const TIP_ICON: Record<ProfileTipKey, React.ReactNode> = {
    profile: <User className="h-4 w-4" strokeWidth={1.75} />,
    reply_time: <Zap className="h-4 w-4" strokeWidth={1.75} />,
    response_rate: <MessageSquare className="h-4 w-4" strokeWidth={1.75} />,
    reviews: <Star className="h-4 w-4" strokeWidth={1.75} />,
    completion: <BookOpen className="h-4 w-4" strokeWidth={1.75} />,
    conversion: <TrendingUp className="h-4 w-4" strokeWidth={1.75} />,
  };
  const tips = buildProfileTips(stats);

  const lastUpdatedLabel = stats.updated_at
    ? new Date(stats.updated_at).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <h2
            className="font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--m-slate)' }}
          >
            Performance
          </h2>
          {/* First-Look chip — Earned (within SLA + rate floor) floats this
              vendor in marketplace ranking; At-risk is a nudge, not alarm. */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              firstLookEarned
                ? 'bg-emerald-500/12 text-emerald-700'
                : 'bg-ink/8 text-ink/55'
            }`}
            title={
              firstLookEarned
                ? `First-Look: Earned — you reply within ${firstLook.slaHours}h, so you get a ranking head-start with couples.`
                : `First-Look: At-risk — reply within ${firstLook.slaHours}h and keep your response rate up to earn a ranking head-start.`
            }
          >
            <Zap className="h-3 w-3" strokeWidth={2} aria-hidden />
            First-Look: {firstLookEarned ? 'Earned' : 'At-risk'}
          </span>
        </div>
        {lastUpdatedLabel ? (
          <span className="text-xs text-ink/40">
            Updated {lastUpdatedLabel}
          </span>
        ) : null}
      </div>

      {/* 6-metric grid: 2 columns mobile · 3 sm · 6 lg */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Response rate */}
        <StatCard
          icon={
            <MessageSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          }
          label="Response rate"
          value={`${stats.response_rate_pct}%`}
          sub="of inquiries replied within 48h"
        />

        {/* Avg reply time */}
        <StatCard
          icon={<Zap className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Avg reply time"
          value={responseTimeLabel ?? '—'}
          sub={
            responseTimeLabel ? 'median first reply' : 'Not enough data yet'
          }
          empty={!responseTimeLabel}
        />

        {/* Review score — spans wider because it has more detail */}
        <ReviewScoreCard
          reviewAvgBayesian={stats.review_avg_bayesian}
          reviewAvgRaw={stats.review_avg_raw}
          reviewCount={stats.review_count}
        />

        {/* Booking completion rate */}
        <StatCard
          icon={
            <BookOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          }
          label="Completion rate"
          value={`${stats.booking_completion_rate_pct}%`}
          sub="of confirmed bookings completed"
        />

        {/* Inquiry-to-booking */}
        <StatCard
          icon={
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          }
          label="Inquiry → booking"
          value={`${stats.inquiry_to_booking_pct}%`}
          sub="of inquiries became bookings"
        />

        {/* Experience badge */}
        <ExperienceBadge count={completedCount} />
      </div>

      {/* Quality score progress bar (full width) */}
      <QualityScoreBar score={stats.quality_score} />

      {/* Fix-it tips — ranked, actionable drags on the quality score */}
      {tips.length > 0 ? (
        <div className="space-y-2">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: 'var(--m-slate)' }}
          >
            Fix-it tips
          </p>
          {tips.map((tip) => (
            <NudgeCard key={tip.key} icon={TIP_ICON[tip.key]} message={tip.message} />
          ))}
        </div>
      ) : null}

      {/* Anonymous benchmark placeholder */}
      <div
        className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.02] p-4"
      >
        <Activity
          className="h-4 w-4 shrink-0 text-ink/35"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-xs text-ink/45">
          Benchmark data coming soon — you&rsquo;ll see how you rank against other
          vendors in your category.
        </p>
      </div>
    </section>
  );
}

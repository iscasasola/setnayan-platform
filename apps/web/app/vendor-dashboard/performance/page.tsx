import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Gauge, Radar, Filter, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRole, canManageVendor } from '@/lib/vendor-role';
import {
  buildVendorHealthComposite,
  type VendorHealthInputs,
} from '@/lib/vendor-health-composite';
import { fetchVendorSourceAttribution } from '@/lib/vendor-source-attribution';
import { VendorStatsPanel } from '../_components/vendor-stats-panel';
import { HealthCompositeCard } from './_components/health-composite-card';
import { RoiAttributionCard } from './_components/roi-attribution-card';

export const metadata = { title: 'My Performance · Vendor · Setnayan' };

export const dynamic = 'force-dynamic';

type RangeKey = 'quarter' | 'half' | 'year' | 'all';

const RANGE_OPTIONS: { value: RangeKey; label: string; days: number | null }[] = [
  { value: 'quarter', label: 'Past 12 weeks', days: 84 },
  { value: 'half', label: 'Past 6 months', days: 182 },
  { value: 'year', label: 'Past 12 months', days: 365 },
  { value: 'all', label: 'All time', days: null },
];

/**
 * /vendor-dashboard/performance — "My Performance" cockpit (Phase 6).
 *
 * The standalone landing for the My Performance nav group. It COMPOSES the
 * already-shipped analytics surfaces (Demand Radar + Funnel are linked
 * drill-downs) and adds two net-new panels:
 *   • Business-health composite — five vendor-SAFE pillars (never the
 *     HQ-internal platform_health_score).
 *   • App-vs-Import ROI attribution — how much booked business Setnayan
 *     sourced vs. business the vendor brought in off-platform.
 *
 * OWNER/ADMIN ONLY: this surfaces money figures, so it mirrors the
 * Earnings/Demand gate — 'performance' is absent from
 * VENDOR_SCOPED_NAV_ITEM_KEYS, and the page re-checks canManageVendor()
 * server-side. Agents/viewers are redirected to the dashboard root.
 */
export default async function VendorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Owner/admin only — the ROI panel surfaces booking revenue figures.
  const role = await resolveVendorRole(supabase, user.id);
  if (!canManageVendor(role)) redirect('/vendor-dashboard');

  const range: RangeKey =
    search.range === 'quarter' ||
    search.range === 'half' ||
    search.range === 'year' ||
    search.range === 'all'
      ? (search.range as RangeKey)
      : 'year';
  const days = RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 365;
  let sinceIso: string | null = null;
  if (days !== null) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    sinceIso = since.toISOString();
  }

  // Health composite — reuses the same vendor-facing activity-stats row the
  // home VendorStatsPanel reads. maybeSingle() → graceful null for new vendors.
  const { data: statsRow } = await supabase
    .from('vendor_activity_stats')
    .select(
      'quality_score, response_rate_pct, booking_completion_rate_pct, profile_completeness_pct, review_avg_bayesian, review_count',
    )
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const health = buildVendorHealthComposite(
    (statsRow as VendorHealthInputs | null) ?? null,
  );

  // App-vs-Import ROI — SECURITY DEFINER RPC, ownership-gated in SQL. The date
  // window scopes the booking attribution; health is a live all-time snapshot.
  const attribution = await fetchVendorSourceAttribution(
    supabase,
    profile.vendor_profile_id,
    sinceIso,
  );

  return (
    <section className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Gauge aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Vendor dashboard · My Performance
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          My Performance
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Your business at a glance — how healthy your storefront is, and how
          much of your booked work Setnayan sourced for you. Drill into where
          demand is building and how couples move from finding you to booking
          you below.
        </p>
      </header>

      {/* Range selector — scopes the ROI attribution window. */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="range"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Booking window
        </label>
        <select
          id="range"
          name="range"
          defaultValue={range}
          className="input-field h-9 max-w-[14rem] py-0 text-sm"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Apply
        </button>
      </form>

      {/* Business-health composite (vendor-safe, five pillars). */}
      <HealthCompositeCard health={health} />

      {/* App-vs-Import ROI attribution. */}
      <RoiAttributionCard attribution={attribution} />

      {/* Detailed metric tiles — moved here from Home (its natural home).
       *  Server component; self-fetches vendor_activity_stats + the First-Look
       *  gate; degrades gracefully for brand-new vendors. */}
      <VendorStatsPanel
        supabase={supabase}
        vendorProfileId={profile.vendor_profile_id}
      />

      {/* Drill-down links to the already-shipped analytics surfaces. */}
      <section className="space-y-3">
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Go deeper
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/vendor-dashboard/demand"
            className="group flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40"
          >
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/10 text-terracotta">
              <Radar className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-base font-semibold text-ink">
                Demand Radar
                <ArrowRight
                  className="h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 block text-xs text-ink/55">
                Where demand is building in your area — by month and by the looks
                couples are choosing.
              </span>
            </span>
          </Link>

          <Link
            href="/vendor-dashboard/funnel"
            className="group flex items-start gap-3 rounded-2xl border border-ink/10 bg-cream p-4 transition-colors hover:border-terracotta/40"
          >
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/10 text-terracotta">
              <Filter className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-base font-semibold text-ink">
                Quote-to-Booking Funnel
                <ArrowRight
                  className="h-4 w-4 text-ink/30 transition-transform group-hover:translate-x-0.5 group-hover:text-terracotta"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 block text-xs text-ink/55">
                How couples move from finding you to booking you — views to
                inquiries to quotes to bookings.
              </span>
            </span>
          </Link>
        </div>
      </section>
    </section>
  );
}

import { redirect } from 'next/navigation';
import { Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canSeePerformanceTrends } from '@/lib/vendor-tier-caps';
import { isVendorFeatureGateEnabled, resolveVendorTier } from '@/lib/vendor-feature-gate';
import { VendorTierGate } from '../_components/tier-gate';
import {
  fetchVendorFunnelTotals,
  buildFunnelSteps,
  minNOk,
  FUNNEL_MIN_N,
  BOOKED_EVENT_VENDOR_STATUSES,
  type FunnelStep,
} from '@/lib/vendor-funnel';

export const metadata = { title: 'Funnel · Vendor' };

export const dynamic = 'force-dynamic';

type RangeKey = 'week' | 'month' | 'quarter';

const RANGE_OPTIONS: { value: RangeKey; label: string; days: number }[] = [
  { value: 'week', label: 'This week', days: 7 },
  { value: 'month', label: 'Past 4 weeks', days: 28 },
  { value: 'quarter', label: 'Past 12 weeks', days: 84 },
];

/** Friendly labels for the event_vendors.source axis. Unknown sources fall
 *  back to a humanized version of the raw key. */
const SOURCE_LABELS: Record<string, string> = {
  profile_direct: 'Profile (direct)',
  host_manual: 'Added by couple',
  host_marketplace_search: 'Marketplace search',
  explore_card: 'Explore card',
  auto_cascade_from_finalize: 'Auto-added (you locked a related vendor)',
};

function humanizeSource(src: string | null): string {
  if (!src) return 'Unattributed';
  return SOURCE_LABELS[src] ?? src.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type Props = { searchParams: Promise<{ range?: string }> };

export default async function VendorFunnelPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const tier = await resolveVendorTier(supabase, profile.vendor_profile_id);
  if (isVendorFeatureGateEnabled() && !canSeePerformanceTrends(tier)) {
    return (
      <VendorTierGate
        feature="Quote-to-Booking Funnel"
        requiredTier="solo"
        blurb="Your views → inquiries → quotes → booked trend over time, sliced by where couples found you. Your performance analytics start with Solo."
        icon={<Filter aria-hidden className="h-5 w-5" strokeWidth={1.75} />}
      />
    );
  }

  const range: RangeKey =
    search.range === 'week' || search.range === 'quarter' || search.range === 'month'
      ? (search.range as RangeKey)
      : 'month';
  const days = RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 28;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  // ── Whole-funnel totals (the vendor always sees their OWN totals) ──────────
  // Reads run on the RLS-scoped session client: vendor_profile_views is gated to
  // current_vendor_profile_ids(), and chat_threads / vendor_proposals /
  // event_vendors already RLS-scope to the vendor's own rows.
  const totals = await fetchVendorFunnelTotals(
    supabase,
    profile.vendor_profile_id,
    sinceIso,
  );
  const steps = buildFunnelSteps(totals);

  // ── Booked, sliced by source (event_vendors.source) ───────────────────────
  // The source axis lives on event_vendors. Each slice is min-N suppressed:
  // a source with fewer than FUNNEL_MIN_N bookings reads as "—" so a thin
  // segment can't read as a reliable signal (behavioral-data lock).
  const { data: bookedRows } = await supabase
    .from('event_vendors')
    .select('source')
    .eq('marketplace_vendor_id', profile.vendor_profile_id)
    .in('status', BOOKED_EVENT_VENDOR_STATUSES as unknown as string[])
    .gte('created_at', sinceIso);

  const bySource = new Map<string, number>();
  for (const row of (bookedRows ?? []) as { source: string | null }[]) {
    const key = row.source ?? '(unattributed)';
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }
  const sourceSlices = [...bySource.entries()]
    .map(([key, count]) => ({
      key,
      label: humanizeSource(key === '(unattributed)' ? null : key),
      count,
      shown: minNOk(count),
    }))
    .sort((a, b) => b.count - a.count);

  // Views, also sliced by source (vendor_profile_views.source) — gives the
  // vendor a read on WHERE their top-of-funnel traffic comes from.
  const { data: viewRows } = await supabase
    .from('vendor_profile_views')
    .select('source')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .gte('viewed_at', sinceIso);
  const viewsBySource = new Map<string, number>();
  for (const row of (viewRows ?? []) as { source: string | null }[]) {
    const key = row.source ?? '(unattributed)';
    viewsBySource.set(key, (viewsBySource.get(key) ?? 0) + 1);
  }
  const viewSourceSlices = [...viewsBySource.entries()]
    .map(([key, count]) => ({
      key,
      label: humanizeSource(key === '(unattributed)' ? null : key),
      count,
      shown: minNOk(count),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Filter aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Quote-to-Booking Funnel</h1>
        </div>
        <p className="max-w-prose text-sm text-ink/60">
          How couples move from finding you to booking you — profile views →
          inquiries → quotes sent → booked. Computed live from your own activity.
        </p>
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <label
          htmlFor="range"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
        >
          Range
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
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Since {sinceIso.slice(0, 10)}
        </span>
      </form>

      <FunnelTable steps={steps} />

      {/* Booked, sliced by where the couple came from. */}
      <section className="mt-6 rounded-xl border border-ink/10 bg-cream p-5">
        <header className="mb-3 space-y-0.5">
          <h2 className="text-base font-semibold text-ink">Bookings by source</h2>
          <p className="text-xs text-ink/55">
            Where your booked couples first found you. Sources with fewer than{' '}
            {FUNNEL_MIN_N} bookings are hidden to keep the read reliable.
          </p>
        </header>
        <SourceSliceTable
          slices={sourceSlices}
          emptyText="No bookings in this window yet."
        />
      </section>

      {/* Views, sliced by source. */}
      <section className="mt-6 rounded-xl border border-ink/10 bg-cream p-5">
        <header className="mb-3 space-y-0.5">
          <h2 className="text-base font-semibold text-ink">Profile views by source</h2>
          <p className="text-xs text-ink/55">
            Where your top-of-funnel traffic comes from. Thin sources (under{' '}
            {FUNNEL_MIN_N}) are hidden.
          </p>
        </header>
        <SourceSliceTable
          slices={viewSourceSlices}
          emptyText="No profile views in this window yet."
        />
      </section>
    </div>
  );
}

function FunnelTable({ steps }: { steps: FunnelStep[] }) {
  const maxCount = Math.max(1, ...steps.map((s) => s.count));
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="py-2 font-medium">Stage</th>
              <th className="py-2 font-medium">Count</th>
              <th className="py-2 font-medium">vs previous</th>
              <th className="py-2 font-medium">Bar</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, idx) => {
              const prev = idx > 0 ? steps[idx - 1] : null;
              const conv = prev && prev.count > 0 ? (s.count / prev.count) * 100 : null;
              const widthPct = Math.max(1, Math.round((s.count / maxCount) * 100));
              return (
                <tr key={s.label} className="border-t border-ink/5">
                  <td className="py-2 text-ink/85">{s.label}</td>
                  <td className="py-2 font-mono text-sm font-semibold text-ink">{s.count}</td>
                  <td className="py-2 text-xs text-ink/65">
                    {conv === null ? '—' : `${conv.toFixed(1)}%`}
                  </td>
                  <td className="py-2">
                    <span
                      aria-hidden
                      className="block h-2 rounded-full bg-terracotta/70"
                      style={{ width: `${widthPct}%` }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourceSliceTable({
  slices,
  emptyText,
}: {
  slices: { key: string; label: string; count: number; shown: boolean }[];
  emptyText: string;
}) {
  if (slices.length === 0) {
    return <p className="text-sm text-ink/55">{emptyText}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <tr>
            <th className="py-2 font-medium">Source</th>
            <th className="py-2 font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.key} className="border-t border-ink/5">
              <td className="py-2 text-ink/85">{s.label}</td>
              <td className="py-2 font-mono text-sm font-semibold text-ink">
                {s.shown ? s.count : <span className="text-ink/40">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

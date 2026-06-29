import { after } from 'next/server';
import { Radar, RefreshCw, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  getAdminDemandRadar,
  maybeRefreshDemandRadar,
} from '@/lib/demand-radar';
import { DemandRadarCard } from '@/app/vendor-dashboard/demand/_components/demand-radar-card';
import { runDemandRadarRefresh } from './actions';

export const metadata = { title: 'Demand Radar · Admin' };

/**
 * /admin/demand — Demand Radar (admin console view).
 *
 * The fuller demand dashboard across ALL markets — month heat, top regions,
 * hot looks, and event-type breakdown — assembled from the demand_radar_admin()
 * RPC. That RPC enforces is_console_admin() + the same admin-managed min-N floor
 * as the vendor surface, so even an operator never sees a below-floor cell: the
 * de-identification contract holds uniformly. Counts only — no couple identity.
 *
 * Admin gating is inherited from /admin/layout.tsx (404s non-admins); the
 * "Run now" action re-asserts admin context (defense in depth).
 *
 * Cron-free: a "Run now" button + an after() opportunistic rebuild (throttled),
 * never a poller.
 */
export default async function AdminDemandPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [radar, settingsRes] = await Promise.all([
    getAdminDemandRadar(supabase),
    supabase
      .from('platform_settings')
      .select('radar_min_n_floor, radar_enabled')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const floor =
    (settingsRes.data as { radar_min_n_floor?: number } | null)?.radar_min_n_floor ?? 1;
  const vendorFeedEnabled =
    (settingsRes.data as { radar_enabled?: boolean } | null)?.radar_enabled ?? true;

  // Cron-free, throttled opportunistic rebuild after the response flushes.
  after(async () => {
    await maybeRefreshDemandRadar();
  });

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Radar aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Setnayan HQ · Demand Radar
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Demand Radar
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          De-identified demand across every market — by month, region, event
          type, and capture look. This is the operator view of the same rollup
          vendors see, scoped to their own region. Counts only; no couple is ever
          identifiable.
        </p>
      </header>

      {sp.ok ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3 text-sm text-emerald-800"
        >
          {sp.ok}
        </p>
      ) : null}
      {sp.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-800"
        >
          {sp.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream p-4">
        <div className="flex items-start gap-3 text-sm text-ink/75">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="space-y-0.5">
            <p className="font-medium text-ink">Privacy + controls</p>
            <p className="text-ink/70">
              Min-N floor is{' '}
              <span className="font-semibold text-ink">{floor}</span> — cells
              with fewer total signals than this are hidden everywhere, including
              here. The vendor-facing feed is{' '}
              <span className="font-semibold text-ink">
                {vendorFeedEnabled ? 'on' : 'off'}
              </span>
              . Both are managed in platform settings.
            </p>
          </div>
        </div>
        <form action={runDemandRadarRefresh}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink/[0.03]"
          >
            <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Run now
          </button>
        </form>
      </div>

      <DemandRadarCard radar={radar} marketLabel={null} scope="admin" />
    </section>
  );
}

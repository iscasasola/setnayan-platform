import { after } from 'next/server';
import { RefreshCw } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  DEMAND_RADAR_UNREADABLE,
  EMPTY_RADAR,
  getAdminDemandRadar,
  maybeRefreshDemandRadar,
} from '@/lib/demand-radar';
import { DemandRadarCard } from '@/app/vendor-dashboard/demand/_components/demand-radar-card';
import { One, UNREAD } from '@/app/admin/app-performance/_components/insights-parts';
import { runDemandRadarRefresh } from './actions';

export const metadata = { title: 'Demand radar · Admin' };

/**
 * /admin/demand — Demand Radar (admin console view). Insights › Demand.
 *
 * The fuller demand dashboard across ALL markets — month heat, top regions,
 * hot looks, and event-type breakdown — assembled from the demand_radar_admin()
 * RPC. That RPC enforces is_console_admin() + the same admin-managed min-N floor
 * as the supplier surface, so even an operator never sees a below-floor cell: the
 * de-identification contract holds uniformly. Counts only — no couple identity.
 *
 * Admin gating is inherited from /admin/layout.tsx (404s non-admins); the
 * "Run now" action re-asserts admin context (defense in depth).
 *
 * Cron-free: a "Run now" button + an after() opportunistic rebuild (throttled),
 * never a poller.
 *
 * Drawn to the approved Insights drawing (admin_pub/insights.html › Demand): the
 * opening sentence in an ⓘ, the floor and the supplier feed as two READ-ONLY rows
 * (nothing in the app writes either — the page used to say "managed in platform
 * settings"), then "Run now", then the radar itself.
 *
 * 🔑 A REFUSED SETTINGS READ IS NOT A DEFAULT. This page used to print "Min-N floor
 * is 1" and "the supplier-facing feed is on" when the platform_settings read was
 * refused — the code defaults, stated as facts about production. Both rows now say
 * "—" and "Couldn't read" instead.
 */
export default async function AdminDemandPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [radarRead, settingsRes] = await Promise.all([
    getAdminDemandRadar(supabase),
    supabase
      .from('platform_settings')
      .select('radar_min_n_floor, radar_enabled')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  const radarUnreadable = radarRead === DEMAND_RADAR_UNREADABLE;
  const radar = radarUnreadable ? EMPTY_RADAR : radarRead;

  // A refused read (or a missing row) is NOT MEASURED — never the code default.
  const settingsUnread = Boolean(settingsRes.error) || settingsRes.data == null;
  if (settingsRes.error) logQueryError('admin/demand: platform_settings radar', settingsRes.error);
  const settings = settingsRes.data as { radar_min_n_floor?: number | null; radar_enabled?: boolean | null } | null;
  const floor: number | null = settingsUnread ? null : (settings?.radar_min_n_floor ?? null);
  const vendorFeedEnabled: boolean | null = settingsUnread ? null : (settings?.radar_enabled ?? null);

  // Cron-free, throttled opportunistic rebuild after the response flushes.
  after(async () => {
    await maybeRefreshDemandRadar();
  });

  const unreadLine = 'Couldn’t read this setting — not the same as a default';

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {/* The page starts at its content.
          ⚖ The sentence survives for its last clause: counts only, no couple
          is ever identifiable. That is a privacy claim about a screen full of
          other people's plans, and it should not be somewhere else — it now
          lives in the opening ⓘ. */}
      <PageMasthead title="Demand Radar" />
      <One label="Counts only; no couple is ever identifiable">
        De-identified demand across every market — by month, region, event type, and capture look. This is the operator
        view of the same rollup suppliers see, scoped to their own region. Counts only; no couple is ever identifiable.
      </One>

      {sp.ok ? (
        <p
          role="status"
          className="mt-3 rounded-lg bg-[var(--sn-success-soft)] px-3 py-2 text-sm text-[var(--sn-success-deep)]"
        >
          {sp.ok}
        </p>
      ) : null}
      {sp.error ? (
        <p role="alert" className="mt-3 rounded-lg bg-[var(--sn-danger-soft)] px-3 py-2 text-sm text-[var(--sn-danger)]">
          {sp.error}
        </p>
      ) : null}

      {/* Read-only rows: nothing in the app writes either setting today. */}
      <div className="mt-2" data-demand-settings="">
        <FormRows data="demand-settings">
          <FormRow
            name="Min-N privacy floor"
            about={{
              words:
                'Cells with fewer total signals than this are hidden everywhere, including here. Read-only: it is managed in platform settings, and no control in the app writes it today.',
            }}
            line={floor === null ? unreadLine : undefined}
          >
            <span
              data-demand-floor=""
              className={`text-[15px] font-semibold tabular-nums ${floor === null ? 'text-[var(--sn-warning-deep)]' : 'text-ink'}`}
            >
              {floor === null ? UNREAD : floor}
            </span>
          </FormRow>
          <FormRow
            name="Supplier-facing feed"
            about={{
              words:
                'Whether suppliers see the demand radar for their own region. Read-only: it is managed in platform settings, and no control in the app writes it today.',
            }}
            line={vendorFeedEnabled === null ? unreadLine : undefined}
          >
            <span
              data-demand-feed=""
              className={`text-[15px] font-semibold ${vendorFeedEnabled === null ? 'text-[var(--sn-warning-deep)]' : 'text-ink'}`}
            >
              {vendorFeedEnabled === null ? UNREAD : vendorFeedEnabled ? 'On' : 'Off'}
            </span>
          </FormRow>
        </FormRows>
      </div>

      <form action={runDemandRadarRefresh} className="my-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-[var(--sn-accent)]"
        >
          <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Run now
        </button>
      </form>

      <DemandRadarCard radar={radar} marketLabel={null} scope="admin" unreadable={radarUnreadable} />
    </section>
  );
}

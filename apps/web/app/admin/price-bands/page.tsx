import { Gauge, RefreshCw } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { regionBySlug } from '@/lib/region-source';
import { paxBucketLabel, prettyCategory } from '@/lib/price-position';
import { SubmitButton } from '@/app/_components/submit-button';
import { recomputePriceBands } from './actions';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Price bands · Admin' };

/**
 * /admin/price-bands — admin review of the computed Price-Position Meter bands
 * (Wave 6 vendor benefit, the last "Soon" one). Clones the /admin/token-bands
 * pattern: a read of the cached band table + a "recompute now" control.
 *
 * The band values are ADMIN-MANAGED — recomputed from real PUBLISHED vendor
 * prices via recompute_market_price_bands(), never hardcoded. The rollup
 * suppresses any (category, region, pax_bucket) bucket below the min-N sample
 * floor, so a thin / founder-only market produces few or no rows — that empty
 * state is EXPECTED today, not a fault.
 *
 * Recompute is cron-free: it runs on this admin "Recompute now" button (or an
 * after() hook), never on a polling cron.
 *
 * Auth enforced at the admin layout level.
 */

type BandRow = {
  category: string;
  region_slug: string;
  pax_bucket: string;
  low_php: number;
  median_php: number;
  high_php: number;
  sample_n: number;
  computed_at: string;
};

function peso(n: number): string {
  return `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export default async function AdminPriceBandsPage({
  searchParams,
}: {
  searchParams: Promise<{ recomputed?: string }>;
}) {
  await requireAdmin();
  const { recomputed } = await searchParams;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('market_price_bands')
    .select(
      'category, region_slug, pax_bucket, low_php, median_php, high_php, sample_n, computed_at',
    )
    .order('category', { ascending: true })
    .order('region_slug', { ascending: true })
    .order('pax_bucket', { ascending: true });
  if (error) logQueryError('AdminPriceBandsPage', error);
  const rows = (data ?? []) as BandRow[];

  const lastComputed =
    rows.length > 0
      ? rows
          .map((r) => r.computed_at)
          .sort()
          .at(-1)
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Price bands</h1>
        </div>
        <p className="text-sm text-ink/65">
          The market low / median / high per{' '}
          <strong>category × region × guest-count bucket</strong>, computed from
          published vendor prices. Vendors see where their own price lands inside
          their band (the Price-Position Meter on their subscription page). Values
          are computed, never hand-set.
        </p>
        <p className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
          <span className="font-semibold">Behavioral min-N.</span> A bucket only
          appears once enough <em>distinct</em> vendors have published a price for
          it (the platform min-N sample floor). Below the floor it&rsquo;s
          suppressed, so the meter never shows a range built from one or two
          vendors. Founder-only today → expect few or zero rows until more vendors
          list.
        </p>
      </header>

      {/* Recompute control */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-cream px-4 py-3">
        <div className="text-sm text-ink/70">
          {lastComputed ? (
            <>
              Last recomputed{' '}
              <strong>
                {new Date(lastComputed).toLocaleString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </strong>{' '}
              · {rows.length} band{rows.length === 1 ? '' : 's'} above the floor
            </>
          ) : (
            <>No bands computed yet (or all suppressed below the min-N floor).</>
          )}
          {recomputed != null && (
            <span className="ml-2 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-900">
              ✓ Recomputed · {recomputed} band{recomputed === '1' ? '' : 's'} written
            </span>
          )}
        </div>
        <form action={recomputePriceBands}>
          <SubmitButton className="button-secondary inline-flex items-center gap-1.5 text-xs" pendingLabel="Recomputing…">
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Recompute now
          </SubmitButton>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-ink/10 bg-cream px-4 py-10 text-center">
          <p className="text-sm font-medium text-ink/70">No bands to show yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink/55">
            Either no recompute has run, or every (category × region × bucket) is
            still below the min-N sample floor. As more vendors publish prices,
            recompute and the bands will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
              <tr>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Region</th>
                <th className="px-3 py-3 font-medium">Guest bucket</th>
                <th className="px-3 py-3 text-right font-medium">Low</th>
                <th className="px-3 py-3 text-right font-medium">Median</th>
                <th className="px-3 py-3 text-right font-medium">High</th>
                <th className="px-3 py-3 text-right font-medium">Vendors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const regionLabel =
                  regionBySlug(r.region_slug)?.display_label ?? r.region_slug;
                return (
                  <tr
                    key={`${r.category}|${r.region_slug}|${r.pax_bucket}`}
                    className="border-t border-ink/5"
                  >
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink">{prettyCategory(r.category)}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                        {r.category}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-ink/75">{regionLabel}</td>
                    <td className="px-3 py-3 text-ink/75">
                      {paxBucketLabel(r.pax_bucket)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-ink/70">
                      {peso(r.low_php)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-ink">
                      {peso(r.median_php)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-ink/70">
                      {peso(r.high_php)}
                    </td>
                    <td className="px-3 py-3 text-right text-ink/70">{r.sample_n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · Price-Position Meter (Wave 6) · table <code>market_price_bands</code>{' '}
        · RPC <code>recompute_market_price_bands()</code> · migration 20270324043850
      </p>
    </div>
  );
}

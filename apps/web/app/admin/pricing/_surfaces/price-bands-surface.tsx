// Money-split studio surface — the body of the former price-bands page,
// re-homed here (2026-07-10). actions/_components stay in /admin/price-bands; the
// legacy route is now a redirect (or, for pricing/settings, the studio shell).
import { Gauge, RefreshCw } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { regionBySlug } from '@/lib/region-source';
import { paxBucketLabel, prettyCategory } from '@/lib/price-position';
import { SubmitButton } from '@/app/_components/submit-button';
import { recomputePriceBands } from '@/app/admin/price-bands/actions';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';

/**
 * /admin/price-bands — admin review of the computed Price-Position Meter bands
 * (Wave 6 vendor benefit, the last "Soon" one). A read of the cached band
 * table + a "recompute now" control.
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

export async function PriceBandsSurface({
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
  // NULL means the read was refused, which is NOT the same as "every bucket is
  // below the min-N floor" — and that page said exactly the second thing when it
  // was the first. `?? []` is what made the two indistinguishable.
  const rows = data as BandRow[] | null;

  const lastComputed =
    rows && rows.length > 0
      ? rows
          .map((r) => r.computed_at)
          .sort()
          .at(-1)
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* The tab strip already says "Price bands", with the same Gauge icon
          on it — so the row underneath was the second copy of both. The name
          stays in the document at zero pixels.
          ⚖ Both sentences survive: the first says these numbers are COMPUTED
          and never hand-set, the second explains why a bucket you expect to
          see is missing. Deleting either turns an empty screen into a bug
          report. */}
      <PageMasthead title="Price bands" />
      <div className="mb-6 space-y-2">
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
      </div>

      {/* Recompute control */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 sn-tile px-4 py-3">
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
              · {rows?.length ?? 0} band{rows?.length === 1 ? '' : 's'} above the floor
            </>
          ) : rows === null ? (
            <>Could not read the band table, so this is not a count of zero.</>
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

      <ConsoleTable
        rows={rows}
        readPermitted
        readError={error}
        reads="the price-band table"
        label="Price bands"
        minWidth="44rem"
        rowKey={(r) => `${r.category}|${r.region_slug}|${r.pax_bucket}`}
        empty={{
          Icon: Gauge,
          title: 'No bands to show yet',
          blurb:
            'Either no recompute has run, or every category × region × bucket is still below the min-N sample floor. As more vendors publish prices, recompute and the bands appear here.',
          verifiedNote: 'Verified: read permitted · 0 bands above the floor',
        }}
        columns={[
          {
            header: 'Category',
            cell: (r) => (
              <>
                <p className="font-medium text-ink">{prettyCategory(r.category)}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
                  {r.category}
                </p>
              </>
            ),
          },
          {
            header: 'Region',
            cell: (r) => (
              <span className="text-ink/75">
                {regionBySlug(r.region_slug)?.display_label ?? r.region_slug}
              </span>
            ),
          },
          {
            header: 'Guest bucket',
            hideBelow: 'md',
            cell: (r) => <span className="text-ink/75">{paxBucketLabel(r.pax_bucket)}</span>,
          },
          {
            header: 'Low',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (r) => <span className="text-ink/70">{peso(r.low_php)}</span>,
          },
          {
            header: 'Median',
            align: 'right',
            mono: true,
            cell: (r) => <span className="font-semibold text-ink">{peso(r.median_php)}</span>,
          },
          {
            header: 'High',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (r) => <span className="text-ink/70">{peso(r.high_php)}</span>,
          },
          {
            header: 'Vendors',
            align: 'right',
            hideBelow: 'lg',
            cell: (r) => <span className="text-ink/70">{r.sample_n}</span>,
          },
        ]}
      />

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
        Source · Price-Position Meter (Wave 6) · table <code>market_price_bands</code>{' '}
        · RPC <code>recompute_market_price_bands()</code> · migration 20270324043850
      </p>
    </div>
  );
}

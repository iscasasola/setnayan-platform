import { BadgeCheck, Info } from 'lucide-react';
import type { VendorVerifiedMedian } from '@/lib/verified-median-read';
import { formatMedianPhp, MIN_MEDIAN_SAMPLE } from '@/lib/verified-median';

/**
 * Verified-Median card (vendor's OWN dashboard).
 *
 * Shows the vendor the market price their declarations produce: the MEDIAN of
 * their locked-booking prices, the count behind it, and their own spread. This
 * is what a couple will see as their "typical price", so the vendor understands
 * the feedback loop — under-declare and this drops (and floods you with
 * unservable leads); over-declare and it rises (and you lose leads).
 *
 * Vendor-facing → shows the EXACT median (the vendor owns this data). The public
 * couple-facing card rounds it. No cross-vendor comparison anywhere.
 *
 * Dark by default: only rendered when NEXT_PUBLIC_VERIFIED_MEDIAN_ENABLED is on
 * (the page gates it).
 */
export function VerifiedMedianCard({ data }: { data: VendorVerifiedMedian }) {
  const { result } = data;

  return (
    <section className="sn-tile mt-8 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="sn-eye">Verified market price</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.015em]">
            Your price, verified by your bookings
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink/60">
            The median of the prices you&apos;ve declared on your locked bookings.
            This is the &quot;typical price&quot; couples see on your page — it moves
            only when your real bookings move.
          </p>
        </div>
        <span className="rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
          Soon
        </span>
      </div>

      {result.status === 'not_established' && (
        <div className="mt-5 rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink/75">
            <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
            Not established yet
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink/55">
            We show a verified price once you have at least {MIN_MEDIAN_SAMPLE}{' '}
            locked bookings with a declared price
            {result.sampleN > 0
              ? ` — you have ${result.sampleN} so far`
              : ''}
            . A median needs enough real bookings behind it; we never estimate one
            from a handful.
          </p>
        </div>
      )}

      {result.status === 'established' && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div
              className="rounded-lg border bg-ink/[0.02] px-4 py-3"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-success-700">
                <BadgeCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
                Verified median
              </p>
              <p className="mt-1 text-3xl font-semibold text-ink">
                {formatMedianPhp(result.medianPhp)}
              </p>
              <p className="mt-0.5 text-[11px] text-ink/50">
                from {result.sampleN} locked booking{result.sampleN === 1 ? '' : 's'}
              </p>
            </div>
            <div
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50">
                Your booking spread
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">
                {formatMedianPhp(result.lowPhp)} – {formatMedianPhp(result.highPhp)}
              </p>
              <p className="mt-0.5 text-[11px] text-ink/50">
                lowest to highest declared lock
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-ink/45">
            Based on {result.sampleN} locked booking
            {result.sampleN === 1 ? '' : 's'} you&apos;ve declared a price on.
            Comp / barter / ₱0 bookings marked non-representative are left out. This
            figure isn&apos;t a target — declare honestly and it settles where your
            real market is.
          </p>
        </>
      )}
    </section>
  );
}

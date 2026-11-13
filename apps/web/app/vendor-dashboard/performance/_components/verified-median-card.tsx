import { BadgeCheck, Info } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
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
/** The design template's section label (rule 2) — small, bold, capitals, slate grey; no box around it. */
const SECTION_LABEL = 'flex min-h-9 items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]';

/**
 * Design template (rules 2 · 5 · 7 · 13): no card around the section — a label with its ⓘ (the explanation, kept word
 * for word), the "Soon" status as a soft chip, the median as the one strong number on the warm surface, the spread as
 * a plain row. Every fact the card carried is still here.
 */
export function VerifiedMedianCard({ data }: { data: VendorVerifiedMedian }) {
  const { result } = data;

  return (
    <section className="mt-8" data-verified-median="">
      <div className="flex items-center justify-between gap-3">
        <InfoTip label="Your price, verified by your bookings" labelAs="h2" labelClassName={SECTION_LABEL} align="start">
          The median of the prices you&apos;ve declared on your locked bookings. This is the &quot;typical price&quot;
          couples see on your page — it moves only when your real bookings move.
        </InfoTip>
        <Badge tone="wait">Soon</Badge>
      </div>

      {result.status === 'not_established' && (
        <p className="flex min-h-14 items-center gap-2 border-b border-ink/10 text-sm text-ink">
          <Info className="h-4 w-4 flex-none text-ink/70" strokeWidth={2} aria-hidden />
          <span>
            Not established yet
            {result.sampleN > 0 ? ` — ${result.sampleN} of ${MIN_MEDIAN_SAMPLE} locked bookings so far` : ''}
          </span>
          <InfoTip label="" ariaLabel="Why it is not established yet" align="end">
            We show a verified price once you have at least {MIN_MEDIAN_SAMPLE} locked bookings with a declared price
            {result.sampleN > 0 ? ` — you have ${result.sampleN} so far` : ''}. A median needs enough real bookings behind
            it; we never estimate one from a handful.
          </InfoTip>
        </p>
      )}

      {result.status === 'established' && (
        <>
          <div className="mt-2 rounded-[18px] bg-[color:var(--m-paper-2)] px-4 py-4" data-verified-median-top="">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-success-700">
              <BadgeCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
              Verified median
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-ink">{formatMedianPhp(result.medianPhp)}</p>
            <p className="mt-0.5 text-sm text-ink/70">
              from {result.sampleN} locked booking{result.sampleN === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-ink/10 py-2">
            <span>
              <span className="block text-base font-semibold text-ink">Your booking spread</span>
              <span className="block text-sm text-ink/70">lowest to highest declared lock</span>
            </span>
            <span className="text-base font-bold tabular-nums text-ink">
              {formatMedianPhp(result.lowPhp)} – {formatMedianPhp(result.highPhp)}
            </span>
          </div>
          <p className="mt-3 flex items-center gap-1 text-sm text-ink/70">
            Based on {result.sampleN} locked booking{result.sampleN === 1 ? '' : 's'} you&apos;ve declared a price on.
            <InfoTip label="" ariaLabel="What is left out" align="end">
              Comp / barter / ₱0 bookings marked non-representative are left out. This figure isn&apos;t a target —
              declare honestly and it settles where your real market is.
            </InfoTip>
          </p>
        </>
      )}
    </section>
  );
}

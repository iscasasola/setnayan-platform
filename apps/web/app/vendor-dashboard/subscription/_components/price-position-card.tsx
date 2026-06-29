import { Gauge, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { PricePositionResult } from '@/lib/price-position';
import { paxBucketLabel, prettyCategory } from '@/lib/price-position';

/**
 * Price-Position Meter card (Wave 6 vendor benefit · the last "Soon" one) —
 * rendered on /vendor-dashboard/subscription beside the Peso-per-lead card.
 * A server component (pure render): "your price sits in the Xth percentile for
 * {category} in {region}" with a low / median / high band rail.
 *
 * BEHAVIORAL HONESTY: when the band was suppressed below the min-N sample floor
 * (founder-only market today), the result is { status: 'no_data' } and this card
 * shows "not enough market data yet" — it never invents a range. The band values
 * are admin-managed (recomputed from real prices at /admin/price-bands), never
 * hardcoded here.
 */

function peso(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

export function PricePositionCard({ result }: { result: PricePositionResult }) {
  const { key } = result;
  const regionText = key.regionLabel ?? 'your region';
  const catText = prettyCategory(key.category);
  const paxText = key.paxBucket === '__all__' ? '' : ` · ${paxBucketLabel(key.paxBucket)}`;

  return (
    <section className="mt-8 m-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-label-mono">Price-position meter</p>
          <h2 className="m-display-tight mt-1 text-xl">Where your price sits</h2>
          <p className="mt-1 max-w-prose text-sm text-ink/60">
            How your <span className="font-medium text-ink/80">{catText}</span>{' '}
            starting price compares to other published vendors in{' '}
            <span className="font-medium text-ink/80">{regionText}</span>
            {paxText}.
          </p>
        </div>
        <span className="rounded-full border border-warn-300/70 bg-warn-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-warn-800">
          Soon
        </span>
      </div>

      {result.status === 'no_data' && (
        <div className="mt-5 rounded-lg border border-ink/10 bg-ink/[0.02] px-4 py-4">
          <p className="flex items-center gap-2 text-sm font-medium text-ink/75">
            <Gauge className="h-4 w-4" strokeWidth={2} aria-hidden />
            Not enough market data yet
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink/55">
            We only show a price band once enough other vendors have published a
            price for {catText} in {regionText}
            {paxText}. As more vendors list, this meter will show you the low,
            median, and high — and exactly where you land. We never estimate a
            range from a handful of vendors.
          </p>
        </div>
      )}

      {result.status === 'no_own_price' && (
        <>
          <BandRail band={result.band} ownPricePhp={null} percentile={null} />
          <p className="mt-4 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2.5 text-[12px] leading-relaxed text-ink/60">
            The market band for {catText} in {regionText}
            {paxText} is above — but you haven&apos;t set a starting price for this
            category yet. Add one to see your percentile.
          </p>
        </>
      )}

      {result.status === 'positioned' && (
        <>
          {/* Headline percentile / position */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PositionHeadline result={result} />
            <div
              className="rounded-lg border px-4 py-3"
              style={{ borderColor: 'var(--m-line)' }}
            >
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50">
                Your starting price
              </p>
              <p className="mt-1 text-3xl font-semibold text-ink">
                {peso(result.key.ownPricePhp)}
              </p>
              <p className="mt-0.5 text-[11px] text-ink/50">
                vs market median {peso(result.band.medianPhp)}
              </p>
            </div>
          </div>

          <BandRail
            band={result.band}
            ownPricePhp={result.key.ownPricePhp}
            percentile={result.percentile}
          />
        </>
      )}

      {(result.status === 'positioned' || result.status === 'no_own_price') && (
        <p className="mt-4 text-[11px] text-ink/45">
          Based on {result.band.sampleN} published vendor
          {result.band.sampleN === 1 ? '' : 's'} · range {peso(result.band.lowPhp)}–
          {peso(result.band.highPhp)} · updated{' '}
          {new Date(result.band.computedAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
          . The band is recomputed from live vendor prices — it isn&apos;t a target.
        </p>
      )}
    </section>
  );
}

function PositionHeadline({
  result,
}: {
  result: Extract<PricePositionResult, { status: 'positioned' }>;
}) {
  const { position, percentile } = result;
  const cfg =
    position === 'below_band'
      ? {
          icon: <TrendingDown className="h-4 w-4" strokeWidth={2} aria-hidden />,
          label: 'Below the market band',
          tone: 'text-success-700',
        }
      : position === 'above_band'
        ? {
            icon: <TrendingUp className="h-4 w-4" strokeWidth={2} aria-hidden />,
            label: 'Above the market band',
            tone: 'text-orange',
          }
        : {
            icon: <Minus className="h-4 w-4" strokeWidth={2} aria-hidden />,
            label: 'Inside the market band',
            tone: 'text-ink/70',
          };

  return (
    <div className="rounded-lg border bg-ink/[0.02] px-4 py-3" style={{ borderColor: 'var(--m-line)' }}>
      <p className={'flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] ' + cfg.tone}>
        {cfg.icon}
        {cfg.label}
      </p>
      <p className="mt-1 text-3xl font-semibold text-ink">
        {percentile == null ? '—' : `${ordinal(percentile)}`}
      </p>
      <p className="mt-0.5 text-[11px] text-ink/50">
        {percentile == null
          ? 'Single-price band — no percentile'
          : `percentile · ${percentile}% of the band's range is below you`}
      </p>
    </div>
  );
}

/** A low–median–high rail with the vendor's marker placed by percentile. */
function BandRail({
  band,
  ownPricePhp,
  percentile,
}: {
  band: { lowPhp: number; medianPhp: number; highPhp: number };
  ownPricePhp: number | null;
  percentile: number | null;
}) {
  // Marker position 0–100. When the vendor is below/above the band, clamp to the
  // ends; in-band uses the computed percentile; no own price → no marker.
  const markerPct =
    ownPricePhp == null
      ? null
      : percentile != null
        ? percentile
        : ownPricePhp <= band.lowPhp
          ? 0
          : ownPricePhp >= band.highPhp
            ? 100
            : 50;

  return (
    <div className="mt-5">
      <div className="relative h-2 w-full rounded-full bg-ink/[0.06]">
        {/* the band fill (low → high) */}
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-champagne-gold/40" />
        {/* median tick at 50% */}
        <div
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink/40"
          style={{ left: '50%' }}
          aria-hidden
        />
        {/* the vendor's marker */}
        {markerPct != null && (
          <div
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream bg-ink shadow"
            style={{ left: `${markerPct}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink/55">
        <span>
          Low {peso(band.lowPhp)}
        </span>
        <span>Median {peso(band.medianPhp)}</span>
        <span>High {peso(band.highPhp)}</span>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  // percentile is 0–100; render as "65th", "1st", "100th"…
  const v = Math.round(n);
  const s = ['th', 'st', 'nd', 'rd'] as const;
  const mod = v % 100;
  const suffix = s[(mod - 20) % 10] ?? s[mod] ?? s[0];
  return `${v}${suffix}`;
}

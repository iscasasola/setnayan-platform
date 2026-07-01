import type { BookingMonthPoint } from '@/lib/vendor-booking-series';
import { formatPhp } from '@/lib/vendors';

/**
 * Momentum mini-charts — the visual half of the "Momentum" card. Two pure,
 * server-rendered (no client JS) charts over the same trailing monthly series:
 *
 *   • <BookingsBars>      — a bar per month (count of booked event_vendors),
 *                           the current month deepened for emphasis.
 *   • <EarningsSparkline> — an SVG area line of confirmed booked revenue.
 *
 * Both degrade to nothing when there is no signal (all-zero series) so a brand
 * new vendor sees the honest big-number empty state, not a flat baseline that
 * reads like a chart with data.
 *
 * Colors come from the champagne-gold palette (--m-orange / --m-orange-2) to
 * match the ROI card's bars and the rest of My Performance.
 */

/** Small caption under each chart naming the window. */
function ChartCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
      {children}
    </p>
  );
}

export function BookingsBars({ series }: { series: BookingMonthPoint[] }) {
  const max = series.reduce((m, p) => Math.max(m, p.bookings), 0);
  if (series.length === 0 || max === 0) return null;

  const total = series.reduce((s, p) => s + p.bookings, 0);

  return (
    <div className="mt-4">
      <div
        className="flex h-16 items-end gap-1"
        role="img"
        aria-label={`Monthly bookings for the last ${series.length} months: ${total} total.`}
      >
        {series.map((p, i) => {
          const isCurrent = i === series.length - 1;
          // Min visible sliver for non-zero months so a single booking still
          // reads as a bar; zero months stay flat.
          const pct = p.bookings === 0 ? 0 : Math.max((p.bookings / max) * 100, 8);
          return (
            <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${pct}%`,
                    minHeight: p.bookings > 0 ? 2 : 0,
                    background: isCurrent ? 'var(--m-orange-2)' : 'var(--m-orange)',
                  }}
                  title={`${p.label}: ${p.bookings} booked`}
                />
              </div>
              <span
                className="font-mono text-[9px] leading-none"
                style={{ color: isCurrent ? 'var(--m-orange-2)' : 'var(--m-slate-3)' }}
              >
                {p.label.charAt(0)}
              </span>
            </div>
          );
        })}
      </div>
      <ChartCaption>Booked per month · last {series.length} months</ChartCaption>
    </div>
  );
}

export function EarningsSparkline({ series }: { series: BookingMonthPoint[] }) {
  const max = series.reduce((m, p) => Math.max(m, p.revenuePhp), 0);
  const priced = series.filter((p) => p.revenuePhp > 0).length;
  if (series.length < 2 || max === 0) return null;

  const W = 100;
  const H = 32;
  const n = series.length;
  // Normalize each point into the viewBox. y is inverted (SVG origin top-left);
  // leave 3px headroom top + bottom so the stroke isn't clipped.
  const pts = series.map((p, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * W;
    const y = H - 3 - (p.revenuePhp / max) * (H - 6);
    return { x, y };
  });
  const line = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const last = pts[pts.length - 1];
  if (!last) return null;
  const peak = formatPhp(max);

  return (
    <div className="mt-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-16 w-full"
        role="img"
        aria-label={`Confirmed booked revenue trend over ${n} months; peak month ${peak}.`}
      >
        <path d={area} fill="var(--m-orange-4)" opacity={0.7} />
        <path
          d={line}
          fill="none"
          stroke="var(--m-orange-2)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r={2} fill="var(--m-orange-2)" />
      </svg>
      <ChartCaption>
        Confirmed revenue trend · {priced} month{priced === 1 ? '' : 's'} with a
        priced booking
      </ChartCaption>
    </div>
  );
}

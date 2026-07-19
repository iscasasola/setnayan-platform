import type { SourceSlice } from '@/lib/vendor-funnel';
import { CountUp } from '../performance/_components/count-up';

/**
 * SourceBreakdown — a titled "by source" table for the vendor's OWN attribution
 * data (bookings / profile views sliced by where the couple came from). Shared
 * by My Performance (/vendor-dashboard/performance) and the Demand Radar page
 * (/vendor-dashboard/demand), so the two surfaces render an identical read.
 *
 * Server component (no client JS). Slices arrive already sorted + min-N gated
 * from fetchBookedBySource() / fetchViewsBySource(); a slice with `shown=false`
 * renders its count as "—" so a thin segment can't read as a reliable signal
 * (behavioral-data lock · project_setnayan_behavioral_data_edge).
 *
 * Editorial `--m-*` palette — matches the funnel/ROI cards on My Performance and
 * reads as a clearly-distinct own-data strip beneath the (market-intel) radar.
 */
export function SourceBreakdown({
  title,
  blurb,
  slices,
  emptyText,
}: {
  title: string;
  blurb: string;
  slices: SourceSlice[];
  emptyText: string;
}) {
  return (
    <section className="space-y-3">
      <header className="space-y-0.5">
        <h3 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h3>
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          {blurb}
        </p>
      </header>

      <div>
        {slices.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            {emptyText}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr
                className="font-mono text-[11px] uppercase tracking-[0.12em]"
                style={{ color: 'var(--m-slate-3)' }}
              >
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {slices.map((s) => (
                <tr
                  key={s.key}
                  className="border-t"
                  style={{ borderColor: 'var(--m-line-soft)' }}
                >
                  <td className="py-2" style={{ color: 'var(--m-ink)' }}>
                    {s.label}
                  </td>
                  <td
                    className="py-2 text-right font-mono text-sm font-semibold tabular-nums"
                    style={{ color: 'var(--m-ink)' }}
                  >
                    {s.shown ? (
                      <CountUp value={s.count} />
                    ) : (
                      <span style={{ color: 'var(--m-slate-4)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

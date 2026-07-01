import { Filter } from 'lucide-react';
import {
  FUNNEL_MIN_N,
  FUNNEL_RANGE_OPTIONS,
  type FunnelStep,
  type FunnelSourceSlice,
  type FunnelRangeKey,
} from '@/lib/vendor-funnel';

/**
 * FunnelPanel — the SHARED, full-detail Quote-to-Booking Funnel body.
 *
 * One source of truth for views → inquiries → quotes → booked, with the
 * time-over-time (stage-over-stage) conversion deltas and the booked + views
 * source breakdowns. Rendered by BOTH:
 *   • the standalone route /vendor-dashboard/funnel (variant="page")
 *   • the vendor Overview's inline funnel section (variant="section")
 *
 * Presentational only — the caller computes the live view via
 * computeVendorFunnelView() and passes it in. Nothing is hardcoded; thin
 * source segments render as "—" (min-N suppressed) exactly as the standalone
 * page does. Editorial `--m-*` palette throughout, matching the vendor
 * Overview.
 *
 * The range picker (`?range=` form) is a page-level affordance; in the inline
 * Overview section it's omitted (fixed to the caller's default window) so the
 * section stays a read, with the standalone route as the "slice it yourself"
 * destination.
 */
export function FunnelPanel({
  steps,
  sourceSlices,
  viewSourceSlices,
  range,
  sinceIso,
  variant = 'page',
}: {
  steps: FunnelStep[];
  sourceSlices: FunnelSourceSlice[];
  viewSourceSlices: FunnelSourceSlice[];
  range: FunnelRangeKey;
  sinceIso: string;
  variant?: 'page' | 'section';
}) {
  const Heading = variant === 'page' ? 'h1' : 'h2';

  return (
    <div className="space-y-6">
      {variant === 'page' ? (
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <Filter aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <Heading
              className="text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--m-ink)' }}
            >
              Quote-to-Booking Funnel
            </Heading>
          </div>
          <p className="max-w-prose text-sm" style={{ color: 'var(--m-slate)' }}>
            How couples move from finding you to booking you — profile views →
            inquiries → quotes sent → booked. Computed live from your own
            activity.
          </p>
        </header>
      ) : (
        <div className="space-y-1.5">
          <Heading
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: 'var(--m-ink)' }}
          >
            <Filter
              aria-hidden
              className="h-5 w-5"
              strokeWidth={1.75}
              style={{ color: 'var(--m-orange-2)' }}
            />
            Quote-to-Booking Funnel
          </Heading>
          <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
            Views → inquiries → quotes sent → booked, computed live from your
            own activity. Since {sinceIso.slice(0, 10)}.
          </p>
        </div>
      )}

      {/* The range picker is a page-only affordance (a GET form). The inline
          Overview section is a fixed-window read; the standalone route is where
          the vendor re-slices. */}
      {variant === 'page' ? (
        <form method="get" className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="range"
            className="m-label-mono"
            style={{ color: 'var(--m-slate-3)' }}
          >
            Range
          </label>
          <select
            id="range"
            name="range"
            defaultValue={range}
            className="input-field h-9 max-w-[14rem] py-0 text-sm"
          >
            {FUNNEL_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button type="submit" className="button-secondary h-9 px-3 text-xs">
            Apply
          </button>
          <span
            className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: 'var(--m-slate-4)' }}
          >
            Since {sinceIso.slice(0, 10)}
          </span>
        </form>
      ) : null}

      <FunnelTable steps={steps} />

      {/* Booked, sliced by where the couple came from. */}
      <section
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <header className="mb-3 space-y-0.5">
          <h3 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            Bookings by source
          </h3>
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
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
      <section
        className="rounded-xl border p-5"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <header className="mb-3 space-y-0.5">
          <h3 className="text-base font-semibold" style={{ color: 'var(--m-ink)' }}>
            Profile views by source
          </h3>
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
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
    <section
      className="rounded-xl border p-5"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead
            className="text-[11px] uppercase tracking-[0.12em]"
            style={{ color: 'var(--m-slate-3)' }}
          >
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
              const conv =
                prev && prev.count > 0 ? (s.count / prev.count) * 100 : null;
              const widthPct = Math.max(
                1,
                Math.round((s.count / maxCount) * 100),
              );
              return (
                <tr
                  key={s.label}
                  className="border-t"
                  style={{ borderColor: 'var(--m-line-soft)' }}
                >
                  <td className="py-2" style={{ color: 'var(--m-ink)' }}>
                    {s.label}
                  </td>
                  <td
                    className="py-2 font-mono text-sm font-semibold"
                    style={{ color: 'var(--m-ink)' }}
                  >
                    {s.count}
                  </td>
                  <td className="py-2 text-xs" style={{ color: 'var(--m-slate)' }}>
                    {conv === null ? '—' : `${conv.toFixed(1)}%`}
                  </td>
                  <td className="py-2">
                    <span
                      aria-hidden
                      className="block h-2 rounded-full"
                      style={{
                        width: `${widthPct}%`,
                        background: 'var(--m-orange)',
                      }}
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
  slices: FunnelSourceSlice[];
  emptyText: string;
}) {
  if (slices.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--m-slate-3)' }}>
        {emptyText}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead
          className="text-[11px] uppercase tracking-[0.12em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          <tr>
            <th className="py-2 font-medium">Source</th>
            <th className="py-2 font-medium">Count</th>
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
                className="py-2 font-mono text-sm font-semibold"
                style={{ color: 'var(--m-ink)' }}
              >
                {s.shown ? (
                  s.count
                ) : (
                  <span style={{ color: 'var(--m-slate-4)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

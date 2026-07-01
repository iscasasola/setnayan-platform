import Link from 'next/link';
import { Briefcase, Wallet } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import type { BookingMonthPoint } from '@/lib/vendor-booking-series';
import { BookingsBars, EarningsSparkline } from './momentum-chart';

/**
 * "Momentum" — a Monthly / Annual toggle over the vendor's booked business.
 * Shows Bookings (count) + Earnings (confirmed booked revenue, PHP) for the
 * selected window, each paired with a trailing-12-month chart (bars for
 * bookings, an area sparkline for revenue). Windows come from
 * vendor_source_attribution(); the charts come from
 * vendor_booking_monthly_series(). The toggle is a URL param
 * (?momentum=month|year) so the surface stays a server component (no client JS).
 *
 * Earnings are the CONFIRMED booked revenue only (total_cost_php on booked
 * event_vendors) — partial by design, since vendors settle off-platform. The
 * caller passes a note when priced coverage is thin.
 */

export type MomentumWindow = {
  bookings: number;
  earningsPhp: number;
  pricedCount: number;
};

export function MomentumCard({
  mode,
  month,
  year,
  series = [],
}: {
  mode: 'month' | 'year';
  month: MomentumWindow;
  year: MomentumWindow;
  /** Trailing monthly series driving the two mini-charts. */
  series?: BookingMonthPoint[];
}) {
  const active = mode === 'month' ? month : year;
  const earningsLabel = mode === 'month' ? 'Earnings this month' : 'Earnings this year';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Momentum
        </h2>
        {/* Monthly / Annual toggle — URL-param, server-rendered. */}
        <div
          className="inline-flex rounded-full border p-0.5"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          role="tablist"
          aria-label="Momentum window"
        >
          <ToggleLink label="Monthly" value="month" active={mode === 'month'} />
          <ToggleLink label="Annual" value="year" active={mode === 'year'} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className="rounded-lg border bg-white p-5"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
            <Briefcase className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.15em]">
              Bookings
            </span>
          </div>
          <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
            {active.bookings}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Booked {mode === 'month' ? 'in the last 28 days' : 'in the last 12 months'}
          </p>
          <BookingsBars series={series} />
        </div>

        <div
          className="rounded-lg border bg-white p-5"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
            <Wallet className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.15em]">
              {earningsLabel}
            </span>
          </div>
          <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
            {active.pricedCount > 0 ? formatPhp(active.earningsPhp) : '—'}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {active.pricedCount > 0
              ? `Confirmed on ${active.pricedCount} of ${active.bookings} booking${active.bookings === 1 ? '' : 's'}`
              : 'No confirmed prices in this window yet'}
          </p>
          <EarningsSparkline series={series} />
        </div>
      </div>
    </section>
  );
}

function ToggleLink({
  label,
  value,
  active,
}: {
  label: string;
  value: 'month' | 'year';
  active: boolean;
}) {
  return (
    <Link
      href={`?momentum=${value}`}
      scroll={false}
      role="tab"
      aria-selected={active}
      className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors"
      style={
        active
          ? { background: 'var(--m-ink)', color: 'var(--m-paper)' }
          : { color: 'var(--m-slate)' }
      }
    >
      {label}
    </Link>
  );
}

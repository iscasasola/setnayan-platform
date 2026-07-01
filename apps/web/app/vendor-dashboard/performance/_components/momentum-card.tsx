import Link from 'next/link';
import { Briefcase, Wallet } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import type { BookingMonthPoint, BookingDayPoint } from '@/lib/vendor-booking-series';
import { BookingsBars, EarningsSparkline, type ChartPoint } from './momentum-chart';
import { buildPerformanceHref } from './perf-links';

/**
 * "Momentum" — a windowed view over the vendor's booked business, tiered:
 *
 *   • BASIC (Solo, variant='basic'): Bookings count only, Monthly / Annual
 *     toggle. No earnings panel, no Daily view.
 *   • FULL (Pro+, variant='full'): Bookings + Earnings (confirmed booked
 *     revenue, PHP), and a Daily / Monthly / Annual toggle (owner 2026-07-01
 *     "also plot daily"). Each stat is paired with a trailing chart (bars for
 *     bookings, an area sparkline for revenue).
 *
 * Windows come from vendor_source_attribution(); the monthly charts come from
 * vendor_booking_monthly_series() and the daily charts from
 * vendor_booking_daily_series(). The toggle is a URL param
 * (?momentum=day|month|year) so the surface stays a server component (no client
 * JS).
 *
 * Earnings are the CONFIRMED booked revenue only (total_cost_php on booked
 * event_vendors) — partial by design, since vendors settle off-platform.
 */

export type MomentumWindow = {
  bookings: number;
  earningsPhp: number;
  pricedCount: number;
};

export type MomentumMode = 'day' | 'month' | 'year';

function toChartPoints(
  mode: MomentumMode,
  monthly: BookingMonthPoint[],
  daily: BookingDayPoint[],
): ChartPoint[] {
  if (mode === 'day') {
    return daily.map((p) => ({
      key: p.day,
      label: p.label,
      bookings: p.bookings,
      revenuePhp: p.revenuePhp,
    }));
  }
  return monthly.map((p) => ({
    key: p.month,
    label: p.label,
    bookings: p.bookings,
    revenuePhp: p.revenuePhp,
  }));
}

export function MomentumCard({
  mode,
  variant,
  day,
  month,
  year,
  monthlySeries = [],
  dailySeries = [],
  serviceId = null,
  scopeLabel = null,
  nullServiceExcluded = null,
}: {
  mode: MomentumMode;
  /** 'basic' (Solo) hides earnings + the Daily view; 'full' (Pro+) shows all. */
  variant: 'basic' | 'full';
  /** Trailing-30-day window (only meaningful in 'full' variant). */
  day?: MomentumWindow;
  month: MomentumWindow;
  year: MomentumWindow;
  monthlySeries?: BookingMonthPoint[];
  dailySeries?: BookingDayPoint[];
  /** Active service scope — threaded into the window-toggle links so switching
   *  Daily/Monthly/Annual preserves ?service. null = All services. */
  serviceId?: string | null;
  /** Selected service's display label, or null when All services. Drives the
   *  scoped empty-state copy ("No bookings for {label} yet"). */
  scopeLabel?: string | null;
  /** Count of booked rows NOT tied to any service (service_id IS NULL) in the
   *  active window, for the reconciliation footnote. null = All services (no
   *  footnote). */
  nullServiceExcluded?: number | null;
}) {
  const isFull = variant === 'full';
  // Basic never lands on 'day' (the toggle doesn't offer it); guard anyway.
  const effectiveMode: MomentumMode = !isFull && mode === 'day' ? 'month' : mode;

  const active =
    effectiveMode === 'day' ? (day ?? month) : effectiveMode === 'month' ? month : year;
  const chartUnit = effectiveMode === 'day' ? 'day' : 'month';
  const chartSeries = toChartPoints(effectiveMode, monthlySeries, dailySeries);

  const bookedCaption =
    effectiveMode === 'day'
      ? 'Booked in the last 30 days'
      : effectiveMode === 'month'
        ? 'Booked in the last 28 days'
        : 'Booked in the last 12 months';
  const earningsLabel =
    effectiveMode === 'day'
      ? 'Earnings · last 30 days'
      : effectiveMode === 'month'
        ? 'Earnings this month'
        : 'Earnings this year';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
          Momentum
        </h2>
        {/* Daily / Monthly / Annual toggle — URL-param, server-rendered. Daily
            is Pro+ only, so basic omits it. */}
        <div
          className="inline-flex rounded-full border p-0.5"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
          role="tablist"
          aria-label="Momentum window"
        >
          {isFull && (
            <ToggleLink
              label="Daily"
              value="day"
              active={effectiveMode === 'day'}
              serviceId={serviceId}
            />
          )}
          <ToggleLink
            label="Monthly"
            value="month"
            active={effectiveMode === 'month'}
            serviceId={serviceId}
          />
          <ToggleLink
            label="Annual"
            value="year"
            active={effectiveMode === 'year'}
            serviceId={serviceId}
          />
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${isFull ? 'sm:grid-cols-2' : ''}`}>
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
            {scopeLabel && active.bookings === 0
              ? `No bookings for ${scopeLabel} yet`
              : bookedCaption}
          </p>
          <BookingsBars series={chartSeries} unit={chartUnit} />
        </div>

        {/* Earnings panel — FULL (Pro+) only. Basic/Solo shows count alone. */}
        {isFull && (
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
            <EarningsSparkline series={chartSeries} unit={chartUnit} />
          </div>
        )}
      </div>

      {/* NULL-service reconciliation — bookings not tied to any specific
          service are excluded from a per-service view; say so honestly. */}
      {scopeLabel && nullServiceExcluded && nullServiceExcluded > 0 ? (
        <p className="text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          Excludes {nullServiceExcluded} booking
          {nullServiceExcluded === 1 ? '' : 's'} not tied to a specific service.
        </p>
      ) : null}
    </section>
  );
}

function ToggleLink({
  label,
  value,
  active,
  serviceId,
}: {
  label: string;
  value: MomentumMode;
  active: boolean;
  /** Active service scope — preserved across the window switch. */
  serviceId: string | null;
}) {
  return (
    <Link
      href={buildPerformanceHref({ service: serviceId, momentum: value })}
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

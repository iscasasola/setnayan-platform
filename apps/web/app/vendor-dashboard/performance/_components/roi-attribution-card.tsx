import { Sparkles, Store, Info } from 'lucide-react';
import type { SourceAttribution } from '@/lib/vendor-source-attribution';
import { formatPhp } from '@/lib/vendors';

/**
 * "Setnayan vs your own book · what the app added" — the app-vs-import ROI
 * panel. It splits the vendor's BOOKED business into Setnayan-sourced (the
 * marketplace found them the couple) vs. off-platform (a couple they already
 * knew, added manually), from vendor_source_attribution().
 *
 * Headline: "₱X in bookings Setnayan sourced for you this year — ~N× your
 * annual plan", then two bars — Setnayan (gold) vs your imported clients (gray).
 * Booking COUNTS are always shown; the peso figures are labeled honestly as
 * partial, because total_cost_php is nullable and vendors settle off-platform.
 *
 * Money is rendered here only on a page already gated to owner/admin.
 */

/** A single labeled bar with a count + revenue, scaled to the larger of the two. */
function AttributionBar({
  label,
  bookingCount,
  revenuePhp,
  pricedCount,
  widthPct,
  tone,
}: {
  label: string;
  bookingCount: number;
  revenuePhp: number;
  pricedCount: number;
  widthPct: number;
  tone: 'setnayan' | 'own';
}) {
  const barColor = tone === 'setnayan' ? 'var(--m-orange)' : 'var(--m-slate-4)';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          {tone === 'setnayan' ? (
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden style={{ color: 'var(--m-orange-2)' }} />
          ) : (
            <Store className="h-4 w-4" strokeWidth={1.75} aria-hidden style={{ color: 'var(--m-slate-2)' }} />
          )}
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums" style={{ color: 'var(--m-slate)' }}>
          {bookingCount} booking{bookingCount === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-8 flex-1 overflow-hidden rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--m-ink) 5%, transparent)' }}
        >
          <div
            className="h-full rounded-lg"
            style={{ width: `${Math.max(widthPct, bookingCount > 0 ? 6 : 0)}%`, background: barColor }}
          />
        </div>
        <span
          className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums"
          style={{ color: 'var(--m-ink)' }}
        >
          {pricedCount > 0 ? formatPhp(revenuePhp) : '—'}
        </span>
      </div>
      {pricedCount > 0 && pricedCount < bookingCount ? (
        <p className="mt-1 text-right text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
          {pricedCount} of {bookingCount} priced
        </p>
      ) : null}
    </div>
  );
}

export function RoiAttributionCard({
  attribution,
  annualPlanPhp,
  windowLabel,
  scopeLabel = null,
  nullServiceExcluded = null,
}: {
  attribution: SourceAttribution | null;
  /** The vendor's own annual plan cost (PHP), or 0/null when on a free tier. */
  annualPlanPhp: number | null;
  /** Human window label for the headline, e.g. "this year". */
  windowLabel: string;
  /** Selected service's display label, or null when All services. Drives the
   *  scoped empty-state copy ("No bookings for {label} yet"). */
  scopeLabel?: string | null;
  /** Count of booked rows NOT tied to any service (service_id IS NULL) in this
   *  window, for the reconciliation footnote. null = All services (no footnote). */
  nullServiceExcluded?: number | null;
}) {
  const hasAnything = attribution && attribution.totalBookings > 0;

  const setnayan = attribution?.setnayan;
  const off = attribution?.offPlatform;

  // Bar scaling: relative to the larger booking count of the two channels.
  const maxCount = Math.max(setnayan?.bookingCount ?? 0, off?.bookingCount ?? 0, 1);
  const setnayanWidth = ((setnayan?.bookingCount ?? 0) / maxCount) * 100;
  const offWidth = ((off?.bookingCount ?? 0) / maxCount) * 100;

  const setnayanRevenue = setnayan?.revenuePhp ?? 0;
  const setnayanPriced = setnayan?.pricedCount ?? 0;

  // "~N× your annual plan" — only when the vendor pays for a plan AND there's
  // confirmed Setnayan-sourced revenue to compare. Never fabricated.
  const roiMultiple =
    annualPlanPhp && annualPlanPhp > 0 && setnayanPriced > 0 && setnayanRevenue > 0
      ? setnayanRevenue / annualPlanPhp
      : null;
  const roiMultipleLabel =
    roiMultiple === null
      ? null
      : roiMultiple >= 10
        ? `~${Math.round(roiMultiple)}×`
        : `~${roiMultiple.toFixed(1)}×`;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
        Setnayan vs your own book
        <span className="ml-2 font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate-3)' }}>
          What the app added
        </span>
      </h2>

      {!hasAnything ? (
        <div className="py-6 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6" strokeWidth={1.5} aria-hidden style={{ color: 'var(--m-slate-4)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
            {scopeLabel ? `No bookings for ${scopeLabel} yet` : 'No booked business yet'}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Once couples start booking you, this shows how much of that work
            Setnayan sourced for you versus business you brought in yourself.
          </p>
        </div>
      ) : (
        <div>
          {/* Headline */}
          <p className="text-3xl font-semibold tabular-nums sm:text-4xl" style={{ color: 'var(--m-ink)' }}>
            {setnayanPriced > 0 ? formatPhp(setnayanRevenue) : `${setnayan?.bookingCount ?? 0} bookings`}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--m-slate)' }}>
            {setnayanPriced > 0 ? 'in bookings' : ''} Setnayan sourced for you {windowLabel}
            {roiMultipleLabel ? (
              <>
                {' — '}
                <span className="font-semibold" style={{ color: 'var(--m-orange-2)' }}>
                  {roiMultipleLabel} your annual plan
                </span>
              </>
            ) : null}
          </p>

          {/* Two bars */}
          <div className="mt-6 space-y-5">
            <AttributionBar
              label="From Setnayan"
              tone="setnayan"
              bookingCount={setnayan?.bookingCount ?? 0}
              revenuePhp={setnayanRevenue}
              pricedCount={setnayanPriced}
              widthPct={setnayanWidth}
            />
            <AttributionBar
              label="Your imported clients"
              tone="own"
              bookingCount={off?.bookingCount ?? 0}
              revenuePhp={off?.revenuePhp ?? 0}
              pricedCount={off?.pricedCount ?? 0}
              widthPct={offWidth}
            />
          </div>

          {/* Honesty footer — the peso ROI is partial. */}
          {attribution.totalPriced < attribution.totalBookings ? (
            <div className="mt-5 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden style={{ color: 'var(--m-slate-3)' }} />
              <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
                Peso figures cover the{' '}
                <span className="font-medium">
                  {attribution.totalPriced} of {attribution.totalBookings}
                </span>{' '}
                bookings with a confirmed price on Setnayan. You settle payment
                directly with couples, so amounts agreed off-platform won&rsquo;t
                appear here.
              </p>
            </div>
          ) : null}

          {/* NULL-service reconciliation — a per-service view omits bookings
              not tied to any specific service; say so honestly. */}
          {scopeLabel && nullServiceExcluded && nullServiceExcluded > 0 ? (
            <p className="mt-3 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              Excludes {nullServiceExcluded} booking
              {nullServiceExcluded === 1 ? '' : 's'} not tied to a specific
              service.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

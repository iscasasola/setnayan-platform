import { Sparkles, Store, HelpCircle, Info } from 'lucide-react';
import type { SourceAttribution } from '@/lib/vendor-source-attribution';
import { formatPhp } from '@/lib/vendors';

/**
 * ROI Attribution card — the "did Setnayan earn its keep?" panel.
 *
 * Splits the vendor's BOOKED business into Setnayan-sourced (the marketplace
 * found them the couple) vs. off-platform (a couple they already knew added
 * them manually). Booking COUNTS are always shown; the peso revenue split is
 * shown honestly labeled as partial, because total_cost_php is nullable and
 * vendors settle payment off-platform.
 *
 * Money figures are rendered by this card only on a page that has already
 * gated the caller to owner/admin (canManageVendor) — the page is the gate.
 */

function SharePips({ pct }: { pct: number | null }) {
  // A 10-pip bar visualizing the Setnayan share (green) vs off-platform (ink).
  const filled = pct === null ? 0 : Math.round(pct / 10);
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 flex-1 rounded-full ${
            i < filled ? 'bg-emerald-500' : 'bg-ink/12'
          }`}
        />
      ))}
    </div>
  );
}

function AttributionTile({
  icon,
  label,
  bookingCount,
  pricedCount,
  revenuePhp,
  accent,
  blurb,
}: {
  icon: React.ReactNode;
  label: string;
  bookingCount: number;
  pricedCount: number;
  revenuePhp: number;
  accent: string;
  blurb: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <span className={accent}>{icon}</span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-ink">
        {bookingCount}
        <span className="ml-1 text-sm font-normal text-ink/50">
          booking{bookingCount === 1 ? '' : 's'}
        </span>
      </p>
      <p className="mt-1 text-sm font-medium text-ink/80">
        {pricedCount > 0 ? formatPhp(revenuePhp) : '—'}
        {pricedCount > 0 && pricedCount < bookingCount ? (
          <span className="ml-1 text-xs font-normal text-ink/45">
            · {pricedCount} of {bookingCount} priced
          </span>
        ) : null}
      </p>
      <p className="mt-1.5 text-xs text-ink/55">{blurb}</p>
    </div>
  );
}

export function RoiAttributionCard({
  attribution,
}: {
  attribution: SourceAttribution | null;
}) {
  const hasAnything = attribution && attribution.totalBookings > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2
          className="font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--m-slate)' }}
        >
          Did Setnayan earn its keep?
        </h2>
      </div>

      {!hasAnything ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-ink/30" strokeWidth={1.5} aria-hidden />
          <p className="text-sm font-medium text-ink/65">No booked business yet</p>
          <p className="mt-1 text-xs text-ink/45">
            Once couples start booking you, this shows how much of that work
            Setnayan sourced for you versus business you brought in yourself.
          </p>
        </div>
      ) : (
        <>
          {/* Headline share bar. */}
          <div className="rounded-2xl border border-ink/10 bg-cream p-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-ink/55">Setnayan-sourced share of your bookings</p>
                <p className="mt-0.5 text-3xl font-semibold tabular-nums text-ink">
                  {attribution.setnayanBookingSharePct === null
                    ? '—'
                    : `${attribution.setnayanBookingSharePct}%`}
                </p>
              </div>
              {attribution.setnayanRevenueSharePct !== null ? (
                <p className="mb-1 text-right text-xs text-ink/55">
                  <span className="font-medium text-ink/80">
                    {attribution.setnayanRevenueSharePct}%
                  </span>
                  <br />
                  of confirmed revenue
                </p>
              ) : null}
            </div>
            <div className="mt-3">
              <SharePips pct={attribution.setnayanBookingSharePct} />
            </div>
            <p className="mt-2 text-xs text-ink/45">
              Out of bookings we can attribute. Unattributed legacy bookings are
              excluded from this share.
            </p>
          </div>

          {/* Two tiles: Setnayan-sourced vs off-platform. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AttributionTile
              icon={<Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              accent="text-emerald-600"
              label="Setnayan sourced"
              bookingCount={attribution.setnayan.bookingCount}
              pricedCount={attribution.setnayan.pricedCount}
              revenuePhp={attribution.setnayan.revenuePhp}
              blurb="Couples who found you through marketplace search or a Setnayan suggestion."
            />
            <AttributionTile
              icon={<Store className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              accent="text-ink/55"
              label="Brought in yourself"
              bookingCount={attribution.offPlatform.bookingCount}
              pricedCount={attribution.offPlatform.pricedCount}
              revenuePhp={attribution.offPlatform.revenuePhp}
              blurb="Couples you already knew, added to their plan manually."
            />
          </div>

          {/* Unattributed note (only when present). */}
          {attribution.unattributed.bookingCount > 0 ? (
            <div className="flex items-start gap-2 rounded-2xl border border-ink/10 bg-ink/[0.02] p-3">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink/35" strokeWidth={1.75} aria-hidden />
              <p className="text-xs text-ink/50">
                {attribution.unattributed.bookingCount} older booking
                {attribution.unattributed.bookingCount === 1 ? '' : 's'} predate
                source tracking, so we can&rsquo;t attribute{' '}
                {attribution.unattributed.bookingCount === 1 ? 'it' : 'them'} to a
                channel.
              </p>
            </div>
          ) : null}

          {/* Honesty footer — the peso ROI is partial. */}
          {attribution.totalPriced < attribution.totalBookings ? (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden />
              <p className="text-xs text-amber-900">
                Revenue figures cover the{' '}
                <span className="font-medium">
                  {attribution.totalPriced} of {attribution.totalBookings}
                </span>{' '}
                bookings that have a confirmed price on Setnayan. You settle
                payment directly with couples, so amounts you agreed off-platform
                won&rsquo;t appear here.
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

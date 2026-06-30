import { Coins } from 'lucide-react';
import type { AdminPesoOverview } from '@/lib/vendor-peso';

/**
 * Admin Peso-Per-Lead unit-economics card (Wave 6) — rendered on
 * /admin/insights. Watches vendor ROI / retention: per-vendor token-answer
 * spend + paid-subscription spend ÷ bookings → cost-per-booked-couple, plus a
 * platform blended line. Visible at all breakpoints (the page's
 * MobileLandingGrid below is mobile-only nav overflow).
 *
 * BEHAVIORAL HONESTY: token burn-on-answer IS live — `unlock_vendor_event`
 * consumes 1–3 region-banded tokens when a PRO/ENTERPRISE vendor accepts an
 * inquiry. Platform-wide token spend reads ₱0 today only because the lone real
 * vendor is the founder (token-gate-exempt) and no other paid vendor has burned
 * yet — NOT because the consume is off. This card states that when `burnInert`
 * (= ₱0 platform token spend), and the ₱/token used to peso-ify token counts is
 * the admin-managed TOKEN_PRICE_PHP (read in lib/vendor-peso.ts, not hardcoded).
 * It never fabricates spend.
 */

function peso(n: number | null | undefined, maxFrac = 0): string {
  if (n === null || n === undefined) return '—';
  return `₱${Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  })}`;
}

const nf = new Intl.NumberFormat('en-PH');

export function PesoPerLeadAdminCard({ overview }: { overview: AdminPesoOverview }) {
  const { periodDays, tokenPricePhp, rows, totals, burnInert } = overview;
  const topRows = rows.slice(0, 8);

  return (
    <section className="m-card mb-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-label-mono" style={{ color: 'var(--m-slate-2)' }}>
            Vendor unit economics
          </p>
          <h2 className="m-display-tight mt-1 text-2xl" style={{ color: 'var(--m-ink)' }}>
            Peso-per-lead scorecard
          </h2>
          <p className="mt-1 max-w-prose text-sm" style={{ color: 'var(--m-slate)' }}>
            What vendors spend (token answers + subscription) against the couples
            they book — your read on vendor ROI and retention over the last{' '}
            {periodDays} days.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-300/70 bg-success-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-success-800">
          <Coins className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Live
        </span>
      </div>

      {/* Platform totals */}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="Active vendors" value={nf.format(totals.vendors)} />
        <Metric label="Leads answered" value={nf.format(totals.leadsAnswered)} />
        <Metric
          label="Total spend"
          value={peso(totals.totalSpendPhp)}
          sub={`${peso(totals.tokenSpendPhp)} tokens · ${peso(
            totals.subscriptionSpendPhp,
          )} subs`}
        />
        <Metric
          label="Blended ₱/booked couple"
          value={peso(totals.costPerBookedCouplePhp)}
          sub={`${nf.format(totals.finalizedBookings)} bookings`}
          emphasis
        />
      </div>

      {burnInert && (
        <p className="mt-4 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2.5 text-[12px] leading-relaxed text-ink/60">
          <span className="font-medium text-ink/75">Why ₱0 —</span> burn-on-answer
          is live (Pro/Enterprise vendors burn 1–3 region-banded tokens to accept
          an inquiry), but platform token spend is{' '}
          <span className="font-mono">₱0</span> because the only active vendor is
          the founder account (token-gate-exempt) and no other paid vendor has
          burned yet. It starts tracking real spend as paid vendors onboard.
          Subscription spend is real. Token counts are valued at the
          admin-managed {peso(tokenPricePhp)}/token.
        </p>
      )}

      {/* Per-vendor table */}
      {topRows.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-[0.1em] text-ink/45" style={{ borderColor: 'var(--m-line)' }}>
                <th className="py-2 pr-3 font-medium">Vendor</th>
                <th className="py-2 px-3 font-medium">Tier</th>
                <th className="py-2 px-3 text-right font-medium">Leads</th>
                <th className="py-2 px-3 text-right font-medium">Bookings</th>
                <th className="py-2 px-3 text-right font-medium">Token ₱</th>
                <th className="py-2 px-3 text-right font-medium">Sub ₱</th>
                <th className="py-2 pl-3 text-right font-medium">₱/booked</th>
              </tr>
            </thead>
            <tbody>
              {topRows.map((r) => (
                <tr
                  key={r.vendorProfileId}
                  className="border-b last:border-0"
                  style={{ borderColor: 'var(--m-line)' }}
                >
                  <td className="py-2 pr-3 font-medium text-ink">{r.businessName}</td>
                  <td className="py-2 px-3 text-ink/60">{r.tierState ?? '—'}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-ink/75">
                    {nf.format(r.leadsAnswered)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-ink/75">
                    {nf.format(r.finalizedBookings)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-ink/75">
                    {peso(r.tokenSpendPhp)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-ink/75">
                    {peso(r.subscriptionSpendPhp)}
                  </td>
                  <td className="py-2 pl-3 text-right font-semibold tabular-nums text-ink">
                    {peso(r.costPerBookedCouplePhp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > topRows.length && (
            <p className="mt-2 text-[11px] text-ink/45">
              Showing top {topRows.length} of {nf.format(rows.length)} active vendors
              by bookings.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-4 text-center text-sm text-ink/55">
          No vendor economics to show yet — vendors appear here once they answer
          a lead, subscribe, or finalize a booking.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={'rounded-lg border px-4 py-3 ' + (emphasis ? 'bg-ink/[0.02]' : '')}
      style={{ borderColor: 'var(--m-line)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-ink/50">{sub}</p> : null}
    </div>
  );
}

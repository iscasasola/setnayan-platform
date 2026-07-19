import { Coins, Receipt, Users } from 'lucide-react';
import type { VendorPesoScorecard } from '@/lib/vendor-peso';

/**
 * Peso-Per-Lead Scorecard card (Wave 6 vendor benefit) — rendered on
 * /vendor-dashboard/subscription. A server component (pure render, no
 * interactivity): "you spent ₱X tokens + ₱Y subscription this cycle = ₱Z per
 * booked couple."
 *
 * BEHAVIORAL HONESTY: token burn-on-answer IS live — `unlock_vendor_event`
 * consumes a flat 1 token (₱200 · 2026-07-12 lock, previously 1–3 region-banded)
 * when a paid-tier vendor accepts an inquiry (FREE blocked · VERIFIED ≤10/wk AND burns · SOLO/PRO/
 * ENTERPRISE unlimited AND burns). Token spend reads ₱0 for a vendor who simply
 * hasn't answered a burning inquiry this cycle. The card says THAT plainly
 * when `burnInert` (= ₱0 token spend this cycle); it never implies the vendor is
 * getting paid leads for free as a perk, and never claims the burn is "off."
 * (The misnomer flag name `burnInert` is kept for compatibility; it means "₱0
 * token spend this cycle," not "burn disabled.") The ₱/token price is
 * admin-managed and read from TOKEN_PRICE_PHP, not hardcoded here.
 */

function peso(n: number | null | undefined, opts?: { maxFrac?: number }): string {
  if (n === null || n === undefined) return '—';
  return `₱${Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: opts?.maxFrac ?? 0,
  })}`;
}

export function PesoPerLeadCard({ scorecard }: { scorecard: VendorPesoScorecard }) {
  const {
    periodDays,
    tokenPricePhp,
    tokenSpendPhp,
    subscriptionSpendPhp,
    totalSpendPhp,
    leadsAnswered,
    finalizedBookings,
    costPerBookedCouplePhp,
    costPerLeadPhp,
    burnInert,
    noSpendYet,
  } = scorecard;

  return (
    <section className="sn-tile mt-8 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="sn-eye">Peso-per-lead scorecard</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.015em]">Your unit economics</h2>
          <p className="mt-1 max-w-prose text-sm text-ink/60">
            What this {periodDays}-day cycle cost you — token answers plus
            subscription — measured against the couples you actually booked.
          </p>
        </div>
      </div>

      {/* Spend breakdown */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Coins className="h-4 w-4" strokeWidth={2} aria-hidden />}
          label="Token answers"
          value={peso(tokenSpendPhp)}
          sub={
            burnInert
              ? 'No token answers this cycle'
              : `${scorecard.tokensBurnedTotal} tokens × ${peso(tokenPricePhp)}`
          }
        />
        <Stat
          icon={<Receipt className="h-4 w-4" strokeWidth={2} aria-hidden />}
          label="Subscription"
          value={peso(subscriptionSpendPhp)}
          sub="Paid plan this cycle"
        />
        <Stat
          icon={<Users className="h-4 w-4" strokeWidth={2} aria-hidden />}
          label="Total spend"
          value={peso(totalSpendPhp)}
          sub={`${leadsAnswered} lead${leadsAnswered === 1 ? '' : 's'} answered`}
          emphasis
        />
      </div>

      {/* The headline ratios */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Ratio
          label="Cost per booked couple"
          value={peso(costPerBookedCouplePhp, { maxFrac: 0 })}
          note={
            finalizedBookings > 0
              ? `${peso(totalSpendPhp)} ÷ ${finalizedBookings} lifetime booking${
                  finalizedBookings === 1 ? '' : 's'
                }`
              : 'No finalized bookings yet'
          }
        />
        <Ratio
          label="Cost per lead"
          value={burnInert ? peso(0) : peso(costPerLeadPhp, { maxFrac: 2 })}
          note={
            burnInert
              ? 'No answered leads burned this cycle'
              : `${peso(tokenSpendPhp)} ÷ ${leadsAnswered} answered`
          }
        />
      </div>

      {/* ₱0 honesty note — the burn IS live; this explains why spend reads ₱0. */}
      {(burnInert || noSpendYet) && (
        <p className="mt-4 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2.5 text-[12px] leading-relaxed text-ink/60">
          <span className="font-medium text-ink/75">Your peso-per-lead reads</span>{' '}
          <span className="font-mono">₱0</span> because you haven&apos;t answered an
          inquiry that burned tokens this cycle. Each answered lead burns a flat{' '}
          {peso(tokenPricePhp)} — this scorecard tracks it the moment you do.
        </p>
      )}
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        'rounded-lg border px-4 py-3 ' + (emphasis ? 'bg-ink/[0.02]' : '')
      }
      style={{ borderColor: 'var(--m-line)' }}
    >
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-ink/50">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink/50">{sub}</p>
    </div>
  );
}

function Ratio({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink/50">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] text-ink/50">{note}</p>
    </div>
  );
}

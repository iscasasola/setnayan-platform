import { Wallet, CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import type { PaydayTotals } from '@/lib/vendor-cashflow';

/**
 * Payday KPI cards — expected / confirmed / still-owed / overdue. Read-only
 * aggregates; no money moves here. Matches the dashboard card styling
 * (rounded-2xl, border-ink/10, terracotta accent).
 */
export function PaydaySummary({ totals }: { totals: PaydayTotals }) {
  const cards = [
    {
      label: 'Expected (all installments)',
      value: formatPhp(totals.expectedPhp),
      icon: Wallet,
      tone: 'text-terracotta',
      bg: 'bg-terracotta/10',
    },
    {
      label: 'Confirmed received',
      value: formatPhp(totals.confirmedPhp),
      icon: CheckCircle2,
      tone: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Still owed',
      value: formatPhp(totals.owedPhp),
      icon: Clock3,
      tone: 'text-ink/70',
      bg: 'bg-ink/5',
    },
    {
      label: `Overdue${totals.overdueCount ? ` · ${totals.overdueCount}` : ''}`,
      value: formatPhp(totals.overduePhp),
      icon: AlertTriangle,
      tone: totals.overdueCount ? 'text-rose-600' : 'text-ink/40',
      bg: totals.overdueCount ? 'bg-rose-500/10' : 'bg-ink/5',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <article
          key={c.label}
          className="rounded-2xl border border-ink/10 bg-white p-4"
        >
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.bg} ${c.tone}`}
          >
            <c.icon aria-hidden className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{c.value}</p>
          <p className="mt-1 text-xs text-ink/60">{c.label}</p>
        </article>
      ))}
    </div>
  );
}

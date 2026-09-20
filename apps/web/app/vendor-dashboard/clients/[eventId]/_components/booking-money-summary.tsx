import { CheckCircle2, Wallet } from 'lucide-react';
import { formatPhp } from '@/lib/orders';
import type { BookingMoney } from '@/lib/vendor-cashflow';

/**
 * What this booking has paid, and what is left — for a booking with no frozen
 * installment plan. Renders nothing when there is no money on record, so the
 * caller's own empty state still speaks for a booking with nothing logged.
 */
export function BookingMoneySummary({ money }: { money: BookingMoney }) {
  if (money.rows.length === 0) return null;
  const pct =
    money.expectedPhp > 0 ? Math.min(100, Math.round((money.receivedPhp / money.expectedPhp) * 100)) : 0;
  return (
    <div data-booking-money className="space-y-3">
      <div className="flex items-center justify-between text-xs text-ink/55">
        <span>
          <span className="font-semibold text-ink">{formatPhp(money.receivedPhp)}</span> received of{' '}
          {formatPhp(money.expectedPhp)}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-success-600" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2">
        {money.rows.map((r) => (
          <li
            key={`${r.event_vendor_id}:${r.seq}`}
            className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
          >
            {r.confirmed ? (
              <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-success-600" strokeWidth={2} />
            ) : (
              <Wallet aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
            )}
            <p className="min-w-0 flex-1 text-sm font-medium text-ink">
              {r.label} · {r.amount_php === null ? '—' : formatPhp(r.amount_php)}
            </p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                r.confirmed ? 'bg-success-100 text-success-900' : 'bg-ink/[0.06] text-ink/60'
              }`}
            >
              {r.confirmed ? 'Received' : 'Not yet'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

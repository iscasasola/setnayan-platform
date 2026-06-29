import { CheckCircle2, AlertTriangle, CalendarDays } from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import type { PaydayInstallment } from '@/lib/vendor-cashflow';

/** 'YYYY-MM-DD' → 'Mar 14, 2027'. Returns a dash when null. */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  // Anchor at noon UTC so the en-PH render never slips a day across timezones.
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * One installment line on the Payday timeline. Read-only — shows the booking,
 * the installment label, the resolved peso amount, due date, and a
 * confirmed / overdue / due status pill.
 */
export function PaydayInstallmentRow({ inst }: { inst: PaydayInstallment }) {
  const statusPill = inst.confirmed
    ? {
        Icon: CheckCircle2,
        text: 'Received',
        cls: 'bg-emerald-500/10 text-emerald-700',
      }
    : inst.overdue
      ? {
          Icon: AlertTriangle,
          text: 'Overdue',
          cls: 'bg-rose-500/10 text-rose-700',
        }
      : {
          Icon: CalendarDays,
          text: 'Due',
          cls: 'bg-ink/5 text-ink/60',
        };

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{inst.event_name}</p>
        <p className="truncate text-xs text-ink/55">
          {inst.label}
          {inst.hasDueDate ? <> · due {formatDate(inst.due_date)}</> : <> · no due date yet</>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-semibold tabular-nums text-ink">
          {formatPhp(inst.amount_php)}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPill.cls}`}
        >
          <statusPill.Icon aria-hidden className="h-3 w-3" strokeWidth={2} />
          {statusPill.text}
        </span>
      </div>
    </li>
  );
}

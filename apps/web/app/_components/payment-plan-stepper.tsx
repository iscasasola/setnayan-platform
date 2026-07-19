import { CheckCircle2, Circle, Clock, PartyPopper } from 'lucide-react';
import type { StepperInstallment } from '@/lib/vendor-service-payment-schedules';

/**
 * Vendor Transaction Lifecycle · Phase 2 · PR-D — the installment PROGRESS
 * STEPPER. Pure presentational + server-safe (no client hooks). Renders one row
 * per frozen plan installment with its settlement state:
 *
 *   • due     — empty circle, muted (no payment logged yet)
 *   • pending — clock, amber (logged, awaiting the vendor's confirmation)
 *   • paid    — filled check, success (vendor-confirmed)
 *
 * When the whole plan is cleared (clearedAt set) a banner crowns the list. An
 * empty plan (no formal schedule) renders the quiet "no installment schedule"
 * note so the caller can still show the cleared banner / direct-pay fallback.
 *
 * Shared by the couple workspace Payments section AND the vendor messages thread.
 * Colors come from the same `--m-*`-derived Tailwind tokens the surrounding
 * surfaces use (success-*, amber/terracotta, ink), so it inherits the active
 * theme rather than hard-coding a palette.
 */

const STATE_META = {
  paid: {
    Icon: CheckCircle2,
    ring: 'border-success-400 bg-success-50 text-success-700',
    label: 'Paid',
    labelClass: 'text-success-700',
  },
  pending: {
    Icon: Clock,
    ring: 'border-warn-400 bg-warn-50 text-warn-700',
    label: 'Awaiting confirmation',
    labelClass: 'text-warn-700',
  },
  due: {
    Icon: Circle,
    ring: 'border-ink/15 bg-cream text-ink/30',
    label: 'Due',
    labelClass: 'text-ink/45',
  },
} as const;

function formatPHP(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

// A frozen due_date is a DATE-ONLY string (YYYY-MM-DD); anchor at UTC noon so
// the en-PH render never shifts a day across the +08:00 boundary.
function formatDueDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(d);
}

export function PaymentPlanStepper({
  steps,
  clearedAt,
  className,
}: {
  steps: StepperInstallment[];
  clearedAt: string | null;
  className?: string;
}) {
  const cleared = clearedAt != null;

  return (
    <div className={['space-y-2.5', className ?? ''].join(' ')}>
      {cleared ? (
        <div className="flex items-center gap-2 rounded-lg border border-success-400 bg-success-50 px-3 py-2 text-sm font-semibold text-success-800">
          <PartyPopper aria-hidden className="h-4 w-4" strokeWidth={2} />
          <span>Payment plan cleared — all installments settled.</span>
        </div>
      ) : null}

      {steps.length === 0 ? (
        <p className="text-[11px] text-ink/55">
          No installment schedule — pay the vendor directly.
        </p>
      ) : (
        <ol className="space-y-2" role="list">
          {steps.map((s) => {
            const meta = STATE_META[s.state];
            const Icon = meta.Icon;
            const amount =
              formatPHP(s.amount_php) ??
              (s.amount_kind === 'percent' && s.percent_bps != null
                ? `${Math.round(s.percent_bps / 100)}% of total`
                : 'Amount TBD');
            const due = formatDueDate(s.due_date);
            return (
              <li
                key={s.seq}
                className="flex items-center gap-2.5"
                aria-label={`${s.label}: ${meta.label}`}
              >
                <span
                  className={[
                    'grid h-6 w-6 shrink-0 place-items-center rounded-full border',
                    meta.ring,
                  ].join(' ')}
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{s.label}</p>
                  <p className={['text-[11px]', meta.labelClass].join(' ')}>
                    {meta.label}
                    {due ? ` · due ${due}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-xs font-semibold tabular-nums text-ink">
                  {amount}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

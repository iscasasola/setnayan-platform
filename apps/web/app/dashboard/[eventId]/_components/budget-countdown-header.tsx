import Link from 'next/link';
import { Wallet, CalendarHeart } from 'lucide-react';
import {
  formatEventDateWithPrecision,
  type EventDatePrecision,
} from '@/lib/events';

// V1 pilot Home v2 — owner directive 2026-05-22.
// Renders ABOVE StageStrip on the customer event-home. Three numbers
// (target / committed / projected) + a days-to-wedding stamp. Status tone
// on the projected number reflects how close committed pacing is to the
// host's stated budget target. When no target is set, the strip
// short-circuits to a polite "Set your budget" CTA so the host can fill
// it in from Settings without leaving the home page.

type Props = {
  /** events.event_date — may be NULL for early-planning events. */
  eventDate: string | null;
  /** events.event_date_precision — 'year' / 'month' / 'day'. Controls
   *  how the date renders and whether days-out is meaningful. */
  eventDatePrecision: EventDatePrecision;
  /** events.estimated_budget_centavos (PHP centavos), populated by
   *  the Budget Setter at /dashboard/[eventId]/budget. When NULL the
   *  strip surfaces a "Set your budget" CTA instead of the three-
   *  number layout. The column landed in migration 20260604030000. */
  targetCentavos: number | null;
  /** Sum of every "money committed so far" signal Setnayan can count:
   *  paid + fulfilled orders, plus contract-or-better event_vendors
   *  whose total_cost_php is known. Always defined; 0 when nothing
   *  has been spent yet. */
  committedCentavos: number;
  /** Route to host settings — used by the "Set your budget" CTA. */
  settingsHref: string;
  /** Used for "67 days to your wedding" — passed in so server time
   *  is the source of truth (no client clock surprises). */
  now: Date;
};

export function BudgetCountdownHeader({
  eventDate,
  eventDatePrecision,
  targetCentavos,
  committedCentavos,
  settingsHref,
  now,
}: Props) {
  const daysOut = computeDaysOut(eventDate, eventDatePrecision, now);
  const dateLabel = eventDate
    ? formatEventDateWithPrecision(eventDate, eventDatePrecision)
    : 'Date to be confirmed';

  const targetPhp = targetCentavos !== null ? targetCentavos / 100 : null;
  const committedPhp = committedCentavos / 100;

  // Projected final: trust the host's target when set; otherwise
  // gently inflate committed by 10% so the rightmost number is
  // never zero out the gate.
  const projectedPhp = targetPhp !== null ? targetPhp : Math.round(committedPhp * 1.1);

  // Status copy + tone on the projected line.
  const status = computeStatus(projectedPhp, targetPhp);

  return (
    <section
      aria-labelledby="budget-countdown-heading"
      className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 id="budget-countdown-heading" className="sr-only">
        Your wedding at a glance
      </h2>

      {/* Countdown line — stays on top in both layouts. */}
      <div className="flex items-baseline gap-2">
        <CalendarHeart aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {countdownLabel(daysOut)}
        </p>
      </div>
      <p className="mt-1 font-display text-xl italic text-ink/80 sm:text-2xl">{dateLabel}</p>

      {/* Three-number row. Stacked on mobile, horizontal on desktop. */}
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-ink/10 pt-5 sm:grid-cols-3 sm:gap-6">
        <BudgetCell
          label="Target"
          value={targetPhp !== null ? formatPesoCompact(targetPhp) : '—'}
          hint={
            targetPhp !== null ? (
              'Your stated budget'
            ) : (
              <Link
                href={settingsHref}
                className="inline-flex items-center gap-1 text-terracotta hover:text-terracotta-700"
              >
                <Wallet aria-hidden className="h-3 w-3" />
                Set your budget · helps us project
              </Link>
            )
          }
        />
        <BudgetCell
          label="Committed"
          value={formatPesoCompact(committedPhp)}
          hint={committedPhp > 0 ? 'Paid + signed vendors' : 'Nothing committed yet'}
        />
        <BudgetCell
          label="Projected final"
          value={formatPesoCompact(projectedPhp)}
          hint={<span className={status.tone}>{status.copy}</span>}
        />
      </div>
    </section>
  );
}

function BudgetCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">{label}</p>
      <p className="font-display text-3xl text-ink sm:text-4xl">{value}</p>
      <p className="text-xs text-ink/65">{hint}</p>
    </div>
  );
}

function computeDaysOut(
  date: string | null,
  precision: EventDatePrecision,
  now: Date,
): number | null {
  if (!date) return null;
  if (precision !== 'day') return null;
  const target = new Date(`${date}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

function countdownLabel(daysOut: number | null): string {
  if (daysOut === null) return 'Your wedding';
  if (daysOut < 0) {
    const past = Math.abs(daysOut);
    if (past === 1) return '1 day ago';
    if (past < 30) return `${past} days ago`;
    return `Past wedding day`;
  }
  if (daysOut === 0) return 'Today';
  if (daysOut === 1) return '1 day to your wedding';
  return `${daysOut} days to your wedding`;
}

function computeStatus(
  projected: number,
  target: number | null,
): { copy: string; tone: string } {
  if (target === null) {
    return {
      copy: 'Set a target to see how you’re tracking',
      tone: 'text-ink/55',
    };
  }
  if (target === 0) {
    return {
      copy: 'Set a target to see how you’re tracking',
      tone: 'text-ink/55',
    };
  }
  const ratio = projected / target;
  if (ratio <= 1) {
    const headroom = target - projected;
    if (headroom < 1000) {
      return { copy: '✓ Right on target', tone: 'text-emerald-700' };
    }
    return {
      copy: `✓ ${formatPesoCompact(headroom)} under target`,
      tone: 'text-emerald-700',
    };
  }
  const over = projected - target;
  if (ratio <= 1.1) {
    return {
      copy: `${formatPesoCompact(over)} over · room to trim`,
      tone: 'text-amber-700',
    };
  }
  return {
    copy: `${formatPesoCompact(over)} over · time to review`,
    tone: 'text-red-700',
  };
}

/**
 * Compact peso formatter. Drops to "₱412K" / "₱1.4M" so the three numbers
 * fit a mobile row without truncation. Full pesos when under ₱10K so small
 * commitments (a single ₱8,500 down payment) still feel real.
 */
function formatPesoCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '₱0';
  const abs = Math.abs(value);
  if (abs < 10_000) {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (abs < 1_000_000) {
    const k = value / 1_000;
    const rounded = Math.abs(k) >= 100 ? Math.round(k) : Math.round(k * 10) / 10;
    return `₱${rounded}K`;
  }
  const m = value / 1_000_000;
  const rounded = Math.abs(m) >= 10 ? Math.round(m * 10) / 10 : Math.round(m * 100) / 100;
  return `₱${rounded}M`;
}

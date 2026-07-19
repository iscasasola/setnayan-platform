'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, CalendarClock, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPhp, type BudgetLiveSummary } from '@/lib/budget';
import { getBudgetLiveSummary } from '../actions';

/**
 * Live payment-progress card for the budget page. Renders the three headline
 * totals (total to pay / paid so far / balance), a % progress bar, and the
 * next coming payments — and keeps all of it current in real time by
 * subscribing to Supabase Realtime on the event's payments + line-item
 * tables. Any INSERT/UPDATE/DELETE triggers a server refetch
 * (getBudgetLiveSummary), so logging a payment in one tab updates this card in
 * every open tab within ~500ms, no refresh.
 *
 * `initial` is computed server-side during the page render, so the card shows
 * correct numbers on first paint before the channel even connects.
 */
export function BudgetLiveSummaryCard({
  eventId,
  initial,
}: {
  eventId: string;
  initial: BudgetLiveSummary;
}) {
  const [summary, setSummary] = useState<BudgetLiveSummary>(initial);
  const [live, setLive] = useState(false);

  // Keep the latest props as the baseline when the server re-renders the page
  // (e.g. after the log-payment form's revalidatePath). Without this, a hard
  // server refresh would be ignored in favor of stale client state.
  useEffect(() => {
    setSummary(initial);
  }, [initial]);

  const refetch = useCallback(async () => {
    const fresh = await getBudgetLiveSummary(eventId);
    if (fresh) setSummary(fresh);
  }, [eventId]);

  // Skip a redundant refetch on the FIRST subscribe — `initial` is already
  // fresh from the server render. Only re-pull on reconnects, which may have
  // missed events while the socket was down.
  const subscribedOnce = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`budget-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_vendor_payments',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refetch();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_vendor_line_items',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          void refetch();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive(true);
          if (subscribedOnce.current) {
            // Reconnect — backfill anything missed while offline.
            void refetch();
          }
          subscribedOnce.current = true;
        } else {
          setLive(false);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, refetch]);

  const { budget, paid, remaining, percentPaid, upcoming } = summary;

  return (
    <section
      aria-labelledby="budget-live-heading"
      className="sn-tile space-y-5"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <TrendingUp aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          <h2
            id="budget-live-heading"
            className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
          >
            Payment progress
          </h2>
        </div>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45"
          title={live ? 'Updating in real time' : 'Reconnecting…'}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              live ? 'bg-success-500 animate-pulse' : 'bg-ink/25'
            }`}
          />
          {live ? 'Live' : 'Syncing'}
        </span>
      </header>

      {/* Progress bar — paid vs total to pay. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-ink/65">
            <span className="font-semibold text-ink">{formatPhp(paid)}</span>
            <span className="text-ink/45"> of </span>
            <span className="font-semibold text-ink">{formatPhp(budget)}</span>
            <span className="text-ink/45"> paid</span>
          </p>
          <p className="font-mono text-2xl font-bold text-ink">{percentPaid}%</p>
        </div>
        <div
          className="sn-bar h-2 w-full overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={percentPaid}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Percent of budget paid"
        >
          <i
            className="bg-terracotta transition-[width] duration-500 ease-out"
            style={{ width: `${percentPaid}%` }}
          />
        </div>
      </div>

      {/* Three headline totals. */}
      <ul className="grid grid-cols-3 gap-3">
        <Stat label="Total to pay" value={formatPhp(budget)} />
        <Stat label="Paid so far" value={formatPhp(paid)} tone="good" />
        <Stat
          label="Balance"
          value={formatPhp(remaining)}
          tone={remaining > 0 ? 'warn' : 'good'}
        />
      </ul>

      {/* Next coming payments. */}
      <div className="space-y-2 border-t border-ink/10 pt-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
          Next payments
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink/55">
            No scheduled payments coming up. Add a due date to a line item below
            and it&rsquo;ll appear here.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {upcoming.map((p) => (
              <UpcomingRow key={p.key} payment={p} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn' | 'good';
}) {
  return (
    <li className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">{label}</p>
      <p
        className={`font-mono text-lg font-bold tracking-tight sm:text-xl ${
          tone === 'warn'
            ? 'text-terracotta-700'
            : tone === 'good'
              ? 'text-success-700'
              : 'text-ink'
        }`}
      >
        {value}
      </p>
    </li>
  );
}

function UpcomingRow({
  payment,
}: {
  payment: BudgetLiveSummary['upcoming'][number];
}) {
  const { label: whenLabel, overdue } = dueMeta(payment.dueDate);
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {overdue ? (
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-700"
            strokeWidth={1.75}
          />
        ) : (
          <CalendarClock
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-ink/40"
            strokeWidth={1.75}
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {payment.vendorName}
            <span className="text-ink/45"> · {payment.label}</span>
          </p>
          <p className="text-xs text-ink/55">
            {formatDate(payment.dueDate)}
            <span aria-hidden> · </span>
            <span className={overdue ? 'font-medium text-terracotta-700' : 'text-ink/55'}>
              {whenLabel}
            </span>
          </p>
        </div>
      </div>
      <p className="shrink-0 text-right text-sm font-semibold text-ink">
        {formatPhp(payment.remainingPhp)}
      </p>
    </li>
  );
}

/**
 * Relative-time label for a due date. Past dates read as "Nd overdue"; the
 * near future gets friendly "today"/"tomorrow"/"in N days"; further out
 * collapses to weeks so the line stays short.
 */
function dueMeta(dueDate: string): { label: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { label: `${n} ${n === 1 ? 'day' : 'days'} overdue`, overdue: true };
  }
  if (diffDays === 0) return { label: 'Due today', overdue: false };
  if (diffDays === 1) return { label: 'Due tomorrow', overdue: false };
  if (diffDays <= 30) return { label: `In ${diffDays} days`, overdue: false };
  const weeks = Math.round(diffDays / 7);
  return { label: `In ${weeks} weeks`, overdue: false };
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

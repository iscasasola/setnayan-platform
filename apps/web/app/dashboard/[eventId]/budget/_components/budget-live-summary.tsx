'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatPhp, type BudgetLiveSummary } from '@/lib/budget';
import { getBudgetLiveSummary } from '../actions';

/**
 * The DOM id `BudgetTopSummary` (page.tsx) sets on its `<header>` — the
 * element with no border of its own. BA4: the pinned condensed bar below
 * measures THIS box, never the outer `.sn-tile` card, because that card's
 * rect includes its 1px border and every measurement drawn from it drifts a
 * pixel off the real content edge.
 */
export const BUDGET_TOP_SUMMARY_HEADER_ID = 'budget-top-summary-header';

/**
 * Live payment-progress + pinned-summary card for the budget page (BA4). Sits
 * inside `BudgetTopSummary`'s single card, below the four Target · Agreed ·
 * Paid · Owed tiles — so this component owns only the progress bar, the
 * upcoming-payments list, and the condensed bar that pins once the tiles
 * above scroll out of view. It no longer prints its own copy of the headline
 * figures; BA2/BA3's "two summaries, four overlapping words" defect is closed
 * by there being exactly one place those numbers are stated.
 *
 * Keeps the BUD-2 realtime subscription unchanged: any INSERT/UPDATE/DELETE
 * on the event's payments + line-item tables triggers a server refetch
 * (getBudgetLiveSummary), so logging a payment in one tab updates this card —
 * AND the pinned bar, which reads the same `summary` state — in every open
 * tab within ~500ms, no refresh.
 *
 * `initial` is computed server-side during the page render, so the card shows
 * correct numbers on first paint before the channel even connects.
 */
export function BudgetLiveSummaryCard({
  eventId,
  initial,
  targetPhp,
}: {
  eventId: string;
  initial: BudgetLiveSummary;
  /** `events.estimated_budget_centavos` in PHP. null = no target set. Drives
   *  the pinned bar's over-target flip. */
  targetPhp: number | null;
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

  // `budget` here IS Agreed (BudgetTopSummary's tile) — `budgetLiveSummaryMoney`
  // (lib/budget-page-money.ts) sets it to the same `money.committed` the strip
  // shows. `remaining` is Owed (stillOwed, not committed-minus-paid — they
  // differ whenever a vendor is overpaid).
  const { budget: agreedPhp, paid: paidPhp, remaining: owedPhp, percentPaid, upcoming } = summary;

  const isOverTarget = targetPhp !== null && agreedPhp > targetPhp;

  // ── BA4 · THE PINNED CONDENSED BAR ────────────────────────────────────────
  // Watches BudgetTopSummary's own `<header>` (via its DOM id — a ref cannot
  // cross the server/client boundary between the two components) and flips a
  // boolean when it scrolls out of view. Defaults to `false`, which is also
  // the CORRECT no-JS state: with JavaScript disabled this effect never runs,
  // the bar simply never pins, and the full summary above (rendered by the
  // server, not by this effect) is what a no-JS reader sees — nothing here
  // gates the PAGE's content on the observer firing, only this one bonus bar.
  const [pinned, setPinned] = useState(false);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const header = document.getElementById(BUDGET_TOP_SUMMARY_HEADER_ID);
    if (!header) return;
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setPinned(!entry.isIntersecting);
    }, {
      // Fires the instant the header's top edge crosses the viewport top —
      // not some way into the scroll, which would leave a gap where neither
      // the full summary nor the pinned one is visible.
      rootMargin: '-1px 0px 0px 0px',
    });
    io.observe(header);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const header = document.getElementById(BUDGET_TOP_SUMMARY_HEADER_ID);
    if (!header) return;
    const measure = () => {
      // getBoundingClientRect() on the HEADER itself, not the outer `.sn-tile`
      // card — that card carries a 1px border, and a rect that includes it
      // drifts the pinned bar a pixel off the real content edge.
      const r = header.getBoundingClientRect();
      setBox({ left: r.left, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [pinned]);

  const scrollToTop = useCallback(() => {
    document
      .getElementById(BUDGET_TOP_SUMMARY_HEADER_ID)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="space-y-5 border-t border-ink/10 pt-5">
      <div className="flex items-center justify-end">
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
      </div>

      {/* Progress bar — paid vs agreed. */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-ink/65">
            <span className="font-semibold text-ink">{formatPhp(paidPhp)}</span>
            <span className="text-ink/45"> of </span>
            <span className="font-semibold text-ink">{formatPhp(agreedPhp)}</span>
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
          aria-label="Percent of agreed money paid"
        >
          <i
            className="bg-terracotta transition-[width] duration-500 ease-out"
            style={{ width: `${percentPaid}%` }}
          />
        </div>
      </div>

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

      {/* BA4 — the condensed bar. Always in the DOM (so a JS-disabled reader
       *  never sees a flash of missing chrome), opacity/pointer-events toggled
       *  by `pinned`. `top` docks it below the shared hide-on-scroll bar via
       *  the same `--fd-bar` token that bar's own wrapper is sized from, and
       *  rides up to 0 when that bar has hidden itself — DOCKING below the
       *  existing chrome rather than stacking a third independent bar. */}
      <div
        className="fixed inset-x-0 z-30 transition-opacity duration-150"
        style={{
          top: 'var(--fd-bar, 56px)',
          opacity: pinned ? 1 : 0,
          pointerEvents: pinned ? 'auto' : 'none',
        }}
        aria-hidden={!pinned}
      >
        <button
          type="button"
          onClick={scrollToTop}
          className={`block w-full border-b px-4 py-2.5 text-left backdrop-blur-sm transition-colors ${
            isOverTarget
              ? 'border-terracotta/30 bg-terracotta/[0.08]'
              : 'border-ink/10 bg-white/85'
          }`}
          style={
            box
              ? { marginLeft: box.left, width: box.width, maxWidth: box.width }
              : undefined
          }
          aria-label="Back to your budget summary"
        >
          <span className="flex items-center justify-between gap-3">
            <PinnedStat label="Agreed" value={formatPhp(agreedPhp)} />
            <PinnedStat label="Paid" value={formatPhp(paidPhp)} />
            <PinnedStat
              label="Owed"
              value={formatPhp(owedPhp)}
              tone={isOverTarget ? 'warn' : 'default'}
            />
          </span>
          <span
            className="mt-1.5 block h-[3px] w-full overflow-hidden rounded-full bg-ink/10"
            role="img"
            aria-label={`${percentPaid}% of agreed money paid`}
          >
            <span
              className={`block h-full ${isOverTarget ? 'bg-terracotta' : 'bg-terracotta'}`}
              style={{ width: `${percentPaid}%` }}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

function PinnedStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'warn';
}) {
  return (
    <span className="flex flex-col items-start">
      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </span>
      <span
        className={`font-mono text-sm font-bold tabular-nums ${
          tone === 'warn' ? 'text-terracotta-700' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </span>
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
      {/* 🔤 A LEDGER COLUMN, so it is set in the ledger face. "Next payments" is
          a divided list of rows with the amount right-aligned down one edge —
          the Ledger archetype's own `.l-amt .a` (Space Mono, tabular). It was
          the one money column on this screen that the 2026-08-25 typeface pass
          missed, because that pass found stat components by SHAPE (a component
          taking `label` + `value`) and this row takes a `payment`. One shape is
          not a survey; the guard now censuses every rendered figure. */}
      <p className="shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-ink">
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

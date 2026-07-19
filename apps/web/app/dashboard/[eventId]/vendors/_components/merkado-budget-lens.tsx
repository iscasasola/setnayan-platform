import Link from 'next/link';
import { Wallet, Clock, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchBudgetSnapshot, buildBudgetLiveSummary, formatPhp } from '@/lib/budget';

/**
 * MerkadoBudgetLens — the Budget tab inside the Merkado (Services takeover).
 *
 * The couple's full budget (target + median-anchored allotments + per-vendor
 * itemization + payment schedules + off-platform manual line items) already
 * lives, mature, at `/dashboard/[eventId]/budget`. This is a compact LENS of it
 * where the money decisions happen — the Merkado — reusing the exact same
 * `buildBudgetLiveSummary` the budget page's live card uses (no new math, no new
 * schema): payment progress + the next few due milestones, then a link to the
 * full surface for setting the budget, allotments, itemizing, and logging
 * payments. Removing the standalone "Budget" nav item (2026-07-10) is safe
 * because this tab — plus its "Open full budget" link — keeps that surface reachable.
 */
export async function MerkadoBudgetLens({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const snapshot = await fetchBudgetSnapshot(supabase, eventId).catch(() => null);

  const budgetHref = `/dashboard/${eventId}/budget`;

  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-cream p-5 text-sm text-ink/65">
        Your budget lives here. <Link href={budgetHref} className="font-medium text-terracotta hover:underline">Open budget &amp; payments</Link> to set a target and track costs.
      </div>
    );
  }

  const summary = buildBudgetLiveSummary(snapshot, 3);
  const hasBudget = summary.budget > 0;

  return (
    <div className="space-y-4">
      {/* Payment progress — reuses the budget page's live-summary math verbatim. */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
            <Wallet className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} aria-hidden />
            Payments
          </p>
          {hasBudget ? (
            <p className="text-sm text-ink/60">
              <span className="font-semibold text-ink">{formatPhp(summary.paid)}</span> paid ·{' '}
              <span className="font-semibold text-ink">{formatPhp(summary.remaining)}</span> to go
            </p>
          ) : null}
        </div>

        {hasBudget ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-success-500 transition-[width]"
                style={{ width: `${summary.percentPaid}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink/50">{summary.percentPaid}% of your itemized total is paid.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink/65">
            Set your budget and itemize vendor costs to start tracking payments.
          </p>
        )}
      </div>

      {/* Upcoming milestones — soonest first (past-due sort to the top). */}
      {summary.upcoming.length > 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-white/60 p-5">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
            Upcoming payments
          </p>
          <ul className="space-y-2.5">
            {summary.upcoming.map((p, i) => (
              <li key={p.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {p.vendorName} <span className="font-normal text-ink/50">· {p.label}</span>
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs text-ink/55">
                    {i === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2 py-0.5 font-medium text-warn-800">
                        <Clock className="h-3 w-3" strokeWidth={2} aria-hidden /> Next
                      </span>
                    ) : null}
                    Due {p.dueDate}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {formatPhp(p.remainingPhp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Into the full surface — set budget, median-anchored allotments,
          per-vendor itemization + off-platform manual line items, log payments. */}
      <Link
        href={budgetHref}
        className="flex items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-cream px-5 py-4 transition hover:border-terracotta/50"
      >
        <span className="text-sm text-ink/75">
          <span className="font-medium text-ink">Open budget &amp; payments</span> — set a target, plan
          allotments, itemize costs, add outside expenses, and log payments.
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}

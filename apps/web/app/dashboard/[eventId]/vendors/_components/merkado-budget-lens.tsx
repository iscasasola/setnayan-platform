import Link from 'next/link';
import { Wallet, Clock, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchBudgetSnapshot, buildBudgetLiveSummary, formatPhp } from '@/lib/budget';
import { isBudgetTruthEnabled } from '@/lib/budget-truth-flag';
import { resolveEventMoney, type EventMoney } from '@/lib/budget-truth';
import { budgetLiveSummaryMoney } from '@/lib/budget-page-money';

/**
 * MerkadoBudgetLens — the Budget tab inside the Merkado (Services takeover).
 *
 * The couple's full budget (target + median-anchored allotments + per-vendor
 * itemization + payment schedules + off-platform manual line items) already
 * lives, mature, at `/dashboard/[eventId]/budget`. This is a compact LENS of it
 * where the money decisions happen — the Merkado: payment progress + the next few
 * due milestones, then a link to the full surface for setting the budget,
 * allotments, itemizing, and logging payments. Removing the standalone "Budget"
 * nav item (2026-07-10) is safe because this tab — plus its "Open full budget"
 * link — keeps that surface reachable.
 *
 * OWNERSHIP (MARKETPLACE_FOUR_TABS_PLAN_2026-08-13 §5, settled): this lens owns
 * paid-so-far · progress · next dues · ONE doorway, and is READ-ONLY, always. The
 * target, allotments, itemization, manual lines, logging payments and export
 * belong to `/budget`. The lens never re-declares an editor control.
 *
 * ─── BUD-8 · why this file reads the resolver ────────────────────────────────
 * This lens and `/budget` are two screens a couple would both call "our money".
 * `/budget` moved onto the shared calculator in BUD-2; this one had not, so the
 * moment `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED` is switched on the two print
 * DIFFERENT NUMBERS FOR THE SAME WEDDING. Measured on the prod capture
 * (`scripts/budget-parity.ts`, event `044f7e64…`): the lens says **₱80,000 to
 * go** where `/budget` says **₱0 still owed**, because one `considering` vendor's
 * headline is an ESTIMATE — a guess the couple has not agreed to pay — and the
 * legacy formula folds it into the total anyway (§18.5 rules 2/3).
 *
 * So both surfaces now go through ONE core, `budgetLiveSummaryMoney`, with the
 * SAME degrade-to-legacy rule `budget/page.tsx` uses: any resolver failure
 * returns `null` and the lens falls back to the legacy figures rather than
 * printing a confident ₱0.
 *
 * ⚠ THIS MUST LAND BEFORE ANYONE FLIPS THAT FLAG.
 *
 * FLAG OFF (production today) renders byte-identically to before: the resolver
 * is not called, not one extra query is issued, and `budgetLiveSummaryMoney`
 * returns the legacy summary verbatim.
 *
 * ── B2 · WARM-EDITORIAL SKIN (2026-08-14) ───────────────────────────────────
 * The 2026-08-08 pass that made the app flat-cream shipped as ONE edit to the
 * shared `.sn-*` recipes, on the measured argument that `.sn-tile` had 417 uses
 * across 186 files. It therefore reached every surface that USES those classes —
 * the event Overview carries 19 of them — and no surface that hand-rolls its own
 * chrome. This whole Marketplace hand-rolled its own: measured 2026-08-14, its
 * seven components carried ZERO `.sn-tile` / `.sn-card` / `.sn-glass` between
 * them, which is precisely why the skin swap missed it and why it still read
 * glass-era next to a re-skinned Overview.
 *
 * Two concrete drifts, both now gone from this file: `rounded-2xl` is 22px
 * (`--m-r-lg`, the glass radius) where the approved card is 14px, and one panel
 * still carried `bg-white/60` — the translucent fill design#6 stripped from the
 * public doorways on 2026-08-13.
 *
 * Values are DERIVED, not re-typed: `.sn-tile` is the recipe. Padding is kept
 * explicit (`p-5`) because Tailwind utilities win over the class's own 18px, so
 * nothing reflows — the shipped `sn-tile p-4 sm:p-5` convention on other
 * dashboard surfaces.
 *
 * The skin is class-level and touches no money path: BUD-8's resolver wiring
 * above is untouched by it, and the two changes met only in this docblock.
 */
export async function MerkadoBudgetLens({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const budgetTruth = isBudgetTruthEnabled();

  const [snapshot, money] = await Promise.all([
    fetchBudgetSnapshot(supabase, eventId).catch(() => null),
    // Degrade to the legacy figures on ANY resolver failure rather than printing
    // a confident ₱0 — same rule, same shape, as `budget/page.tsx`. Flag OFF
    // issues no extra query at all.
    budgetTruth
      ? resolveEventMoney(supabase, eventId).catch((): EventMoney | null => null)
      : Promise.resolve<EventMoney | null>(null),
  ]);

  const budgetHref = `/dashboard/${eventId}/budget`;

  if (!snapshot) {
    return (
      <div className="sn-tile p-5 text-sm text-ink/65">
        Your budget lives here. <Link href={budgetHref} className="font-medium text-terracotta-700 hover:underline">Open budget &amp; payments</Link> to set a target and track costs.
      </div>
    );
  }

  // ONE core, shared with `/budget`'s live card. Flag OFF → `legacy` verbatim.
  // The 3-milestone cap is this lens's own framing (the /budget card lists them
  // all); `budgetLiveSummaryMoney` passes `upcoming` through untouched, so the
  // cap survives the move onto the resolver.
  const summary = budgetLiveSummaryMoney({
    enabled: budgetTruth,
    money,
    legacy: buildBudgetLiveSummary(snapshot, 3),
  });
  const hasBudget = summary.budget > 0;

  return (
    <div className="space-y-4">
      {/* Payment progress — reuses the budget page's live-summary math verbatim. */}
      <div className="sn-tile p-5">
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
            {/* The base of this percentage CHANGES with the flag: legacy divides
                by every vendor's itemized total, the resolver divides by what the
                couple has actually committed. Naming the wrong base under a right
                number is the same misleading-label defect the resolver exists to
                end, so the noun follows the arithmetic. Flag OFF is byte-identical. */}
            <p className="mt-1.5 text-xs text-ink/50">{summary.percentPaid}% of {budgetTruth ? 'what you have committed' : 'your itemized total'} is paid.</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink/65">
            Set your budget and itemize vendor costs to start tracking payments.
          </p>
        )}
      </div>

      {/* Upcoming milestones — soonest first (past-due sort to the top). */}
      {summary.upcoming.length > 0 ? (
        <div className="sn-tile p-5">
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
        className="sn-tile flex items-center justify-between gap-2 px-5 py-4 hover:border-terracotta/50"
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

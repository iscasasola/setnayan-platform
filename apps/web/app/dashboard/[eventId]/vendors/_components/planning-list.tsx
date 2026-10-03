'use client';

/**
 * PlanningList — "Your planning": the five planning doors on the Suppliers tab,
 * in plain sight.
 *
 * Owner 2026-10-03: Budget, Shortlist (now "Saved"), Build, Payments and Plans
 * sat inside the ⋯ menu and the owner could not find them — "thought they were
 * lost". They are now ONE short visible list under the supplier rows and the
 * Find a supplier button; the ⋯ menu that held them is gone (it held nothing
 * else — each destination has exactly one visible place).
 *
 * NOT NEW DESTINATIONS. Every row is what its ⋯ row was:
 *   Budget    a link to the Budget part (`teamParts`' own href — never typed here)
 *   the rest  the SHIPPED `goToBuildTab` bus, which scrolls to `#svc-<tab>`,
 *             mirrors `?tab=` and opens the find area first on a phone
 * Compare stays inside Plans/Build; its route is untouched.
 *
 * Labels come from `tabLabel()` (flag-aware, "Saved" for the shortlist) and
 * icons from `TAB_META` — authored here only for Budget, which is a page, not
 * a section.
 */

import Link from 'next/link';
import { Banknote, ChevronRight } from 'lucide-react';
import { TAB_META, goToBuildTab, tabLabel, type BudgetBuildTab } from '@/lib/budget-build';

/** Owner's order: Budget · Saved · Build · Plans · Payments. A permutation of
 *  `BUDGET_BUILD_TABS` (pinned by test) — keys never re-listed, only ordered. */
export const PLANNING_JUMP_ORDER: readonly BudgetBuildTab[] = ['shortlist', 'build', 'compare', 'budget'];

const ROW_CLASS =
  'flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-ink transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-mulberry';

export function PlanningList({ budgetHref }: { budgetHref?: string }) {
  return (
    <section aria-labelledby="planning-list-heading" data-planning-list="" className="mb-6">
      <h2
        id="planning-list-heading"
        className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/70"
      >
        Your planning
      </h2>
      <ul className="sn-tile divide-y divide-ink/10 overflow-hidden p-0">
        {budgetHref ? (
          <li>
            <Link href={budgetHref} className={ROW_CLASS} data-planning-row="budget">
              <Banknote className="h-5 w-5 shrink-0 text-ink/60" strokeWidth={1.75} aria-hidden />
              <span className="flex-1">Budget</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
            </Link>
          </li>
        ) : null}
        {PLANNING_JUMP_ORDER.map((tab) => {
          const { icon: Icon } = TAB_META[tab];
          return (
            <li key={tab}>
              <button type="button" onClick={() => goToBuildTab(tab)} className={ROW_CLASS} data-planning-row={tab}>
                <Icon className="h-5 w-5 shrink-0 text-ink/60" strokeWidth={1.75} aria-hidden />
                <span className="flex-1">{tabLabel(tab)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

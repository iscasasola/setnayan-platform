'use client';

/**
 * ServicesTakeover — the couple Services tab as a full-screen FOCUS MODE
 * takeover (Budget "Build"). Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Mirrors the Guests focus-mode shell (`guests/page.tsx`):
 *   - a `<style>` hides the global top bar on MOBILE only (desktop keeps it for
 *     the EventSwitcher + notifications; the takeover is full-screen on mobile).
 *   - a fixed floating X (top-left, `lg:hidden`) is the single exit → event Home;
 *     desktop keeps the sidebar.
 *   - the global 5-tab bottom nav is suppressed on `/vendors` (see
 *     `customer-bottom-nav.tsx`, gated on the `budgetBuild` prop) and REPLACED by
 *     this surface's own 5-tab section nav: Summary · Shortlist · Build ·
 *     Compare · Lock. On desktop the tabs render as a top strip instead.
 *
 * Phase 1 (this PR): the SHELL only. Shortlist renders today's Services
 * experience (the `PlanBudgetAccordion`, passed as `shortlistSlot`); the other
 * tabs are stubs that Phases 2–5 fill (Build engine, Compare, Summary, Lock).
 * Entirely behind `BUDGET_BUILD_ENABLED` — off in production until the owner flips it.
 */

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, Gauge, Bookmark, Hammer, Scale, Lock, type LucideIcon } from 'lucide-react';
import { BUDGET_BUILD_TABS, type BudgetBuildTab } from '@/lib/budget-build';

const TAB_META: Record<BudgetBuildTab, { label: string; icon: LucideIcon; blurb: string }> = {
  summary: {
    label: 'Summary',
    icon: Gauge,
    blurb: 'Your build at a glance — progress, budget used, and what comes next.',
  },
  shortlist: {
    label: 'Shortlist',
    icon: Bookmark,
    blurb: 'The bench — every service you are considering.',
  },
  build: {
    label: 'Build',
    icon: Hammer,
    blurb: 'Assemble a plan that fits your budget, date and guest count.',
  },
  compare: {
    label: 'Compare',
    icon: Scale,
    blurb: 'Put your saved builds side by side — and see which dates work.',
  },
  lock: {
    label: 'Lock',
    icon: Lock,
    blurb: 'Finalize the vendors for your wedding.',
  },
};

export function ServicesTakeover({
  eventId,
  summarySlot,
  shortlistSlot,
  buildSlot,
  compareSlot,
  lockSlot,
  initialTab = 'shortlist',
}: {
  eventId: string;
  summarySlot?: ReactNode;
  shortlistSlot?: ReactNode;
  buildSlot?: ReactNode;
  compareSlot?: ReactNode;
  lockSlot?: ReactNode;
  initialTab?: BudgetBuildTab;
}) {
  const [tab, setTab] = useState<BudgetBuildTab>(initialTab);

  const slots: Record<BudgetBuildTab, ReactNode> = {
    summary: summarySlot,
    shortlist: shortlistSlot,
    build: buildSlot,
    compare: compareSlot,
    lock: lockSlot,
  };
  const active = slots[tab];

  return (
    <section
      className="-mt-6 pt-[calc(env(safe-area-inset-top)+3.25rem)] lg:pt-0"
      data-budget-build-takeover=""
    >
      {/* Hide the global top bar on MOBILE only — the takeover is full-screen
          there. On desktop the top bar is the only host of the EventSwitcher +
          notifications bell (no sidebar fallback), so keep it; the desktop tab
          strip lives in the content area and won't collide. (Review 2026-06-09.) */}
      <style>{`@media (max-width:1023px){.shell-topbar{display:none}}`}</style>

      {/* Floating exit (mobile only) — the single way back to event home;
          desktop keeps the sidebar. */}
      <Link
        href={`/dashboard/${eventId}`}
        aria-label="Back to dashboard home"
        className="fixed left-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream/95 text-ink/70 shadow-[0_4px_14px_-6px_rgba(30,34,41,0.5)] ring-1 ring-ink/10 backdrop-blur transition-colors hover:bg-cream hover:text-ink lg:hidden"
      >
        <X className="h-5 w-5" strokeWidth={2} aria-hidden />
      </Link>

      {/* Desktop tab strip — mobile uses the fixed bottom section nav below. */}
      <div role="tablist" aria-label="Services sections" className="mb-4 hidden items-center gap-1 border-b border-ink/10 lg:flex">
        {BUDGET_BUILD_TABS.map((key) => {
          const { label, icon: Icon } = TAB_META[key];
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`bbtab-d-${key}`}
              aria-selected={on}
              aria-controls="budget-build-panel"
              onClick={() => setTab(key)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                on ? 'border-terracotta text-ink' : 'border-transparent text-ink/50 hover:text-ink/80'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      <div
        id="budget-build-panel"
        role="tabpanel"
        tabIndex={0}
        aria-label={TAB_META[tab].label}
        className="min-w-0"
      >
        {active ?? <TabStub tab={tab} />}
      </div>

      {/* Mobile section bottom nav — replaces the suppressed global bottom nav. */}
      <nav
        role="tablist"
        aria-label="Services sections"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink/10 bg-cream/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {BUDGET_BUILD_TABS.map((key) => {
          const { label, icon: Icon } = TAB_META[key];
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`bbtab-m-${key}`}
              aria-selected={on}
              aria-controls="budget-build-panel"
              onClick={() => setTab(key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2"
            >
              <Icon
                className={`h-5 w-5 ${on ? 'text-terracotta' : 'text-ink/50'}`}
                strokeWidth={1.75}
                aria-hidden
              />
              <span
                className={`text-[10px] ${on ? 'font-semibold text-terracotta' : 'text-ink/60'}`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}

function TabStub({ tab }: { tab: BudgetBuildTab }) {
  const { label, icon: Icon, blurb } = TAB_META[tab];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-ink">{label}</h2>
      <p className="text-sm text-ink/60">{blurb}</p>
      <p className="mt-1 text-xs text-ink/40">Coming together as we build this out.</p>
    </div>
  );
}

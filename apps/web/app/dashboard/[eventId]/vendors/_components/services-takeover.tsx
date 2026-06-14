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
 *   - the global 5-tab bottom nav stays VISIBLE at the screen bottom
 *     (nav-everywhere 2026-06-13). This surface's own 5-tab section nav
 *     (Summary · Shortlist · Build · Compare · Lock) is a STICKY HEADER at the
 *     top of the page body — above the panel, below the floating X — so it
 *     never double-stacks the global nav. On desktop the tabs render as a top
 *     strip instead.
 *
 * Phase 1 (this PR): the SHELL only. Shortlist renders today's Services
 * experience (the `PlanBudgetAccordion`, passed as `shortlistSlot`); the other
 * tabs are stubs that Phases 2–5 fill (Build engine, Compare, Summary, Lock).
 * Entirely behind `BUDGET_BUILD_ENABLED` — off in production until the owner flips it.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { X, Gauge, Bookmark, Hammer, Scale, Lock, type LucideIcon } from 'lucide-react';
import { BUDGET_BUILD_TABS, type BudgetBuildTab } from '@/lib/budget-build';

/** Cross-tab navigation: any slot can `window.dispatchEvent(new CustomEvent(
 *  'bb:tab', { detail: 'build' }))` to switch the takeover's active tab without a
 *  server round-trip (e.g. Compare "Modify" → Build, Build "Lock your build" →
 *  Lock). Kept here so the server-rendered slots stay decoupled from the tab state. */
export const BB_TAB_EVENT = 'bb:tab';
export function goToBuildTab(tab: BudgetBuildTab) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BB_TAB_EVENT, { detail: tab }));
  }
}

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

  // Switch sections AND mirror the choice into ?tab= so refresh + deep links
  // land on the same section (2026-06-12). replaceState — flipping sections
  // shouldn't pollute the back stack; the page never re-renders off the URL.
  const selectTab = useCallback((next: BudgetBuildTab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url);
    } catch {
      // URL/history unavailable — the tab still switches, just client-only.
    }
  }, []);

  // Let slots request a tab switch via the `bb:tab` CustomEvent (see goToBuildTab).
  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<BudgetBuildTab>).detail;
      if (next && BUDGET_BUILD_TABS.includes(next)) selectTab(next);
    };
    window.addEventListener(BB_TAB_EVENT, onTab);
    return () => window.removeEventListener(BB_TAB_EVENT, onTab);
  }, [selectTab]);

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

      {/* Desktop tab strip — pill segmented control (sn-seg). Mobile uses the
          sticky-top pill nav below. */}
      <div role="tablist" aria-label="Services sections" className="sn-seg mb-4 hidden lg:flex">
        {BUDGET_BUILD_TABS.map((key) => {
          const { label, icon: Icon } = TAB_META[key];
          const on = key === tab;
          return (
            <button
              key={`${key}-${tab}`}
              type="button"
              role="tab"
              id={`bbtab-d-${key}`}
              aria-selected={on}
              aria-controls="budget-build-panel"
              onClick={() => selectTab(key)}
              className={`sn-seg-item${on ? ' sn-bounce' : ''}`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {/* Mobile section nav — sticky-header pill segmented control (sn-seg).
          Desktop uses the top strip above. The global bottom nav now owns the
          very bottom of the screen, so this surface's own section nav rides at
          the top of the page body as a pill track instead of stacking a second
          bottom bar. The sticky wrapper keeps a soft backdrop pad behind the
          pill; the rectangular border-b framing is gone. */}
      <div className="sticky top-0 z-10 -mx-2 mb-2 bg-cream/95 px-2 py-2 backdrop-blur lg:hidden">
        <nav role="tablist" aria-label="Services sections" className="sn-seg">
          {BUDGET_BUILD_TABS.map((key) => {
            const { label, icon: Icon } = TAB_META[key];
            const on = key === tab;
            return (
              <button
                key={`${key}-${tab}`}
                type="button"
                role="tab"
                id={`bbtab-m-${key}`}
                aria-selected={on}
                aria-controls="budget-build-panel"
                onClick={() => selectTab(key)}
                className={`sn-seg-item min-w-0 px-1.5 text-[11px]${on ? ' sn-bounce' : ''}`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </nav>
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

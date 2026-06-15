'use client';

/**
 * ServicesTakeover — the couple Services tab as a full-screen FOCUS MODE
 * takeover (Budget "Build"). Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Mirrors the Guests focus-mode shell (`guests/page.tsx`):
 *   - a `<style>` hides the global top bar on MOBILE only (desktop keeps it for
 *     the EventSwitcher + notifications; the takeover is full-screen on mobile).
 *   - the global 5-tab bottom nav stays VISIBLE at the screen bottom
 *     (nav-everywhere 2026-06-13). This surface's own 5-tab section nav
 *     (Summary · Shortlist · Build · Compare · Lock) is a STICKY HEADER at the
 *     top of the page body — above the panel — so it never double-stacks the
 *     global nav. On desktop the tabs render as a top strip instead.
 *
 * The old floating focus-mode "back X" (top-left) was REMOVED 2026-06-15
 * (nav-surfaces follow-up to #1470): the global journey bottom nav is always
 * present here, so a dedicated "back to home" affordance is vestigial.
 *
 * Phase 1 (this PR): the SHELL only. Shortlist renders today's Services
 * experience (the `PlanBudgetAccordion`, passed as `shortlistSlot`); the other
 * tabs are stubs that Phases 2–5 fill (Build engine, Compare, Summary, Lock).
 * Entirely behind `BUDGET_BUILD_ENABLED` — off in production until the owner flips it.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Gauge, Bookmark, Hammer, Scale, Lock, type LucideIcon } from 'lucide-react';
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
  // `eventId` stays in the props contract (the page passes it) but is no longer
  // read in the body since the floating "back X" that used it was removed
  // 2026-06-15. Not destructured → no unused-var lint, caller API unchanged.
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
      className="-mt-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-0"
      data-budget-build-takeover=""
    >
      {/* Hide the global top bar on MOBILE only — the takeover is full-screen
          there. On desktop the top bar is the only host of the EventSwitcher +
          notifications bell (no sidebar fallback), so keep it; the desktop tab
          strip lives in the content area and won't collide. (Review 2026-06-09.) */}
      <style>{`@media (max-width:1023px){.shell-topbar{display:none}}`}</style>

      {/* (The floating focus-mode "back X" was removed 2026-06-15 — the global
          bottom nav is always present, so it's vestigial. The safe-area top
          padding above is kept because the top bar stays hidden on mobile.) */}

      {/* Desktop tab strip — pill segmented control (sn-seg). Mobile uses the
          sticky-top pill nav below. The show/hide (`hidden lg:block`) MUST live
          on a plain wrapper, NOT on the `.sn-seg` element itself:
          `.sn-seg { display: flex }` in globals.css has the same specificity as
          Tailwind's `.hidden` (`display: none`) but wins on source order, so
          `sn-seg ... hidden` never hides — it leaked the desktop strip onto
          mobile, stacking a second (full-label, overflowing) tab bar above the
          sticky mobile pill. Wrapping keeps the responsive toggle off `.sn-seg`,
          mirroring the mobile strip below. */}
      <div className="mb-4 hidden lg:block">
        <div role="tablist" aria-label="Services sections" className="sn-seg">
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
      </div>

      {/* Mobile section nav — DOCKED above the global bottom nav as that tab's
          own sub-nav (owner 2026-06-16 "pin it on top of the bottom nav as its
          sub nav"). A floating frosted pill that LIFTS into place on section
          entry: the `bb-subnav-dock` keyframe plays once on mount, and entering
          /vendors is what mounts this — so the lift fires on section entry and
          NOT when switching between sub-tabs (which is client state, no remount).

          Geometry mirrors the bottom-nav pill (bottom-nav.tsx → NavShell):
          inset 14px, frosted --m-paper-2 @ 92% + the same soft shadow, fully
          rounded — one size down so it reads as the nav's subordinate shelf.
          It docks ABOVE the nav: bottom = safe-area + 12px (nav's own offset)
          + 64px (nav height) + 8px gap = safe-area + 84px. The panel below
          carries matching bottom padding so its last content clears this
          floating chrome. Desktop (lg+) uses the top strip above. */}
      <nav
        role="tablist"
        aria-label="Services sections"
        className="bb-subnav-dock sn-seg fixed inset-x-[14px] bottom-[calc(env(safe-area-inset-bottom)+84px)] z-20 backdrop-blur lg:hidden"
        style={{
          background: 'rgba(248, 246, 240, 0.92)',
          boxShadow: '0 10px 30px -12px rgba(30, 34, 41, 0.35)',
        }}
      >
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

      {/* Active tab content. On mobile the docked sub-nav (above) + the global
          bottom nav both float over this, so reserve bottom space for both:
          safe-area + 40px clears the docked pill (whose top sits ~safe+125px)
          on top of the layout's own pb-20. Desktop has no docked pill → pb-0. */}
      <div
        id="budget-build-panel"
        role="tabpanel"
        tabIndex={0}
        aria-label={TAB_META[tab].label}
        className="min-w-0 pb-[calc(env(safe-area-inset-bottom)+40px)] lg:pb-0"
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

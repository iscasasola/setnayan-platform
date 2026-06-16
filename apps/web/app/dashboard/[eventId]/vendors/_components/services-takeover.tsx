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
import {
  BUDGET_BUILD_TABS,
  TAB_META,
  BB_TAB_EVENT,
  goToBuildTab,
  type BudgetBuildTab,
} from '@/lib/budget-build';

// The cross-tab bus (BB_TAB_EVENT + goToBuildTab) and TAB_META moved to
// @/lib/budget-build 2026-06-16: the docked mobile section sub-nav is now
// mounted in the EVENT LAYOUT (customer-section-subnav.tsx) — not here — so it
// paints and responds BEFORE this server-built panel resolves (owner: "the sub
// nav should always respond first"). The dock shares the bus + meta from the lib
// without importing across _components. Re-exported here so the existing
// imperative consumers (build-compare.tsx, build-picks-list.tsx) keep importing
// goToBuildTab from './services-takeover' unchanged.
export { BB_TAB_EVENT, goToBuildTab };

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

  // The docked section sub-nav (event layout) writes ?tab= via replaceState and
  // may do so while THIS page is still loading — before this panel mounts. On
  // mount, adopt the live ?tab= if it diverged from the server `initialTab`, so
  // a tab tapped during the load is honored. Deferred to an effect (not a lazy
  // initializer) so SSR + first client paint both agree on `initialTab` — no
  // hydration flash; the correction lands one render later. Runs once.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && (BUDGET_BUILD_TABS as readonly string[]).includes(t) && t !== tab) {
      setTab(t as BudgetBuildTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* Mobile section nav lives in the EVENT LAYOUT now, not here:
          <VendorsSectionSubnav> (dashboard/[eventId]/_components) mounts the
          reusable <SubNav> alongside the bottom nav so it paints + responds the
          instant Explore opens — before this server-built panel resolves (owner
          2026-06-16 "the sub nav should always respond first"). It self-gates to
          this route, seeds from ?tab=, and drives section switches over the
          shared BB_TAB_EVENT bus, which the `selectTab` listener below consumes.
          Desktop (lg+) still uses the top strip above. */}

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

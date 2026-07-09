'use client';

/**
 * ServicesTakeover — the couple Services tab as a full-screen FOCUS MODE
 * takeover (Budget "Build"). Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Mirrors the Guests focus-mode shell (`guests/page.tsx`):
 *   - a `<style>` hides the global top bar on MOBILE only (desktop keeps it for
 *     the EventSwitcher + notifications; the takeover is full-screen on mobile).
 *   - the global 5-tab bottom nav stays VISIBLE at the screen bottom
 *     (nav-everywhere 2026-06-13). This surface's own section nav
 *     (Shortlist · Build · Compare) is a STICKY HEADER at the top of the page
 *     body — above the panel — so it never double-stacks the global nav. On
 *     desktop the tabs render as a top strip instead.
 *
 * INTEGRATED SINGLE-SCROLL (2026-07-09): the three sections no longer swap one
 * mount at a time. All three slots render STACKED in one vertical scroll surface
 * — `#svc-shortlist` ("Browse the bench") · `#svc-build` ("Build your team") ·
 * `#svc-compare` ("Compare saved builds", collapsed by default). The sticky
 * strip is now an in-page SECTION NAV: selecting a section SMOOTH-SCROLLS to its
 * anchor and lights the active section (scroll-spy). The `BB_TAB_EVENT` bus +
 * `?tab=` contract is UNCHANGED — the mobile dock (`customer-section-subnav.tsx`)
 * and any `goToBuildTab` callers keep working verbatim; the bus listener now
 * SCROLLS instead of swapping mounts. Slot component internals (the 3-state Build
 * engine, Compare, the Shortlist accordion) are UNTOUCHED — they render as
 * section bodies exactly as before.
 *
 * The old floating focus-mode "back X" (top-left) was REMOVED 2026-06-15
 * (nav-surfaces follow-up to #1470): the global journey bottom nav is always
 * present here, so a dedicated "back to home" affordance is vestigial.
 *
 * Entirely behind `BUDGET_BUILD_ENABLED` — the flag-OFF path (legacy
 * `PlanBudgetAccordion`) lives in `page.tsx` and is unchanged.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
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

/** DOM id for a section's scroll anchor. Keyed by the same tab keys the mobile
 *  dock dispatches over the bus, so `goToBuildTab('build')` resolves to `#svc-build`. */
const sectionId = (tab: BudgetBuildTab) => `svc-${tab}`;

/** Per-section intro copy — the single-scroll headings the strip scrolls between. */
const SECTION_HEADING: Record<BudgetBuildTab, string> = {
  shortlist: 'Browse the bench',
  build: 'Build your team',
  compare: 'Compare saved builds',
};

export function ServicesTakeover({
  // `eventId` stays in the props contract (the page passes it) but is no longer
  // read in the body since the floating "back X" that used it was removed
  // 2026-06-15. Not destructured → no unused-var lint, caller API unchanged.
  shortlistSlot,
  buildSlot,
  compareSlot,
  initialTab = 'shortlist',
}: {
  eventId: string;
  shortlistSlot?: ReactNode;
  buildSlot?: ReactNode;
  compareSlot?: ReactNode;
  initialTab?: BudgetBuildTab;
}) {
  // `active` is now the HIGHLIGHTED section (scroll target / scroll-spy state),
  // not a mount switch — all three sections are always mounted below.
  const [active, setActive] = useState<BudgetBuildTab>(initialTab);
  // Compare is the least-used + longest section → collapsed by default,
  // expandable in place. Selecting/scrolling to Compare auto-expands it.
  const [compareOpen, setCompareOpen] = useState(false);
  // Guards the scroll-spy from fighting a programmatic smooth-scroll: while a
  // click/bus jump is animating we pin `active` to the target and ignore spy
  // updates until the scroll settles.
  const scrollLockRef = useRef<number>(0);

  // Scroll a section into view + light it + mirror ?tab= for refresh/deep-links.
  // Shared by the strip clicks, the bus listener, and the on-mount ?tab= adopt.
  const goToSection = useCallback((next: BudgetBuildTab, smooth = true) => {
    setActive(next);
    if (next === 'compare') setCompareOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url);
    } catch {
      // URL/history unavailable — the highlight/scroll still happen, client-only.
    }
    const el = document.getElementById(sectionId(next));
    if (el) {
      // Pin the highlight through the animation so the spy doesn't strobe the
      // in-between sections; released ~700ms later (smooth scroll is brief).
      scrollLockRef.current = Date.now() + (smooth ? 700 : 0);
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    }
  }, []);

  // The docked section sub-nav (event layout) writes ?tab= via replaceState and
  // may do so while THIS page is still loading — before this panel mounts. On
  // mount, adopt the live ?tab= if it points at a non-default section, scrolling
  // there so a tab tapped during the load is honored. Deferred to an effect (not
  // a lazy initializer) so SSR + first client paint agree on `initialTab` — no
  // hydration flash. `compare` also expands. Runs once.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && (BUDGET_BUILD_TABS as readonly string[]).includes(t)) {
      const next = t as BudgetBuildTab;
      if (next === 'compare') setCompareOpen(true);
      // Only jump for a non-shortlist target — shortlist is the top of the page
      // and scrolling to it on every load would be pointless jank.
      if (next !== 'shortlist') {
        // Defer one frame so the sections have laid out before we measure.
        requestAnimationFrame(() => goToSection(next, false));
      } else {
        setActive('shortlist');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let slots + the mobile dock request a section via the `bb:tab` CustomEvent
  // (see goToBuildTab). The contract is UNCHANGED for callers — the listener now
  // SCROLLS to the section instead of swapping the mounted panel.
  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<BudgetBuildTab>).detail;
      if (next && BUDGET_BUILD_TABS.includes(next)) goToSection(next);
    };
    window.addEventListener(BB_TAB_EVENT, onTab);
    return () => window.removeEventListener(BB_TAB_EVENT, onTab);
  }, [goToSection]);

  // Scroll-spy — light whichever section sits in the active band as the user
  // scrolls (client-only; SSR renders with `active = initialTab`). Same tuning
  // as the docked sub-nav's anchor spy so the two read consistently. Suspended
  // while a programmatic jump is animating (scrollLockRef).
  useEffect(() => {
    const visible = new Set<string>();
    const els = BUDGET_BUILD_TABS
      .map((t) => document.getElementById(sectionId(t)))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        if (Date.now() < scrollLockRef.current) return;
        // Topmost (document-order) section in the active band wins.
        const first = BUDGET_BUILD_TABS.find((t) => visible.has(sectionId(t)));
        if (first) setActive(first);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);

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

      {/* Desktop section nav — pill segmented control (sn-seg). Now an IN-PAGE
          anchor nav: each item smooth-scrolls to its section and lights the
          active one (scroll-spy). Mobile uses the docked sub-nav in the event
          layout. The show/hide (`hidden lg:block`) MUST live on a plain wrapper,
          NOT on `.sn-seg` itself: `.sn-seg { display: flex }` has the same
          specificity as `.hidden` (`display:none`) but wins on source order, so
          `sn-seg ... hidden` never hides — wrapping keeps the responsive toggle
          off `.sn-seg`. Not sticky — the desktop `.shell-topbar` already owns
          `sticky top-0 z-20`, so a second sticky strip would overlap it; the
          always-docked mobile sub-nav covers jump-anytime on mobile. */}
      <nav aria-label="Services sections" className="mb-4 hidden lg:block">
        <div className="sn-seg">
          {BUDGET_BUILD_TABS.map((key) => {
            const { label, icon: Icon } = TAB_META[key];
            const on = key === active;
            return (
              <button
                key={key}
                type="button"
                id={`bbtab-d-${key}`}
                aria-current={on ? 'true' : undefined}
                onClick={() => goToSection(key)}
                className={`sn-seg-item${on ? ' sn-bounce' : ''}`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile section nav lives in the EVENT LAYOUT: <CustomerSectionSubnav>
          drives section switches over the shared BB_TAB_EVENT bus, which the
          `goToSection` listener above consumes (now scrolling, not swapping).
          Desktop (lg+) uses the sticky strip above. */}

      {/* Merkado layout (S1 · 2026-07-09): MOBILE stacks (shortlist → build →
          compare) exactly as before — the grid collapses to one column and the
          right wrapper is a normal block, so the docked sub-nav + scroll-spy keep
          working. DESKTOP (lg+) becomes TWO COLUMNS: the tall shortlist on the
          left, the build + compare in a STICKY right rail that stays in view while
          you browse categories. Same single DOM — the slots are never mounted
          twice (no duplicate client state) — only reflowed by grid + sticky. The
          BB_TAB_EVENT bus, anchor nav, and scroll-spy are untouched. */}
      <div className="grid min-w-0 gap-8 pb-[calc(env(safe-area-inset-bottom)+40px)] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:pb-0">
        <div className="min-w-0">
          <ServiceSection tab="shortlist" heading={SECTION_HEADING.shortlist}>
            {shortlistSlot ?? <SectionStub tab="shortlist" />}
          </ServiceSection>
        </div>

        <div className="min-w-0 space-y-8 lg:sticky lg:top-4 lg:self-start">
          <ServiceSection tab="build" heading={SECTION_HEADING.build}>
            {buildSlot ?? <SectionStub tab="build" />}
          </ServiceSection>

          {/* Compare — collapsed by default (least-used + longest). Expands in
              place; selecting/scrolling to it auto-opens (compareOpen). */}
          <ServiceSection
            tab="compare"
            heading={SECTION_HEADING.compare}
            collapsible
            open={compareOpen}
            onToggle={() => setCompareOpen((v) => !v)}
          >
            {compareSlot ?? <SectionStub tab="compare" />}
          </ServiceSection>
        </div>
      </div>
    </section>
  );
}

/**
 * One stacked section of the single-scroll surface: an anchored `<section>` with
 * a serif heading. Compare passes `collapsible` → the body sits behind a
 * "Show comparison" disclosure (controlled by the parent so the nav can open it).
 */
function ServiceSection({
  tab,
  heading,
  children,
  collapsible = false,
  open = true,
  onToggle,
}: {
  tab: BudgetBuildTab;
  heading: string;
  children: ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const { blurb } = TAB_META[tab];
  const bodyId = `${sectionId(tab)}-body`;
  return (
    // scroll-mt clears the sticky desktop strip when scrolled into view.
    <section id={sectionId(tab)} aria-labelledby={`${sectionId(tab)}-h`} className="scroll-mt-24">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${sectionId(tab)}-h`}
            className="font-serif text-xl italic leading-tight text-ink sm:text-2xl"
          >
            {heading}
          </h2>
          <p className="mt-0.5 text-sm text-ink/55">{blurb}</p>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5"
          >
            {open ? 'Hide' : 'Show comparison'}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        )}
      </header>
      {(!collapsible || open) && <div id={bodyId}>{children}</div>}
    </section>
  );
}

/** Fallback body when a slot isn't supplied (e.g. a slot still being built). */
function SectionStub({ tab }: { tab: BudgetBuildTab }) {
  const { label, icon: Icon, blurb } = TAB_META[tab];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-ink">{label}</h3>
      <p className="text-sm text-ink/60">{blurb}</p>
      <p className="mt-1 text-xs text-ink/40">Coming together as we build this out.</p>
    </div>
  );
}

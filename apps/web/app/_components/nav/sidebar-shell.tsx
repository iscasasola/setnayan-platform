'use client';

/**
 * SidebarShell — v2.1 Navigation Refactor Phase 0.
 *
 * WHY: CLAUDE.md 2026-05-28 11th row "v2.1 template package adoption"
 * locked the burnt-sienna `--m-*` palette + paper backgrounds for the
 * shared sidebar treatment across all 3 doorways (customer · vendor ·
 * admin dashboards). This shell owns the structural concerns — desktop
 * sidebar visibility + collapsible state + sticky top bar slot + main
 * content area — without baking in any per-doorway content. Phases 1-3
 * (customer · vendor · admin refactors) compose their own NavGroup[]
 * arrays into a <SidebarSection> tree and pass it through `sidebar`.
 *
 * SCOPE: structural shell only. Sidebar content (groups + items) is
 * provided by the caller via `sidebar` prop. Mobile chrome (top bar
 * + bottom-nav) is also caller-injected so each doorway can keep its
 * existing mobile-only utilities cluster (Setnayan AI eyebrow on
 * couple side, role-switch + profile on vendor side, etc.).
 *
 * COLLAPSED STATE: persisted to localStorage under
 * `setnayan.nav.sidebar.collapsed` ('1' = collapsed, '0' = expanded).
 * Default = expanded. Toggle button sits inside the sidebar footer
 * (chevron-left when expanded, chevron-right when collapsed) so the
 * affordance moves with the sidebar itself. Collapsed width 64px
 * (4rem · icon-only), expanded width 256px (16rem · driven by
 * `--sidebar-width` CSS var). On collapse the `[data-sidebar-collapsed="1"]`
 * data attribute applies to the root so child components can hide
 * labels via CSS — no prop drilling required.
 *
 * RESPONSIVE: < lg (1024px) the sidebar is `hidden`; the caller's mobile
 * chrome handles all nav. ≥ lg the sidebar is the fixed left column and
 * mobile chrome is hidden via the caller's own breakpoint logic.
 *
 * Z-INDEX: sidebar sits at z-30 (above content, below modals/dialogs).
 * Sticky top-bar slot sits inside main column above content scroll.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHideOnScroll } from './use-hide-on-scroll';

const STORAGE_KEY = 'setnayan.nav.sidebar.collapsed';

type Props = {
  /** Sidebar content — typically a <SidebarSection> tree. */
  sidebar: ReactNode;
  /**
   * Pinned header slot rendered at the TOP of the sidebar, outside the
   * scrollable nav area. Use this for identity / branding elements
   * (AccountSwitcher, Wordmark + eyebrow) that must stay visible while the
   * nav items below scroll. Hidden automatically when the sidebar collapses
   * to the 64px icon rail via `[[data-sidebar-collapsed='1']_&]:hidden`.
   */
  sidebarHeader?: ReactNode;
  /**
   * Optional sidebar footer slot rendered pinned at the bottom of the
   * desktop sidebar, just above the collapse/expand toggle.
   */
  sidebarFooter?: ReactNode;
  /** Optional sticky top bar slot rendered above main content. */
  topBar?: ReactNode;
  /** Main content area — scrollable. */
  children: ReactNode;
};

export function SidebarShell({ sidebar, sidebarHeader, sidebarFooter, topBar, children }: Props) {
  // Default expanded. Hydrate from localStorage on mount so SSR + initial
  // client render agree (both render expanded), then flip if persisted
  // state says otherwise. Avoids hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);

  // Universal top-nav rule (owner 2026-06-15): the sticky top bar hides on
  // scroll-down and reveals on scroll-up — same behavior as the marketing
  // site nav. One change here covers all three dashboard doorways (couple /
  // vendor / admin), since each composes its top bar through this slot. Only
  // engages when a topBar is actually present. The desktop LEFT sidebar is a
  // side nav, not a top nav, so it stays put — the rule is top-navs-only.
  const topBarHidden = useHideOnScroll(Boolean(topBar));

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      if (v === '1') setCollapsed(true);
    } catch {
      // localStorage blocked (Safari private mode, etc.) — silently default
      // to expanded. The toggle still works in-session; just won't persist.
    }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // No-op — see above.
      }
      return next;
    });
  };

  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <div
      data-sidebar-collapsed={collapsed ? '1' : '0'}
      className="min-h-screen"
      style={{ background: 'var(--m-paper)' }}
    >
      {/* Desktop sidebar — hidden < lg so mobile chrome (caller-injected) owns nav. */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-30 lg:flex lg:flex-col lg:border-r"
        style={{
          background: 'var(--m-paper-2)',
          borderColor: 'var(--m-line)',
          width: collapsed ? '4rem' : 'var(--sidebar-width, 16rem)',
          transition: 'width 180ms cubic-bezier(.2,.7,.2,1)',
        }}
      >
        {/* Pinned header — identity / branding (AccountSwitcher, Wordmark).
            Rendered outside the scroll container so it stays put while the
            nav items below scroll. Hidden on the 64px collapsed rail. */}
        {sidebarHeader ? (
          <div
            className="shrink-0 border-b [[data-sidebar-collapsed='1']_&]:hidden"
            style={{ borderColor: 'var(--m-line)' }}
          >
            {sidebarHeader}
          </div>
        ) : null}

        {/* Scrollable nav — own scroll context so the pinned header + footer
            toggle stay in place regardless of how many items are in the tree. */}
        <div className="flex-1 overflow-y-auto py-3">{sidebar}</div>

        {/* Optional sidebar footer — utility affordances (Switch view pill,
            etc.) that should always be visible but not part of the scrolling
            section tree. Hidden when the sidebar collapses to 64px so the
            collapse-toggle button below has clean full-width treatment. */}
        {sidebarFooter && !collapsed ? (
          <div
            className="border-t px-3 py-3"
            style={{ borderColor: 'var(--m-line)' }}
          >
            {sidebarFooter}
          </div>
        ) : null}

        {/* Collapse toggle — sits in the footer so the affordance moves with
            the sidebar. Uses --m-line hover border per v2.1 ghost button
            treatment in globals.css .m-btn-ghost. */}
        <div
          className="border-t px-2 py-2"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:bg-[var(--m-paper)]"
            style={{
              color: 'var(--m-slate)',
              outlineColor: 'var(--m-orange)',
            }}
          >
            <ToggleIcon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main column — offset left by sidebar width on desktop. The CSS calc
          via inline style mirrors the sidebar's width so a future drag-to-
          resize handle (V1.x) can drive both off the same --sidebar-width var. */}
      <div
        className="lg:transition-[padding] lg:duration-[180ms]"
        style={{
          paddingLeft: collapsed
            ? undefined
            : undefined,
        }}
      >
        <div
          className="lg:pl-0"
          style={{
            // Tailwind `lg:pl-[var(--sidebar-width,16rem)]` isn't safe with the
            // collapsed state, so use a runtime media query via inline style with
            // a CSS custom property. The wrapper sets --shell-main-offset which
            // the inner div consumes.
            ['--shell-main-offset' as string]: collapsed
              ? '4rem'
              : 'var(--sidebar-width, 16rem)',
          }}
        >
          {/* Sticky top bar slot — caller-owned. The shell guarantees the slot
              renders above the scrollable main content area and inherits the
              same offset as the rest of the column. */}
          {topBar ? (
            <div
              // `shell-topbar` is a stable hook so an individual page can
              // hide the sticky top strip (e.g. the Vendors tab renders its
              // own full-bleed black budget bar in its place). Purely a
              // styling hook — no behavior here. The transform classes apply
              // the universal hide-on-scroll-down / reveal-on-scroll-up rule.
              className={`shell-topbar sticky top-0 z-20 transition-transform duration-300 ease-out motion-reduce:transition-none ${
                topBarHidden ? '-translate-y-full' : 'translate-y-0'
              }`}
              style={{
                background: 'var(--m-paper)',
                borderBottom: '1px solid var(--m-line)',
              }}
            >
              <div className="lg:pl-[var(--shell-main-offset)]">{topBar}</div>
            </div>
          ) : null}

          {/* Main scroll area. Caller controls inner max-width / padding. */}
          <main className="lg:pl-[var(--shell-main-offset)]">{children}</main>
        </div>
      </div>
    </div>
  );
}

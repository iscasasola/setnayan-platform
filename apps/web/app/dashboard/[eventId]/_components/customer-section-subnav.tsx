'use client';

/**
 * CustomerSectionSubnav — the ONE docked section sub-nav for the customer doorway.
 *
 * Owner direction 2026-06-17: *"sub nav are child menus of the 6 menus."* This
 * replaces the two bespoke section docks (guests-section-subnav.tsx +
 * vendors-section-subnav.tsx) with a single config-driven component that renders
 * whichever of the 6 menus' CHILDREN belong to the current route — sourced from
 * the canonical tree in `lib/customer-menu.ts`.
 *
 * Mounted ONCE in `[eventId]/layout.tsx` next to `<CustomerBottomNav>` (a layout
 * sibling, NOT inside any page — see [[project_setnayan_bottom_nav_canonical]]),
 * so it paints + responds the instant a section opens, ahead of the page's server
 * data, and the bottom nav collapses to icons-only while it's docked. Mobile-only
 * (the underlying `<SubNav>` is `lg:hidden`); desktop uses the sidebar.
 *
 * Two child flavors, dispatched per `kind` (the dock is the union of what the two
 * old components did, verbatim):
 *   - `route` (Guests journey): onSelect → router.push; active ← longest-prefix
 *     of the pathname over the child `match`; Day-of stays muted until its window.
 *   - `tab` (Explore takeover): onSelect → replaceState(?tab=) + the BB_TAB_EVENT
 *     bus (so `ServicesTakeover` switches its panel without a server round-trip);
 *     active ← `?tab=` (read off window, seeded on entry; never useSearchParams,
 *     which doesn't observe replaceState). The dock also LISTENS to the bus so
 *     cross-tab jumps (Compare→Build, Build→Lock via goToBuildTab) keep it lit.
 *
 * Self-gates: renders only while the pathname is inside a menu's narrow
 * `sectionMatch` AND that menu has children — null everywhere else (so it never
 * double-stacks). Flags `html.subnav-docked` while docked → globals.css pads the
 * page bottom clear of the floating pill.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SubNav } from '@/app/_components/nav/sub-nav';
import {
  buildCustomerMenuTree,
  matchesMenuSection,
  activeRouteChildKey,
} from '@/lib/customer-menu';
import { isDayOfOpen } from '@/lib/guest-journey';
import { goToBuildTab, BB_TAB_EVENT, type BudgetBuildTab } from '@/lib/budget-build';

export function CustomerSectionSubnav({
  eventId,
  eventDate,
}: {
  eventId: string;
  eventDate: string | null;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  // Day-of gate deferred to the client so SSR + first paint agree (muted), then
  // it un-mutes inside the event window — no hydration flash. Same as the old
  // guests dock.
  const [dayOfOpen, setDayOfOpen] = useState(false);
  useEffect(() => {
    setDayOfOpen(isDayOfOpen(eventDate, new Date()));
  }, [eventDate]);

  const tree = buildCustomerMenuTree(eventId, { dayOfOpen });
  const activeMenu = tree.find((m) => matchesMenuSection(pathname, m)) ?? null;
  const children = activeMenu?.children ?? [];
  const inSection = children.length > 0;
  const hasTabChildren = children.some((c) => c.kind === 'tab');

  // Tab state — only meaningful when the active menu uses tab children. Seeds
  // from the live ?tab= on entry (covers cold load + the takeover writing it via
  // replaceState while loading); default = the first tab child to match the
  // takeover's no-?tab= fallback. Read off window, not useSearchParams.
  const [activeTab, setActiveTab] = useState<string>('');
  useEffect(() => {
    if (!inSection || !hasTabChildren) return;
    const tabs = children.filter((c) => c.kind === 'tab');
    const t = new URLSearchParams(window.location.search).get('tab');
    const valid = t && tabs.some((c) => c.tab === t);
    setActiveTab(valid ? (t as string) : (tabs[0]?.tab ?? ''));
    // children is rederived each render; pathname is the real entry signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSection, hasTabChildren, pathname]);
  useEffect(() => {
    if (!hasTabChildren) return;
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (next) setActiveTab(next);
    };
    window.addEventListener(BB_TAB_EVENT, onTab);
    return () => window.removeEventListener(BB_TAB_EVENT, onTab);
  }, [hasTabChildren]);

  // While docked, flag <html> so globals.css pads the page bottom clear of the
  // floating pill (shared `subnav-docked` class). Reverses on leaving the section.
  useEffect(() => {
    if (!inSection) return;
    const el = document.documentElement;
    el.classList.add('subnav-docked');
    return () => el.classList.remove('subnav-docked');
  }, [inSection]);

  if (!inSection) return null;

  // Active key: a route child wins by longest-prefix; otherwise the tab child
  // whose tab === activeTab; otherwise the first child.
  const routeKey = activeRouteChildKey(pathname, children);
  const tabKey = hasTabChildren
    ? (children.find((c) => c.kind === 'tab' && c.tab === activeTab)?.key ??
       children.find((c) => c.kind === 'tab')?.key)
    : null;
  const activeKey = routeKey ?? tabKey ?? children[0]?.key ?? '';

  return (
    <SubNav
      items={children.map((c) => ({ key: c.key, label: c.label, icon: c.icon, muted: c.muted }))}
      activeKey={activeKey}
      onSelect={(key) => {
        const child = children.find((c) => c.key === key);
        if (!child) return;
        if (child.kind === 'route') {
          if (child.href && key !== activeKey) router.push(child.href);
        } else if (child.tab) {
          setActiveTab(child.tab);
          // Mirror into ?tab= so refresh / deep link lands on the same section
          // (replaceState — flipping sections shouldn't pollute the back stack).
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', child.tab);
            window.history.replaceState(null, '', url);
          } catch {
            // history/URL unavailable — the panel still switches via the event.
          }
          // Switch the takeover's panel without a server round-trip.
          goToBuildTab(child.tab as BudgetBuildTab);
        }
      }}
      ariaLabel={activeMenu?.subnavLabel ?? 'Section navigation'}
    />
  );
}

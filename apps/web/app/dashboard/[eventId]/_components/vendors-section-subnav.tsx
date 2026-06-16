'use client';

/**
 * VendorsSectionSubnav — the docked section sub-nav for the customer "Explore"
 * tab (route `/dashboard/[eventId]/vendors`, the Services "Build" takeover).
 *
 * Owner direction 2026-06-16: *"when we open explore, the first that should load
 * is the sub nav before the full screen. the sub nav should always respond
 * first."* The takeover's 5-stage <SubNav> (Summary · Shortlist · Build ·
 * Compare · Lock) used to live INSIDE <ServicesTakeover>, which the ~48KB server
 * page builds last — so it only painted after every query resolved, behind the
 * full-screen loading cover. Mounting the <SubNav> HERE (in the event layout,
 * next to <CustomerBottomNav>, the same slot as <GuestsSectionSubnav>) makes it
 * paint and respond the instant Explore opens: a layout renders above the page
 * segment's <Suspense>/loading.tsx boundary and PERSISTS across the loading→page
 * swap, so the shelf mounts once (lift reveal fires on section ENTRY only) and
 * is tappable while the panel streams in behind it.
 *
 * Unlike the Guests journey (five SEPARATE routes → router.push), the takeover
 * is ONE route with client-state tabs. So this drives switching over the shared
 * BB_TAB_EVENT bus (lib/budget-build): onSelect → mirror into ?tab= via
 * replaceState + dispatch the event, which <ServicesTakeover>'s listener
 * consumes to switch the panel (no server round-trip). The dock also LISTENS to
 * BB_TAB_EVENT so cross-tab jumps (Compare "Modify" → Build, Build → Lock via
 * goToBuildTab) keep it lit. Active tab seeds from ?tab= (read off window, never
 * useSearchParams — replaceState doesn't update that hook) on every entry into
 * the section, defaulting to 'summary' to match page.tsx's no-?tab= fallback.
 *
 * Self-gates: renders only on the exact takeover root, null elsewhere (so it
 * never double-stacks on /vendors/categories, /packages, a vendor detail, or
 * any other tab). Mobile-only (<SubNav> is `lg:hidden`; desktop uses the
 * takeover's top strip). While docked it flags `subnav-docked` on <html> so
 * globals.css pads the page bottom clear of the floating pill.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SubNav } from '@/app/_components/nav/sub-nav';
import {
  BUDGET_BUILD_TABS,
  TAB_META,
  BB_TAB_EVENT,
  goToBuildTab,
  type BudgetBuildTab,
} from '@/lib/budget-build';

function isTakeoverRoot(pathname: string, eventId: string): boolean {
  const root = `/dashboard/${eventId}/vendors`;
  return pathname === root || pathname === `${root}/`;
}

function isTab(value: string): value is BudgetBuildTab {
  return (BUDGET_BUILD_TABS as readonly string[]).includes(value);
}

export function VendorsSectionSubnav({ eventId }: { eventId: string }) {
  const pathname = usePathname() ?? '';
  const inSection = isTakeoverRoot(pathname, eventId);

  // 'summary' matches the takeover's no-?tab= default (page.tsx) so the lit tab
  // is correct in the ~1–2s before the panel mounts, and SSR + first client
  // paint agree (window is only read in effects below → no hydration flash).
  const [activeTab, setActiveTab] = useState<BudgetBuildTab>('summary');

  // Seed from ?tab= whenever we're on the takeover root — covers cold loads and
  // client navigations into /vendors?tab=X, plus re-entries (the dock/takeover
  // write ?tab= via replaceState, so read it off window, not useSearchParams).
  // pathname is a dep so this re-runs on every entry; in-section switches change
  // only the query (not pathname) so they don't re-trigger and fight the bus.
  useEffect(() => {
    if (!inSection) return;
    const t = new URLSearchParams(window.location.search).get('tab');
    setActiveTab(t && isTab(t) ? t : 'summary');
  }, [inSection, pathname]);

  // Keep lit when a slot jumps tabs imperatively (goToBuildTab → BB_TAB_EVENT:
  // Compare "Modify" → Build, Build picks → Lock). The dock receiving its own
  // onSelect dispatch is idempotent (sets the value it already holds) — no loop,
  // since the takeover's listener (selectTab) never re-dispatches.
  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<BudgetBuildTab>).detail;
      if (next && isTab(next)) setActiveTab(next);
    };
    window.addEventListener(BB_TAB_EVENT, onTab);
    return () => window.removeEventListener(BB_TAB_EVENT, onTab);
  }, []);

  // While docked, flag <html> so globals.css pads the page bottom clear of the
  // floating pill. Toggled in an effect (never during render) so it's SSR-safe
  // and reverses on leaving the section. Shares the `subnav-docked` class with
  // the globals clearance rule.
  useEffect(() => {
    if (!inSection) return;
    const el = document.documentElement;
    el.classList.add('subnav-docked');
    return () => el.classList.remove('subnav-docked');
  }, [inSection]);

  if (!inSection) return null;

  return (
    <SubNav
      items={BUDGET_BUILD_TABS.map((key) => ({
        key,
        label: TAB_META[key].label,
        icon: TAB_META[key].icon,
      }))}
      activeKey={activeTab}
      onSelect={(key) => {
        const next = key as BudgetBuildTab;
        setActiveTab(next);
        // Mirror into ?tab= so a refresh / deep link lands on the same section
        // (replaceState — flipping sections shouldn't pollute the back stack).
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', next);
          window.history.replaceState(null, '', url);
        } catch {
          // history/URL unavailable — the panel still switches via the event.
        }
        // Switch the takeover's panel without a server round-trip.
        goToBuildTab(next);
      }}
      ariaLabel="Services sections"
    />
  );
}

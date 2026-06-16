'use client';

/**
 * CustomerBottomNav — customer mobile primary nav (FLAT 6-TAB BAR).
 *
 * Owner-locked 2026-06-16: six flat tabs — Home · Guests · Explore · Studio ·
 * Design · Budget. This SUPERSEDES the journey-group accordion (and the
 * mother/osmosis explorations): with six real destinations there's nothing to
 * reveal in the bar — each tab navigates to its page, and that page surfaces its
 * own handful of sub-features as cards. No accordion, no "More", no overlay.
 *
 *   1. Home    — /dashboard/[id]                (the Setnayan brand mark IS this tab)
 *   2. Guests  — /guests   (+ seating · event-qr · hosts light this tab)
 *   3. Explore — /vendors  (the marketplace)
 *   4. Studio  — /add-ons  (Papic · Panood · Patiktok · save-the-date · … hub)
 *   5. Design  — /design   (Website · Mood Board · Monogram hub)
 *   6. Budget  — /budget   (+ disputes light this tab)
 *
 * Each tab's `activeMatch` enumerates the routes that belong to it, so the right
 * tab stays lit on any of its child pages (e.g. /seating lights Guests). Home is
 * an EXACT match on the event root so it doesn't claim every `${base}/*` route.
 *
 * NAV REGISTRY (2026-06-16): the tab LABEL + ICON come from the admin-managed
 * registry (`customer.bottom-nav.<key>` slots) via `navSlots`, falling back to
 * the hardcoded defaults below if a slot is missing — so the bar is unchanged
 * until an admin edits it on /admin/menus. href + activeMatch stay in code
 * (routing, not naming). A slot marked hidden drops its tab.
 *
 * Renders via the shared <BottomNav> FLAT `items` path (the same canonical
 * primitive vendor + admin use) — the locked pill / traveling-pill / press-light
 * / icon-grow treatment is reused verbatim; registry icons are resolved to
 * stable components by navIconComponent so the bar itself is untouched.
 * Mobile-only (`lg:hidden`); the desktop sidebar renders separately.
 */

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { LucideIcon } from 'lucide-react';
import { Users, Compass, Sparkles, Palette, Wallet } from 'lucide-react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { NavSlotLite } from '@/lib/nav-registry-types';

type TabSpec = {
  key: string;
  fallbackLabel: string;
  fallbackIcon: LucideIcon;
  href: string;
  activeMatch: string | string[];
  activeMatchExact?: boolean;
};

/**
 * Builds the flat 6-tab roster for the given eventId. Each tab is a real
 * destination; `activeMatch` carries the routes that should keep the tab lit.
 * `navSlots` (when provided) supplies the registry label + icon per tab.
 */
export function buildCustomerNavTabs(
  eventId: string,
  navSlots?: Record<string, NavSlotLite>,
): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;
  const specs: TabSpec[] = [
    {
      key: 'home',
      fallbackLabel: 'Home',
      // The Setnayan brand mark IS the Home tab (owner 2026-06-16). Cast:
      // SetnayanMark renders the same className/style/aria props the bar passes.
      fallbackIcon: SetnayanMark as unknown as LucideIcon,
      href: base,
      // Exact-match the event root only — otherwise it would prefix-match every
      // `${base}/*` route and stay perpetually active.
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'guests',
      fallbackLabel: 'Guests',
      fallbackIcon: Users,
      href: `${base}/guests`,
      activeMatch: [`${base}/guests`, `${base}/seating`, `${base}/event-qr`, `${base}/hosts`],
    },
    {
      key: 'explore',
      fallbackLabel: 'Explore',
      fallbackIcon: Compass,
      href: `${base}/vendors`,
      activeMatch: `${base}/vendors`,
    },
    {
      key: 'studio',
      fallbackLabel: 'Studio',
      fallbackIcon: Sparkles,
      href: `${base}/add-ons`,
      // The whole add-ons subtree (Papic/Panood/Patiktok/mood-board/…) lives
      // under /add-ons, so a prefix match lights Studio across all of it.
      activeMatch: `${base}/add-ons`,
    },
    {
      key: 'design',
      fallbackLabel: 'Design',
      fallbackIcon: Palette,
      href: `${base}/design`,
      // Design's surfaces are scattered: the new hub + the standalone Website
      // editor + the standalone Monogram studio. (Mood Board sits physically
      // under /add-ons, so it lights Studio — the Design hub still links to it.)
      activeMatch: [`${base}/design`, `/site-editor/${eventId}`, `${base}/monogram`],
    },
    {
      key: 'budget',
      fallbackLabel: 'Budget',
      fallbackIcon: Wallet,
      href: `${base}/budget`,
      activeMatch: [`${base}/budget`, `${base}/disputes`],
    },
  ];

  const tabs: BottomNavItem[] = [];
  for (const spec of specs) {
    const slot = navSlots?.[`customer.bottom-nav.${spec.key}`];
    if (slot?.isHidden) continue; // admin can drop a tab without a code change
    tabs.push({
      key: spec.key,
      label: slot?.label ?? spec.fallbackLabel,
      href: spec.href,
      icon: slot ? navIconComponent(slot.icon) : spec.fallbackIcon,
      activeMatch: spec.activeMatch,
      ...(spec.activeMatchExact ? { activeMatchExact: true } : {}),
    });
  }
  return tabs;
}

/**
 * CustomerBottomNav — wraps the shared BottomNav primitive with the customer
 * 6-tab roster. Renders nothing on lg+ (the sidebar takes over). Shows on every
 * customer surface (owner directive 2026-06-13 "global nav everywhere").
 *
 * `navSlots` is the registry slot map resolved server-side in the event layout.
 */
export function CustomerBottomNav({
  eventId,
  navSlots,
}: {
  eventId: string;
  navSlots?: Record<string, NavSlotLite>;
}) {
  return <BottomNav items={buildCustomerNavTabs(eventId, navSlots)} />;
}

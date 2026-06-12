'use client';

/**
 * AdminBottomNav — admin mobile nav (ops-shaped redesign 2026-06-08).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock specified a
 * 5-tab strip (Home · Queues · Directory · Money · More). The ops-shaped
 * nav redesign (Admin_Console_Nav_Redesign_2026-06-08.md · owner
 * conditionally signed off) re-cuts it to a 4-tab spine — admin is a
 * desktop-first ops tool, so the mobile job is approvals-on-the-go, not a
 * domain-tab mirror:
 *   Home · Work · Directory · More
 * The "Money" tab is gone — money config folds into More (Money & Catalog),
 * money queues fold into Work.
 *
 * The desktop sidebar (admin-sidebar.tsx) exposes 6 groups: Home · Work
 * (key 'queues') · Directory · Insights (key 'funnels') · Money & Catalog
 * (key 'money') · Platform (key 'content'). The mobile-overflow landing
 * pages (/admin/work + /admin/directory + /admin/more) present those
 * surfaces. Legacy /admin/queues + /admin/money redirect to /admin/work +
 * /admin/more for bookmark continuity.
 *
 * activeMatch rules:
 *   - Home      — EXACT /admin (activeMatchExact, since every other tab's
 *                 route also starts with /admin/)
 *   - Work      — /admin/work (+ legacy /admin/queues) OR any act-now route
 *   - Directory — /admin/directory OR any directory record route
 *   - More      — /admin/more (+ legacy /admin/money) OR any Insights /
 *                 Money & Catalog / Platform route
 *
 * BottomNav primitive auto-hides at lg via lg:hidden, so this only renders
 * on mobile + tablet. Desktop uses SidebarShell + AdminSidebar.
 *
 * CLIENT BOUNDARY (REQUIRED): this file holds `ADMIN_BOTTOM_NAV_ITEMS` whose
 * entries carry `icon: LucideIcon` refs (forwardRef objects). A Server
 * Component rendering <BottomNav items={...}/> would try to serialize those
 * function refs across the Server→Client boundary and throw into the root
 * error boundary. `'use client'` keeps the refs client-side end-to-end.
 * Symmetric with admin-sidebar.tsx. Caught + fixed 2026-05-29.
 */

import { Home, ListChecks, Users, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

const ADMIN_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/admin',
    icon: Home,
    // Exact match — every other admin route starts with `/admin/` so a
    // standard startsWith match would keep Home perpetually active.
    activeMatch: '/admin',
    activeMatchExact: true,
  },
  {
    key: 'work',
    label: 'Work',
    href: '/admin/work',
    icon: ListChecks,
    activeMatch: [
      '/admin/work',
      // legacy landing — /admin/queues now redirects to /admin/work
      '/admin/queues',
      '/admin/verify',
      '/admin/payments',
      '/admin/payouts',
      '/admin/token-purchases',
      '/admin/subscriptions',
      '/admin/payment-options',
      '/admin/disputes',
      '/admin/force-majeure',
      '/admin/reviews',
      '/admin/concierge-abuse',
      '/admin/approvals',
      '/admin/help',
    ],
  },
  {
    key: 'directory',
    label: 'Directory',
    href: '/admin/directory',
    icon: Users,
    activeMatch: [
      '/admin/directory',
      '/admin/users',
      '/admin/vendors',
      '/admin/demo-vendors',
      '/admin/events',
      '/admin/venues',
    ],
  },
  {
    key: 'more',
    label: 'More',
    href: '/admin/more',
    icon: Menu,
    activeMatch: [
      '/admin/more',
      // legacy landing — /admin/money now redirects to /admin/more
      '/admin/money',
      // Insights group
      '/admin/growth',
      '/admin/funnels',
      '/admin/operations-hiring',
      '/admin/telemetry',
      '/admin/connection-logs',
      '/admin/offline',
      // Money & Catalog group
      '/admin/pricing',
      '/admin/addons',
      '/admin/discount-codes',
      '/admin/token-bands',
      '/admin/budget-planner',
      '/admin/receipts',
      // Platform group (note: /admin/settings also covers
      // /admin/settings/payment-methods + /admin/settings/demo-mode)
      '/admin/settings',
      '/admin/onboarding',
      '/admin/taxonomy',
      '/admin/event-types',
      '/admin/website',
      '/admin/ads',
      '/admin/brain',
      '/admin/moodboard-library',
      '/admin/songs',
      '/admin/wedding-types',
      '/admin/wedding-traditions',
      '/admin/notifications',
    ],
  },
];

export function AdminBottomNav() {
  return <BottomNav items={ADMIN_BOTTOM_NAV_ITEMS} />;
}

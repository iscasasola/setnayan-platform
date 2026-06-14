'use client';

/**
 * AdminBottomNav — admin mobile nav (ops-shaped redesign 2026-06-08).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock specified a
 * 5-tab strip (Home · Queues · Directory · Money · More). The ops-shaped
 * nav redesign (Admin_Console_Nav_Redesign_2026-06-08.md · owner
 * conditionally signed off) re-cut it to a 4-tab spine (Home · Work ·
 * Directory · More).
 *
 * NAV TUNE 2026-06-15 (owner-approved this session — "6 tabs, keep 'Work'"):
 * the strip grows back to 6 tabs so the daily money + analytics surfaces are
 * one tap, not two levels deep in More:
 *   Home · Work · Directory · Money · Insights · More
 * This re-promotes Money + Insights to dedicated tabs (reversing the
 * 2026-06-08 "fold Money/Insights into More" call) but KEEPS the 'Work'
 * rename (the old 'Queues' label stays retired). Money carries the config
 * surfaces only — the act-now money QUEUES (Payments · Payouts · Token sales)
 * stay in Work. /admin/money is now a real card-grid landing (no longer a
 * redirect to /admin/more); /admin/insights is new.
 *
 * The desktop sidebar (admin-sidebar.tsx) exposes 6 groups: Home · Work
 * (key 'queues') · Directory · Insights (key 'funnels') · Money & Catalog
 * (key 'money') · Platform (key 'content'). The mobile-overflow landing
 * pages (/admin/work + /admin/directory + /admin/money + /admin/insights +
 * /admin/more) present those surfaces. Legacy /admin/queues redirects to
 * /admin/work for bookmark continuity.
 *
 * activeMatch rules:
 *   - Home      — EXACT /admin (activeMatchExact, since every other tab's
 *                 route also starts with /admin/)
 *   - Work      — /admin/work (+ legacy /admin/queues) OR any act-now route
 *   - Directory — /admin/directory OR any directory record route
 *   - Money     — /admin/money OR any Money & Catalog config route. NOTE:
 *                 /admin/settings/payment-methods is deliberately OMITTED —
 *                 it lives under More's '/admin/settings' umbrella, so leaving
 *                 it here too would double-highlight (Money + More). The Money
 *                 landing still links to it.
 *   - Insights  — /admin/insights OR any Insights route
 *   - More      — /admin/more OR any Platform route
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

import { Home, ListChecks, Users, DollarSign, BarChart3, Menu } from 'lucide-react';
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
      '/admin/pax-changes',
      '/admin/force-majeure',
      '/admin/reviews',
      '/admin/concierge-abuse',
      '/admin/account-deletions',
      '/admin/user-reports',
      '/admin/approvals',
      '/admin/social-queue',
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
    // NAV TUNE 2026-06-15 — Money re-promoted to a dedicated tab. Config
    // surfaces only; the act-now money QUEUES (Payments · Payouts · Token
    // sales) stay on Work. /admin/settings/payment-methods is intentionally
    // NOT listed (it lives under More's '/admin/settings' umbrella — listing
    // it here too would double-highlight Money + More).
    key: 'money',
    label: 'Money',
    href: '/admin/money',
    icon: DollarSign,
    activeMatch: [
      '/admin/money',
      '/admin/pricing',
      '/admin/addons',
      '/admin/discount-codes',
      '/admin/token-bands',
      '/admin/budget-planner',
      '/admin/receipts',
    ],
  },
  {
    // NAV TUNE 2026-06-15 — Insights re-promoted to a dedicated tab (the
    // daily analytics pulse). Landing at /admin/insights mirrors the desktop
    // sidebar Insights group (key 'funnels').
    key: 'insights',
    label: 'Insights',
    href: '/admin/insights',
    icon: BarChart3,
    activeMatch: [
      '/admin/insights',
      '/admin/growth',
      '/admin/intelligence',
      '/admin/funnels',
      '/admin/operations-hiring',
      '/admin/telemetry',
      '/admin/connection-logs',
      '/admin/offline',
    ],
  },
  {
    key: 'more',
    label: 'More',
    href: '/admin/more',
    icon: Menu,
    // NAV TUNE 2026-06-15 — More now carries the Platform group ONLY (Insights
    // + Money moved to their own tabs above). Every Platform route is
    // enumerated so none goes "unlit" on mobile per
    // [[feedback_setnayan_orphan_prevention]].
    activeMatch: [
      '/admin/more',
      // Platform group (note: /admin/settings also covers
      // /admin/settings/payment-methods + /admin/settings/demo-mode)
      '/admin/settings',
      '/admin/onboarding',
      '/admin/taxonomy',
      '/admin/event-types',
      '/admin/refinements',
      '/admin/website',
      '/admin/hero-video',
      '/admin/real-stories',
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

/**
 * AdminBottomNav — v2.1 Navigation Phase 3 (admin mobile).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock specifies a
 * 5-item BottomNav strategy: Home · Queues · Directory · Money · More.
 * The 28 admin surfaces compress into 5 mobile-overflow landing pages
 * because forcing all 8 desktop groups into a bottom strip would yield
 * unusably-narrow tap targets at common PH mobile widths (360-414px).
 *
 * The 4 mobile-overflow landing pages (/admin/queues + /admin/directory +
 * /admin/money + /admin/more) render the same NavGroup items from
 * admin-sidebar.tsx as a card grid — single source of truth, two
 * presentation surfaces.
 *
 * activeMatch rules:
 *   - Home    — EXACT /admin (uses activeMatchExact since every other
 *               tab's route also starts with /admin/)
 *   - Queues  — /admin/queues landing OR any queue sub-route
 *   - Directory — /admin/directory landing OR any directory sub-route
 *   - Money   — /admin/money landing OR any money sub-route
 *   - More    — /admin/more landing OR any content/operations/funnels/
 *               settings sub-route
 *
 * BottomNav primitive (PR #603 + Phase 3 activeMatchExact extension)
 * auto-hides at lg breakpoint via lg:hidden, so this only renders on
 * mobile + tablet. Desktop uses the SidebarShell + AdminSidebar instead.
 */

import { Home, LayoutList, Users, DollarSign, Menu } from 'lucide-react';
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
    key: 'queues',
    label: 'Queues',
    href: '/admin/queues',
    icon: LayoutList,
    activeMatch: [
      '/admin/queues',
      '/admin/payments',
      '/admin/verify',
      '/admin/disputes',
      '/admin/force-majeure',
      '/admin/reviews',
      '/admin/help',
      '/admin/concierge-abuse',
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
    key: 'money',
    label: 'Money',
    href: '/admin/money',
    icon: DollarSign,
    activeMatch: [
      '/admin/money',
      '/admin/pricing',
      '/admin/discount-codes',
      '/admin/addons',
      '/admin/payouts',
      '/admin/receipts',
      '/admin/bir',
      '/admin/settings/payment-methods',
    ],
  },
  {
    key: 'more',
    label: 'More',
    href: '/admin/more',
    icon: Menu,
    activeMatch: [
      '/admin/more',
      // Content group
      '/admin/brain',
      '/admin/moodboard-library',
      '/admin/taxonomy',
      '/admin/website',
      '/admin/ads',
      // Operations group
      '/admin/operations-hiring',
      '/admin/telemetry',
      '/admin/offline',
      // Funnels group
      '/admin/funnels',
      // Settings group. Note: `/admin/settings/payment-methods` will ALSO
      // match the Money tab above (via the same `/admin/settings/payment-methods`
      // prefix). This is acceptable dual-highlight because the iteration
      // 0023 § 1 spec itself dual-locates Payment methods conceptually —
      // it's Money substance reachable from Settings context. The
      // /admin/settings/payment-methods URL matching both tabs is a
      // truthful surface of that reality.
      '/admin/settings',
    ],
  },
];

export function AdminBottomNav() {
  return <BottomNav items={ADMIN_BOTTOM_NAV_ITEMS} />;
}

'use client';

/**
 * AdminBottomNav — v2.1 Navigation Phase 3 (admin mobile).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 admin doorway mobile lock specifies a
 * 5-item BottomNav strategy: Home · Queues · Directory · Money · More.
 * The admin surfaces compress into mobile-overflow landing pages because
 * forcing all desktop groups into a bottom strip would yield
 * unusably-narrow tap targets at common PH mobile widths (360-414px).
 *
 * The desktop sidebar (admin-sidebar.tsx) now exposes 6 groups: Home ·
 * Queues · Directory · Money · Insights (key 'funnels') · Manage (key
 * 'content'). The 4 mobile-overflow landing pages (/admin/queues +
 * /admin/directory + /admin/money + /admin/more) render the same NavGroup
 * items from admin-sidebar.tsx as a card grid — single source of truth,
 * two presentation surfaces.
 *
 * activeMatch rules:
 *   - Home    — EXACT /admin (uses activeMatchExact since every other
 *               tab's route also starts with /admin/)
 *   - Queues  — /admin/queues landing OR any queue sub-route
 *   - Directory — /admin/directory landing OR any directory sub-route
 *   - Money   — /admin/money landing OR any money sub-route
 *   - More    — /admin/more landing OR any Insights/Manage sub-route
 *
 * BottomNav primitive (PR #603 + Phase 3 activeMatchExact extension)
 * auto-hides at lg breakpoint via lg:hidden, so this only renders on
 * mobile + tablet. Desktop uses the SidebarShell + AdminSidebar instead.
 *
 * CLIENT BOUNDARY (REQUIRED): this file holds the `ADMIN_BOTTOM_NAV_ITEMS`
 * array whose entries carry `icon: LucideIcon` references — Lucide icons
 * are forwardRef objects with `$$typeof` + `render` properties. When a
 * Server Component renders `<BottomNav items={ADMIN_BOTTOM_NAV_ITEMS} />`
 * and `BottomNav` is itself a Client Component, Next.js tries to
 * serialize `items` across the Server→Client boundary and trips on the
 * function references inside each icon ("Only plain objects can be
 * passed to Client Components from Server Components" + "Functions
 * cannot be passed directly to Client Components"). Without this
 * directive every authed admin visit to /admin throws into the root
 * error boundary at apps/web/app/error.tsx and renders "Something on
 * our end didn't work." Marking this file `'use client'` keeps the icon
 * references on the client side end-to-end so the boundary is never
 * crossed. Symmetric with `apps/web/app/admin/_components/admin-sidebar.tsx`
 * which has been `'use client'` since PR #606 for the same reason (its
 * sidebar items also carry LucideIcon refs). Caught + fixed 2026-05-29.
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
      '/admin/payment-options',
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
      '/admin/wedding-types',
      '/admin/wedding-traditions',
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
      '/admin/budget-planner',
      '/admin/discount-codes',
      '/admin/addons',
      '/admin/payouts',
      '/admin/token-bands',
      '/admin/receipts',
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
      // Insights group (2026-06-04 remap — now also holds the old Operations surfaces)
      '/admin/growth',
      '/admin/funnels',
      '/admin/operations-hiring',
      '/admin/telemetry',
      '/admin/connection-logs',
      '/admin/offline',
      // Manage group (2026-06-04 remap — old Content + Settings)
      '/admin/brain',
      '/admin/moodboard-library',
      '/admin/taxonomy',
      '/admin/songs',
      '/admin/website',
      '/admin/ads',
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

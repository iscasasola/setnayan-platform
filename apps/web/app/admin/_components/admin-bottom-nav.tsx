'use client';

/**
 * AdminBottomNav — admin mobile nav (6-tab topic-cluster redesign 2026-06-18).
 *
 * Six tabs map 1-to-1 to the six sidebar groups in admin-sidebar.tsx:
 *
 *   1. Accounts     → /admin/users     — directory + account queues
 *   2. Transactions → /admin/payments  — all money movement + issues
 *   3. Services     → /admin/pricing   — what Setnayan sells + config
 *   4. Content      → /admin/website   — public-facing content
 *   5. Platform     → /admin/settings  — system config + taxonomy
 *   6. Intelligence → /admin           — analytics + overview (exact match)
 *
 * MOBILE LOCK: the bottom nav is permanently fixed at these 6 tabs. If new
 * sidebar groups are added beyond these 6 in the future they appear in the
 * desktop sidebar only — the mobile strip does not grow beyond 6.
 *
 * activeMatch arrays enumerate every route that should light up a given tab.
 * Routes not listed here go "unlit" on mobile (no tab highlights) — this is
 * intentional for any route that is desktop-only by nature (e.g. deep
 * analytics sub-pages not listed below).
 *
 * CLIENT BOUNDARY (REQUIRED): icon refs (LucideIcon forwardRef objects) must
 * not cross the Server→Client boundary. `'use client'` keeps them client-side.
 */

import { Users, Banknote, Sparkles, Globe, Settings, BarChart3 } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';

const ADMIN_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    key: 'accounts',
    label: 'Accounts',
    href: '/admin/users',
    icon: Users,
    activeMatch: [
      '/admin/users',
      '/admin/vendors',
      '/admin/events',
      '/admin/venues',
      '/admin/verify',
      '/admin/vendor-partnerships',
      '/admin/pax-changes',
      '/admin/completions',
      '/admin/reviews',
      '/admin/account-deletions',
      '/admin/concierge-abuse',
      '/admin/user-reports',
      '/admin/papic-sampler',
    ],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    href: '/admin/payments',
    icon: Banknote,
    activeMatch: [
      '/admin/payments',
      '/admin/payouts',
      '/admin/token-purchases',
      '/admin/subscriptions',
      '/admin/payment-options',
      '/admin/disputes',
      '/admin/force-majeure',
      '/admin/approvals',
      '/admin/help',
      '/admin/receipts',
      '/admin/settings/payment-methods',
    ],
  },
  {
    key: 'services',
    label: 'Services',
    href: '/admin/pricing',
    icon: Sparkles,
    activeMatch: [
      '/admin/pricing',
      '/admin/addons',
      '/admin/token-bands',
      '/admin/discount-codes',
      '/admin/budget-planner',
      '/admin/pakanta',
      '/admin/ads',
      '/admin/brain',
    ],
  },
  {
    key: 'content',
    label: 'Content',
    href: '/admin/website',
    icon: Globe,
    activeMatch: [
      '/admin/website',
      '/admin/hero-video',
      '/admin/reveal-studio',
      '/admin/real-stories',
      '/admin/recaps',
      '/admin/social-queue',
      '/admin/songs',
      '/admin/moodboard-library',
      '/admin/notifications',
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    href: '/admin/settings',
    icon: Settings,
    activeMatch: [
      '/admin/settings',
      '/admin/menus',
      '/admin/taxonomy',
      '/admin/event-types',
      '/admin/wedding-types',
      '/admin/wedding-traditions',
      '/admin/refinements',
      '/admin/onboarding',
      '/admin/demo-vendors',
      '/admin/settings/demo-mode',
    ],
  },
  {
    // Intelligence tab lands on the /admin overview (the command-centre
    // dashboard). Exact match required — every other tab's routes also
    // start with /admin/.
    key: 'intelligence',
    label: 'Intelligence',
    href: '/admin',
    icon: BarChart3,
    // activeMatchExact: true with an explicit array — /admin alone would
    // startsWith-match every /admin/* route and keep this tab perpetually
    // active; listing each route avoids that without per-entry exact support.
    activeMatch: [
      '/admin',
      '/admin/growth',
      '/admin/funnels',
      '/admin/intelligence',
      '/admin/operations-hiring',
      '/admin/connection-logs',
      '/admin/offline',
    ],
    activeMatchExact: true,
  },
];

export function AdminBottomNav({
  navSlots,
}: {
  navSlots?: Record<string, NavSlotLite>;
}) {
  const items = navSlots
    ? ADMIN_BOTTOM_NAV_ITEMS.flatMap((item) => {
        const slot = navSlots[`admin.bottom-nav.${item.key}`];
        if (!slot) return [item];
        if (slot.isHidden) return [];
        return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
      })
    : ADMIN_BOTTOM_NAV_ITEMS;
  return <BottomNav items={items} />;
}

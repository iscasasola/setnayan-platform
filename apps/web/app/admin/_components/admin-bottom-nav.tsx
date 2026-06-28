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
 * NAV TUNE 2026-06-15 / 2026-06-21 (<=5 reroster): the strip is 5 tabs —
 *   Home · Work · Directory · Money · More
 * The 2026-06-15 tune had re-promoted Money + Insights to dedicated tabs (a
 * 6-tab strip); the 2026-06-21 ratified ruleset caps the pill at <=5, so
 * Insights is demoted back into More (its /admin/insights landing is now a
 * More overflow card + folded into the More activeMatch). Money KEEPS its tab.
 * The 'Work' rename (old 'Queues' retired) stays. Money carries the config
 * surfaces only — the act-now money QUEUES (Payments · Payouts · Token sales)
 * stay in Work. /admin/money is a real card-grid landing; /admin/insights
 * remains a real landing, now reached via More.
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

import { Home, ListChecks, Users, DollarSign, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';

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
      '/admin/completions',
      '/admin/reviews',
      '/admin/concierge-abuse',
      '/admin/account-deletions',
      '/admin/user-reports',
      '/admin/approvals',
      '/admin/social-queue',
      '/admin/pakanta',
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
    key: 'more',
    label: 'More',
    href: '/admin/more',
    icon: Menu,
    // NAV TUNE 2026-06-15 / 2026-06-21 — More carries the Insights group + the
    // three groups the desktop "Platform" group split into on 2026-06-28 (Data
    // Structure · Content & Media · Settings; Money still its own tab). Every
    // route is enumerated so none goes "unlit" on mobile per
    // [[feedback_setnayan_orphan_prevention]].
    activeMatch: [
      '/admin/more',
      // Insights group (demoted from its dedicated tab in the 2026-06-21 <=5
      // reroster; folded into More on mobile — /admin/insights is the landing,
      // also reached via the More overflow card).
      '/admin/insights',
      '/admin/growth',
      '/admin/intelligence',
      '/admin/funnels',
      '/admin/operations-hiring',
      '/admin/connection-logs',
      '/admin/offline',
      // Data Structure + Content & Media + Settings groups (note:
      // /admin/settings also covers /admin/settings/demo-mode; payment-methods
      // sits under the Money tab's domain but is matched via this umbrella)
      '/admin/settings',
      '/admin/menus',
      '/admin/onboarding',
      '/admin/taxonomy',
      '/admin/event-types',
      '/admin/refinements',
      '/admin/website',
      '/admin/hero-video',
      '/admin/real-stories',
      '/admin/recaps',
      '/admin/brain',
      '/admin/moodboard-library',
      '/admin/songs',
      '/admin/wedding-types',
      '/admin/wedding-traditions',
      '/admin/notifications',
    ],
  },
];

export function AdminBottomNav({
  navSlots,
  queueCounts,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
}) {
  // The mobile "Work" tab rolls up ALL queues, so its badge is the SUM of open
  // work across every Work queue (the per-queue split lives in the sidebar +
  // the /admin/work feed). One rolled-up tab can only say "you have work" →
  // amber; the red/amber SLA distinction is the sidebar's job.
  const workTotal = queueCounts
    ? Object.values(queueCounts).reduce<number>(
        (sum, c) => sum + (typeof c === 'number' && c > 0 ? c : 0),
        0,
      )
    : 0;

  const withWorkBadge = (item: BottomNavItem): BottomNavItem =>
    item.key === 'work' && workTotal > 0
      ? {
          ...item,
          badge: { count: workTotal, tone: 'amber', label: `${workTotal} pending` },
        }
      : item;

  // Nav registry overlay: label + icon per tab from its admin.bottom-nav.<key>
  // slot (keys match the slot suffix 1:1). Fallback = the hardcoded default;
  // hidden slot drops the tab; href/activeMatch stay in code. No-op when absent.
  const items = (
    navSlots
      ? ADMIN_BOTTOM_NAV_ITEMS.flatMap((item) => {
          const slot = navSlots[`admin.bottom-nav.${item.key}`];
          if (!slot) return [item];
          if (slot.isHidden) return [];
          return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
        })
      : ADMIN_BOTTOM_NAV_ITEMS
  ).map(withWorkBadge);

  return <BottomNav items={items} />;
}

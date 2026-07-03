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
 * 6-MENU RESPINE 2026-07-03 (owner: "Overview · Accounts · Content ·
 * Marketing · Performance · System Settings") under the 2026-06-21 ≤5 mobile
 * ruleset — the strip is 5 tabs:
 *   Overview · Accounts · Marketing · Performance · More
 * Overview = the merged Home+Work task inbox (the /admin pulse + every
 * act-now queue), so the old Work tab dissolves into it and its rolled-up
 * badge moves here. Money's tab dissolves: config went to System Settings
 * (inside More), Discount codes + Referrals to Marketing. Content + System
 * Settings live inside More per the ≤5 cap.
 *
 * The desktop sidebar (admin-sidebar.tsx) exposes the same 6 groups:
 * Overview (key 'queues') · Accounts (key 'directory') · Content (key
 * 'media') · Marketing (key 'marketing') · Performance (key 'funnels') ·
 * System Settings (key 'settings-group'). Mobile-overflow landings:
 * /admin/work (All work, linked from Overview) · /admin/directory ·
 * /admin/marketing · /admin/more. Legacy /admin/queues redirects to
 * /admin/work; /admin/money + /admin/insights stay as bookmark landings.
 *
 * activeMatch rules:
 *   - Overview    — EXACT /admin (via activeMatchAlsoExact — every other
 *                   tab's route also starts with /admin/) PLUS every act-now
 *                   queue route as a prefix umbrella.
 *   - Accounts    — /admin/directory OR any account record route
 *   - Marketing   — /admin/marketing OR any marketing surface route
 *   - Performance — /admin/app-performance OR any Performance route
 *   - More        — /admin/more OR any Content / System Settings route.
 *                   /admin/settings umbrella also covers payment-methods.
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

import { Home, Users, Megaphone, Activity, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';

const ADMIN_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    // OVERVIEW — the merged Home+Work task inbox. Lands on the /admin pulse;
    // lights for the exact /admin path (activeMatchAlsoExact — every other
    // admin route starts with /admin/) AND for every act-now queue route.
    key: 'home',
    label: 'Overview',
    href: '/admin',
    icon: Home,
    activeMatchAlsoExact: ['/admin'],
    activeMatch: [
      '/admin/work',
      // legacy landing — /admin/queues now redirects to /admin/work
      '/admin/queues',
      '/admin/verify',
      '/admin/vendor-partnerships',
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
      '/admin/repost-watch',
      '/admin/corrections',
      '/admin/integrity-watch',
      '/admin/approvals',
      '/admin/pakanta',
      '/admin/editorial-review',
      '/admin/help',
    ],
  },
  {
    key: 'directory',
    label: 'Accounts',
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
    // MARKETING (2026-07-03 respine) — the social publishing queue + the
    // featuring levers + growth incentives. /admin/marketing is the card-grid
    // landing (same renderer as /admin/directory).
    key: 'marketing',
    label: 'Marketing',
    href: '/admin/marketing',
    icon: Megaphone,
    activeMatch: [
      '/admin/marketing',
      '/admin/social-queue',
      '/admin/spotlight-awards',
      '/admin/journal-spotlights',
      '/admin/discount-codes',
      '/admin/referrals',
    ],
  },
  {
    // PERFORMANCE — lands directly on the App Performance cockpit (a real
    // page, not an overflow grid). Re-promoted to a dedicated tab by the
    // 2026-07-03 respine, still within the ≤5 ruleset (Work + Money tabs
    // dissolved). /admin/insights stays reachable as its drill-down landing.
    key: 'performance',
    label: 'Performance',
    href: '/admin/app-performance',
    icon: Activity,
    activeMatch: [
      '/admin/app-performance',
      '/admin/insights',
      '/admin/growth',
      '/admin/intelligence',
      '/admin/funnels',
      '/admin/operations-hiring',
      '/admin/connection-logs',
      '/admin/offline',
    ],
  },
  {
    key: 'more',
    label: 'More',
    href: '/admin/more',
    icon: Menu,
    // More carries the Content group + System Settings (incl. the dissolved
    // Money-config surfaces). Every route is enumerated so none goes "unlit"
    // on mobile per [[feedback_setnayan_orphan_prevention]]. /admin/money
    // stays matched here as a legacy bookmark landing.
    activeMatch: [
      '/admin/more',
      // Content group
      '/admin/website',
      '/admin/hero-video',
      '/admin/reveal-studio',
      '/admin/real-stories',
      '/admin/recaps',
      '/admin/patiktok',
      '/admin/songs',
      '/admin/moodboard-library',
      // System Settings group (note: /admin/settings also covers
      // /admin/settings/demo-mode + /admin/settings/payment-methods)
      '/admin/settings',
      '/admin/notifications',
      '/admin/pricing',
      '/admin/addons',
      '/admin/vendor-recommendations',
      '/admin/token-bands',
      '/admin/price-bands',
      '/admin/budget-planner',
      '/admin/receipts',
      '/admin/money',
      '/admin/menus',
      '/admin/taxonomy',
      '/admin/event-types',
      // '/admin/refinements' REMOVED 2026-07-03 — route retired to a
      // redirect(/admin/taxonomy); refinements now live in the Taxonomy Studio
      // inspector's Refinements tab. Dedicated nav entry dropped.
      '/admin/onboarding',
      '/admin/wedding-types',
      '/admin/wedding-traditions',
      '/admin/brain',
    ],
  },
];

export function AdminBottomNav({
  navSlots,
  queueCounts,
  overdue = 0,
  dueSoon = 0,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
  /** Count of queues past SLA — turns the Work tab badge red. */
  overdue?: number;
  /** Count of queues approaching SLA — turns it amber. */
  dueSoon?: number;
}) {
  // The mobile "Overview" tab is the merged task inbox, so its badge is the
  // SUM of open work across every queue (the per-queue split lives in the
  // sidebar + the /admin/work feed). Tone escalates with the worst queue: red
  // if anything is overdue, amber if anything is due-soon, else neutral.
  const workTotal = queueCounts
    ? Object.values(queueCounts).reduce<number>(
        (sum, c) => sum + (typeof c === 'number' && c > 0 ? c : 0),
        0,
      )
    : 0;
  const workTone = overdue > 0 ? 'red' : dueSoon > 0 ? 'amber' : 'neutral';

  const withWorkBadge = (item: BottomNavItem): BottomNavItem =>
    item.key === 'home' && workTotal > 0
      ? {
          ...item,
          badge: {
            count: workTotal,
            tone: workTone,
            label:
              overdue > 0
                ? `${workTotal} pending, ${overdue} overdue`
                : `${workTotal} pending`,
          },
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

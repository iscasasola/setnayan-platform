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
 * 6-MENU RESPINE 2026-07-04 (owner: "Overview · Accounts · Studio · Ugat
 * Console · App Performance · Money" — the desktop sidebar IA in
 * ADMIN_NAV_GROUPS). Owner directive 2026-07-04: mobile menus must carry the
 * SAME content as desktop, only the orientation differs. The COMPLETE 6-menu
 * set now lives in the /admin/more full-menu landing (rendered straight from
 * ADMIN_NAV_GROUPS). This bottom strip is the ≤5-tab SUBSET SHORTCUT (locked
 * ≤5 primitive) into the daily-driver menus — it is NOT the full menu; More is.
 *
 * TAB CHOICE (≤5) — the owner's three "sure" priority menus (Overview · Ugat
 * Console · App Performance) get their own tab, plus Accounts (record look-up)
 * and a More tab that opens the complete 6-group menu:
 *   Overview · Accounts · Ugat Console · App Performance · More
 * The retired 2026-07-03 "Marketing" tab is GONE — its group folded into Studio
 * on desktop, so its surfaces are reachable in More → Studio. Studio + Money
 * (the two non-tab desktop menus) are always one tap away inside More.
 *
 * Key CONTINUITY: 'home' · 'directory' · 'performance' · 'more' keep their keys
 * (localStorage / active-state). The 'marketing' slot is REPLACED by 'ugat'
 * (new). Overview = the merged Home+Work task inbox (the /admin pulse + every
 * act-now queue); the old Work tab's rolled-up badge lives on Overview.
 *
 * Landings: /admin/directory (Accounts) · /admin/more (full 6-menu). Ugat +
 * Performance tabs land on real anchor pages (/admin/taxonomy = the Ugat
 * Console's Taxonomy-Studio anchor · /admin/app-performance = the cockpit), not
 * overflow grids. Legacy /admin/queues → /admin/work; /admin/marketing +
 * /admin/money + /admin/insights stay as bookmark landings.
 *
 * activeMatch rules:
 *   - Overview       — EXACT /admin (via activeMatchAlsoExact — every other
 *                      tab's route also starts with /admin/) PLUS every act-now
 *                      queue route as a prefix umbrella.
 *   - Accounts       — /admin/directory OR any account record route
 *   - Ugat Console   — /admin/taxonomy OR any Ugat data-structure route
 *   - App Performance— /admin/app-performance OR any Performance route
 *   - More           — /admin/more OR any Studio / Money route (the two
 *                      non-tab desktop menus). /admin/settings umbrella also
 *                      covers payment-methods; /admin/marketing kept as a
 *                      legacy bookmark landing.
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

import { Home, Users, Tag, Activity, Menu } from 'lucide-react';
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
      '/admin/fraud',
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
      '/admin/accounts',
      '/admin/users',
      '/admin/vendors',
      '/admin/demo-vendors',
      '/admin/events',
      '/admin/venues',
    ],
  },
  {
    // UGAT CONSOLE (2026-07-04 respine · replaces the retired 'marketing' slot)
    // — the data-structure / mapping wing, an owner "sure" priority menu. Lands
    // on /admin/taxonomy, the Taxonomy-Studio anchor of the Ugat Console group,
    // and claims every Ugat data-structure route as its umbrella.
    key: 'ugat',
    label: 'Ugat Console',
    href: '/admin/taxonomy',
    icon: Tag,
    activeMatch: [
      '/admin/taxonomy',
      '/admin/ugat',
      '/admin/menus',
      '/admin/onboarding',
      '/admin/wedding-traditions',
      '/admin/brain',
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
    // More opens the COMPLETE 6-menu landing (rendered from ADMIN_NAV_GROUPS).
    // As a lit-state umbrella it claims the two desktop menus WITHOUT their own
    // tab — Studio (old Content + Marketing lanes) + Money — so none goes
    // "unlit" on mobile per [[feedback_setnayan_orphan_prevention]]. The Ugat
    // Console routes moved to the dedicated 'ugat' tab above. /admin/marketing
    // + /admin/money stay matched here as legacy bookmark landings.
    activeMatch: [
      '/admin/more',
      // Studio group — the consolidation hub landing + Content lane
      '/admin/studio',
      '/admin/website',
      '/admin/hero-video',
      '/admin/reveal-studio',
      '/admin/real-stories',
      '/admin/recaps',
      '/admin/patiktok',
      '/admin/songs',
      '/admin/moodboard-library',
      // Studio group — Marketing lane (folded into Studio 2026-07-04; the old
      // standalone Marketing tab retired, its surfaces live here now)
      '/admin/marketing',
      '/admin/social-queue',
      '/admin/spotlight-awards',
      '/admin/journal-spotlights',
      '/admin/discount-codes',
      '/admin/referrals',
      // Money group — config + settings tail (note: /admin/settings also covers
      // /admin/settings/demo-mode + /admin/settings/payment-methods)
      '/admin/pricing',
      '/admin/addons',
      '/admin/vendor-recommendations',
      '/admin/token-bands',
      '/admin/price-bands',
      '/admin/budget-planner',
      '/admin/receipts',
      '/admin/money',
      '/admin/settings',
      '/admin/notifications',
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

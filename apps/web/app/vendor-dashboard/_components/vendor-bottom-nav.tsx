'use client';

/**
 * VendorBottomNav — v2.1 Navigation Phase 2 (vendor mobile).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit. The vendor doorway's 17
 * surfaces compress into 5 mobile-overflow buckets because forcing
 * all 6 desktop groups into a bottom strip would yield unusably-narrow
 * tap targets at common PH mobile widths (360-414px) — the exact same
 * geometry constraint the admin doorway (PR #606) ran into and solved
 * with the 5-tab + /more landing pattern. Customer doorway (PR #625)
 * mirrored it.
 *
 * 5 TABS:
 *   1. Profile     — /vendor-dashboard (exact-match · vendor home)
 *   2. Bookings    — Booking pipeline (per-booking workspace · soft-hold
 *                    + downpaid status · cancel + release CTAs)
 *   3. Messages    — Chat inbox (per-thread workspace)
 *   4. Marketing   — Marketing surface (Boosted Ads · Sponsored Boost ·
 *                    visibility + verification cross-link)
 *   5. More        — Everything else (Contracts · Services · Attributes ·
 *                    Verify · Reviews · Moodboard library · Earnings ·
 *                    Tokens · Manpower · Tax docs · Redeem code · Team)
 *                    routed through the /vendor-dashboard/more landing.
 *
 * The 5-tab set retires the legacy 14-tab horizontal pill from the
 * pre-Phase 2 layout. Notifications doesn't get a tab — it stays
 * accessible via the topbar UnreadBellBadge per the admin pattern
 * (single source of truth for unread + live count via Realtime).
 *
 * activeMatch RULES per tab:
 *   - Profile   — /vendor-dashboard EXACT (activeMatchExact:true)
 *                 because every other vendor route shares this prefix —
 *                 startsWith would keep Profile perpetually active.
 *   - Bookings  — /vendor-dashboard/bookings + per-booking workspace
 *   - Messages  — /vendor-dashboard/messages + per-thread workspace
 *   - Marketing — /vendor-dashboard/marketing + verify (paired surfaces)
 *   - More      — /vendor-dashboard/more landing OR any of the 11
 *                 surfaces that aren't surfaced as a dedicated tab.
 *
 * BottomNav primitive (PR #603 + Phase 3 activeMatchExact extension)
 * auto-hides at lg breakpoint via lg:hidden, so this only renders on
 * mobile + tablet. Desktop uses the SidebarShell + VendorSidebar
 * instead.
 *
 * CLIENT BOUNDARY: 'use client' required because the BottomNavItem[]
 * array carries LucideIcon refs (forwardRef objects with $$typeof +
 * render properties). Per the admin-bottom-nav.tsx docstring (PR #606)
 * passing this array from a Server Component to a Client Component
 * trips Next.js serialization. Symmetric pattern.
 */

import { Home, Briefcase, MessageSquare, Megaphone, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

const VENDOR_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    key: 'profile',
    label: 'Profile',
    href: '/vendor-dashboard',
    icon: Home,
    // Exact-match override — every other vendor route also begins with
    // `/vendor-dashboard/`, so a default startsWith match would keep
    // Profile active on every page. Same trap that customer-bottom-nav
    // + admin-bottom-nav documented (Home/Overview tabs).
    activeMatch: '/vendor-dashboard',
    activeMatchExact: true,
  },
  {
    key: 'bookings',
    label: 'Bookings',
    href: '/vendor-dashboard/bookings',
    icon: Briefcase,
    activeMatch: '/vendor-dashboard/bookings',
  },
  {
    key: 'messages',
    label: 'Messages',
    href: '/vendor-dashboard/messages',
    icon: MessageSquare,
    activeMatch: '/vendor-dashboard/messages',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    href: '/vendor-dashboard/marketing',
    icon: Megaphone,
    // Marketing + Verify pair on mobile chrome — both are visibility +
    // trust surfaces that read as one cognitive bucket on a narrow
    // viewport. Each still has its own sidebar entry on desktop.
    activeMatch: ['/vendor-dashboard/marketing', '/vendor-dashboard/verify'],
  },
  {
    key: 'more',
    label: 'More',
    href: '/vendor-dashboard/more',
    icon: Menu,
    // Catch-all for everything not in the first 4 tabs. Enumerated
    // explicitly per [[feedback_setnayan_orphan_prevention]] — every
    // route must be reachable AND have its active tab light up
    // correctly. New routes need an entry here OR in one of the
    // dedicated tabs above.
    activeMatch: [
      '/vendor-dashboard/more',
      // Pipeline group (excluding bookings which has its own tab)
      '/vendor-dashboard/contracts',
      '/vendor-dashboard/services',
      '/vendor-dashboard/attributes',
      // Marketing group (excluding marketing + verify which pair under Marketing tab)
      '/vendor-dashboard/reviews',
      '/vendor-dashboard/moodboard-library',
      // Money group
      '/vendor-dashboard/earnings',
      '/vendor-dashboard/tokens',
      '/vendor-dashboard/manpower',
      '/vendor-dashboard/tax-documents',
      '/vendor-dashboard/redeem-code',
      // Team group
      '/vendor-dashboard/team',
      // Notifications surfaces here too — topbar bell is the primary
      // entry point but the per-route notifications page lights up More
      // on the mobile chrome so navigation feels predictable.
      '/vendor-dashboard/notifications',
    ],
  },
];

/**
 * VendorBottomNav — wraps the shared BottomNav primitive with the
 * vendor-doorway 5-tab config. Renders nothing on lg+ (sidebar takes
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's destination
 * route is verified to exist on the codebase.
 */
export function VendorBottomNav() {
  return <BottomNav items={VENDOR_BOTTOM_NAV_ITEMS} />;
}

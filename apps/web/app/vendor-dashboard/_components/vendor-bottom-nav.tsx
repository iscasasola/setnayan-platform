'use client';

/**
 * VendorBottomNav — v2.1 Navigation Phase 2 (vendor mobile).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit. The vendor doorway's surfaces
 * compress into 5 mobile-overflow buckets because forcing all the
 * desktop groups into a bottom strip would yield unusably-narrow
 * tap targets at common PH mobile widths (360-414px) — the exact same
 * geometry constraint the admin doorway (PR #606) ran into and solved
 * with the 5-tab + /more landing pattern. Customer doorway (PR #625)
 * mirrored it.
 *
 * The desktop sidebar (vendor-sidebar.tsx) exposes 4 groups (remapped
 * 2026-06-04 from the original 6): Home · Work (key 'pipeline') · Grow
 * (key 'marketing') · Business (key 'money'). The bottom strip flattens
 * those into 6 tabs (2026-06-15 nav-tune — Website added · owner-picked):
 *   1. Home (key 'profile') — /vendor-dashboard (exact-match · Overview)
 *   2. Bookings    — Booking pipeline (per-booking workspace · soft-hold
 *                    + downpaid status · cancel + release CTAs)
 *   3. Calendar    — Schedule-pool surface (2026-06-14 nav-tune · promoted
 *                    over Earnings; the calendar that stops double-bookings
 *                    is the vendor pitch and shouldn't be buried in /more)
 *   4. Messages    — Chat inbox (per-thread workspace)
 *   5. Website     — Live preview of the public page (/v/[slug]) "as couples
 *                    see it" + Edit + Open-live (2026-06-15 nav-tune · owner
 *                    picked it over Services for the 6th slot)
 *   6. More        — Everything else (Profile · Clients · Services ·
 *                    Contracts · Proposals · Attributes · Repertoire ·
 *                    Subscription · Tokens · Redeem code · Marketing ·
 *                    Verify · Reviews · Moodboard library · Earnings ·
 *                    Payment options · Manpower · Branches · Team ·
 *                    Notifications) routed through the
 *                    /vendor-dashboard/more landing.
 *
 * The 5-tab set retires the legacy 14-tab horizontal pill from the
 * pre-Phase 2 layout. Notifications doesn't get a tab — it stays
 * accessible via the topbar UnreadBellBadge per the admin pattern
 * (single source of truth for unread + live count via Realtime).
 * (Tax docs retired 2026-05-29 under the V2 publisher posture — no More
 * entry · the page redirects to /vendor-dashboard.)
 *
 * activeMatch RULES per tab:
 *   - Home      — /vendor-dashboard EXACT (activeMatchExact:true)
 *                 because every other vendor route shares this prefix —
 *                 startsWith would keep Home perpetually active.
 *   - Bookings  — /vendor-dashboard/bookings + per-booking workspace
 *   - Calendar  — /vendor-dashboard/calendar
 *   - Messages  — /vendor-dashboard/messages + per-thread workspace
 *   - More      — /vendor-dashboard/more landing OR any surface that
 *                 isn't surfaced as a dedicated tab (enumerated
 *                 exhaustively below so no vendor route goes unlit).
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

import { Home, Briefcase, CalendarDays, MessageSquare, Globe, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { canManageVendor, VENDOR_SCOPED_BOTTOM_NAV_KEYS } from '@/lib/vendor-role';
import type { NavSlotLite } from '@/lib/nav-registry-types';

const VENDOR_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    // 2026-05-29 nav-tune — relabeled Profile → Home. Root route
    // /vendor-dashboard now renders the Overview (per PR #636) not the
    // profile editor. Profile editor moved to /vendor-dashboard/profile
    // and is reachable via the sidebar Home group + /more landing.
    //
    // `key: 'profile'` preserved so the per-section localStorage
    // `setnayan.nav.section.profile.open` state from existing users
    // doesn't reset on the relabel.
    //
    // Exact-match override — every other vendor route also begins with
    // `/vendor-dashboard/`, so a default startsWith match would keep
    // this tab active on every page.
    key: 'profile',
    label: 'Home',
    href: '/vendor-dashboard',
    icon: Home,
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
    // 2026-06-14 nav-tune — Calendar promoted to bottom nav slot 3 in
    // place of Earnings. The vendor pitch is the calendar that stops
    // double-bookings (schedule-pool lock 2026-06-12); it shouldn't be
    // buried in /more. Earnings moves OUT to the sidebar Business group +
    // the More umbrella (still one tap away).
    key: 'calendar',
    label: 'Calendar',
    href: '/vendor-dashboard/calendar',
    icon: CalendarDays,
    activeMatch: '/vendor-dashboard/calendar',
  },
  {
    key: 'messages',
    label: 'Messages',
    href: '/vendor-dashboard/messages',
    icon: MessageSquare,
    activeMatch: '/vendor-dashboard/messages',
  },
  {
    // 2026-06-15 nav-tune — Website promoted to bottom nav slot 5 (6-tab
    // strip). It's a live preview of the vendor's public page (/v/[slug]) —
    // "what couples see" — with an Edit entry back to the profile editor and
    // an Open-live link. Owner picked it over Services for the new slot; the
    // 4th content slot stayed Calendar over Earnings (Earnings still in More).
    key: 'website',
    label: 'Website',
    href: '/vendor-dashboard/website',
    icon: Globe,
    activeMatch: '/vendor-dashboard/website',
  },
  {
    key: 'more',
    label: 'More',
    href: '/vendor-dashboard/more',
    icon: Menu,
    // Catch-all for everything not on one of the first 5 tabs (Home ·
    // Bookings · Calendar · Messages · Website). Enumerated EXHAUSTIVELY per
    // [[feedback_setnayan_orphan_prevention]] — every vendor route must be
    // reachable AND light its active tab. Any route here that is NOT a
    // dedicated tab MUST appear below, or it goes "unlit" on mobile.
    //
    // 2026-06-14 nav-tune — Calendar promoted to a dedicated tab (slot 3,
    // replacing Earnings); Earnings moved IN here. Audit-flagged gaps
    // closed: Clients · Proposals · Subscription were never enumerated and
    // so never lit More — added. Tax docs included for bookmark continuity
    // (page redirects to /vendor-dashboard but the route can still be hit).
    // List kept alphabetical-by-group so future routes are easy to slot in.
    activeMatch: [
      '/vendor-dashboard/more',
      // Home group (Profile now lives at /profile after PR #636)
      '/vendor-dashboard/profile',
      // Work group (excluding bookings + calendar + messages, which each
      // have their own dedicated tab)
      '/vendor-dashboard/clients',
      '/vendor-dashboard/services',
      '/vendor-dashboard/contracts',
      '/vendor-dashboard/proposals',
      '/vendor-dashboard/repertoire',
      '/vendor-dashboard/attributes',
      // Grow group (Subscription · Tokens · Redeem code folded in here
      // 2026-06-14 — kept under More on mobile)
      '/vendor-dashboard/subscription',
      '/vendor-dashboard/tokens',
      '/vendor-dashboard/redeem-code',
      '/vendor-dashboard/verify',
      '/vendor-dashboard/partnerships',
      '/vendor-dashboard/reviews',
      '/vendor-dashboard/real-stories',
      '/vendor-dashboard/recaps',
      '/vendor-dashboard/moodboard-library',
      // Business group (Earnings moved here from the tab bar 2026-06-14)
      '/vendor-dashboard/earnings',
      '/vendor-dashboard/payment-options',
      '/vendor-dashboard/manpower',
      '/vendor-dashboard/branches',
      '/vendor-dashboard/team',
      // Tax docs RETIRED 2026-05-29 (BIR 2307 retired under V2 publisher
      // posture · page redirects to /vendor-dashboard) — kept here so a
      // bookmarked hit still lights More instead of going unlit.
      '/vendor-dashboard/tax-documents',
      // Notifications surfaces here too — topbar bell is the primary
      // entry point but the per-route notifications page lights up More
      // on the mobile chrome so navigation feels predictable.
      '/vendor-dashboard/notifications',
    ],
  },
];

/**
 * VendorBottomNav — wraps the shared BottomNav primitive with the
 * vendor-doorway 6-tab config. Renders nothing on lg+ (sidebar takes
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's destination
 * route is verified to exist on the codebase.
 */
export function VendorBottomNav({
  role,
  navSlots,
}: {
  role: VendorTeamRole | null;
  navSlots?: Record<string, NavSlotLite>;
}) {
  // Role-aware tabs — owner/admin get the full strip; agent/viewer get the
  // scoped subset (Phase 1: Home + More). Phase 2 expands agent tabs once
  // per-service data scoping lands.
  const base = canManageVendor(role)
    ? VENDOR_BOTTOM_NAV_ITEMS
    : VENDOR_BOTTOM_NAV_ITEMS.filter((i) => VENDOR_SCOPED_BOTTOM_NAV_KEYS.has(i.key));
  // Nav registry overlay: label + icon per tab from its vendor.bottom-nav.<key>
  // slot (the Home tab keeps key 'profile' for localStorage continuity but maps
  // to the 'home' slot). Fallback = the hardcoded default; hidden slot drops the
  // tab; href/activeMatch stay in code. No-op when navSlots is absent.
  const items = navSlots
    ? base.flatMap((item) => {
        const slot = navSlots[`vendor.bottom-nav.${item.key === 'profile' ? 'home' : item.key}`];
        if (!slot) return [item];
        if (slot.isHidden) return [];
        return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
      })
    : base;
  return <BottomNav items={items} />;
}

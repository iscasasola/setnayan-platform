'use client';

/**
 * CustomerBottomNav — v2.1 Navigation Phase 1 (customer mobile).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit. The 19 customer event-scoped
 * surfaces compress into 5 mobile-overflow buckets because forcing
 * all 7 desktop groups into a bottom strip would yield unusably-narrow
 * tap targets at common PH mobile widths (360-414px) — the exact same
 * geometry constraint the admin doorway (PR #606) ran into and solved
 * with the 5-tab + /more landing pattern.
 *
 * 5 TABS:
 *   1. Today        — Today's Focus wizard route
 *   2. Home         — Event-home (dashboard root for this event)
 *   3. Guests       — Guest list (single highest-value people-side surface)
 *   4. Website      — Public landing page hub
 *   5. More         — Everything else (Schedule · Vendors · Budget ·
 *                     Orders · Receipts · Messages · Contracts · Add-ons ·
 *                     Mood Board · Activity · Disputes · Event QR · Hosts ·
 *                     Profile) routed through the /more landing page.
 *
 * The 5-tab set retires the legacy "Services" catch-all from the 2026-05-22
 * 5-tab refactor. "Services" was the umbrella catch-all that contained
 * 12 different sub-routes — replacing it with a literal "More" tab that
 * routes to a card grid with all of them surfaced as first-class entries
 * is cleaner + matches the admin doorway pattern.
 *
 * activeMatch RULES per tab:
 *   - Today    — /dashboard/{eventId}/today (exact + prefix)
 *   - Home     — /dashboard/{eventId} EXACT (activeMatchExact:true)
 *                because every other event-scoped route shares this prefix
 *                — startsWith would keep Home perpetually active.
 *   - Guests   — /dashboard/{eventId}/guests + sponsors + hosts (people
 *                surfaces map to the Guests tab on mobile)
 *   - Website  — /dashboard/{eventId}/website + invitation
 *   - More     — /dashboard/{eventId}/more landing OR any of the 14
 *                surfaces that aren't surfaced as a dedicated tab.
 *
 * BottomNav primitive (PR #603 + Phase 3 activeMatchExact extension)
 * auto-hides at lg breakpoint via lg:hidden, so this only renders on
 * mobile + tablet. Desktop uses the SidebarShell + CustomerSidebar
 * instead.
 *
 * CLIENT BOUNDARY: 'use client' required because the BottomNavItem[]
 * array carries LucideIcon refs (forwardRef objects with $$typeof +
 * render properties). Per the admin-bottom-nav.tsx docstring (PR #606)
 * passing this array from a Server Component to a Client Component
 * trips Next.js serialization. Symmetric pattern.
 *
 * BUILDER: per-event hrefs require runtime construction. The
 * buildCustomerBottomNav(eventId) factory mirrors the buildCustomerNavGroups
 * pattern from customer-sidebar.tsx so callers in the layout pass eventId
 * once and both surfaces stay in lockstep.
 */

import { Focus, Home, Users, Globe, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

/**
 * Builds the 5-tab BottomNav items array for the given eventId.
 * Mirror of buildCustomerNavGroups — single source of truth on the
 * customer-side mobile chrome.
 */
export function buildCustomerBottomNav(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      key: 'today',
      label: 'Today',
      href: `${base}/today`,
      icon: Focus,
      activeMatch: `${base}/today`,
    },
    {
      key: 'home',
      label: 'Home',
      href: base,
      icon: Home,
      // Exact-match override — every other event route also begins with
      // `${base}/`, so a default startsWith match would keep Home active
      // on every page. Same trap that bottom-nav.tsx legacy implementation
      // documented at line 106 + that admin-bottom-nav.tsx Home tab
      // adopted at PR #606.
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'guests',
      label: 'Guests',
      href: `${base}/guests`,
      icon: Users,
      // People-side surfaces all bucket under Guests on the mobile
      // chrome — guests list + per-guest workspace, sponsors, hosts,
      // and the invitation editor. The full /more landing surfaces
      // each as its own card too; this umbrella keeps the mobile
      // bottom-tab feeling natural when the host taps from a person
      // sub-route.
      activeMatch: [
        `${base}/guests`,
        `${base}/sponsors`,
        `${base}/hosts`,
      ],
    },
    {
      key: 'website',
      label: 'Website',
      href: `${base}/website`,
      icon: Globe,
      // Public landing surfaces — website hub + invitation editor.
      activeMatch: [`${base}/website`, `${base}/invitation`],
    },
    {
      key: 'more',
      label: 'More',
      href: `${base}/more`,
      icon: Menu,
      // Catch-all for everything event-planning-side that isn't a
      // dedicated tab. Enumerated explicitly per the
      // [[feedback_setnayan_orphan_prevention]] rule — every route
      // must be reachable AND have its active tab light up correctly.
      // New routes need an entry here OR in one of the umbrellas above.
      activeMatch: [
        `${base}/more`,
        // Plan group (excluding guests + hosts which sit under Guests)
        `${base}/seating`,
        `${base}/schedule`,
        `${base}/vendors`,
        // Spend group
        `${base}/budget`,
        `${base}/orders`,
        // /receipts is app-root scoped — added so reaching it from any
        // event-scoped route highlights More on the mobile chrome.
        '/receipts',
        // Communicate group
        `${base}/messages`,
        `${base}/contracts`,
        // Share group (Website lives in its own tab; Add-ons + Mood
        // Board live under More)
        `${base}/add-ons`,
        // After group
        `${base}/activity`,
        `${base}/disputes`,
        `${base}/event-qr`,
        // Settings group (Profile lives at /dashboard/profile — app-root
        // scope, included so Profile pages light up More on event chrome)
        '/dashboard/profile',
        // Legacy event-scoped surfaces that still ship
        `${base}/paperwork`,
        `${base}/documents`,
        `${base}/date-selection`,
      ],
    },
  ];
}

/**
 * CustomerBottomNav — wraps the shared BottomNav primitive with the
 * customer-doorway 5-tab config. Renders nothing on lg+ (sidebar takes
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's destination
 * route is verified to exist on the codebase.
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav items={buildCustomerBottomNav(eventId)} />;
}

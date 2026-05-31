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
 * 6 TABS (owner reorder 2026-05-31):
 *   1. Home         — Event-home (dashboard root for this event)
 *   2. Guests       — Guest list (single highest-value people-side surface)
 *   3. Vendors      — Marketplace + event-scoped vendor management
 *   4. Website      — Public landing-page hub (promoted from /more)
 *   5. Add-ons      — Paid Setnayan services hub (promoted from /more)
 *   6. More         — Everything else (Today's Focus · Schedule · Budget ·
 *                     Messages · Contracts · Mood Board · Activity ·
 *                     Disputes · Event QR · Hosts · Profile) routed
 *                     through the /more landing page.
 *
 * 2026-05-31 owner directive ("menu should be Home · Guests · Vendor ·
 * Website · More"):
 *   - DROPPED the Today tab from primary nav (was slot 1 per the 2026-05-30
 *     nav-tune (3)). The /today route still ships — Today's Focus / Wedding
 *     Essentials remains reachable via /more (added to the More activeMatch
 *     list) + the event-home plan grid + notification deep links. Per
 *     [[feedback_setnayan_orphan_prevention]] the route is not orphaned: it
 *     lights up the More tab and is linked from the /more landing grid.
 *   - PROMOTED Website to its own slot 4 (was buried in /more). The
 *     /website + /invitation routes move out of the More activeMatch list
 *     into the Website tab so they don't double-light.
 *   - Home → slot 1, Guests → slot 2, Vendors → slot 3 (was Vendors slot 3,
 *     Guests slot 4 — Guests + Vendors swap so the order matches the owner's
 *     stated Home · Guests · Vendor · Website · More).
 *
 * activeMatch RULES per tab:
 *   - Home     — /dashboard/{eventId} EXACT (activeMatchExact:true)
 *                because every other event-scoped route shares this prefix
 *                — startsWith would keep Home perpetually active.
 *   - Guests   — /dashboard/{eventId}/guests + sponsors + hosts (people
 *                surfaces map to the Guests tab on mobile)
 *   - Vendors  — /dashboard/{eventId}/vendors
 *   - Website  — /dashboard/{eventId}/website + invitation
 *   - More     — /dashboard/{eventId}/more landing OR any of the surfaces
 *                that aren't surfaced as a dedicated tab (incl. Today).
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

import { Home, Users, Store, Globe, LayoutGrid, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

/**
 * Builds the 6-tab BottomNav items array for the given eventId.
 * Mirror of buildCustomerNavGroups — single source of truth on the
 * customer-side mobile chrome.
 */
export function buildCustomerBottomNav(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // Slot 1 · Home — the event-home dashboard surfaces budget · phase
      // tracker · plan grid · activity feed. Highest-frequency daily landing.
      key: 'home',
      label: 'Home',
      href: base,
      icon: Home,
      // Exact-match override — every other event route also begins with
      // `${base}/`, so a default startsWith match would keep Home active
      // on every page. Same trap admin-bottom-nav.tsx Home tab adopted
      // at PR #606.
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      // Slot 2 · Guests — people-side surfaces all bucket here on mobile:
      // guests list + per-guest workspace, sponsors, hosts.
      key: 'guests',
      label: 'Guests',
      href: `${base}/guests`,
      icon: Users,
      activeMatch: [`${base}/guests`, `${base}/sponsors`, `${base}/hosts`],
    },
    {
      // Slot 3 · Vendors — marketplace + event-scoped vendor management.
      // Owner framing 2026-05-29: "the connection of vendors and customer
      // IS the marketplace." Routes to /dashboard/[eventId]/vendors so
      // couples land in their event's vendor context, not global /vendors.
      key: 'vendors',
      label: 'Vendors',
      href: `${base}/vendors`,
      icon: Store,
      activeMatch: `${base}/vendors`,
    },
    {
      // Slot 4 · Website — public landing-page hub (promoted from /more
      // per owner directive 2026-05-31). The hub links the invitation
      // editor + public landing page + QR surfaces. /invitation buckets
      // here too (it's the editor behind the public website).
      key: 'website',
      label: 'Website',
      href: `${base}/website`,
      icon: Globe,
      activeMatch: [`${base}/website`, `${base}/invitation`],
    },
    {
      // Slot 5 · Add-ons — paid Setnayan services hub (Papic · Panood ·
      // Patiktok · Pailaw · Pakanta · Save-the-Date video · Mood Board ·
      // etc.). Promoted to its own tab per owner directive 2026-05-31
      // (6-tab menu: Home · Guests · Vendors · Website · Add-ons · More).
      // Mood Board sub-routes live under /add-ons/mood-board so they bucket
      // here too. Icon matches the desktop sidebar Add-ons entry (LayoutGrid).
      key: 'add-ons',
      label: 'Add-ons',
      href: `${base}/add-ons`,
      icon: LayoutGrid,
      activeMatch: `${base}/add-ons`,
    },
    {
      // Slot 6 · More — catch-all for everything event-planning-side that
      // isn't a dedicated tab. Enumerated explicitly per the
      // [[feedback_setnayan_orphan_prevention]] rule — every route must be
      // reachable AND have its active tab light up correctly.
      key: 'more',
      label: 'More',
      href: `${base}/more`,
      icon: Menu,
      activeMatch: [
        `${base}/more`,
        // Today's Focus / Wedding Essentials — dropped as a dedicated tab
        // 2026-05-31 but the route still ships; it lives under More now.
        `${base}/today`,
        // Messages + Contracts
        `${base}/messages`,
        `${base}/contracts`,
        // Plan group (excluding guests + hosts under Guests, vendors own tab,
        // website + invitation under the Website tab)
        `${base}/seating`,
        `${base}/schedule`,
        // Spend group
        `${base}/budget`,
        `${base}/orders`,
        // /receipts is app-root scoped — added so reaching it from any
        // event-scoped route highlights More on the mobile chrome.
        '/receipts',
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
 * customer-doorway 6-tab config. Renders nothing on lg+ (sidebar takes
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's destination
 * route is verified to exist on the codebase.
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav items={buildCustomerBottomNav(eventId)} />;
}

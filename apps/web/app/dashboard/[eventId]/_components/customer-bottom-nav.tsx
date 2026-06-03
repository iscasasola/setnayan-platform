'use client';

/**
 * CustomerBottomNav — customer mobile primary nav.
 *
 * 5 TABS (owner directive 2026-06-02):
 *   1. Home     — Event-home. Holds the personalized menu (the couple's
 *                 wedding shape + the services they've added) AND the
 *                 activity feed, inline — the two surfaces couples return
 *                 to. (The full personalized menu lives at /for-you as the
 *                 home preview's "See all" target — not a nav tab.)
 *   2. Guests   — Guest list (+ sponsors + hosts on mobile)
 *   3. Vendors  — Marketplace + event-scoped vendor management
 *   4. Website  — Public landing-page hub (+ invitation editor)
 *   5. More     — Everything else (Today's Focus · Add-ons · Activity ·
 *                 Schedule · Budget · Messages · Contracts · Seating ·
 *                 Orders · Disputes · Event QR · Hosts · Profile · For you)
 *                 via the /more landing page.
 *
 * WHY this set: owner directive 2026-06-02 — the personalized menu +
 * activity move INSIDE Home (not separate tabs), and the primary nav is
 * Home · Guests · Vendors · Website · More. Add-ons loses its dedicated
 * tab and joins More; Today's Focus, Activity, and the /for-you "see all"
 * page are reachable via More + the home surface. Per
 * [[feedback_setnayan_orphan_prevention]] every demoted route is
 * enumerated in More's activeMatch (reachable AND lights up correctly) and
 * the desktop sidebar keeps full access.
 *
 * activeMatch RULES:
 *   - Home     — /dashboard/{eventId} EXACT (activeMatchExact:true) —
 *                every other event route shares this prefix.
 *   - Guests   — /dashboard/{eventId}/guests + sponsors + hosts
 *   - Vendors  — /dashboard/{eventId}/vendors
 *   - Website  — /dashboard/{eventId}/website + invitation
 *   - More     — /dashboard/{eventId}/more OR any surface without a
 *                dedicated tab (enumerated below).
 *
 * BottomNav primitive auto-hides at lg via lg:hidden — mobile + tablet
 * only. Desktop uses SidebarShell + CustomerSidebar.
 *
 * CLIENT BOUNDARY: 'use client' required because the BottomNavItem[]
 * carries LucideIcon refs (forwardRef objects) — passing them from a
 * Server Component to the Client BottomNav trips Next.js serialization.
 */

import { usePathname } from 'next/navigation';
import { Home, Users, Store, Globe, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

/**
 * Builds the 5-tab BottomNav items array for the given eventId.
 */
export function buildCustomerBottomNav(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // Slot 1 · Home — holds the personalized menu + activity feed inline.
      key: 'home',
      label: 'Home',
      href: base,
      icon: Home,
      // Exact-match override — every other event route also begins with
      // `${base}/`, so a default startsWith match would keep Home active
      // on every page.
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      // Slot 2 · Guests — people surfaces bucket here on mobile.
      key: 'guests',
      label: 'Guests',
      href: `${base}/guests`,
      icon: Users,
      activeMatch: [`${base}/guests`, `${base}/sponsors`, `${base}/hosts`],
    },
    {
      // Slot 3 · Services — the couple's chosen services (the services
      // their vendors provide) + the marketplace. Renamed from "Vendors"
      // 2026-06-02 (owner: the tab shows SERVICES, not vendor profiles).
      // key stays 'vendors' (changing it resets nav localStorage); the
      // route path stays /vendors (internal, not menu-visible).
      key: 'vendors',
      label: 'Services',
      href: `${base}/vendors`,
      icon: Store,
      activeMatch: `${base}/vendors`,
    },
    {
      // Slot 4 · Website — opens the full-screen Reels site editor
      // (/site-editor). Flipped 2026-06-03 from the retired journey scroll;
      // the invitation editor stays under this tab's active-state.
      key: 'website',
      label: 'Website',
      href: `/site-editor/${eventId}`,
      icon: Globe,
      activeMatch: [`/site-editor/${eventId}`, `${base}/invitation`],
    },
    {
      // Slot 5 · More — catch-all for every surface that isn't a dedicated
      // tab. Enumerated per [[feedback_setnayan_orphan_prevention]].
      key: 'more',
      label: 'More',
      href: `${base}/more`,
      icon: Menu,
      activeMatch: [
        `${base}/more`,
        // Today's Focus — route ships, lives under More.
        `${base}/today`,
        // Paid Setnayan services hub (Papic · Panood · Patiktok · Mood
        // Board · etc. — mood-board sub-routes live under /add-ons).
        `${base}/add-ons`,
        // Activity feed full page (also surfaced inline on Home).
        `${base}/activity`,
        // For-you full personalized menu ("see all" from the Home preview).
        `${base}/for-you`,
        // Edit match criteria (region · feel · budget) — "Edit" on the
        // Personalized block. CLAUDE.md 2026-06-02 "do both" · step 1.
        `${base}/details`,
        // Messages + Contracts
        `${base}/messages`,
        `${base}/contracts`,
        // Plan group
        `${base}/seating`,
        `${base}/schedule`,
        // Spend group
        `${base}/budget`,
        `${base}/orders`,
        // /receipts is app-root scoped — added so reaching it from any
        // event route highlights More.
        '/receipts',
        // After group
        `${base}/disputes`,
        `${base}/event-qr`,
        // Settings (Profile lives at /dashboard/profile — app-root scope)
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
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's
 * destination route exists.
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();

  // FOCUS MODE — Guests page (owner directive 2026-06-03). The Guests list
  // runs as a "takeover": its lower-third carousel's own tab menu (Summary ·
  // Search & sort · Add · Customize) REPLACES the global 5-tab bottom nav,
  // and a floating X (top-left) is the single exit back to event home. So we
  // suppress this nav on the exact list route. Scoped to `/guests` only —
  // sub-pages (/guests/import, /guests/quick) and the sibling people routes
  // (/sponsors, /hosts) keep the standard nav, so no surface is orphaned
  // (the X returns to Home, where the full nav is available again).
  // usePathname() is populated during SSR for client components, so the nav
  // is absent from first paint on /guests — no hide-flash.
  if (pathname === `/dashboard/${eventId}/guests`) return null;

  return <BottomNav items={buildCustomerBottomNav(eventId)} />;
}

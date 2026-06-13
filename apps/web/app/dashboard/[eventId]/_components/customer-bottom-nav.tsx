'use client';

/**
 * CustomerBottomNav — customer mobile primary nav.
 *
 * 5 TABS (owner directive 2026-06-02):
 *   1. Home     — Event-home cockpit: live countdown · Setnayan AI ·
 *                 upcoming schedules · activity feed. (The couple's match
 *                 criteria moved to the "Matching you on" strip on the
 *                 Vendors/Services tab — see match-criteria-strip.tsx.)
 *   2. Guests   — Guest list (+ sponsors + hosts on mobile)
 *   3. Vendors  — Marketplace + event-scoped vendor management
 *   4. Website  — Public landing-page hub (+ invitation editor)
 *   5. More     — Everything else (Add-ons · Activity · Schedule · Budget ·
 *                 Messages · Contracts · Seating · Orders · Disputes ·
 *                 Event QR · Hosts · Profile) via the /more
 *                 landing page.
 *
 * WHY this set: owner directive 2026-06-02 — the personalized menu +
 * activity move INSIDE Home (not separate tabs), and the primary nav is
 * Home · Guests · Vendors · Website · More. Add-ons loses its dedicated
 * tab and joins More; Activity is reachable via More + the home
 * surface. Per
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
      // Slot 4 · Website — opens the Website HUB (a dashboard page that keeps
      // the global nav). The hub launches the full-screen Reels site editor
      // (/site-editor); the editor + the invitation editor all light up this
      // tab via activeMatch. (Owner 2026-06-13 "global nav everywhere" — the
      // tab no longer deep-links straight into the chrome-less editor.)
      key: 'website',
      label: 'Website',
      href: `${base}/website`,
      icon: Globe,
      activeMatch: [
        `${base}/website`,
        `/site-editor/${eventId}`,
        `${base}/invitation`,
      ],
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
        // Paid Setnayan services hub (Papic · Panood · Patiktok · Mood
        // Board · etc. — mood-board sub-routes live under /add-ons).
        `${base}/add-ons`,
        // Activity feed full page (also surfaced inline on Home).
        `${base}/activity`,
        // Personalization — the couple's match criteria (region · feel ·
        // budget · …), now surfaced as the "Matching you on" strip on the
        // Vendors/Services tab; /details is its full editable page. The old
        // /for-you "see all" route was retired (redirects to Vendors).
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
 *
 * The global nav now shows on EVERY customer surface (owner directive
 * 2026-06-13 "global nav everywhere"). The former Guests + Services
 * "focus mode" suppressions are retired — those surfaces moved their own
 * bottom controls UP into a sticky in-page bar so there is no double bar,
 * and the Website tab points at the /website hub (the full-screen
 * /site-editor keeps its own chrome and is launched from the hub).
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav items={buildCustomerBottomNav(eventId)} />;
}

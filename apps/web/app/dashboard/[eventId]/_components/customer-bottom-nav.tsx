'use client';

/**
 * CustomerBottomNav — customer mobile primary nav.
 *
 * 4 TABS (owner directive 2026-06-02 · CLAUDE.md lean-home + nav lock):
 *   1. Home     — Event-home (lean: anchor header + personalized preview
 *                 + activity feed)
 *   2. For you  — /for-you · the full personalized menu (the couple's
 *                 wedding shape + every service they've added)
 *   3. Activity — /activity · the full movement/notification history
 *   4. More     — Everything else (Today's Focus · Guests · Vendors ·
 *                 Website · Add-ons · Schedule · Budget · Messages ·
 *                 Contracts · Seating · Orders · Disputes · Event QR ·
 *                 Hosts · Sponsors · Profile) via the /more landing page.
 *
 * WHY this set: the owner's directive was to strip the primary nav (and
 * the home page) down to the two surfaces couples actually return to —
 * a personalized menu + activity — and demote everything else into More.
 * "Today / Plan / Spend / Communicate / Share" lose their dedicated mobile
 * tabs; they remain fully reachable via the /more landing grid (mobile)
 * + the desktop sidebar groups (which keep full access). Per
 * [[feedback_setnayan_orphan_prevention]] no surface is orphaned — every
 * demoted route lights up the More tab (enumerated below) and is linked
 * from /more.
 *
 * activeMatch RULES:
 *   - Home     — /dashboard/{eventId} EXACT (activeMatchExact:true) —
 *                every other event route shares this prefix, so a
 *                startsWith match would keep Home perpetually active.
 *   - For you  — /dashboard/{eventId}/for-you
 *   - Activity — /dashboard/{eventId}/activity
 *   - More     — /dashboard/{eventId}/more OR any surface without a
 *                dedicated tab (enumerated explicitly).
 *
 * BottomNav primitive auto-hides at lg via lg:hidden — mobile + tablet
 * only. Desktop uses SidebarShell + CustomerSidebar.
 *
 * CLIENT BOUNDARY: 'use client' required because the BottomNavItem[]
 * carries LucideIcon refs (forwardRef objects) — passing them from a
 * Server Component to the Client BottomNav trips Next.js serialization.
 *
 * BUILDER: per-event hrefs need runtime construction; the
 * buildCustomerBottomNav(eventId) factory mirrors buildCustomerNavGroups
 * so both surfaces stay in lockstep.
 */

import { Home, Sparkles, Activity, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

/**
 * Builds the 4-tab BottomNav items array for the given eventId.
 */
export function buildCustomerBottomNav(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      // Slot 1 · Home — lean event-home: anchor header + personalized
      // menu preview + activity feed. Highest-frequency daily landing.
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
      // Slot 2 · For you — the full personalized menu (taste + services).
      key: 'for-you',
      label: 'For you',
      href: `${base}/for-you`,
      icon: Sparkles,
      activeMatch: `${base}/for-you`,
    },
    {
      // Slot 3 · Activity — full movement + notification history.
      key: 'activity',
      label: 'Activity',
      href: `${base}/activity`,
      icon: Activity,
      activeMatch: `${base}/activity`,
    },
    {
      // Slot 4 · More — catch-all for every planning surface that isn't a
      // dedicated tab. Enumerated per [[feedback_setnayan_orphan_prevention]]
      // — every route reachable AND its active tab lights up.
      key: 'more',
      label: 'More',
      href: `${base}/more`,
      icon: Menu,
      activeMatch: [
        `${base}/more`,
        // Today's Focus / Wedding Essentials — route still ships, under More.
        `${base}/today`,
        // People surfaces
        `${base}/guests`,
        `${base}/sponsors`,
        `${base}/hosts`,
        // Vendors + marketplace
        `${base}/vendors`,
        // Website + invitation editor
        `${base}/website`,
        `${base}/invitation`,
        // Paid Setnayan services hub (Papic · Panood · Patiktok · Mood
        // Board · etc. — mood-board sub-routes live under /add-ons).
        `${base}/add-ons`,
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
        // After group (Activity has its own tab now — not listed here)
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
 * customer-doorway 4-tab config. Renders nothing on lg+ (sidebar takes
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's
 * destination route exists.
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav items={buildCustomerBottomNav(eventId)} />;
}

'use client';

/**
 * CustomerBottomNav — customer mobile primary nav.
 *
 * 6 TABS (owner-locked REDESIGN_PLAN · 2026-06-14):
 *   1. Home    — Event-home cockpit: live countdown · Setnayan AI ·
 *                upcoming schedules · activity feed.
 *   2. Guests  — Guest list (+ sponsors + hosts on mobile).
 *   3. Studio  — The in-app Setnayan services hub (/add-ons — Papic ·
 *                Panood · Save-the-Date · etc.). Relabeled from "Add-ons".
 *   4. Budget  — Per-vendor budget + Setnayan add-ons ledger.
 *   5. Wedding — The couple's wedding website / Reels editor
 *                (/site-editor). Relabeled from "Website".
 *   6. More    — Everything else (Explore/vendors · Seating · Schedule ·
 *                Messages · Contracts · Mood Board · Monogram · Live Wall ·
 *                Activity · Disputes · Event QR · Personalization · Hosts ·
 *                Profile · Find your date) via the /more landing page.
 *
 * WHY this set: REDESIGN_PLAN locks the couple bottom nav at
 * Home · Guests · Studio · Budget · Wedding · More. The shared <BottomNav>
 * already supports 6 columns (Math.min(items.length, 6) + dynamic grid).
 * Per [[feedback_setnayan_orphan_prevention]] every route NOT represented
 * by a primary tab is enumerated in More's activeMatch (reachable AND lights
 * up correctly) and the desktop sidebar keeps full access.
 *
 * activeMatch RULES:
 *   - Home    — /dashboard/{eventId} EXACT (activeMatchExact:true) —
 *               every other event route shares this prefix.
 *   - Guests  — /dashboard/{eventId}/guests + sponsors + hosts.
 *   - Studio  — /dashboard/{eventId}/add-ons.
 *   - Budget  — /dashboard/{eventId}/budget.
 *   - Wedding — /site-editor/{eventId} + /dashboard/{eventId}/website +
 *               invitation (legacy hub + editor surfaces).
 *   - More    — /dashboard/{eventId}/more OR any surface without a
 *               dedicated tab (enumerated below).
 *
 * NOTE on /add-ons/mood-board: it shares the Studio prefix, so the Studio
 * tab claims it (findIndex first-match wins, Studio precedes More). Accepted
 * dual-bucket — mirrors the desktop sidebar where Studio + Mood Board can
 * both highlight on that path. mood-board is still listed in More for
 * orphan-prevention completeness.
 *
 * BottomNav primitive auto-hides at lg via lg:hidden — mobile + tablet
 * only. Desktop uses SidebarShell + CustomerSidebar.
 *
 * CLIENT BOUNDARY: 'use client' required because the BottomNavItem[]
 * carries LucideIcon refs (forwardRef objects) — passing them from a
 * Server Component to the Client BottomNav trips Next.js serialization.
 */

import { Home, Users, Sparkles, Wallet, Globe, Menu } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';

/**
 * Builds the 6-tab BottomNav items array for the given eventId.
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
      // Slot 3 · Studio — the in-app Setnayan services hub. Relabeled from
      // "Add-ons" 2026-06-14; key 'add-ons' + route /add-ons unchanged.
      key: 'add-ons',
      label: 'Studio',
      href: `${base}/add-ons`,
      icon: Sparkles,
      activeMatch: `${base}/add-ons`,
    },
    {
      // Slot 4 · Budget — promoted to a primary tab 2026-06-14 (the couple's
      // most-checked planning surface).
      key: 'budget',
      label: 'Budget',
      href: `${base}/budget`,
      icon: Wallet,
      activeMatch: `${base}/budget`,
    },
    {
      // Slot 5 · Wedding — the couple's wedding website. The href opens the
      // full-screen Reels editor (/site-editor); the legacy /website hub +
      // the invitation editor also light this tab. Relabeled from "Website"
      // 2026-06-14.
      key: 'website',
      label: 'Wedding',
      href: `/site-editor/${eventId}`,
      icon: Globe,
      activeMatch: [
        `/site-editor/${eventId}`,
        `${base}/website`,
        `${base}/invitation`,
      ],
    },
    {
      // Slot 6 · More — catch-all for every surface that isn't a dedicated
      // tab. Enumerated per [[feedback_setnayan_orphan_prevention]].
      key: 'more',
      label: 'More',
      href: `${base}/more`,
      icon: Menu,
      activeMatch: [
        `${base}/more`,
        // Explore — the vendor marketplace (no longer a primary tab).
        `${base}/vendors`,
        // Plan group (non-tab surfaces)
        `${base}/seating`,
        `${base}/schedule`,
        // Book group
        `${base}/messages`,
        `${base}/contracts`,
        // Design group (Website lives on the Wedding tab; mood-board shares
        // the Studio prefix but is listed here for completeness).
        `${base}/add-ons/mood-board`,
        `${base}/monogram`,
        // Day-of group
        `${base}/live`,
        `${base}/event-qr`,
        // After group
        `${base}/activity`,
        `${base}/disputes`,
        // Settings group
        `${base}/details`,
        // Find your date — demoted to Settings, reachable via More.
        `${base}/find-date`,
        // Profile lives at /dashboard/profile — app-root scope.
        '/dashboard/profile',
        // /receipts is app-root scoped — reaching it from any event route
        // highlights More.
        '/receipts',
        `${base}/orders`,
        // Legacy event-scoped surfaces that still ship.
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
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's
 * destination route exists.
 *
 * The global nav shows on EVERY customer surface (owner directive
 * 2026-06-13 "global nav everywhere"). The Wedding tab points at the
 * full-screen /site-editor (which keeps its own chrome); the former
 * focus-mode suppressions are retired.
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav items={buildCustomerBottomNav(eventId)} />;
}

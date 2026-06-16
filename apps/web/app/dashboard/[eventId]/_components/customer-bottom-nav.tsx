'use client';

/**
 * CustomerBottomNav — customer mobile primary nav (FLAT 6-TAB BAR).
 *
 * Owner-locked 2026-06-16: six flat tabs — Home · Guests · Explore · Studio ·
 * Design · Budget. This SUPERSEDES the journey-group accordion (and the
 * mother/osmosis explorations): with six real destinations there's nothing to
 * reveal in the bar — each tab navigates to its page, and that page surfaces its
 * own handful of sub-features as cards. No accordion, no "More", no overlay.
 *
 *   1. Home    — /dashboard/[id]                (the Setnayan brand mark IS this tab)
 *   2. Guests  — /guests   (+ seating · event-qr · hosts light this tab)
 *   3. Explore — /vendors  (the marketplace)
 *   4. Studio  — /add-ons  (Papic · Panood · Patiktok · save-the-date · … hub)
 *   5. Design  — /design   (Website · Mood Board · Monogram hub)
 *   6. Budget  — /budget   (+ disputes light this tab)
 *
 * Each tab's `activeMatch` enumerates the routes that belong to it, so the right
 * tab stays lit on any of its child pages (e.g. /seating lights Guests). Home is
 * an EXACT match on the event root so it doesn't claim every `${base}/*` route.
 *
 * Renders via the shared <BottomNav> FLAT `items` path (the same canonical
 * primitive vendor + admin use) — the locked pill / traveling-pill / press-light
 * / icon-grow treatment is reused verbatim. Mobile-only (`lg:hidden`); the
 * desktop sidebar renders separately.
 */

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { LucideIcon } from 'lucide-react';
import { Users, Compass, Sparkles, Palette, Wallet, QrCode, LayoutGrid, Rocket, CalendarClock } from 'lucide-react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { LifecyclePhase } from '@/lib/day-of-mode';

/**
 * Builds the flat 6-tab roster for the given eventId. Each tab is a real
 * destination; `activeMatch` carries the routes that should keep the tab lit.
 */
export function buildCustomerNavTabs(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;
  return [
    {
      key: 'home',
      label: 'Home',
      href: base,
      // The Setnayan brand mark IS the Home tab (the "mother" as a real
      // destination, per owner 2026-06-16). Cast: SetnayanMark renders the same
      // className/style/aria props the bar passes every icon.
      icon: SetnayanMark as unknown as LucideIcon,
      // Exact-match the event root only — otherwise it would prefix-match every
      // `${base}/*` route and stay perpetually active.
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'guests',
      label: 'Guests',
      href: `${base}/guests`,
      icon: Users,
      activeMatch: [
        `${base}/guests`,
        `${base}/seating`,
        `${base}/event-qr`,
        `${base}/hosts`,
      ],
    },
    {
      key: 'explore',
      label: 'Explore',
      href: `${base}/vendors`,
      icon: Compass,
      activeMatch: `${base}/vendors`,
    },
    {
      key: 'studio',
      label: 'Studio',
      href: `${base}/add-ons`,
      icon: Sparkles,
      // The whole add-ons subtree (Papic/Panood/Patiktok/mood-board/…) lives
      // under /add-ons, so a prefix match lights Studio across all of it.
      activeMatch: `${base}/add-ons`,
    },
    {
      key: 'design',
      label: 'Design',
      href: `${base}/design`,
      icon: Palette,
      // Design's surfaces are scattered: the new hub + the standalone Website
      // editor + the standalone Monogram studio. (Mood Board sits physically
      // under /add-ons, so it lights Studio — the Design hub still links to it.)
      activeMatch: [`${base}/design`, `/site-editor/${eventId}`, `${base}/monogram`],
    },
    {
      key: 'budget',
      label: 'Budget',
      href: `${base}/budget`,
      icon: Wallet,
      activeMatch: [`${base}/budget`, `${base}/disputes`],
    },
  ];
}

/**
 * Builds the DAY-OF roster — the menu the couple/coordinator operate the wedding
 * day with (Event Lifecycle Menu, 2026-06-16). While the event is live, the Plan
 * tabs step aside and the bar becomes the day-of command center. Five operable
 * destinations that all already exist; the unified "Services" launch hub is built
 * in a follow-up (PR2) — until then Services points at the owned-services hub
 * (/add-ons). Slot 1 stays the Setnayan mark (the home root, which already
 * becomes the live "Now" command-center view), relabelled "Now"; the **Planning
 * escape lives OUTSIDE the bar** (a top-bar link, see layout.tsx) so there's no
 * second tab pointing at `base` (which would collide on active state).
 */
export function buildDayOfNavTabs(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;
  return [
    {
      key: 'now',
      label: 'Now',
      href: base,
      icon: SetnayanMark as unknown as LucideIcon,
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'checkin',
      label: 'Check-in',
      href: `${base}/guests/checkin`,
      icon: QrCode,
      activeMatch: `${base}/guests/checkin`,
    },
    {
      key: 'seats',
      label: 'Seats',
      href: `${base}/seating`,
      icon: LayoutGrid,
      activeMatch: `${base}/seating`,
    },
    {
      // The unified day-of launch hub (PR2): one place to start every owned
      // live service — Panood "Go live" · Live Wall "Open the wall" · Papic
      // "Hand out seats" — with an upsell for anything not yet owned.
      key: 'services',
      label: 'Services',
      href: `${base}/launch`,
      icon: Rocket,
      activeMatch: `${base}/launch`,
    },
    {
      key: 'schedule',
      label: 'Schedule',
      href: `${base}/schedule`,
      icon: CalendarClock,
      activeMatch: `${base}/schedule`,
    },
  ];
}

/**
 * CustomerBottomNav — wraps the shared BottomNav primitive with the customer
 * roster. Renders nothing on lg+ (the sidebar takes over). Shows on every
 * customer surface (owner directive 2026-06-13 "global nav everywhere").
 *
 * `phase` swaps the whole roster by lifecycle phase (Event Lifecycle Menu): the
 * day-of command center while the event is live, the planning roster otherwise.
 * Computed SERVER-SIDE in the layout via `getLifecyclePhase(event_date,
 * cleared_at)` (which uses `isEventDayActive` — live ‖ post, so an evening
 * reception in `post` still gets the Day-of bar — and the `cleared_at` close-out)
 * and passed down, so there's no client `Date.now()` and no hydration flash. The
 * `after` roster (Review · Editorial · Galleries) lands in PR4; until then `after`
 * falls back to the planning roster.
 */
export function CustomerBottomNav({
  eventId,
  phase = 'plan',
}: {
  eventId: string;
  phase?: LifecyclePhase;
}) {
  const items = phase === 'dayof' ? buildDayOfNavTabs(eventId) : buildCustomerNavTabs(eventId);
  return <BottomNav items={items} />;
}

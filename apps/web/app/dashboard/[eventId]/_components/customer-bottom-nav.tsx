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
 * NAV REGISTRY (2026-06-16): the tab LABEL + ICON come from the admin-managed
 * registry (`customer.bottom-nav.<key>` slots) via `navSlots`, falling back to
 * the hardcoded defaults below if a slot is missing — so the bar is unchanged
 * until an admin edits it on /admin/menus. href + activeMatch stay in code
 * (routing, not naming). A slot marked hidden drops its tab.
 *
 * Renders via the shared <BottomNav> FLAT `items` path (the same canonical
 * primitive vendor + admin use) — the locked pill / traveling-pill / press-light
 * / icon-grow treatment is reused verbatim; registry icons are resolved to
 * stable components by navIconComponent so the bar itself is untouched.
 * Mobile-only (`lg:hidden`); the desktop sidebar renders separately.
 */

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { LucideIcon } from 'lucide-react';
import { Users, Compass, Sparkles, Palette, Wallet, QrCode, LayoutGrid, Rocket, CalendarClock, Star, Newspaper, Images } from 'lucide-react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { LifecyclePhase } from '@/lib/day-of-mode';

type TabSpec = {
  key: string;
  fallbackLabel: string;
  fallbackIcon: LucideIcon;
  href: string;
  activeMatch: string | string[];
  activeMatchExact?: boolean;
};

/**
 * Builds the flat 6-tab roster for the given eventId. Each tab is a real
 * destination; `activeMatch` carries the routes that should keep the tab lit.
 * `navSlots` (when provided) supplies the registry label + icon per tab.
 */
export function buildCustomerNavTabs(
  eventId: string,
  navSlots?: Record<string, NavSlotLite>,
): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;
  const specs: TabSpec[] = [
    {
      key: 'home',
      fallbackLabel: 'Home',
      // The Setnayan brand mark IS the Home tab (owner 2026-06-16). Cast:
      // SetnayanMark renders the same className/style/aria props the bar passes.
      fallbackIcon: SetnayanMark as unknown as LucideIcon,
      href: base,
      // Exact-match the event root only — otherwise it would prefix-match every
      // `${base}/*` route and stay perpetually active.
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'guests',
      fallbackLabel: 'Guests',
      fallbackIcon: Users,
      href: `${base}/guests`,
      activeMatch: [`${base}/guests`, `${base}/seating`, `${base}/event-qr`, `${base}/hosts`],
    },
    {
      key: 'explore',
      fallbackLabel: 'Explore',
      fallbackIcon: Compass,
      href: `${base}/vendors`,
      activeMatch: `${base}/vendors`,
    },
    {
      key: 'studio',
      fallbackLabel: 'Studio',
      fallbackIcon: Sparkles,
      href: `${base}/add-ons`,
      // The whole add-ons subtree (Papic/Panood/Patiktok/mood-board/…) lives
      // under /add-ons, so a prefix match lights Studio across all of it.
      activeMatch: `${base}/add-ons`,
    },
    {
      key: 'design',
      fallbackLabel: 'Design',
      fallbackIcon: Palette,
      href: `${base}/design`,
      // Design's surfaces are scattered: the new hub + the standalone Website
      // editor + the standalone Monogram studio. (Mood Board sits physically
      // under /add-ons, so it lights Studio — the Design hub still links to it.)
      activeMatch: [`${base}/design`, `/site-editor/${eventId}`, `${base}/monogram`],
    },
    {
      key: 'budget',
      fallbackLabel: 'Budget',
      fallbackIcon: Wallet,
      href: `${base}/budget`,
      activeMatch: [`${base}/budget`, `${base}/disputes`],
    },
  ];

  const tabs: BottomNavItem[] = [];
  for (const spec of specs) {
    const slot = navSlots?.[`customer.bottom-nav.${spec.key}`];
    if (slot?.isHidden) continue; // admin can drop a tab without a code change
    tabs.push({
      key: spec.key,
      label: slot?.label ?? spec.fallbackLabel,
      href: spec.href,
      icon: slot ? navIconComponent(slot.icon) : spec.fallbackIcon,
      activeMatch: spec.activeMatch,
      ...(spec.activeMatchExact ? { activeMatchExact: true } : {}),
    });
  }
  return tabs;
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
 * Builds the AFTER roster — the menu once the wedding is over and the day has
 * been closed out (Event Lifecycle Menu §6, 2026-06-16). Planning is no longer
 * the point; what you keep is. Four tabs: the Home anchor (the dashboard stays
 * alive as the event's reference home) plus the three memory-forward
 * destinations — **Review · Editorial · Galleries**:
 *   - Review    → /vendors          (the completion-gated per-vendor review tracker)
 *   - Editorial → /website/editorial (the living recap / front-page story)
 *   - Galleries → /galleries         (the collected photos, "collecting → ready")
 *
 * Slot 1 stays the Setnayan mark on the event root (exact match, so it doesn't
 * claim every child route) — same home-anchor pattern as the Plan/Day-of
 * rosters. There's no separate "Planning escape": in After the Home tab IS the
 * dashboard, so planning is reachable (demoted, never deleted) without a second
 * affordance.
 */
export function buildAfterNavTabs(eventId: string): BottomNavItem[] {
  const base = `/dashboard/${eventId}`;
  return [
    {
      key: 'home',
      label: 'Home',
      href: base,
      icon: SetnayanMark as unknown as LucideIcon,
      activeMatch: base,
      activeMatchExact: true,
    },
    {
      key: 'review',
      label: 'Review',
      href: `${base}/vendors`,
      icon: Star,
      activeMatch: `${base}/vendors`,
    },
    {
      key: 'editorial',
      label: 'Editorial',
      href: `${base}/website/editorial`,
      icon: Newspaper,
      activeMatch: `${base}/website/editorial`,
    },
    {
      key: 'galleries',
      label: 'Galleries',
      href: `${base}/galleries`,
      icon: Images,
      activeMatch: `${base}/galleries`,
    },
  ];
}

/**
 * CustomerBottomNav — wraps the shared BottomNav primitive with the customer
 * roster. Renders nothing on lg+ (the sidebar takes over). Shows on every
 * customer surface (owner directive 2026-06-13 "global nav everywhere").
 *
 * `phase` swaps the whole roster by lifecycle phase (Event Lifecycle Menu):
 * the planning menu before the day, the day-of command center while the event
 * is live, and the After memories menu once it's closed out. Computed
 * SERVER-SIDE in the layout via `getLifecyclePhase(event_date, cleared_at)`
 * (which uses `isEventDayActive` — live ‖ post, so an evening reception in
 * `post` still gets the Day-of bar — and the `cleared_at` close-out → `after`)
 * and passed down, so there's no client `Date.now()` and no hydration flash.
 *
 * `navSlots` is the admin nav-registry slot map (label + icon overrides) resolved
 * server-side in the layout; it feeds the planning roster (the day-of + after
 * rosters' registry slots land in a follow-up).
 */
export function CustomerBottomNav({
  eventId,
  phase = 'plan',
  navSlots,
}: {
  eventId: string;
  phase?: LifecyclePhase;
  navSlots?: Record<string, NavSlotLite>;
}) {
  const items =
    phase === 'dayof'
      ? buildDayOfNavTabs(eventId)
      : phase === 'after'
        ? buildAfterNavTabs(eventId)
        : buildCustomerNavTabs(eventId, navSlots);
  return <BottomNav items={items} />;
}

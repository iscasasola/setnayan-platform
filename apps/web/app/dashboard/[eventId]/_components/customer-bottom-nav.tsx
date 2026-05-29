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

import { CalendarHeart, Home, Store, Users, Menu } from 'lucide-react';
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
      // 2026-05-30 nav-tune (3) · Today RESTORED to slot 1.
      //
      // The 2026-05-29 nav-tune (2) move that removed Today from primary
      // nav assumed Today's Focus was paid-only (₱1,499-9,999) and
      // therefore prime real estate. That assumption was invalidated by
      // PR #644 (Wedding Essentials Free DIY surface · CLAUDE.md
      // 2026-05-29 row) which split /today rendering per tier:
      //
      //   - PAID (events.concierge_status='active') → full 65-card
      //     WizardHero with hard-floor scheduler + religion-adaptive
      //     copy + 5-tier ranking + coordinator meetings
      //   - FREE DIY (NULL / 'diy' / 'trial' / 'expired') → 7 Wedding
      //     Essentials cards + soft upgrade nudge to paid wizard
      //
      // Today is now valuable for EVERY couple. Hiding it in /more
      // orphaned the Wedding Essentials surface (owner 2026-05-30:
      // "today did not show"). Restoring to slot 1 honors the surface's
      // role as the daily planning anchor across the full runway.
      key: 'today',
      label: 'Today',
      href: `${base}/today`,
      icon: CalendarHeart,
      activeMatch: `${base}/today`,
    },
    {
      // Home demoted to slot 2 (was slot 1). Still high-frequency — the
      // event-home dashboard surfaces budget · phase tracker · plan
      // grid · activity feed. Couples will reach for Home daily, but
      // Today edges it out because Today carries the actionable next
      // step (Wedding Essential to fill OR wizard card to lock).
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
      // Vendors marketplace stays slot 3 (was slot 2 in PR #637). Owner
      // framing from 2026-05-29: "the connection of vendors and customer
      // IS the marketplace · without the marketplace or the vendor
      // recommendation, we will not connect them properly." Vendors stays
      // prominent in the primary nav.
      //
      // Routes to /dashboard/[eventId]/vendors (event-scoped vendor
      // management + marketplace embed) so couples land in their event's
      // vendor context, not the global /vendors page.
      key: 'vendors',
      label: 'Vendors',
      href: `${base}/vendors`,
      icon: Store,
      activeMatch: `${base}/vendors`,
    },
    {
      key: 'guests',
      label: 'Guests',
      href: `${base}/guests`,
      icon: Users,
      // People-side surfaces all bucket under Guests on the mobile
      // chrome — guests list + per-guest workspace, sponsors, hosts,
      // and the invitation editor.
      activeMatch: [
        `${base}/guests`,
        `${base}/sponsors`,
        `${base}/hosts`,
      ],
    },
    {
      // Messages MOVED to More (from slot 4 in PR #637). The Today/Plan
      // loop edges out Messages as the daily anchor across the full
      // 6-18 month runway. Messages stays one tap away via /more +
      // deep-links from chat notifications + in-thread links. Heavy
      // chat phase (final 2-3 months) still has Messages reachable
      // through More → Messages and through notification deep links.
      key: 'more',
      label: 'More',
      href: `${base}/more`,
      icon: Menu,
      // Catch-all for everything event-planning-side that isn't a
      // dedicated tab. Enumerated explicitly per the
      // [[feedback_setnayan_orphan_prevention]] rule — every route
      // must be reachable AND have its active tab light up correctly.
      // 2026-05-30 nav-tune (3) · Messages added (moved from slot 4).
      // Today removed from More activeMatch (Today now lives in slot 1).
      activeMatch: [
        `${base}/more`,
        // Messages — moved here from slot 4
        `${base}/messages`,
        `${base}/contracts`,
        // Plan group (excluding guests + hosts which sit under Guests,
        // and vendors which has its own tab)
        `${base}/seating`,
        `${base}/schedule`,
        // Spend group
        `${base}/budget`,
        `${base}/orders`,
        // /receipts is app-root scoped — added so reaching it from any
        // event-scoped route highlights More on the mobile chrome.
        '/receipts',
        // Share group — Website + invitation editor live under More
        `${base}/website`,
        `${base}/invitation`,
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

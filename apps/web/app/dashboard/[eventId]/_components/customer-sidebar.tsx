'use client';

/**
 * CustomerSidebar — v2.1 Navigation Phase 1 (customer doorway).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit (62 surfaces · 19 of them
 * customer-side) + 2026-05-23 row 2 admin nav pattern that PR #606
 * established as the reference for the 3-doorway sidebar treatment.
 *
 * Pre-Phase 1 the customer chrome rendered a 5-tab pill bar at
 * apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx (Today ·
 * Home · Guests · Website · Services) — fine on mobile but on desktop
 * it was the ONLY nav surface, forcing every other surface (Schedule ·
 * Vendors · Budget · Orders · Receipts · Messages · Contracts · Mood
 * Board · Activity · Disputes · Event QR · Hosts) into umbrella catch-
 * alls under "Services" with no per-route lighting. The audit found this
 * silently kept the side nav from highlighting any non-headline surface.
 *
 * This file owns the NavGroup[] array consumed by SidebarShell +
 * SidebarSection + SidebarItem from @/app/_components/nav/*. It is the
 * single source of truth for customer event-scoped nav structure on
 * desktop. The 5-item mobile BottomNav lives in customer-bottom-nav.tsx
 * alongside this file.
 *
 * 7 GROUPS (per canonical IA — same logical buckets the admin sidebar
 * established at PR #606, adapted to the 19 customer surfaces):
 *   1. Today         — Today's Focus · Home (the daily-driver entrypoints)
 *   2. Plan          — Guests · Seating · Schedule · Vendors
 *   3. Spend         — Budget · Orders · Receipts
 *   4. Communicate   — Messages · Contracts
 *   5. Share         — Website · Add-ons · Mood Board
 *   6. After         — Activity · Disputes · Event QR
 *   7. Settings      — Hosts · Profile
 *
 * REMOVED from the brief vs the original ship spec:
 *   - "Privacy" under Settings — /dashboard/profile/privacy doesn't exist
 *     on this codebase (only /dashboard/profile + /dashboard/profile/
 *     concierge). Adding a sidebar entry to a 404 would violate
 *     [[feedback_setnayan_orphan_prevention]]. Privacy controls live
 *     inside the Profile page itself; the Profile entry surfaces them.
 *
 * MOOD BOARD path — lives under /dashboard/[eventId]/add-ons/mood-board
 * per the on-disk route. Surfacing it as a sibling Share entry (rather
 * than nesting it under Add-ons) keeps the most-loved styling surface
 * one tap away — matches the iteration 0010 lock (mood-board has its
 * own first-class tile on event-home too).
 *
 * BRAND-LAYER per the v2.1 brief: route paths + DB tables stay; sidebar
 * labels read in editorial brand voice. "Today's Focus" not "Concierge."
 * "Add-ons" not "Services" (legacy label from the 2026-05-22 4-tab era
 * still in i18n as `nav.services` but the canonical surface is `Add-ons`
 * per CLAUDE.md 2026-05-22 rename — surfaced in the v2.1 voice).
 *
 * HREFS — the customer sidebar is event-scoped. Item hrefs include the
 * full `/dashboard/${eventId}/...` path because the NavItem type holds a
 * single href string (no Route helper). The exported builder
 * `buildCustomerNavGroups(eventId)` takes the eventId and returns the
 * NavGroup[] with hrefs baked in. The mobile BottomNav builder
 * `buildCustomerBottomNav(eventId)` mirrors this pattern.
 *
 * ACTIVE STATE — defers to <SidebarItem>'s default
 * (`pathname === href || pathname.startsWith(matchPrefix + '/')`) for
 * most items. Two exceptions need exact-match:
 *   - `Home` (`/dashboard/${eventId}`) — every other event-scoped route
 *     also starts with `/dashboard/${eventId}/`, so a startsWith match
 *     would keep Home perpetually active. We instead set matchPrefix to
 *     an unrouted sentinel `__home__` so the strict-prefix branch never
 *     fires and only the `pathname === href` branch keeps Home lit.
 *   - `Profile` (`/dashboard/profile`) — has a child route at
 *     `/dashboard/profile/concierge` (retired surface per
 *     [[project_setnayan_v2_1_canonical]]) and any future profile child
 *     should not auto-light the top-level Profile entry. Same sentinel
 *     pattern.
 *
 * GUESTS umbrella — `matchPrefix='/dashboard/${eventId}/guests'` so
 * `/dashboard/${eventId}/guests/[guestId]` keeps Guests lit. Same
 * treatment for Vendors (per-vendor workspace at /vendors/[vendorId]) +
 * Messages (per-thread at /messages/[threadId]) + Orders (per-order at
 * /orders/[orderId]) + Add-ons (per-addon at /add-ons/[addon]) + Mood
 * Board (sub-routes inside /add-ons/mood-board) + Contracts (per-
 * contract at /contracts/[contractId]) + Schedule + Seating + Disputes +
 * Hosts + Sponsors (legacy alias) — each defaults to its own href
 * which IS the prefix.
 */

import {
  Focus,
  Home,
  Users,
  LayoutGrid,
  CalendarClock,
  Briefcase,
  Wallet,
  ShoppingCart,
  Receipt,
  MessageSquare,
  FileText,
  Globe,
  Sparkles,
  Palette,
  Activity,
  Shield,
  QrCode,
  UserPlus,
  User,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Builds the canonical customer NavGroup[] for the given eventId. Mobile-
 * overflow landing at /dashboard/[eventId]/more consumes the same builder
 * via shape introspection — single source of truth.
 *
 * Stable group/item `key` values mean future label edits (e.g., a brand
 * polish pass on "Today" → "Today's Focus" in the heading) don't reset
 * the per-section `setnayan.nav.section.<key>.open` localStorage state.
 */
export function buildCustomerNavGroups(eventId: string): NavGroup[] {
  const base = `/dashboard/${eventId}`;

  return [
    {
      key: 'today',
      label: 'Today',
      items: [
        {
          key: 'todays-focus',
          label: "Today's Focus",
          href: `${base}/today`,
          icon: Focus,
        },
        {
          key: 'home',
          label: 'Home',
          href: base,
          icon: Home,
          // Sentinel matchPrefix so the strict-prefix branch never fires.
          // Only the exact-equality branch keeps Home lit — same pattern
          // as bottom-nav.tsx Home tab (CLAUDE.md 2026-05-22 PR #311
          // documents the prefix-vs-exact trap).
          matchPrefix: '__home__',
        },
      ],
    },
    {
      key: 'plan',
      label: 'Plan',
      items: [
        {
          key: 'guests',
          label: 'Guests',
          href: `${base}/guests`,
          icon: Users,
          matchPrefix: `${base}/guests`,
        },
        {
          key: 'seating',
          label: 'Seating',
          href: `${base}/seating`,
          icon: LayoutGrid,
          matchPrefix: `${base}/seating`,
        },
        {
          key: 'schedule',
          label: 'Schedule',
          href: `${base}/schedule`,
          icon: CalendarClock,
          matchPrefix: `${base}/schedule`,
        },
        {
          key: 'vendors',
          label: 'Vendors',
          href: `${base}/vendors`,
          icon: Briefcase,
          matchPrefix: `${base}/vendors`,
        },
      ],
    },
    {
      key: 'spend',
      label: 'Spend',
      items: [
        {
          key: 'budget',
          label: 'Budget',
          href: `${base}/budget`,
          icon: Wallet,
        },
        {
          key: 'orders',
          label: 'Orders',
          href: `${base}/orders`,
          icon: ShoppingCart,
          matchPrefix: `${base}/orders`,
        },
        {
          // /receipts lives at the app root (not event-scoped) — owner can
          // see all receipts across events from this single surface. We
          // still bucket it under Spend on the event chrome because the
          // host frequently lands here from a per-order flow.
          key: 'receipts',
          label: 'Receipts',
          href: `/receipts`,
          icon: Receipt,
          matchPrefix: '/receipts',
        },
      ],
    },
    {
      key: 'communicate',
      label: 'Communicate',
      items: [
        {
          key: 'messages',
          label: 'Messages',
          href: `${base}/messages`,
          icon: MessageSquare,
          matchPrefix: `${base}/messages`,
        },
        {
          key: 'contracts',
          label: 'Contracts',
          href: `${base}/contracts`,
          icon: FileText,
          matchPrefix: `${base}/contracts`,
        },
      ],
    },
    {
      key: 'share',
      label: 'Share',
      items: [
        {
          key: 'website',
          label: 'Website',
          href: `${base}/website`,
          icon: Globe,
          matchPrefix: `${base}/website`,
        },
        {
          key: 'add-ons',
          label: 'Add-ons',
          href: `${base}/add-ons`,
          icon: Sparkles,
          // /add-ons/mood-board has its own dedicated sidebar entry so
          // we exclude it from the Add-ons match via matching against
          // the bare /add-ons prefix only. Both will end up lit when
          // viewing /add-ons/mood-board because Mood Board's href IS
          // a prefix of that path AND the Add-ons matchPrefix is too —
          // accepted dual-highlight, mirrors the admin Payment methods
          // dual-bucket precedent (Money + Settings groups).
          matchPrefix: `${base}/add-ons`,
        },
        {
          key: 'mood-board',
          label: 'Mood Board',
          href: `${base}/add-ons/mood-board`,
          icon: Palette,
          matchPrefix: `${base}/add-ons/mood-board`,
        },
      ],
    },
    {
      key: 'after',
      label: 'After',
      items: [
        {
          key: 'activity',
          label: 'Activity',
          href: `${base}/activity`,
          icon: Activity,
        },
        {
          key: 'disputes',
          label: 'Disputes',
          href: `${base}/disputes`,
          icon: Shield,
          matchPrefix: `${base}/disputes`,
        },
        {
          key: 'event-qr',
          label: 'Event QR',
          href: `${base}/event-qr`,
          icon: QrCode,
        },
      ],
    },
    {
      key: 'settings',
      label: 'Settings',
      // Low-traffic — collapse by default to keep the Share + After groups
      // closer to the fold without forcing a scroll on lg-medium viewports.
      defaultOpen: false,
      items: [
        {
          key: 'hosts',
          label: 'Hosts',
          href: `${base}/hosts`,
          icon: UserPlus,
          matchPrefix: `${base}/hosts`,
        },
        {
          key: 'profile',
          label: 'Profile',
          href: `/dashboard/profile`,
          icon: User,
          // Sentinel matchPrefix so the strict-prefix branch never fires;
          // /dashboard/profile/concierge (retired surface) should not
          // auto-light the top-level Profile entry. The Profile page
          // itself surfaces privacy controls inline (no separate route
          // exists in this codebase).
          matchPrefix: '__profile-exact__',
        },
      ],
    },
  ];
}

/**
 * CustomerSidebar — renders the 7 customer nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark) so the customer doorway reads as a separate context from
 * vendor + admin doorways (each doorway gets the same chrome shape with
 * different context — the Wordmark eyebrow + 'Event' label is the
 * customer-side variant).
 */
export function CustomerSidebar({ eventId }: { eventId: string }) {
  const pathname = usePathname() ?? `/dashboard/${eventId}`;
  const groups = buildCustomerNavGroups(eventId);

  return (
    <>
      {/* Brand header — scrolls with the nav rather than being pinned.
          Matches the v2.1 editorial register: Wordmark + 'Event' eyebrow
          in m-label-mono. Mirrors admin-sidebar.tsx for cross-doorway
          chrome consistency. */}
      <header className="px-4 pb-4 pt-2 [[data-sidebar-collapsed='1']_&]:hidden">
        <Wordmark className="text-ink" />
        <p
          className="m-label-mono mt-2"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Event
        </p>
      </header>

      {groups.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}

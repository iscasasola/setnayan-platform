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
 * 6 JOURNEY GROUPS (owner-locked — the IA reads as the couple's planning
 * JOURNEY; everything past Setnayan + Plan collapses by default). Re-pointed
 * from the destination-menu structure shipped in PR #1465 back to this
 * journey IA. Full WHY + per-item provenance lives in the builder at
 * customer-nav-config.ts:
 *   1. Setnayan — Home · Studio · Explore                   (open)
 *   2. Plan     — Guests · Seating · Schedule · Budget      (open)
 *   3. Book     — Messages · Contracts                      (collapsed)
 *   4. Design   — Website · Mood Board · Monogram           (collapsed)
 *   5. Day-of   — Live Wall · Event QR                      (collapsed)
 *   6. After    — Activity · Disputes                       (collapsed)
 *
 * NO Settings group — Personalization (/details) · Hosts (/hosts) · Profile
 * + all account settings live under the profile avatar (top-right ProfileMenu
 * → Profile / Settings / Sign out). Those routes still exist and stay
 * reachable directly + via the Profile/Settings page; they're just off the
 * primary nav. Orders + Receipts stay retired-from-sidebar (reachable via
 * order-confirmation emails + Studio + Budget).
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
 * labels read in editorial brand voice. "Setnayan AI" not "Concierge."
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
 * most items. One exception needs exact-match:
 *   - `Home` (`/dashboard/${eventId}`) — every other event-scoped route
 *     also starts with `/dashboard/${eventId}/`, so a startsWith match
 *     would keep Home perpetually active. We instead set matchPrefix to
 *     an unrouted sentinel `__home__` so the strict-prefix branch never
 *     fires and only the `pathname === href` branch keeps Home lit. Home is
 *     a child of the Setnayan group.
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

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isDayOfOpen } from '@/lib/guest-journey';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
// buildCustomerNavGroups + the lucide icon refs it consumes live in a
// neutral (non-'use client') module — Server Components (specifically
// /more/page.tsx) need to be able to import + call this builder, which
// would crash if it were defined here because this file is 'use client'
// (required for the usePathname-driven active-state highlight below).
// See customer-nav-config.ts header for the full WHY block.
import { buildCustomerNavGroups } from './customer-nav-config';

// Re-export so existing consumers (this file's CustomerSidebar render +
// any other client-side caller) keep their existing import paths. New
// Server Component consumers should import directly from
// './customer-nav-config' to avoid the 'use client' boundary trap.
export { buildCustomerNavGroups };

/**
 * --- BEGIN historical buildCustomerNavGroups body (now lives in
 * customer-nav-config.ts) — kept in JSDoc form as a reference for the
 * 7-group customer IA structure. Any edits to the builder MUST land in
 * customer-nav-config.ts; this comment is documentation only.
 *
 * Builds the canonical customer NavGroup[] for the given eventId. Mobile-
 * overflow landing at /dashboard/[eventId]/more consumes the same builder
 * via shape introspection — single source of truth.
 *
 * Stable group/item `key` values mean future label edits (e.g., a brand
 * polish pass on "Today" → "Setnayan AI" in the heading) don't reset
 * the per-section `setnayan.nav.section.<key>.open` localStorage state.
 * --- END historical body
 */


/**
 * CustomerSidebar — renders the 6 customer journey groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark) so the customer doorway reads as a separate context from
 * vendor + admin doorways (each doorway gets the same chrome shape with
 * different context — the Wordmark eyebrow + 'Event' label is the
 * customer-side variant).
 */
/**
 * Maps each journey-group ITEM key → its admin nav-registry slot key. Items
 * absent here (e.g. the "Checklist" auto-step) have no registry slot yet and
 * pass through with their hardcoded label/icon. GROUP heading labels are a
 * deferred follow-up (no group slots yet).
 */
const SIDEBAR_SLOT_KEYS: Record<string, string> = {
  home: 'customer.sidebar.home',
  'add-ons': 'customer.sidebar.studio',
  vendors: 'customer.sidebar.explore',
  guests: 'customer.sidebar.guests',
  schedule: 'customer.sidebar.schedule',
  budget: 'customer.sidebar.budget',
  messages: 'customer.sidebar.messages',
  contracts: 'customer.sidebar.contracts',
  website: 'customer.sidebar.website',
  'mood-board': 'customer.sidebar.mood-board',
  monogram: 'customer.sidebar.monogram',
  live: 'customer.sidebar.live',
  'event-qr': 'customer.sidebar.event-qr',
  activity: 'customer.sidebar.activity',
  disputes: 'customer.sidebar.disputes',
};

/**
 * Maps nested child item keys → their registry slot keys. Currently covers the
 * five guest-journey stages that live under the "Guests" parent item. "seat"
 * reuses the pre-existing `customer.sidebar.seating` slot so admins who already
 * customised it see their changes reflected here too.
 */
const CHILD_SLOT_KEYS: Record<string, string> = {
  build: 'customer.sidebar.guests.build',
  invite: 'customer.sidebar.guests.invite',
  confirm: 'customer.sidebar.guests.confirm',
  seat: 'customer.sidebar.seating',
  dayof: 'customer.sidebar.guests.dayof',
};

/**
 * Overlays admin registry label + icon onto each item and its children
 * (fallback = the item's hardcoded default). A slot marked hidden drops the
 * item. href/activeMatch + group structure stay in code. No-op when navSlots is
 * absent (fails open to the built-in nav).
 */
function applyRegistry(
  groups: NavGroup[],
  navSlots?: Record<string, NavSlotLite>,
): NavGroup[] {
  if (!navSlots) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const slotKey = SIDEBAR_SLOT_KEYS[item.key];
      const slot = slotKey ? navSlots[slotKey] : undefined;
      if (slot?.isHidden) return [];
      const resolved = slot
        ? { ...item, label: slot.label, icon: navIconComponent(slot.icon) }
        : item;
      if (!resolved.children?.length) return [resolved];
      const children = resolved.children.flatMap((child) => {
        const childSlotKey = CHILD_SLOT_KEYS[child.key];
        const childSlot = childSlotKey ? navSlots[childSlotKey] : undefined;
        if (childSlot?.isHidden) return [];
        if (!childSlot) return [child];
        return [{ ...child, label: childSlot.label, icon: navIconComponent(childSlot.icon) }];
      });
      return [{ ...resolved, children }];
    }),
  }));
}

export function CustomerSidebar({
  eventId,
  navSlots,
  eventDate,
}: {
  eventId: string;
  navSlots?: Record<string, NavSlotLite>;
  /**
   * Drives the Guests-journey Day-of stage's time-gate (muted until the live
   * window). Deferred to a client effect so SSR + first paint agree (both
   * render Day-of muted) and it un-mutes on the event day — same no-flash
   * pattern as <GuestsSectionSubnav>.
   */
  eventDate?: string | null;
}) {
  const pathname = usePathname() ?? `/dashboard/${eventId}`;
  const [dayOfOpen, setDayOfOpen] = useState(false);
  useEffect(() => {
    setDayOfOpen(isDayOfOpen(eventDate ?? null, new Date()));
  }, [eventDate]);
  const groups = applyRegistry(
    buildCustomerNavGroups(eventId, { dayOfOpen }),
    navSlots,
  );

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

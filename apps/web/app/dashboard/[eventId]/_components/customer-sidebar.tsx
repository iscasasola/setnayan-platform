'use client';

/**
 * CustomerSidebar — unified 5-tab desktop sidebar (owner 2026-06-17).
 *
 * WHY: mobile shows 5 flat tabs (Home · Guests · Explore · Studio · Budget);
 * the desktop sidebar previously used a different 6-group journey structure
 * (Setnayan · Plan · Book · Design · Day-of · After). This mismatch meant a
 * user switching between breakpoints saw a completely different nav IA.
 *
 * The fix: the desktop sidebar now mirrors the same 5 top-level destinations
 * as the mobile tabs. ONE header-less group, five items, each expandable to
 * reveal their sub-pages on the desktop rail:
 *   1. Home    — dashboard root  (Checklist · Schedule · Messages · Contracts)
 *   2. Guests  — guest hub       (5 journey stages · Event QR)
 *   3. Explore — vendor market   (leaf — no sub-pages)
 *   4. Studio  — add-ons hub     (Website · Mood Board · Monogram · Live Wall)
 *   5. Budget  — financials      (Activity · Disputes)
 *
 * The NavGroup[] builder lives in customer-nav-config.ts (server-safe neutral
 * module). This file owns the rendering layer: registry overlay via
 * applyRegistry(), active-state computation via usePathname, and the
 * SidebarSection + SidebarItem composition.
 *
 * ACTIVE STATE — <SidebarItem> handles the standard rule
 * (`pathname === href || pathname.startsWith(matchPrefix + '/')`). Home is
 * the one exception: its matchPrefix is the sentinel `__home__` so the
 * startsWith branch never fires and only the exact-match branch lights it
 * (every other event route shares the `/dashboard/${eventId}/` prefix).
 *
 * NAV REGISTRY — admin-editable slot labels/icons via navSlots prop. The top-
 * level 5 tabs are covered by SIDEBAR_SLOT_KEYS; child items by
 * CHILD_SLOT_KEYS. Slots absent from the registry fall through to hardcoded
 * defaults (e.g. "Checklist" has no registry slot yet). A slot marked
 * `isHidden` drops the item entirely.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isDayOfOpen } from '@/lib/guest-journey';
import { AccountSwitcherStandalone } from '@/app/_components/account-switcher/account-switcher';
import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
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
 * CustomerSidebar — renders the unified 5-tab nav using SidebarSection +
 * SidebarItem primitives. The header-less root group means SidebarSection
 * renders no heading button — just the 5 items (each expandable to their
 * sub-pages). Wraps with a Wordmark brand header so the customer doorway
 * reads as its own context vs the vendor + admin doorways.
 */
/**
 * Maps the five top-level tab item keys → their admin nav-registry slot keys.
 * Matches the unified 5-tab structure in customer-nav-config.ts.
 */
const SIDEBAR_SLOT_KEYS: Record<string, string> = {
  home: 'customer.sidebar.home',
  guests: 'customer.sidebar.guests',
  explore: 'customer.sidebar.explore',
  studio: 'customer.sidebar.studio',
  budget: 'customer.sidebar.budget',
};

/**
 * Maps all child item keys → their registry slot keys. Covers the five
 * guest-journey stages plus every other sub-page nested under a top-level tab.
 * Items absent here (e.g. "Checklist") have no registry slot and pass through
 * with their hardcoded label/icon.
 */
const CHILD_SLOT_KEYS: Record<string, string> = {
  // Home children
  schedule: 'customer.sidebar.schedule',
  messages: 'customer.sidebar.messages',
  contracts: 'customer.sidebar.contracts',
  // Guests children — five journey stages
  build: 'customer.sidebar.guests-build',
  invite: 'customer.sidebar.guests-invite',
  confirm: 'customer.sidebar.guests-confirm',
  seat: 'customer.sidebar.seating',
  dayof: 'customer.sidebar.guests-dayof',
  'event-qr': 'customer.sidebar.event-qr',
  // Studio children
  website: 'customer.sidebar.website',
  'mood-board': 'customer.sidebar.mood-board',
  monogram: 'customer.sidebar.monogram',
  live: 'customer.sidebar.live',
  // Budget children
  activity: 'customer.sidebar.activity',
  disputes: 'customer.sidebar.disputes',
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
  switcherData,
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
  /** Pre-fetched AccountSwitcher data — renders at the top of the sidebar
      replacing the Wordmark, so the user's identity is always in the top-left. */
  switcherData?: SwitcherData;
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
      {/* Account switcher — top of sidebar, replaces the old Wordmark header.
          User identity at top-left (desktop); hidden when collapsed to icon rail. */}
      {switcherData ? (
        <div className="px-3 pb-3 pt-3 [[data-sidebar-collapsed='1']_&]:hidden">
          <AccountSwitcherStandalone data={switcherData} />
        </div>
      ) : null}

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

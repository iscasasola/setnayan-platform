'use client';

/**
 * CustomerSidebar — unified desktop sidebar (owner 2026-06-17), kept at parity
 * with the mobile tabs.
 *
 * WHY: the mobile tabs and the desktop sidebar must describe the SAME nav IA;
 * an earlier desktop-only journey structure meant a user switching breakpoints
 * saw a completely different nav.
 *
 * The fix: the desktop sidebar mirrors the same top-level destinations as the
 * mobile tabs (lib/customer-menu.ts). Two labelled sections — PLAN + GO LIVE —
 * composed by the builder:
 *   PLAN
 *     1. Overview — dashboard root  (plain leaf — old Checklist/Schedule/
 *        Messages/Contracts children were flattened #3004; those surfaces live
 *        in the dashboard body + topbar)
 *     2. Guests   — guest hub       (plain leaf — journey stages live in-page)
 *     3. Merkado  — vendor market   (Build tabs)
 *     4. Studio   — add-ons hub     (Event page · Website · Mood Board ·
 *        Monogram · Live Wall)
 *   GO LIVE
 *     5. Launch   — the couple's live personal website (gated on websiteEnabled)
 *
 * BUDGET (with its Activity + Disputes children) was REMOVED 2026-07-10 (owner)
 * to match the mobile SSOT — the budget moved into the Merkado. /budget stays
 * reachable from the Merkado's Budget tab; /activity from the dashboard body's
 * "See all recent activity →" link (event-dashboard.tsx, foot of "Around your
 * event"); /disputes from the vendor booking cancel→dispute flow. The
 * customer.sidebar.activity/disputes registry slots are intentionally kept so a
 * re-surfaced link stays admin-editable.
 *
 * The NavGroup[] builder lives in customer-nav-config.ts (server-safe neutral
 * module). This file owns the rendering layer: registry overlay via
 * applyRegistry(), active-state computation via usePathname, and the
 * SidebarSection + SidebarItem composition.
 *
 * ACTIVE STATE — <SidebarItem> handles the standard rule
 * (`pathname === href || pathname.startsWith(matchPrefix + '/')`). Overview is
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
  launch: 'customer.sidebar.launch',
  // (No 'budget' — the top-level Budget item was removed 2026-07-10; its
  // customer.sidebar.budget registry slot was already retired.)
};

/**
 * Maps all child item keys → their registry slot keys. Covers the five
 * guest-journey stages plus every other sub-page nested under a top-level tab.
 * Items absent here (e.g. "Checklist") have no registry slot and pass through
 * with their hardcoded label/icon.
 */
const CHILD_SLOT_KEYS: Record<string, string> = {
  // (Overview's old schedule/messages/contracts children were flattened #3004;
  // their CHILD_SLOT_KEYS entries were dead and were removed 2026-07-10.)
  // Guests children — five journey stages
  build: 'customer.sidebar.guests-build',
  invite: 'customer.sidebar.guests-invite',
  confirm: 'customer.sidebar.guests-confirm',
  seat: 'customer.sidebar.seating',
  dayof: 'customer.sidebar.guests-dayof',
  'event-qr': 'customer.sidebar.event-qr',
  // Studio children
  'event-page': 'customer.sidebar.event-page',
  website: 'customer.sidebar.website',
  'mood-board': 'customer.sidebar.mood-board',
  monogram: 'customer.sidebar.monogram',
  live: 'customer.sidebar.live',
  // Budget children — retained even though the top-level Budget item was removed
  // 2026-07-10: the customer.sidebar.activity/disputes registry slots are kept
  // (routes still valid), so these mappings stay so a re-surfaced Activity /
  // Disputes link renders its admin-editable label + icon.
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
  hideKeys,
  websiteEnabled,
  monogramEnabled,
  slug,
  guestCount,
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
  /** Top-level nav keys to drop for this event type (e.g. ['explore','budget']
   *  for a vendor-free Simple Event). Resolved from the profile in layout.tsx. */
  hideKeys?: string[];
  /** Whether this event type enables the 'website' surface — gates the Studio
   *  Event page / Website / Launch children. Resolved from the profile in layout. */
  websiteEnabled?: boolean;
  /** Whether this event type enables the 'monogram' surface — gates the Studio
   *  "Monogram" child. Resolved from the profile in layout. */
  monogramEnabled?: boolean;
  /** The event's public slug — points the top-level "Launch" entry at the
   *  couple's live personal website (`/[slug]`). Resolved in layout.tsx. */
  slug?: string | null;
  /** Live guest head-count → the Guests item badge. Resolved in layout.tsx;
   *  0/absent → no badge (never fabricated). */
  guestCount?: number | null;
  /** @deprecated No longer consumed by the sidebar — the Overview › Messages
   *  child was flattened #3004, so buildCustomerNavGroups dropped this param.
   *  Accepted only so the layout.tsx call site (which still computes it for the
   *  topbar bell) keeps type-checking; safe to remove once layout stops passing
   *  it. Not destructured on purpose (no dead local). */
  unreadMessages?: number;
}) {
  const pathname = usePathname() ?? `/dashboard/${eventId}`;
  const [dayOfOpen, setDayOfOpen] = useState(false);
  useEffect(() => {
    setDayOfOpen(isDayOfOpen(eventDate ?? null, new Date()));
  }, [eventDate]);
  const groups = applyRegistry(
    buildCustomerNavGroups(eventId, {
      dayOfOpen,
      hideKeys,
      websiteEnabled,
      monogramEnabled,
      slug,
      guestCount,
    }),
    navSlots,
  );

  return (
    <>
      {groups.map((group) => (
        // `eyebrow` — Glass PR-2 shell polish: section labels render as `.sn-eye`
        // gold eyebrows on the customer doorway only (opt-in; vendor/admin adopt
        // it in PR-6/PR-8). No-op on the header-less root group, which renders no
        // section heading — kept as the opt-in wiring for any labelled group.
        <SidebarSection key={group.key} group={group} pathname={pathname} eyebrow>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}

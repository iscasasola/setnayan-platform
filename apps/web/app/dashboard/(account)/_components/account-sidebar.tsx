'use client';

/**
 * AccountSidebar — desktop rail for the account-level customer doorway.
 *
 * Renders the flat 5-item account nav (My Events · Notifications · Profile &
 * Settings · Marketplace · New event) using the shared SidebarSection +
 * SidebarItem primitives, so the non-event customer pages match the event /
 * vendor / admin sidebars one-for-one (owner 2026-06-20 "universal style of
 * side bar").
 *
 * The NavGroup[] builder lives in account-nav-config.ts (server-safe neutral
 * module). This file owns the rendering layer: registry overlay via
 * applyRegistry(), active-state computation via usePathname, and the
 * SidebarSection + SidebarItem composition — the same shape as
 * customer-sidebar.tsx.
 *
 * NAV REGISTRY — admin-editable slot labels/icons via the navSlots prop (mapped
 * by SIDEBAR_SLOT_KEYS → the `customer.account.*` slots in
 * lib/nav-registry-defaults.ts). A slot marked `isHidden` drops the item. Slots
 * absent from the registry fall through to the hardcoded default. This file is a
 * registry chokepoint (scripts/lint-nav-icon-source.mjs) — it MUST consume the
 * resolved slot map; the applyRegistry + navIconComponent references below
 * satisfy that guard.
 */

import { usePathname } from 'next/navigation';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { buildAccountNavGroups } from './account-nav-config';

/**
 * Maps each account item key → its admin nav-registry slot key. Items absent
 * here pass through with their hardcoded label/icon.
 */
const SIDEBAR_SLOT_KEYS: Record<string, string> = {
  events: 'customer.account.events',
  notifications: 'customer.account.notifications',
  profile: 'customer.account.profile',
  marketplace: 'customer.account.marketplace',
  'new-event': 'customer.account.new-event',
};

/**
 * Overlays admin registry label + icon onto each item (fallback = the item's
 * hardcoded default). A slot marked hidden drops the item. href/matchPrefix +
 * group structure stay in code. No-op when navSlots is absent (fails open to
 * the built-in nav). The account nav is flat, so no child recursion is needed.
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
      if (!slot) return [item];
      return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
    }),
  }));
}

export function AccountSidebar({
  navSlots,
}: {
  navSlots?: Record<string, NavSlotLite>;
}) {
  const pathname = usePathname() ?? '/dashboard';
  const groups = applyRegistry(buildAccountNavGroups(), navSlots);

  return (
    <>
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

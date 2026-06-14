'use client';

/**
 * CustomerBottomNav — customer mobile primary nav (JOURNEY-GROUP ACCORDION).
 *
 * SIX FIXED JOURNEY MENUS · ALL EXPAND (re-pointed from the destination-menu
 * structure shipped in PR #1465 back to the journey-group IA the owner wants):
 *   1. Setnayan — Home · Studio · Explore
 *   2. Plan     — Guests · Seating · Schedule · Budget
 *   3. Book     — Messages · Contracts
 *   4. Design   — Website · Mood Board · Monogram
 *   5. Day-of   — Live Wall · Event QR
 *   6. After    — Activity · Disputes
 *
 * EVERY menu has children → EVERY menu extracts an inline accordion on tap
 * (the menu glides to the far-left corner = back-hinge, its children cascade
 * out). NONE navigate directly — there is no childless "navigates straight"
 * menu anymore. Home is a CHILD of Setnayan (tap Setnayan → Home), by design.
 * NO "More" overflow, NO horizontal scroll. Account/settings live under the
 * profile avatar (top-right ProfileMenu → Profile / Settings / Sign out ·
 * front door to iteration 0025) — the nav carries no Settings group.
 *
 * SINGLE SOURCE OF TRUTH: this builder no longer hand-rolls its own roster.
 * It derives the accordion menus directly from buildCustomerNavGroups
 * (customer-nav-config.ts) — the SAME six journey groups the desktop sidebar
 * renders. Each NavGroup → a BottomNavMenu { key, label, icon: group.icon,
 * children: group.items }. Each NavItem → a BottomNavItem (the item's
 * `matchPrefix` becomes the menu/child `activeMatch`; sentinel matchPrefixes
 * like `__home__` map to an exact-match on the item's own href so Home only
 * lights on the exact event-home route, never on every `${base}/*` child).
 *
 * The shared <BottomNav> renders the accordion when given the `menus` prop.
 * The four locked motion knobs + the traveling pill + press-light + icon-grow
 * are reused verbatim from the canonical primitive
 * (project_setnayan_bottom_nav_canonical). The accordion machinery in
 * bottom-nav.tsx already (a) lights a parent menu when ANY of its children
 * matches the route, and (b) never navigates a parent that HAS children —
 * tapping always expands. Since all six journey menus have children, no
 * special-casing is required. Vendor + admin doorways keep the flat `items`
 * path unchanged (customer-first rollout · spec §8).
 *
 * CLIENT BOUNDARY: 'use client' required because BottomNavMenu[] carries
 * LucideIcon refs (forwardRef objects) — passing them from a Server Component
 * to the Client BottomNav trips Next.js serialization. buildCustomerNavGroups
 * itself lives in a neutral module so Server Components can also call it.
 */

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import type {
  BottomNavItem,
  BottomNavMenu,
  NavGroup,
  NavItem,
} from '@/app/_components/nav/types';
import { Home } from 'lucide-react';
import { buildCustomerNavGroups } from './customer-nav-config';

/**
 * Maps a NavItem (sidebar/destination shape) onto a BottomNavItem
 * (accordion shape). The NavItem's `matchPrefix` (defaults to `href`) carries
 * active-detection. A SENTINEL matchPrefix (`__…__` — used by Home so the
 * strict-prefix branch never fires in the sidebar) can't be matched against a
 * real path, so for the bottom nav we instead exact-match the item's own
 * `href` (the actual route). All other items use prefix-match on
 * `matchPrefix ?? href`.
 */
function navItemToBottomNavItem(item: NavItem): BottomNavItem {
  const isSentinel =
    typeof item.matchPrefix === 'string' &&
    item.matchPrefix.startsWith('__') &&
    item.matchPrefix.endsWith('__');

  return {
    key: item.key,
    label: item.label,
    href: item.href,
    icon: item.icon,
    badge: item.badge,
    // Sentinel → exact-match the real href; otherwise prefix-match
    // matchPrefix (falls back to href). The shared matchesPath() uses
    // `pathname === prefix || pathname.startsWith(prefix + '/')`.
    activeMatch: isSentinel ? item.href : (item.matchPrefix ?? item.href),
    activeMatchExact: isSentinel ? true : undefined,
  };
}

/**
 * Maps a NavGroup (journey group) onto a BottomNavMenu — a top-level
 * accordion menu that EXPANDS to its children. `href` is a non-JS / keyboard
 * fallback only (a menu with children opens the section on tap); point it at
 * the first child so it still resolves. `activeMatch` is the union of the
 * children's prefixes so the menu lights when any child route is active (the
 * accordion's own activeMenuIndex also checks children, so this is belt-and-
 * suspenders + keeps a sane fallback if the group ever had zero children).
 */
function navGroupToBottomNavMenu(group: NavGroup): BottomNavMenu {
  const children = group.items.map(navItemToBottomNavItem);
  const firstChild = children[0];

  return {
    key: group.key,
    label: group.label,
    // Per the NavGroup→accordion contract the top-level menu always carries a
    // glyph; fall back to Home only if a group somehow omitted its icon.
    icon: group.icon ?? Home,
    // Fallback href (menus with children expand, they don't navigate).
    href: firstChild?.href ?? '#',
    // Union of child prefixes — lights the menu when any child is active.
    activeMatch: children.flatMap((c) =>
      Array.isArray(c.activeMatch) ? c.activeMatch : [c.activeMatch],
    ),
    children,
  };
}

/**
 * Builds the 6-menu journey accordion config for the given eventId, derived
 * from the SAME buildCustomerNavGroups the desktop sidebar consumes — one
 * roster, two renderings.
 */
export function buildCustomerNavMenus(eventId: string): BottomNavMenu[] {
  return buildCustomerNavGroups(eventId).map(navGroupToBottomNavMenu);
}

/**
 * CustomerBottomNav — wraps the shared BottomNav primitive with the
 * customer-doorway 6-menu journey accordion config. Renders nothing on lg+
 * (the sidebar takes over). Per [[feedback_setnayan_orphan_prevention]] every
 * menu/child destination route exists (the roster is the same one the sidebar
 * ships, whose hrefs all resolve to real route folders under
 * apps/web/app/dashboard/[eventId]/ + /site-editor/[eventId]).
 *
 * The global nav shows on EVERY customer surface (owner directive
 * 2026-06-13 "global nav everywhere").
 */
export function CustomerBottomNav({ eventId }: { eventId: string }) {
  return <BottomNav menus={buildCustomerNavMenus(eventId)} />;
}

/**
 * navLineIcon — the event menu's five destinations accept a registry icon ONLY
 * from the app's own line family (owner 2026-10-07: *"make the logo of guests,
 * supplier and event hub consistent"* · *"fix the icons on the bottom nav as
 * well"*; DECISION_LOG "THE BOTTOM NAV'S FIVE ICONS — THE OWNER'S PICK").
 *
 * `navIconComponent` (app/_components/nav/nav-icon-component.tsx) resolves ANY
 * descriptor — a lucide name, the inline Setnayan mark, an uploaded image. That
 * is right for the admin and supplier menus, and it is how the phone bar's Home
 * tab came to draw the FILLED Setnayan mark among four line icons. For the
 * five event tabs (Home · Guests · Suppliers · Hub · More) — on the phone bar,
 * the desktop rail and the Home doorway row — an admin override may RELABEL a
 * tab and pick ANOTHER lucide icon from the allowlist (`getLucideIcon`), and
 * nothing else: a custom mark, an uploaded image, an emoji or any name the
 * allowlist does not know falls back to the code icon (`EVENT_MENU_ICONS`).
 *
 * Neutral module (no `'use client'`): the server Home page and the client bar
 * both import it.
 */

import type { LucideIcon } from 'lucide-react';
import { getLucideIcon } from '@/lib/nav-icons';
import type { NavIconDescriptor, NavSlotLite } from '@/lib/nav-registry-types';
import { HOME_DOORWAY_ICONS } from '@/lib/customer-menu';

/** A registry icon for one of the five, or `fallback` when it is not a line icon. */
export function navLineIcon(icon: NavIconDescriptor | null | undefined, fallback: LucideIcon): LucideIcon {
  if (!icon || icon.kind !== 'lucide') return fallback;
  return getLucideIcon(icon.lucideName) ?? fallback;
}

export type HomeDoorwayKey = keyof typeof HOME_DOORWAY_ICONS;

/**
 * The icon for one Home doorway button ("Edit your Guest list" → `guests`,
 * "Edit your Suppliers" → `explore`, "Edit your Event Hub" → `launch`) — the
 * SAME registry slot the bottom-bar tab it opens reads
 * (`customer.bottom-nav.<key>`), through the same line-only rule, so a doorway
 * and its tab can never wear two icons.
 */
export function homeDoorwayIcon(key: HomeDoorwayKey, navSlots?: Record<string, NavSlotLite> | null): LucideIcon {
  return navLineIcon(navSlots?.[`customer.bottom-nav.${key}`]?.icon, HOME_DOORWAY_ICONS[key]);
}

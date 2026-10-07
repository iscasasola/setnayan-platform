/**
 * Customer NavGroup[] builder — THE EVENT MENU, FIVE ROWS (Stage D, owner
 * 2026-09-29: *"this is what an event needs. Guestlist · Your Team · Event Hub
 * Maker · Our Services"*).
 *
 * 🔑 THIS IS NOT A TREE OF ITS OWN. It is the desktop rail's (and the ☰
 * drawer's) PROJECTION of `buildEventMenuSections` in `lib/customer-menu.ts` —
 * the one tree the phone's bottom bar reads too. Rows, order, labels, routes,
 * claims and gating are decided THERE; this file only turns icon NAMES into
 * components, adds the Guest list head-count badge, and hands the sections
 * over as `NavGroup[]`:
 *
 *   event    (no heading) → Details — drawn as the event's NAME row
 *   pillars  (no heading) → Home · Guest list · Your Team · Event Hub Maker ·
 *                           More Services (opens to its five — 2026-09-30)
 *
 * WHERE THE OLD ROWS WENT (each page still lights the row that holds it):
 *   · Hosts · Check-in              → Guest list's parts
 *   · Budget                        → Your Team's Budget part
 *   · Schedule · Mood Board · Logo  → the Event Hub Maker (Details)
 *   · Editorial                     → the Maker's Post Event (Gallery on Our
 *                                     Services where there is no Maker)
 *   · Setnayan AI · Papic · Live Studio · Music Maker · Patiktok
 *                                   → More Services' five children
 *   · Refer a couple                → the account menu (top bar)
 *
 * 🔒 EVERY ROW IS A PLAIN LEAF — "solid menu with no submenus" (owner-locked
 * 2026-07-15) — except More Services (`studio`), which the owner opened on
 * 2026-09-30 to its five services. 🔒 EVERY KEY IS UNCHANGED (`home` · `guests` · `explore` ·
 * `launch` · `studio` · `personalization` · `seat`): `SIDEBAR_SLOT_KEYS`, the
 * hideKeys gate and `eventRailMatchRows` all key off them, and none of them
 * throws when a key stops matching.
 *
 * Server-Component safety: neutral (non-'use client') module — the layout
 * calls it (through `eventRailMatchRows`) and the client rail calls it. Icons
 * are resolved HERE, on whichever side calls it; nothing crosses the boundary
 * but the plain inputs.
 */

import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { customerGuestsBadge } from '@/lib/nav-badges';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import {
  buildEventMenuSections,
  EVENT_MENU_ICONS,
  type EventMenuChild,
  type EventStudioRow,
} from '@/lib/customer-menu';

export function buildCustomerNavGroups(
  eventId: string,
  opts?: {
    dayOfOpen?: boolean;
    hideKeys?: string[];
    websiteEnabled?: boolean;
    /** ⚠ UNDEFINED MEANS SHOW — only an explicit `false` drops Seat plan. */
    seatingEnabled?: boolean;
    /** Retained for callers; the monogram surface now gates the Logo Maker
     *  product row upstream, in `railToolsSignedIn`. */
    monogramEnabled?: boolean;
    /** Retained for callers/other consumers; no row routes on it. */
    slug?: string | null;
    /** Live guest count → the Guests item's badge (neutral tone). Resolved
     *  server-side in layout.tsx; omit/0 → no badge (never fabricated). */
    guestCount?: number | null;
    /** plan · dayof · after. Omitted ⇒ 'plan'. The five rows are the same in
     *  every phase; it is passed through for the tree's own use. */
    phase?: MenuLifecyclePhase;
    /** The event's Studio products, plain data from `railToolsSignedIn` —
     *  no longer rows; their pages are claimed by the row that holds them. */
    studioRows?: ReadonlyArray<EventStudioRow>;
    /** The App Store / Play Store shell — refused rows are dropped by the one
     *  tree (`storeShellRefusesMenuRow`), on the rail and ☰ drawer too. */
    storeShell?: boolean;
    /** The five under More Services (`EventMenuCtx.services`). */
    services?: ReadonlyArray<EventMenuChild>;
  },
): NavGroup[] {
  // The Guest list head-count badge, built ONCE by the shared helper that the
  // phone's bottom bar also calls — see lib/nav-badges.ts for why the two must
  // not each derive it.
  const guestsBadge = customerGuestsBadge(opts?.guestCount);

  return buildEventMenuSections(eventId, {
    phase: opts?.phase,
    hideKeys: opts?.hideKeys,
    websiteEnabled: opts?.websiteEnabled,
    seatingEnabled: opts?.seatingEnabled,
    studioRows: opts?.studioRows,
    storeShell: opts?.storeShell,
    services: opts?.services,
  }).map((section) => ({
    key: section.key,
    label: section.label,
    defaultOpen: true,
    items: section.rows.map((r): NavItem => ({
      key: r.key,
      label: r.label,
      href: r.href,
      // One line family for every row — Home too (owner 2026-10-07: the
      // Setnayan mark stays in the top bar only; `EVENT_MENU_ICONS`).
      icon: EVENT_MENU_ICONS[r.icon],
      matchPrefix: r.matchPrefix ?? r.href,
      ...(r.alsoMatch?.length ? { alsoMatch: r.alsoMatch } : {}),
      ...(r.key === 'guests' && guestsBadge ? { badge: guestsBadge } : {}),
      // 📂 Only More Services carries children (owner 2026-09-30).
      ...(r.children?.length
        ? {
            children: r.children.map((c): NavItem => ({
              key: c.key,
              label: c.label,
              // The service's Setnayan name, small under its plain name (owner d17).
              ...(c.sub ? { description: c.sub } : {}),
              href: c.href,
              icon: EVENT_MENU_ICONS[c.icon],
            })),
          }
        : {}),
    })),
  }));
}

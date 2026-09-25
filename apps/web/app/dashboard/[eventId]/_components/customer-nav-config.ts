/**
 * Customer NavGroup[] builder — THE EVENT MENU, BY MOMENT (owner 2026-09-24).
 *
 * 🔑 THIS IS NO LONGER A TREE OF ITS OWN. It is the desktop rail's (and the ☰
 * drawer's) PROJECTION of `buildEventMenuSections` in `lib/customer-menu.ts` —
 * the one sectioned tree the phone's bottom bar and moment strip read too.
 * Rows, order, labels, routes and gating are decided THERE; this file only
 * turns icon NAMES into components, adds the Guests head-count badge, and
 * hands the sections over as `NavGroup[]`:
 *
 *   event   (no heading) → Details — drawn as the event's NAME row
 *   spine   (no heading) → Overview · Papic ✦ · Galleries · Editorial (after)
 *   book    "Book"       → Your Team · Budget
 *   look    "Look"       → Mood Board ✦ · Logo Maker ✦ · Pakanta ✦
 *   invite  "Invite"     → Guests · Hosts · Event Hub Controller
 *   day     "The day"    → Schedule · Check-in (day-of) · Seat plan ·
 *                          Live Studio ✦ · Patiktok ✦ (3D Plan ✦ is absorbed
 *                          into Seat plan, which claims its pages — 2026-09-24)
 *   end     (no heading) → Setnayan AI ✦ · Suite · Refer a couple
 *
 * Binding drawing: `build-sessions/prototypes/event_menu_by_moment_2026-09-24.html`.
 * The acceptance test is the owner's sentence — *"finding the logo maker at
 * the bottom feels so far"*: Logo Maker moves from row 26 of 27 (+11 hidden)
 * to row 9 of 21, directly under Mood Board.
 *
 * WHAT WENT, AND WHERE (the per-row ledger lives in the drawing's foot):
 *   · "Plan" / "Go live" / "Also in this event" headings → the moments above.
 *   · Personalization → Details, on the event's name row (key unchanged).
 *   · The shell's "Browse by category" group → REMOVED inside an event (owner:
 *     *"we already have your team as where they search, negotiate and build
 *     their suppliers"*). It opened the date-blind public `/explore`.
 *   · The shell's Studio group → DISSOLVED: each product sits at its moment
 *     with ✦; its "Event Hub" row is the Event Hub Controller row (one door,
 *     2026-09-02); its "All services" row is the `studio` row, now "Suite".
 *
 * 🔒 EVERY ROW IS A PLAIN LEAF — "solid menu with no submenus" (owner-locked
 * 2026-07-15). 🔒 EVERY KEY IS UNCHANGED (`home` · `guests` · `explore` ·
 * `studio` · `launch` · `personalization` · `hosts` · `refer` · `schedule` ·
 * `seat` · `budget` · `editorial` · `galleries`): `SIDEBAR_SLOT_KEYS`, the
 * hideKeys gate (`refer` hides when the programme is off; `explore`/`budget`
 * for vendor-free kinds) and `eventRailMatchRows` all key off them, and none of
 * them throws when a key stops matching.
 *
 * Server-Component safety: neutral (non-'use client') module — the layout
 * calls it (through `eventRailMatchRows`) and the client rail calls it. Icons
 * are resolved HERE, on whichever side calls it; nothing crosses the boundary
 * but the plain inputs.
 */

import type { LucideIcon } from 'lucide-react';
import type { NavGroup, NavItem } from '@/app/_components/nav/types';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { customerGuestsBadge } from '@/lib/nav-badges';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import {
  buildEventMenuSections,
  EVENT_MENU_ICONS,
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
    /** plan · dayof · after. Omitted ⇒ 'plan'. Day-of adds Check-in to The
     *  day; after adds Editorial to the spine. */
    phase?: MenuLifecyclePhase;
    /** The event's Studio products, plain data from `railToolsSignedIn`. */
    studioRows?: ReadonlyArray<EventStudioRow>;
    /** The App Store / Play Store shell — refused rows are dropped by the one
     *  tree (`storeShellRefusesMenuRow`), on the rail and ☰ drawer too. */
    storeShell?: boolean;
  },
): NavGroup[] {
  // The Guests head-count badge, built ONCE by the shared helper that the
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
  }).map((section) => ({
    key: section.key,
    label: section.label,
    defaultOpen: true,
    items: section.rows.map((r): NavItem => ({
      key: r.key,
      label: r.label,
      href: r.href,
      icon:
        r.key === 'home'
          ? (SetnayanMark as unknown as LucideIcon)
          : EVENT_MENU_ICONS[r.icon],
      matchPrefix: r.matchPrefix ?? r.href,
      ...(r.studio ? { studio: true } : {}),
      ...(r.alsoMatch?.length ? { alsoMatch: r.alsoMatch } : {}),
      ...(r.key === 'guests' && guestsBadge ? { badge: guestsBadge } : {}),
    })),
  }));
}

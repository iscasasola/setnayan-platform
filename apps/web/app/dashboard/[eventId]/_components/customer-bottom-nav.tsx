'use client';

/**
 * CustomerBottomNav — the phone's ONE bottom bar inside an event (Stage D,
 * owner 2026-09-29: *"on mobile mode. we do not want that sub bottom nav
 * anymore. we want it to be simple and easy to manage"*).
 *
 *     Home · Guests · Suppliers · Hub · Memories
 *
 * The same five in every phase, for every event type, on the web and in the app
 * (owner 22 Oct 2026: every event wears the wedding's bar, then *"Yes remove
 * more"* — the 2026-10-01 More tab and its chooser sheet are gone; every
 * service lives on Home › Your services. Owner 23 Oct 2026: Memories — this
 * event's photos — is the fifth, after Hub, wearing the account bar's glyph). In the rail's own words, picked out of
 * the one tree in `lib/customer-menu.ts` (`buildCustomerMenuTree`) — the desktop
 * rail draws the same rows under the same words. Nothing docks above this bar; a
 * pillar's parts are chosen inside its page.
 *
 * NAV REGISTRY: `navSlots` (`customer.bottom-nav.<key>`) overlays the
 * admin-managed label + icon on each tab; a slot marked hidden drops its tab.
 * The icon is LINE-ONLY (`navLineIcon`, owner 2026-10-07): House ·
 * BookUser · Store · AppWindow · Sparkles (Memories) by default, another lucide icon by
 * override, never the Setnayan mark, an image or an emoji.
 * Keys `home` · `guests` · `explore` · `launch` · `memories` (and the retired `studio`) — each has its slot
 * in NAV_SLOT_DEFAULTS. href + activeMatch always stay in code.
 *
 * Renders via the shared <BottomNav> primitive — traveling-pill + press-light
 * treatment is reused verbatim. Mobile-only (`lg:hidden`).
 */

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navLineIcon } from '@/lib/nav-line-icon';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';
import { buildCustomerMenuTree, type EventStudioRow } from '@/lib/customer-menu';

import { customerGuestsBadge } from '@/lib/nav-badges';

export function CustomerBottomNav({
  eventId,
  phase = 'plan',
  navSlots,
  hideKeys,
  guestCount,
  seatingEnabled,
  websiteEnabled,
  studioRows,
  storeShell,
}: {
  eventId: string;
  phase?: MenuLifecyclePhase;
  navSlots?: Record<string, NavSlotLite>;
  /**
   * Live guest head-count → the Guests tab's badge, identical to the one the
   * desktop sidebar has always shown. Resolved server-side in layout.tsx and
   * fail-soft there, so 0/null means "none or could not tell" and the shared
   * helper renders nothing rather than a badge claiming zero.
   */
  guestCount?: number | null;
  /** Top-level menu keys to drop. ⚖ The event layout passes NONE (owner 22 Oct 2026 — every event
   *  wears the wedding's bar, `lib/event-menu-gates.ts`); kept for a caller that draws a part bar. */
  hideKeys?: string[];
  /** Whether this event type enables 'seating' — gates the Seat plan rail row,
   *  whose pages light the Guest list tab here. Resolved in layout.tsx. */
  seatingEnabled?: boolean;
  /**
   * Whether this event type enables the 'website' surface — gates the Event
   * Hub Maker tab.
   *
   * 🔴 THIS PROP DID NOT EXIST, AND THE TAB IT GATES NEVER RENDERED ON A PHONE.
   * `buildCustomerMenuTree` gates the plan-phase `launch` row on
   * `ctx.websiteEnabled`; this component never passed it, so the flag arrived
   * `undefined`, the gate read that as "no website surface", and the row was
   * dropped from every planning phone. The day-of and after rosters build their
   * `launch` row UNGATED, so the tab appeared the moment the wedding arrived —
   * which is exactly why nobody found it: the bug only existed before the day.
   *
   * 🔑 AND BEFORE THE DAY IS WHEN THE HUB IS THE PRODUCT. `customer-menu.ts`
   * says so itself, about the change that created this row: *"on a phone in the
   * months BEFORE the day — when the save-the-date and the invitation ARE the
   * product — the Hub was two taps deep behind a word for something else."*
   * That fix shipped, and on phones it never took effect.
   *
   * ⚠ UNDEFINED MEANS HIDE HERE — the opposite of `seatingEnabled` one field
   * up, whose docblock says *"a caller that has not been taught this field must
   * not silently lose the tab."* Two sibling gates, opposite defaults, and only
   * one of them was designed for the caller who had not been taught. That
   * asymmetry is the root cause, not a typo. The gate itself is RIGHT — an
   * event kind with no website surface must not offer the Hub, and the desktop
   * rail hides it too — so the caller is what gets fixed, plus a guard below so
   * the next caller cannot repeat it.
   */
  websiteEnabled?: boolean;
  /**
   * The event's Studio products as PLAIN DATA (key · href · name) — no longer
   * tabs, but the one tree claims each product's pages for the tab that holds
   * it (More Services, or the Maker for Mood Board / Logo), so a product page
   * still lights a tab. Without this list those pages light nothing.
   *
   * 🛑 Strings only. This is a `'use client'` component fed by a server
   * layout; a function prop here is the 2026-09-23 seven-hour outage.
   */
  studioRows?: ReadonlyArray<EventStudioRow>;
  /**
   * The App Store / Play Store shell, resolved server-side (`isStoreShellRequest()`
   * in layout.tsx). The one tree drops every tab whose door `lib/store-shell.ts`
   * refuses, so a refused tab is never built — a hidden-after-paint tab left a
   * blank slot in the grid (the Papic slot the owner saw on 2026-09-25).
   */
  storeShell?: boolean;
}) {
  const tree = buildCustomerMenuTree(eventId, { phase, hideKeys, seatingEnabled, websiteEnabled, studioRows, storeShell });

  const items: BottomNavItem[] = tree.flatMap((m) => {
    // Registry overrides (label + icon) — every tab has its
    // `customer.bottom-nav.<key>` slot in NAV_SLOT_DEFAULTS.
    const slot = navSlots?.[`customer.bottom-nav.${m.key}`];
    if (slot?.isHidden) return [];
    const label = slot?.label ?? m.label;
    // ONE LINE FAMILY (owner 2026-10-07). The slot may pick another lucide
    // icon; a custom mark, an image or an unknown name falls back to the
    // tree's icon (`EVENT_MENU_ICONS`). The Setnayan mark is the top bar's
    // alone — it is no longer this bar's Home.
    const icon = navLineIcon(slot?.icon, m.icon);
    // Live badge — the SAME helper the desktop rail's Guest list row uses, so
    // the phone and the laptop can never show different numbers for the same
    // thing. Only tabs whose sidebar twin already carries a badge get one;
    // inventing a count for a tab is a product decision, not a port detail.
    const badge = m.key === 'guests' ? customerGuestsBadge(guestCount) : undefined;
    return [
      {
        key: m.key,
        label,
        icon,
        href: m.href,
        activeMatch: m.activeMatch,
        activeMatchExact: m.activeMatchExact,
        ...(m.activeMatchAlsoExact ? { activeMatchAlsoExact: m.activeMatchAlsoExact } : {}),
        ...(badge ? { badge } : {}),
      },
    ];
  });

  return <BottomNav items={items} />;
}

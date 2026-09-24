'use client';

/**
 * CustomerBottomNav — customer mobile primary nav, driven by the SSOT tree in
 * `lib/customer-menu.ts`.
 *
 * Phase-aware (Plan → Day-of → After): `buildCustomerMenuTree` returns the
 * correct tab roster for the current lifecycle phase. All three phases apply
 * admin nav-registry overrides (label + icon per slot). See `lib/customer-menu.ts`
 * for the full tab definitions and active-match specs per phase.
 *
 * NAV REGISTRY (all phases): `navSlots` (`customer.bottom-nav.<key>`) overlays
 * admin-managed label + icon on each tab; a slot marked hidden drops its tab.
 * Plan `home/papic/explore/guests/launch` · Day-of
 * `now/papic/checkin/launch/schedule` · After `home/papic/galleries/review/launch`
 * (2026-09-24, event menu by moment) — every key has its slot in
 * NAV_SLOT_DEFAULTS. href + activeMatch always stay in code.
 *
 * Renders via the shared <BottomNav> primitive — traveling-pill + press-light
 * treatment is reused verbatim. Mobile-only (`lg:hidden`).
 */

import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { LucideIcon } from 'lucide-react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
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
  /** Top-level menu keys to drop for this event type (e.g. ['explore','budget']
   *  for a vendor-free Simple Event). Resolved from the profile in layout.tsx. */
  hideKeys?: string[];
  /** Whether this event type enables 'seating' — gates the DAY-OF "Seats" tab.
   *  `hideKeys` cannot express it: the day-of branch returns before that filter
   *  runs. Resolved from the profile in layout.tsx. */
  seatingEnabled?: boolean;
  /**
   * Whether this event type enables the 'website' surface — gates the PLAN
   * phase's Event Hub Controller tab.
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
   * The event's Studio products as PLAIN DATA (key · href · name) — the Papic
   * tab (every phase, owner 2026-09-24) is picked out of the one tree by key,
   * so without this list there is no Papic tab.
   *
   * 🛑 Strings only. This is a `'use client'` component fed by a server
   * layout; a function prop here is the 2026-09-23 seven-hour outage.
   */
  studioRows?: ReadonlyArray<EventStudioRow>;
}) {
  const tree = buildCustomerMenuTree(eventId, { phase, dayOfOpen: false, hideKeys, seatingEnabled, websiteEnabled, studioRows });

  const items: BottomNavItem[] = tree.flatMap((m) => {
    // All phases apply nav-registry overrides (label + icon) — plan, day-of, and
    // after each have `customer.bottom-nav.<key>` slots in NAV_SLOT_DEFAULTS.
    const slot = navSlots?.[`customer.bottom-nav.${m.key}`];
    if (slot?.isHidden) return [];
    const label = slot?.label ?? m.label;
    // Keep the Setnayan mark on the anchor tab (key 'now' or 'home') as the code
    // default when no admin override has set an icon for the slot.
    const icon =
      slot
        ? navIconComponent(slot.icon)
        : m.key === 'now' || m.key === 'home'
          ? (SetnayanMark as unknown as LucideIcon)
          : m.icon;
    // Live badge — the SAME helper the desktop sidebar's Guests row uses, so
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
        ...(badge ? { badge } : {}),
      },
    ];
  });

  return <BottomNav items={items} />;
}

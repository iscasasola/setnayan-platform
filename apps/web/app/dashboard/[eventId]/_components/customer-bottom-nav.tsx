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
 * The Day-of (`now/checkin/seats/services/schedule`) and After
 * (`home/review/editorial/galleries`) tabs have their own slots in
 * NAV_SLOT_DEFAULTS, mirroring the plan-phase slots. href + activeMatch always
 * stay in code.
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
import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { customerGuestsBadge } from '@/lib/nav-badges';

export function CustomerBottomNav({
  eventId,
  phase = 'plan',
  navSlots,
  hideKeys,
  guestCount,
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
}) {
  const tree = buildCustomerMenuTree(eventId, { phase, dayOfOpen: false, hideKeys });

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

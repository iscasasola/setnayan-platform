'use client';

/**
 * CustomerBottomNav — customer mobile primary nav, driven by the SSOT tree in
 * `lib/customer-menu.ts`.
 *
 * Phase-aware (Plan → Day-of → After): `buildCustomerMenuTree` returns the
 * correct tab roster for the current lifecycle phase. Plan phase applies
 * admin nav-registry overrides (label + icon per slot); Day-of and After use
 * code defaults (registry slots land in a follow-up). See `lib/customer-menu.ts`
 * for the full tab definitions and active-match specs per phase.
 *
 * NAV REGISTRY (Plan phase only): `navSlots` (`customer.bottom-nav.<key>`)
 * overlays admin-managed label + icon on each plan tab; a slot marked hidden
 * drops its tab. href + activeMatch always stay in code.
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
import type { LifecyclePhase } from '@/lib/day-of-mode';
import { buildCustomerMenuTree } from '@/lib/customer-menu';

export function CustomerBottomNav({
  eventId,
  phase = 'plan',
  navSlots,
}: {
  eventId: string;
  phase?: LifecyclePhase;
  navSlots?: Record<string, NavSlotLite>;
}) {
  const tree = buildCustomerMenuTree(eventId, { phase, dayOfOpen: false });

  const items: BottomNavItem[] = tree.flatMap((m) => {
    if (phase === 'plan') {
      // Plan phase: apply nav-registry overrides (label + icon).
      const slot = navSlots?.[`customer.bottom-nav.${m.key}`];
      if (slot?.isHidden) return [];
      const label = slot?.label ?? m.label;
      const icon =
        slot
          ? navIconComponent(slot.icon)
          : m.key === 'home'
            ? (SetnayanMark as unknown as LucideIcon)
            : m.icon;
      return [{ key: m.key, label, icon, href: m.href, activeMatch: m.activeMatch, activeMatchExact: m.activeMatchExact }];
    }
    // Day-of / After: registry slots land in a follow-up; use code defaults.
    // Keep the Setnayan mark on the anchor tab (key 'now' or 'home').
    const icon =
      m.key === 'now' || m.key === 'home'
        ? (SetnayanMark as unknown as LucideIcon)
        : m.icon;
    return [{ key: m.key, label: m.label, icon, href: m.href, activeMatch: m.activeMatch, activeMatchExact: m.activeMatchExact }];
  });

  return <BottomNav items={items} />;
}

'use client';

/**
 * LabBar — the three REAL tab lists in the REAL dock, addresses moved under
 * `/dev/bar-lab` (see the page). Client-side because a tab carries its icon
 * component, which cannot cross from a server page.
 */
import { BottomDock, BottomNav } from '@/app/_components/nav/bottom-nav';
import type { BottomNavItem } from '@/app/_components/nav/types';
import { accountBarItems } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { vendorBarItems } from '@/app/vendor-dashboard/_components/vendor-bottom-nav';
import { accountBarTabs } from '@/lib/account-bar';
import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { navLineIcon } from '@/lib/nav-line-icon';

const P = '/dev/bar-lab';
export const LAB_EVENT = 'ev-lab';

/** A real tab, moved under the lab prefix (its address AND what lights it). */
function lab(i: BottomNavItem): BottomNavItem {
  const at = (h: string) => (h === '/' ? P : P + h);
  const m = i.activeMatch;
  return {
    ...i,
    href: at(i.href),
    activeMatch: Array.isArray(m) ? m.map(at) : at(m),
    ...(i.activeMatchAlsoExact ? { activeMatchAlsoExact: i.activeMatchAlsoExact.map(at) } : {}),
  };
}

export function LabBar({ kind, ownsShop = true }: { kind: 'account' | 'shop' | 'event'; ownsShop?: boolean }) {
  const items: BottomNavItem[] =
    kind === 'account'
      ? accountBarItems(accountBarTabs({ ownsShop, discoverOpen: true }))
      : kind === 'shop'
        ? vendorBarItems({ role: 'owner', navSlots: {}, bookingsBadge: 2, threadsBadge: 1 })
        : buildCustomerMenuTree(LAB_EVENT, { websiteEnabled: true, seatingEnabled: true }).map((m) => ({
            key: m.key,
            label: m.label,
            icon: navLineIcon(undefined, m.icon),
            href: m.href,
            activeMatch: m.activeMatch,
            activeMatchExact: m.activeMatchExact,
          }));
  return (
    <BottomDock boundary={kind === 'event' ? 'tab' : 'lg'}>
      <BottomNav items={items.map(lab)} />
    </BottomDock>
  );
}

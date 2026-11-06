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
import { buildCustomerMenuTree, type EventMenuChild } from '@/lib/customer-menu';
import { navLineIcon } from '@/lib/nav-line-icon';
import type { EventMenuGates } from '@/lib/event-menu-gates';
import type { MenuLifecyclePhase } from '@/lib/day-of-mode';

const P = '/dev/bar-lab';
/** The five under More on the web (plain data, as the layout hands them). */
const LAB_SERVICES: EventMenuChild[] = [
  { key: 'setnayan-ai', label: 'Setnayan AI', href: '#ai', icon: 'ai' },
  { key: 'papic', label: 'Papic', href: '#papic', icon: 'papic' },
  { key: 'live-studio', label: 'Live Watch', href: '#live', icon: 'live' },
  { key: 'music-maker', label: 'Music Maker', href: '#music', icon: 'pakanta' },
  { key: 'patiktok', label: 'Patiktok', href: '#patiktok', icon: 'patiktok' },
];
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

/** An event of a given type (`?type=&needs=&phase=&store=` on the page): the layout's own gates for it. */
export type LabEventBar = {
  gates: EventMenuGates;
  /** Empty — the layout drops no tab. Filled only by `&was=1`, which replays main's rule before 22 Oct 2026. */
  hideKeys: string[];
  phase: MenuLifecyclePhase;
  storeShell: boolean;
};

/** The REAL event tab list for a type's gates (`eventMenuGates`) — the event layout's own inputs. */
export function labEventBarItems(eventId: string, event?: LabEventBar): BottomNavItem[] {
  return buildCustomerMenuTree(eventId, {
    // Every gate the layout forwards (the-phone-forwards-every-gate.test.ts), at a plain web event's values
    // unless `event` names a type's own (`eventMenuGates`).
    phase: event?.phase ?? 'plan',
    hideKeys: event?.hideKeys ?? [],
    seatingEnabled: event?.gates.seatingEnabled ?? true,
    websiteEnabled: event?.gates.websiteEnabled ?? true,
    studioRows: [],
    storeShell: event?.storeShell ?? false,
    // The web's More holds the five (the layout's `services`); the app holds none.
    services: event?.storeShell ? [] : LAB_SERVICES,
  }).map((m) => ({
    key: m.key,
    label: m.label,
    icon: navLineIcon(undefined, m.icon),
    href: m.href,
    activeMatch: m.activeMatch,
    activeMatchExact: m.activeMatchExact,
    ...(m.activeMatchAlsoExact ? { activeMatchAlsoExact: m.activeMatchAlsoExact } : {}),
  }));
}

export function LabBar({
  kind,
  ownsShop = true,
  event,
}: {
  kind: 'account' | 'shop' | 'event';
  ownsShop?: boolean;
  event?: LabEventBar;
}) {
  const items: BottomNavItem[] =
    kind === 'account'
      ? accountBarItems(accountBarTabs({ ownsShop, discoverOpen: true }))
      : kind === 'shop'
        ? vendorBarItems({ role: 'owner', navSlots: {}, bookingsBadge: 2, threadsBadge: 1 })
        : labEventBarItems(LAB_EVENT, event);
  return (
    <BottomDock boundary={kind === 'event' ? 'tab' : 'lg'}>
      <BottomNav items={items.map(lab)} />
    </BottomDock>
  );
}

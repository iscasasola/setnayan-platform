'use client';

/**
 * AdminBottomNav — the admin's bottom bar: Work · Money · People · Catalogue · Insights.
 *
 * Owner, 13 Nov 2026: *"admin has been ok'ed"* — `Setnayan-specs/prototypes/admin_pub/` (DECISION_LOG 2026-11-13
 * "ADMIN DRAWING APPROVED — BUILD IT"; BUILDER-NOTES: "Five tabs, no More"). Admin-of-admin (Team, Admin log,
 * Secrets, Email delivery, Switches, Business) lives under the avatar, never as a tab.
 *
 * ⚖ THIS SUPERSEDES TWO EARLIER RULINGS, BY THE OWNER'S OWN LATER ONES — not by taste:
 *   · 2026-08-26 "on a phone the console answers, it does not edit" → reversed 2026-10-28 in the drawing's design
 *     review ("edit from the phone = yes", every edit through the confirm step), and approved with the drawing.
 *   · "More is the only route from a phone to sixty pages" → every page now has a tab › view, reached from the
 *     pinned row's `Page · View ▾` on every screen; `app/admin/admin-routes-all-have-a-tab.test.ts` proves no page
 *     is left without one. /admin/more still answers (it lights Work); it is just no longer a tab.
 *
 * WHICH TAB LIGHTS comes from `lib/admin/admin-tabs.ts` — query-aware and most-specific-wins
 * (`/admin/studio?tab=referrals` is Money, `/admin/studio` is Catalogue). The shared bar's own matcher is prefix-only,
 * so this bar resolves the one winner and hands the primitive an exact match for it alone. Avatar pages light no tab.
 *
 * ⚖ THE WORK BADGE IS HONEST (T28/T29): the sum of open work, red when anything is overdue, amber when due soon —
 * and when a count could not be read it shows "—", never a quiet nothing that reads as "all clear".
 *
 * Labels and icons stay renamable from /admin/menus through the nav registry (`admin.bottom-nav.<tab key>`); the
 * address and which pages light the tab stay in code.
 *
 * CLIENT BOUNDARY (REQUIRED): the items carry Lucide component refs, which cannot cross the Server→Client boundary.
 */

import { Banknote, Inbox, LayoutGrid, LineChart, Users, type LucideIcon } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { AdminQueueCounts } from '@/lib/admin/queue-counts';
import { ADMIN_TABS, activeAdminTabKey, type AdminTab } from '@/lib/admin/admin-tabs';
import { formatCount } from '@/lib/format-number';
import { usePathname } from 'next/navigation';
import { useAdminAddress } from './admin-tab-rows';

export const ADMIN_TAB_ICON: Record<AdminTab['icon'], LucideIcon> = {
  Inbox,
  Banknote,
  Users,
  LayoutGrid,
  LineChart,
};

/** The five tabs, in the approved order. Lit by `activeAdminTabKey`, never by a prefix list of their own. */
export const ADMIN_BOTTOM_NAV_ITEMS: BottomNavItem[] = ADMIN_TABS.map((t) => ({
  key: t.key,
  label: t.label,
  href: t.href,
  icon: ADMIN_TAB_ICON[t.icon],
  activeMatch: [],
  activeMatchExact: true,
}));

/** The Work tab's badge — the open work, honestly. `null` = nothing to show. */
export function workBadge(
  queueCounts: AdminQueueCounts | undefined,
  overdue: number,
  dueSoon: number,
  unreadable: number,
): BottomNavItem['badge'] | null {
  const total = queueCounts
    ? Object.values(queueCounts).reduce<number>((sum, c) => sum + (typeof c === 'number' && c > 0 ? c : 0), 0)
    : 0;
  if (total > 0) {
    return {
      count: total,
      tone: overdue > 0 ? 'red' : dueSoon > 0 ? 'amber' : 'neutral',
      label: overdue > 0 ? `${formatCount(total)} pending, ${overdue} overdue` : `${formatCount(total)} pending`,
    };
  }
  // Nothing counted, but something could not be counted: say so — a failed read is not a clear desk.
  if (!queueCounts || unreadable > 0) {
    return { count: 0, text: '—', tone: 'amber', label: 'Work counts unavailable — not the same as none' };
  }
  return null;
}

export function AdminBottomNav({
  navSlots,
  queueCounts,
  overdue = 0,
  dueSoon = 0,
  unreadable = 0,
  at,
}: {
  navSlots?: Record<string, NavSlotLite>;
  queueCounts?: AdminQueueCounts;
  /** Lab only — an address drawn on fixtures. */
  at?: string;
  /** Count of queues past SLA — turns the Work badge red. */
  overdue?: number;
  /** Count of queues approaching SLA — turns it amber. */
  dueSoon?: number;
  /** Count of queues whose count could not be read. */
  unreadable?: number;
}) {
  const { pathname, params } = useAdminAddress(at);
  const active = activeAdminTabKey(pathname, params);
  // The shared bar lights a tab by the URL it is actually on, so the winner is handed THAT address.
  const here = usePathname() ?? pathname;
  const badge = workBadge(queueCounts, overdue, dueSoon, unreadable);

  const items = ADMIN_BOTTOM_NAV_ITEMS.flatMap((item): BottomNavItem[] => {
    // Registry overlay: label + icon per tab from its admin.bottom-nav.<key> slot; a hidden slot drops the tab.
    const slot = navSlots?.[`admin.bottom-nav.${item.key}`];
    if (slot?.isHidden) return [];
    const named = slot ? { ...item, label: slot.label, icon: navIconComponent(slot.icon) } : item;
    return [
      {
        ...named,
        // The one winner lights by its exact current address; every other tab matches nothing.
        activeMatch: item.key === active ? [here] : [],
        ...(item.key === 'work' && badge ? { badge } : {}),
      },
    ];
  });

  return <BottomNav items={items} />;
}

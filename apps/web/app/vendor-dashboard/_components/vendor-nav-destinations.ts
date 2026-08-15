'use client';

/**
 * vendor-nav-destinations.ts — THE five, once.
 *
 * ─── 🔴 THIS FILE IS CLIENT-ONLY, AND THAT IS NOT A STYLE CHOICE ──────────
 * It calls `navIconComponent`, which lives in a `'use client'` module and
 * returns a React COMPONENT. Calling a client module's function from a server
 * component throws — and between 2026-08-14 and 2026-08-15 that is exactly
 * what happened: `layout.tsx` is a server component, it called
 * `resolveVendorDestinations`, the registry always serves a slot for
 * `vendor.sidebar.overview`, so the icon branch ran on EVERY request and every
 * one of a supplier's 63 screens answered with the "Something on our end
 * didn't work" page. Nothing was wrong with the menu; the resolution was
 * simply happening on the wrong side of the boundary.
 *
 * 🔑 THE TWO SIBLING RAILS ALREADY HAD THIS RIGHT. `admin-rail-context.tsx`
 * and `event-rail-context.tsx` are handed the SERIALIZABLE `navSlots` map and
 * resolve their own icons; only this one resolved on the server, and the sole
 * instance of a pattern is a tell. Whoever calls `resolveVendorDestinations`
 * must be a client component — `vendor-rail-context.tsx` is, and
 * `vendor-nav-boundary.test.ts` fails if a server one starts calling it again.
 *
 * One Shell slice 2 (2026-08-14). The shop's own menu now renders in the shared
 * front-door rail (`vendor-rail-context.tsx`) instead of the retiring
 * `<SidebarShell>` rail (`vendor-sidebar.tsx`). Both read this file, so the
 * conversion cannot quietly change what the menu IS.
 *
 * ─── WHY A THIRD FILE AND NOT A COPY ─────────────────────────────────────
 * `vendor-sidebar.tsx` already carried the five TWICE — once as
 * `VENDOR_NAV_GROUPS` and once as `VENDOR_SIDEBAR_TREE` — and the second
 * array's own comment is a promise that "the two stay in sync by covering the
 * same route set." A promise is not a mechanism. Adding a third hand-typed
 * copy for the rail is how the keys drift, and the keys are load-bearing in
 * four separate places at once (below).
 *
 * ─── THE KEYS ARE THE CONTRACT — DO NOT RENAME ONE ───────────────────────
 * `overview · shop · customers · performance · on-the-day` are read by:
 *   1. the role filter, which gates staff BY ITEM KEY
 *      (`VENDOR_SCOPED_NAV_ITEM_KEYS` — an agent sees overview + customers);
 *   2. the admin nav registry, whose slots are literally `vendor.sidebar.<key>`;
 *   3. the per-section localStorage open-state, `setnayan.nav.section.<key>`;
 *   4. the badge map, which lands both live counts on `customers`.
 * Rename one and all four fail — three of them silently.
 *
 * ─── THE FIVE ARE OWNER-LOCKED ───────────────────────────────────────────
 * Owner, 2026-07-12: *"overview, my shop, my customers, my performance, BEO
 * are all 1-page each with the different features integrated on that page."*
 * Every former sub-surface lives as a TAB inside its hub and the old routes
 * redirect in with their params preserved. Do NOT re-add children here —
 * extend the hub's own tab strip instead.
 */

import { Home, ShoppingBag, Users, Gauge, CalendarCheck } from 'lucide-react';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup, NavItem, NavBadge } from '@/app/_components/nav/types';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { filterVendorNavGroups } from '@/lib/vendor-role';
import { vendorCustomersBadge } from '@/lib/nav-badges';

/**
 * The five destinations, in the owner's own order.
 *
 * 🪤 `matchPrefix: '__overview-exact__'` IS NOT A TYPO AND IS NOT DEAD DATA.
 * The shipped matcher is `pathname === href || pathname.startsWith(prefix +
 * '/')`, and EVERY vendor route begins with `/vendor-dashboard/`. Left to
 * default, Overview's prefix branch matches all 63 screens and the row is
 * perpetually lit — a rail that says you are on the Overview while you read
 * your Customers. The sentinel is a string no pathname can ever start with, so
 * the prefix branch is dead and only the exact equality survives.
 * Same trick as the couple's Home and the admin Overview.
 */
export const VENDOR_DESTINATIONS: readonly NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: '/vendor-dashboard',
    icon: Home,
    matchPrefix: '__overview-exact__',
  },
  {
    key: 'shop',
    label: 'My Shop',
    href: '/vendor-dashboard/shop',
    icon: ShoppingBag,
    matchPrefix: '/vendor-dashboard/shop',
  },
  {
    key: 'customers',
    label: 'My Customers',
    href: '/vendor-dashboard/customers',
    icon: Users,
    matchPrefix: '/vendor-dashboard/customers',
  },
  {
    key: 'performance',
    label: 'My Performance',
    href: '/vendor-dashboard/performance',
    icon: Gauge,
    matchPrefix: '/vendor-dashboard/performance',
  },
  {
    key: 'on-the-day',
    label: 'On the Day (BEO)',
    href: '/vendor-dashboard/on-the-day',
    icon: CalendarCheck,
    matchPrefix: '/vendor-dashboard/on-the-day',
  },
] as const;

/** The five wrapped as the single labelled group the old sidebar rendered. */
export function vendorNavGroups(): NavGroup[] {
  return [{ key: 'shell-business', label: 'Menu', items: [...VENDOR_DESTINATIONS] }];
}

/**
 * The rows THIS person should see, named as THIS deployment names them, with
 * whatever real counts are waiting for them.
 *
 * Order is deliberate and matches the shipped sidebar exactly:
 *   role filter → registry labels → badges.
 * The registry runs before the badges so an admin-renamed row keeps its count;
 * running it after would overwrite the badge with the plain slot item.
 */
export function resolveVendorDestinations({
  role,
  navSlots,
  bookingsBadge = 0,
  threadsBadge = 0,
}: {
  role: VendorTeamRole | null;
  navSlots?: Record<string, NavSlotLite>;
  /** Pending-inquiry count. Real layout data; 0 omits the badge. */
  bookingsBadge?: number;
  /** Unread-thread count. Real layout data; 0 omits the badge. */
  threadsBadge?: number;
}): NavItem[] {
  /*
    STAFF SCOPING IS BY ITEM KEY, and it is NOT ownership. `/vendor-dashboard`
    admits the shop's owner OR anyone on its team, so a row gated on "do you
    own this shop" would vanish for staff who can legitimately open the page.
    `filterVendorNavGroups` gates on the key against the scoped-keys set, which
    is the same rule the phone's bottom bar uses.
  */
  const scoped = filterVendorNavGroups(vendorNavGroups(), role);
  const items = scoped[0]?.items ?? [];

  /*
    THE ADMIN'S RENAME, OR THE WORD IN THE CODE. The phone bar already reads
    these slots; if the rail hard-coded its own words a rename would apply on
    the phone and not on the laptop — two answers to one question, with no
    error to notice. A hidden slot drops the row, matching the shipped
    overlay; an absent registry is a no-op, so a failed read fails OPEN to the
    in-code words rather than to a blank menu.
  */
  const named = navSlots
    ? items.flatMap((item) => {
        const slot = navSlots[`vendor.sidebar.${item.key}`];
        if (!slot) return [item];
        if (slot.isHidden) return [];
        return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
      })
    : items;

  /*
    Both live counts land on My Customers — the hub that holds the booking
    pipeline AND the message threads under the 5-page IA. Built by the SHARED
    helper the phone bar calls, so the laptop and the phone can never disagree
    about the number. A zero or a failed read omits the badge; it is never
    fabricated and never shown as 0.
  */
  const badges: Record<string, NavBadge | undefined> = {
    customers: vendorCustomersBadge(bookingsBadge, threadsBadge),
  };
  return named.map((item) => {
    const badge = badges[item.key];
    return badge && badge.count > 0 ? { ...item, badge } : item;
  });
}

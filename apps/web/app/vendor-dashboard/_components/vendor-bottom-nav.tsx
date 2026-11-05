'use client';

/**
 * VendorBottomNav — the supplier's phone bar: **Today · Customers · Shop · Hub**.
 *
 * ── RE-CUT 2026-10-21 (owner, verbatim: "Yes to all") ──────────────────────
 * To the supplier-dashboard audit (`shots-2026-10-21/supplier-dash-audit/
 * AUDIT.md`), whose question was the owner's own: the event is now Home ·
 * Guests · Suppliers · Hub (#6725) — can the supplier's be as simple? It can:
 * every row the old fourth tab, More, held already had a home —
 *   · Messages      → the envelope in the top bar (the SAME URL the row linked);
 *   · How it is going → Shop's third segment (it lights Shop);
 *   · Settings + More tools → under the profile picture (the avatar sheet);
 * so the fourth slot is the room More was hiding: the **Event Hub** ("Run the
 * day" + the scanner), under the couple's word for it, **Hub**. On a day with no
 * event the Hub lists the next booked events, each locked until its booking fee
 * is paid. This SUPERSEDES DECISION_LOG 2026-10-01 answer 1 (the bar ends in
 * More) and 2026-10-08 answer 1 (More = Event Hub · Settings · More tools).
 * `/vendor-dashboard/more` is a redirect stub to Settings, so a bookmark lands.
 *
 * 🧑‍🔧 A HELPER (agent / viewer) gets Today · Customers, plus the Hub on a day
 * this shop has an event — the scanner is what a crew helper needs at the venue
 * (owner, item 6). It adds the door, not access: `lib/vendor-role.ts`.
 *
 * The SAME four on every phone surface — the web below 1024 px and the iPhone
 * app (the store shell): nothing on the bar is a web-only route, so
 * `barItemsForShell` drops nothing. The laptop rail draws the same four words
 * (`vendor-nav-destinations.ts`). `vendor-bar-is-four.test.ts` holds all of it.
 *
 * ⚠ THE OLD DOCBLOCK HERE DESCRIBED A FIVE-TAB BAR (Home · Bookings · Calendar ·
 * Messages · More, 2026-06) and said "there is no More tab" next to code that
 * had one — a stale comment read as fact (audit item 9). It is gone; this one
 * describes the code below it.
 *
 * activeMatch: Today is EXACT (every supplier route shares its prefix); each
 * other tab claims its own routes and the rooms filed under it. The BottomNav
 * primitive hides itself at lg+.
 *
 * CLIENT BOUNDARY: 'use client' because the items carry LucideIcon refs, which
 * do not serialize from a server component (same as admin-bottom-nav.tsx).
 */

import { CalendarCheck, ShoppingBag, Store, Users } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { canManageVendor, vendorScopedBarKeys } from '@/lib/vendor-role';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { vendorCustomersBadge } from '@/lib/nav-badges';
import { VENDOR_SHOP_EXTRA_MATCH } from './vendor-nav-destinations';

export const VENDOR_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    // Today — the at-a-glance landing. Labelled "Today" since the 2026-08-26
    // re-cut (owner: "yes i agree"): it is the room a shop owner opens in the
    // morning, and "Overview" named the layout rather than the job. My
    // Customers sits ahead of My Shop for the same reason — people are the
    // daily job, setting up a shop is a once.
    // `key: 'profile'` preserved so any
    // per-tab localStorage state from existing users doesn't reset on the
    // 2026-07-01 6-tab reroster. Exact-match override — every other vendor
    // route also begins with `/vendor-dashboard/`, so a default startsWith
    // match would keep this tab active on every page.
    key: 'profile',
    label: 'Today',
    href: '/vendor-dashboard',
    // 🏪 The storefront, not a house (owner 2026-10-24: "Shop icon not home
    // icon on Shop's Dashboard Today"). The bar draws the REGISTRY's icon over
    // this one — slot `vendor.bottom-nav.home` says `Store` too; change both.
    icon: Store,
    activeMatch: '/vendor-dashboard',
    activeMatchExact: true,
  },
  {
    // My Customers — the booking-pipeline destination + its cluster (messages ·
    // clients · bookings · calendar · contracts · proposals · earnings · payday
    // · payment-options).
    key: 'customers',
    label: 'Customers',
    href: '/vendor-dashboard/customers',
    icon: Users,
    activeMatch: [
      '/vendor-dashboard/customers',
      '/vendor-dashboard/messages',
      '/vendor-dashboard/clients',
      '/vendor-dashboard/bookings',
      '/vendor-dashboard/calendar',
      '/vendor-dashboard/contracts',
      '/vendor-dashboard/proposals',
      '/vendor-dashboard/earnings',
      '/vendor-dashboard/payday',
      '/vendor-dashboard/payment-options',
    ],
  },
  {
    // My Shop — the storefront destination + its whole cluster. The sub-routes
    // (verify · reviews · the More-tools rooms · …) light this tab so a
    // bookmarked deep-link never goes "unlit".
    key: 'shop',
    label: 'Shop',
    href: '/vendor-dashboard/shop',
    icon: ShoppingBag,
    activeMatch: [
      '/vendor-dashboard/shop',
      '/vendor-dashboard/verify',
      '/vendor-dashboard/reviews',
      '/vendor-dashboard/theft-watch',
      '/vendor-dashboard/real-stories',
      '/vendor-dashboard/recaps',
      '/vendor-dashboard/recommendations',
      '/vendor-dashboard/partnerships',
      '/vendor-dashboard/team',
      '/vendor-dashboard/branches',
      '/vendor-dashboard/subscription',
      // ⚠ NOT /settings · /notifications · /help (2026-10-21): the account's
      // rooms, opened from the profile picture, light no tab. `/more` is a
      // redirect stub to Settings.
      // My Services was folded into My Shop (2026-07-02) — the retired services
      // routes light this tab so bookmarks/deep-links never go unlit.
      '/vendor-dashboard/services',
      '/vendor-dashboard/attributes',
      '/vendor-dashboard/repertoire',
      // Sibling of repertoire; was missing here too, so the tab went unlit while
      // a host sat on his own segments page.
      '/vendor-dashboard/activities',
      '/vendor-dashboard/manpower',
      '/vendor-dashboard/moodboard-library',
      // Shop's segments outside /shop — Page (Your page · details · collections)
      // and How it is going (2026-10-21). The one list the rail reads too.
      ...VENDOR_SHOP_EXTRA_MATCH,
    ],
  },
  {
    // 🗓 HUB — the Event Hub (owner "Yes to all", 2026-10-21). Key `onday` is
    // the old Event Hub tab's, so its registry slot (`vendor.bottom-nav.onday`)
    // names this tab again and an admin rename reaches it.
    key: 'onday',
    label: 'Hub',
    href: '/vendor-dashboard/on-the-day',
    icon: CalendarCheck,
    // 🗂 "Events" FOLDED INTO HUB (owner 2026-10-29): the old fifth tab's address forwards here and lights it.
    activeMatch: ['/vendor-dashboard/on-the-day', '/vendor-dashboard/events'],
  },
];

/**
 * The tabs THIS person gets, named as THIS deployment names them, with the live
 * count — pure, so the lab and the guards ask the same function the bar does.
 * Order: role filter → registry labels → badge (a renamed tab keeps its count).
 */
export function vendorBarItems({
  role,
  navSlots,
  bookingsBadge,
  threadsBadge,
  eventToday = false,
  runsEvents = false,
}: {
  role: VendorTeamRole | null;
  navSlots?: Record<string, NavSlotLite>;
  bookingsBadge?: number | null;
  threadsBadge?: number | null;
  /** One of this shop's days is today — a helper gets the Hub then (owner 2026-10-21, item 6). */
  eventToday?: boolean;
  /**
   * This person coordinates at least one event, live. "Events" FOLDED INTO HUB (owner 2026-10-29): no fifth tab — a
   * scoped teammate who runs an event gets the Hub, where "Events you run" now lives. Their own seat; a door, not access.
   */
  runsEvents?: boolean;
}): BottomNavItem[] {
  // Role-aware: owner/admin get the four; agent/viewer get Today · Customers,
  // plus the Hub on an event day. FAILS CLOSED — a role that could not be read
  // is not an owner.
  const scoped = vendorScopedBarKeys({ eventToday: eventToday || runsEvents === true });
  const base = canManageVendor(role)
    ? VENDOR_BOTTOM_NAV_ITEMS
    : VENDOR_BOTTOM_NAV_ITEMS.filter((i) => scoped.has(i.key));
  // Nav registry overlay: label + icon per tab from its vendor.bottom-nav.<key>
  // slot (Today keeps key 'profile' for localStorage continuity but maps to the
  // 'home' slot). Fallback = the word in the code; a hidden slot drops the tab;
  // href/activeMatch stay in code. No-op when navSlots is absent.
  const labelled = navSlots
    ? base.flatMap((item) => {
        const slot = navSlots[`vendor.bottom-nav.${item.key === 'profile' ? 'home' : item.key}`];
        if (!slot) return [item];
        if (slot.isHidden) return [];
        return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
      })
    : base;
  // Live badge, AFTER the overlay so a relabelled tab keeps its count. Same
  // helper as the laptop rail — one rule for what the number means.
  const customersBadge = vendorCustomersBadge(bookingsBadge, threadsBadge);
  return customersBadge
    ? labelled.map((item) => (item.key === 'customers' ? { ...item, badge: customersBadge } : item))
    : labelled;
}

/** The supplier's phone bar. Renders nothing on lg+ (the rail takes over). */
export function VendorBottomNav({
  role,
  navSlots,
  bookingsBadge,
  threadsBadge,
  eventToday = false,
  runsEvents = false,
}: {
  role: VendorTeamRole | null;
  navSlots?: Record<string, NavSlotLite>;
  /**
   * Inquiries still awaiting Accept/Decline, and unread chat threads. Both are
   * already fetched in layout.tsx for the rail; passed here so the phone shows
   * the SAME badge. Fail-soft to 0 upstream, so 0 means "none or could not
   * tell" and the shared helper renders nothing — never a dot claiming zero.
   */
  bookingsBadge?: number | null;
  threadsBadge?: number | null;
  /** One of this shop's days is today (the layout reads it for a helper only). */
  eventToday?: boolean;
  /** At least one LIVE coordinator seat (`readEventsYouRun`) — the Events tab shows only then. */
  runsEvents?: boolean;
}) {
  return <BottomNav items={vendorBarItems({ role, navSlots, bookingsBadge, threadsBadge, eventToday, runsEvents })} />;
}

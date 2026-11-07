'use client';

/**
 * VendorBottomNav — the supplier's phone bar: **Today · Clients · Shop · Portfolio**.
 *
 * ── THE ONE BUILD, 8 Nov 2026 (owner, BARS LOCKED 7 Nov: *"remove hub"*; v110 THE ONE BUILD items 1–2) ──────────────
 * The bar is Today · Clients · Shop · Portfolio. The tab word "Customers" became **Clients** (the KEY stays `customers`:
 * the registry slot, the badge and every guard hold on to it; the URL `/vendor-dashboard/customers` is kept). The Hub
 * LEFT the bar: the Event Hub room (`/vendor-dashboard/on-the-day`) is kept and reached from a picked client's Hub page,
 * Today's next-event card and "Events you run" — and while it is open it lights **Clients**, where it now lives.
 * **Portfolio** is the new fourth tab: Your collections (`/vendor-dashboard/collections`) and the inspiration library,
 * which used to light Shop. SUPERSEDES the 2026-10-21 re-cut (Today · Customers · Shop · Hub).
 *
 * 🧑‍🔧 A HELPER (agent / viewer) gets Today · Clients on EVERY day (the Hub tab on an event day is gone with the tab; a
 * helper's door to the scanner is Today's next-event card and their client's Hub page, both scoped by the per-event
 * grant). Shop and Portfolio stay owner/admin only. `lib/vendor-role.ts`.
 *
 * The SAME four on every phone surface — the web below 1024 px and the iPhone app (the store shell): nothing on the
 * bar is a web-only route. The laptop rail draws the same four words (`vendor-nav-destinations.ts`).
 * 🔒 supplier-bar-is-today-clients-shop-portfolio.test.ts · vendor-bar-is-four.test.ts
 *
 * activeMatch: Today is EXACT (every supplier route shares its prefix); each other tab claims its own routes and the
 * rooms filed under it. The BottomNav primitive hides itself at lg+.
 *
 * CLIENT BOUNDARY: 'use client' because the items carry LucideIcon refs, which do not serialize from a server
 * component (same as admin-bottom-nav.tsx).
 */

import { Images, ShoppingBag, Store, Users } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { canManageVendor, VENDOR_SCOPED_BOTTOM_NAV_KEYS } from '@/lib/vendor-role';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { vendorCustomersBadge } from '@/lib/nav-badges';
import { VENDOR_CLIENTS_EXTRA_MATCH, VENDOR_PORTFOLIO_EXTRA_MATCH, VENDOR_SHOP_EXTRA_MATCH } from './vendor-nav-destinations';

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
    // Clients (was "Customers" — THE ONE BUILD, 8 Nov 2026; the key stays) — the booking-pipeline destination + its
    // cluster (messages · clients · bookings · calendar · contracts · proposals · earnings · payday · payment-options),
    // and the Event Hub room, which now lives under a picked client (Hub left the bar, owner 7 Nov "remove hub").
    key: 'customers',
    label: 'Clients',
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
      // The Event Hub room (+ the old Events address that forwards to it) — it lives under a picked client now.
      ...VENDOR_CLIENTS_EXTRA_MATCH,
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
      '/vendor-dashboard/theft-watch',
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
      // Shop's segments outside /shop — Page (Your page · details · collections)
      // and How it is going (2026-10-21). The one list the rail reads too.
      ...VENDOR_SHOP_EXTRA_MATCH,
    ],
  },
  {
    // 🖼 PORTFOLIO (THE ONE BUILD, 8 Nov 2026 — owner "Today · Clients · Shop · Portfolio"): every photo and video the
    // shop shows — Your collections, and the inspiration library it draws from. Owner/admin only, like Shop.
    key: 'portfolio',
    label: 'Portfolio',
    href: '/vendor-dashboard/collections',
    icon: Images,
    activeMatch: ['/vendor-dashboard/collections', ...VENDOR_PORTFOLIO_EXTRA_MATCH],
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
}: {
  role: VendorTeamRole | null;
  navSlots?: Record<string, NavSlotLite>;
  bookingsBadge?: number | null;
  threadsBadge?: number | null;
}): BottomNavItem[] {
  // Role-aware: owner/admin get the four; agent/viewer get Today · Clients, every day. FAILS CLOSED — a role that
  // could not be read is not an owner.
  const base = canManageVendor(role)
    ? VENDOR_BOTTOM_NAV_ITEMS
    : VENDOR_BOTTOM_NAV_ITEMS.filter((i) => VENDOR_SCOPED_BOTTOM_NAV_KEYS.has(i.key));
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
}) {
  return <BottomNav items={vendorBarItems({ role, navSlots, bookingsBadge, threadsBadge })} />;
}

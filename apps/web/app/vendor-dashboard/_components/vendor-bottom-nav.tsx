'use client';

/**
 * VendorBottomNav — v2.1 Navigation Phase 2 (vendor mobile).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit. The vendor doorway's surfaces
 * compress into 5 mobile-overflow buckets because forcing all the
 * desktop groups into a bottom strip would yield unusably-narrow
 * tap targets at common PH mobile widths (360-414px) — the exact same
 * geometry constraint the admin doorway (PR #606) ran into and solved
 * with the 5-tab + /more landing pattern. Customer doorway (PR #625)
 * mirrored it.
 *
 * The desktop sidebar (vendor-sidebar.tsx) exposes the 6-menu IA (reorg
 * 2026-07-01): Overview · My Shop · My Customers · My Performance · My
 * Services · On the Day (6th landed Phase 7, 2026-07-01). The bottom strip is
 * route-based —
 * unaffected by the sidebar regroup — and flattens into 5 tabs
 * (2026-06-21 <=5 reroster — Website demoted to More):
 *   1. Home (key 'profile') — /vendor-dashboard (exact-match · Overview)
 *   2. Bookings    — Booking pipeline (per-booking workspace · soft-hold
 *                    + downpaid status · cancel + release CTAs)
 *   3. Calendar    — Schedule-pool surface (2026-06-14 nav-tune · promoted
 *                    over Earnings; the calendar that stops double-bookings
 *                    is the vendor pitch and shouldn't be buried in /more)
 *   4. Messages    — Chat inbox (per-thread workspace)
 *   5. More        — Everything else (Website · Profile · Clients · Services ·
 *                    Contracts · Proposals · Attributes · Repertoire ·
 *                    Subscription · Tokens · Marketing ·
 *                    Verify · Reviews · Moodboard library · On the Day ·
 *                    Earnings · Payment options · Manpower · Branches · Team ·
 *                    Notifications) routed through the
 *                    /vendor-dashboard/more landing.
 *
 * The 5-tab set retires the legacy 14-tab horizontal pill from the
 * pre-Phase 2 layout. Notifications doesn't get a tab — it stays
 * accessible via the topbar UnreadBellBadge per the admin pattern
 * (single source of truth for unread + live count via Realtime).
 * (Tax docs retired 2026-05-29 under the V2 publisher posture — no More
 * entry · the page redirects to /vendor-dashboard.)
 *
 * activeMatch RULES per tab:
 *   - Home      — /vendor-dashboard EXACT (activeMatchExact:true)
 *                 because every other vendor route shares this prefix —
 *                 startsWith would keep Home perpetually active.
 *   - Bookings  — /vendor-dashboard/bookings + per-booking workspace
 *   - Calendar  — /vendor-dashboard/calendar
 *   - Messages  — /vendor-dashboard/messages + per-thread workspace
 *   - More      — /vendor-dashboard/more landing OR any surface that
 *                 isn't surfaced as a dedicated tab (enumerated
 *                 exhaustively below so no vendor route goes unlit).
 *
 * BottomNav primitive (PR #603 + Phase 3 activeMatchExact extension)
 * auto-hides at lg breakpoint via lg:hidden, so this only renders on
 * mobile + tablet. Desktop uses the SidebarShell + VendorSidebar
 * instead.
 *
 * CLIENT BOUNDARY: 'use client' required because the BottomNavItem[]
 * array carries LucideIcon refs (forwardRef objects with $$typeof +
 * render properties). Per the admin-bottom-nav.tsx docstring (PR #606)
 * passing this array from a Server Component to a Client Component
 * trips Next.js serialization. Symmetric pattern.
 */

import { useState } from 'react';
import { Home, ShoppingBag, Users, MoreHorizontal } from 'lucide-react';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { BottomNavItem } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { canManageVendor, VENDOR_SCOPED_BOTTOM_NAV_KEYS } from '@/lib/vendor-role';
import type { NavSlotLite } from '@/lib/nav-registry-types';
import { vendorCustomersBadge } from '@/lib/nav-badges';
import { VENDOR_MORE_MATCH, vendorMoreRows } from '@/lib/vendor-more-rows';

/* The More sheet is the HOST's shipped one (#6205, `more-services-sheet.tsx`).
   ⚠ IMPORTED STATICALLY, ON PURPOSE — measured 2026-10-01. A lazy `import()`
   here made webpack split the sheet into a SECOND async chunk for this bar, and
   every async chunk adds an entry to the shared runtime's chunk map: +20 B gz
   on a shared bundle with ~20 B of headroom (`scripts/check-bundle-size.mjs`).
   Static, it rides the supplier layout's own chunk — supplier routes only, no
   shared bytes. (The host's bar keeps its lazy import: its routes carry the
   Maker's first-load ceiling; these do not.) */
import MoreServicesSheet from '@/app/dashboard/[eventId]/_components/more-services-sheet';

const VENDOR_BOTTOM_NAV_ITEMS: BottomNavItem[] = [
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
    icon: Home,
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
    // (profile · verify · website · reviews · …) light this tab so a
    // bookmarked deep-link never goes "unlit" now that there is no More tab.
    // The /more overflow itself also lights here (reachable via the topbar
    // overflow link) so no route orphans.
    key: 'shop',
    label: 'Shop',
    href: '/vendor-dashboard/shop',
    icon: ShoppingBag,
    activeMatch: [
      '/vendor-dashboard/shop',
      '/vendor-dashboard/profile',
      '/vendor-dashboard/verify',
      '/vendor-dashboard/website',
      '/vendor-dashboard/reviews',
      '/vendor-dashboard/theft-watch',
      '/vendor-dashboard/real-stories',
      '/vendor-dashboard/recaps',
      '/vendor-dashboard/recommendations',
      '/vendor-dashboard/partnerships',
      '/vendor-dashboard/team',
      '/vendor-dashboard/branches',
      '/vendor-dashboard/subscription',
      // ⚠ `/more` and `/notifications` moved to the More tab (2026-10-01, the
      // supplier phone app): there IS a More tab again, and they are its rows.
      // Tax docs RETIRED 2026-05-29 (page redirects to /vendor-dashboard) —
      // kept for bookmark continuity so a stale hit still lights a tab.
      '/vendor-dashboard/tax-documents',
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
    ],
  },
  {
    // 📱 MORE — owner-APPROVED 2026-10-01 (DECISION_LOG "THE SUPPLIER PHONE APP
    // — APPROVED, WITH THE THREE RECOMMENDED ANSWERS", answer 1): the bar is
    // Today · Customers · Shop · More, and Insights + Event Hub + Messages live
    // in More. The tab OPENS A SHEET (below); its href is the /more page, so the
    // tab still goes somewhere before the sheet has loaded and on a laptop.
    //
    // ⚠ Insights (key 'performance') and Event Hub (key 'onday') LEFT THE BAR.
    // Their registry slots (`vendor.bottom-nav.performance` · `.onday`) still
    // name their rows inside More (`lib/vendor-more-rows.ts`), so an admin
    // rename still reaches them.
    key: 'more',
    label: 'More',
    href: '/vendor-dashboard/more',
    icon: MoreHorizontal,
    activeMatch: [...VENDOR_MORE_MATCH],
  },
];

/**
 * VendorBottomNav — wraps the shared BottomNav primitive with the
 * vendor-doorway 5-tab config. Renders nothing on lg+ (sidebar takes
 * over). Per [[feedback_setnayan_orphan_prevention]] each tab's destination
 * route is verified to exist on the codebase.
 */
export function VendorBottomNav({
  role,
  navSlots,
  bookingsBadge,
  threadsBadge,
  storeShell = false,
}: {
  role: VendorTeamRole | null;
  navSlots?: Record<string, NavSlotLite>;
  /**
   * Inquiries still awaiting Accept/Decline, and unread chat threads. Both are
   * already fetched in layout.tsx for the desktop sidebar; they are passed here
   * so the phone shows the SAME badge rather than a second, separately-derived
   * one. Fail-soft to 0 upstream, so 0 means "none or could not tell" and the
   * shared helper renders nothing — never a dot claiming zero.
   */
  bookingsBadge?: number | null;
  threadsBadge?: number | null;
  /** The App Store / Play Store shell — drops the web-only Plan row from More. */
  storeShell?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  // Role-aware tabs — owner/admin get the full strip; agent/viewer get the
  // scoped subset. ⚠ This comment said "Phase 1: Home + More" until 2026-09-22
  // while the SAME FILE says twice, above, that there is no More tab any more —
  // a stale comment read as a measurement is how this repo has been burned
  // before. Staff get Overview + My Customers; Phase 2 expands agent tabs once
  // per-service data scoping lands.
  // Role-aware tabs — owner/admin get the full strip; agent/viewer get the
  // scoped subset. "My Services" was retired 2026-07-02 (folded into
  // owner/admin-only My Shop); its routes now light the Shop tab (see that tab's
  // activeMatch).
  const base = canManageVendor(role)
    ? VENDOR_BOTTOM_NAV_ITEMS
    : VENDOR_BOTTOM_NAV_ITEMS.filter((i) => VENDOR_SCOPED_BOTTOM_NAV_KEYS.has(i.key));
  // Nav registry overlay: label + icon per tab from its vendor.bottom-nav.<key>
  // slot (the Home tab keeps key 'profile' for localStorage continuity but maps
  // to the 'home' slot). Fallback = the hardcoded default; hidden slot drops the
  // tab; href/activeMatch stay in code. No-op when navSlots is absent.
  const labelled = navSlots
    ? base.flatMap((item) => {
        const slot = navSlots[`vendor.bottom-nav.${item.key === 'profile' ? 'home' : item.key}`];
        if (!slot) return [item];
        if (slot.isHidden) return [];
        return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
      })
    : base;

  // Live badge, applied AFTER the registry overlay so an admin relabelling a tab
  // cannot drop its count. Same helper as the desktop sidebar — one rule for
  // what the number means, in one place.
  const customersBadge = vendorCustomersBadge(bookingsBadge, threadsBadge);
  const badged = customersBadge
    ? labelled.map((item) =>
        item.key === 'customers' ? { ...item, badge: customersBadge } : item,
      )
    : labelled;

  // More opens the sheet; the rows are the ONE list the /more page also draws.
  const moreRows = vendorMoreRows({ storeShell, navSlots });
  const items = badged.map((item) =>
    item.key === 'more'
      ? {
          ...item,
          onSelect: () => setMoreOpen(true),
        }
      : item,
  );

  return (
    <>
      <BottomNav items={items} />
      {/* Mounted only while open. */}
      {moreOpen ? (
        <MoreServicesSheet open onClose={() => setMoreOpen(false)} title="More" services={moreRows} />
      ) : null}
    </>
  );
}

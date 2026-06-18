'use client';

/**
 * VendorSidebar — v2.1 Navigation Phase 2 (vendor doorway).
 *
 * WHY: CLAUDE.md tenth 2026-05-28 row v2.1 brief canonical lock + 14th
 * 2026-05-28 row System Wiring Map audit (62 surfaces · 17 of them
 * vendor-side) + 2026-05-23 row 2 admin nav pattern that PR #606
 * established as the reference for the 3-doorway sidebar treatment. Nav
 * Phase 3 (admin · PR #606) + Nav Phase 1 (customer · PR #625) shipped
 * the pattern; this file mirrors it for the vendor doorway.
 *
 * Pre-Phase 2 the vendor chrome rendered a 14-tab horizontal pill bar
 * at apps/web/app/vendor-dashboard/layout.tsx 119-233 with
 * `overflow-x-auto` (every tab via apps/web/app/vendor-dashboard/
 * _components/subnav-tab.tsx). That worked on desktop only after the
 * vendor scrolled horizontally; on mobile the pill bar wrapped onto
 * itself or hid the trailing entries behind a scroll. The audit found
 * the strip provided no per-route grouping (Bookings + Contracts +
 * Services + Attributes all read as siblings of Tax docs + Notifications
 * even though they sit in different cognitive buckets).
 *
 * This file owns the NavGroup[] array consumed by SidebarShell +
 * SidebarSection + SidebarItem from @/app/_components/nav/*. It is the
 * single source of truth for vendor nav structure on desktop. The
 * 6-tab mobile BottomNav lives in vendor-bottom-nav.tsx alongside this
 * file.
 *
 * 6 GROUPS (reclustered 2026-06-18 from the 4-group layout). Mirrors the
 * admin console 6-group pattern (PR #1712). Group and item keys are NEW
 * (localStorage open-state intentionally reset on the recluster):
 *
 *   1. Home (key 'home')          — Overview (root · exact-match) ·
 *                       Profile · Website (public-page preview)
 *
 *   2. Operations (key 'operations') — Bookings · Calendar · Clients ·
 *                       Messages · Contracts · Proposals
 *                       (all live-event run-the-business surfaces)
 *
 *   3. Offerings (key 'offerings')  — Services · Packages · Attributes ·
 *                       Repertoire
 *                       (what the vendor sells + describes)
 *
 *   4. Grow (key 'grow')           — Subscription · Tokens · Redeem code ·
 *                       Marketing · Verify · Partnerships · Reviews
 *                       (everything that buys the vendor more reach +
 *                       trust + visibility)
 *
 *   5. Content (key 'content')     — Real Stories · Recaps ·
 *                       Moodboard library
 *                       (portfolio + editorial content)
 *
 *   6. Business (key 'business')   — Earnings · How clients pay you ·
 *                       Manpower · Branches · Team & Setnayan
 *                       (pure money + org/ops · Tax docs retired
 *                       2026-05-29 under V2 publisher posture)
 *
 * OMITTED PER ORPHAN-PREVENTION RULE — routes the brief enumerated but
 * which DON'T EXIST on disk get dropped per
 * [[feedback_setnayan_orphan_prevention]]: Bids (/vendor-dashboard/bids
 * never landed · v2.1 lead-broker side-branch RETIRED).
 *
 * NOTIFICATIONS — surfaced via topbar UnreadBellBadge per the admin
 * pattern (PR #606). Not duplicated in the sidebar — the topbar bell
 * is the canonical entry point for /vendor-dashboard/notifications.
 *
 * ACTIVE STATE — defers to <SidebarItem>'s default
 * (`pathname === href || pathname.startsWith(matchPrefix + '/')`) for
 * most items. One exception needs exact-match: Overview
 * (`/vendor-dashboard`) — every other vendor route also starts with
 * `/vendor-dashboard/`, so a startsWith match would keep Overview
 * perpetually active. Sentinel matchPrefix `__overview-exact__` so the
 * strict-prefix branch never fires and only `pathname === href` lights
 * the entry. Same pattern as customer Home + admin Overview.
 */

import {
  Home,
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileSignature,
  FileText,
  HardHat,
  Megaphone,
  MessageSquare,
  Music,
  Package as PackageIcon,
  Palette,
  Globe,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  User,
  Users,
  Wallet,
  Coins,
  Crown,
  Building2,
  Images,
  Handshake,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { filterVendorNavGroups } from '@/lib/vendor-role';
import type { NavSlotLite } from '@/lib/nav-registry-types';

/**
 * Canonical vendor NavGroup[] export — 6 semantic topic groups that map
 * 1-to-1 to the 6 conceptual areas of a vendor's Setnayan account. Mobile
 * bottom nav uses a fixed 6-tab strip (vendor-bottom-nav.tsx); the More
 * landing at /vendor-dashboard/more consumes this array via shape
 * introspection for its grouped link grid.
 *
 * Stable item `key` values mean future label edits don't reset the per-
 * section `setnayan.nav.section.<key>.open` localStorage state.
 */
export const VENDOR_NAV_GROUPS: NavGroup[] = [
  {
    key: 'home',
    label: 'Home',
    items: [
      {
        // Sentinel matchPrefix so the strict-prefix branch never fires;
        // every other vendor route begins with `/vendor-dashboard/`, so a
        // default startsWith match would keep Overview perpetually active.
        key: 'overview',
        label: 'Overview',
        href: '/vendor-dashboard',
        icon: Home,
        matchPrefix: '__overview-exact__',
      },
      {
        key: 'profile',
        label: 'Profile',
        href: '/vendor-dashboard/profile',
        icon: User,
        matchPrefix: '/vendor-dashboard/profile',
      },
      {
        // Live preview of the vendor's public page (/v/[slug]) —
        // "what couples see" — with Edit + Open-live entry points.
        key: 'website',
        label: 'Website',
        href: '/vendor-dashboard/website',
        icon: Globe,
        matchPrefix: '/vendor-dashboard/website',
      },
    ],
  },
  {
    // Operations — live-event run-the-business surfaces.
    key: 'operations',
    label: 'Operations',
    items: [
      { key: 'bookings', label: 'Bookings', href: '/vendor-dashboard/bookings', icon: Briefcase, matchPrefix: '/vendor-dashboard/bookings' },
      { key: 'calendar', label: 'Calendar', href: '/vendor-dashboard/calendar', icon: CalendarDays, matchPrefix: '/vendor-dashboard/calendar' },
      { key: 'clients', label: 'Clients', href: '/vendor-dashboard/clients', icon: Users, matchPrefix: '/vendor-dashboard/clients' },
      { key: 'messages', label: 'Messages', href: '/vendor-dashboard/messages', icon: MessageSquare, matchPrefix: '/vendor-dashboard/messages' },
      { key: 'contracts', label: 'Contracts', href: '/vendor-dashboard/contracts', icon: FileSignature, matchPrefix: '/vendor-dashboard/contracts' },
      { key: 'proposals', label: 'Proposals', href: '/vendor-dashboard/proposals', icon: FileText, matchPrefix: '/vendor-dashboard/proposals' },
    ],
  },
  {
    // Offerings — what the vendor sells and how they describe themselves.
    key: 'offerings',
    label: 'Offerings',
    items: [
      { key: 'services', label: 'Services', href: '/vendor-dashboard/services', icon: ClipboardList, matchPrefix: '/vendor-dashboard/services' },
      { key: 'packages', label: 'Packages', href: '/vendor-dashboard/packages', icon: PackageIcon, matchPrefix: '/vendor-dashboard/packages' },
      { key: 'attributes', label: 'Attributes', href: '/vendor-dashboard/attributes', icon: Tag, matchPrefix: '/vendor-dashboard/attributes' },
      // Repertoire is a music-act surface (band · singer · orchestra · choir
      // · DJ) — hidden for every other category (owner directive 2026-06-13;
      // the page keeps its own isMusicVendor gate). Filtered via showRepertoire
      // prop in VendorSidebar below.
      { key: 'repertoire', label: 'Repertoire', href: '/vendor-dashboard/repertoire', icon: Music, matchPrefix: '/vendor-dashboard/repertoire' },
    ],
  },
  {
    // Grow — everything that buys the vendor more reach, trust, and
    // visibility on the Setnayan platform.
    key: 'grow',
    label: 'Grow',
    items: [
      { key: 'subscription', label: 'Subscription', href: '/vendor-dashboard/subscription', icon: Crown, matchPrefix: '/vendor-dashboard/subscription' },
      { key: 'tokens', label: 'Tokens', href: '/vendor-dashboard/tokens', icon: Coins, matchPrefix: '/vendor-dashboard/tokens' },
      { key: 'redeem-code', label: 'Redeem code', href: '/vendor-dashboard/redeem-code', icon: Tag, matchPrefix: '/vendor-dashboard/redeem-code' },
      { key: 'marketing', label: 'Marketing', href: '/vendor-dashboard/marketing', icon: Megaphone, matchPrefix: '/vendor-dashboard/marketing' },
      { key: 'verify', label: 'Verify', href: '/vendor-dashboard/verify', icon: ShieldCheck, matchPrefix: '/vendor-dashboard/verify' },
      {
        // Vendor-to-vendor commercial relationships. Badges are invisible to
        // couples until Setnayan HQ verifies them (two-admin gate).
        key: 'partnerships',
        label: 'Partnerships',
        href: '/vendor-dashboard/partnerships',
        icon: Handshake,
        matchPrefix: '/vendor-dashboard/partnerships',
      },
      { key: 'reviews', label: 'Reviews', href: '/vendor-dashboard/reviews', icon: Star, matchPrefix: '/vendor-dashboard/reviews' },
    ],
  },
  {
    // Content — portfolio and editorial content surfaces.
    key: 'content',
    label: 'Content',
    items: [
      { key: 'real-stories', label: 'Real Stories', href: '/vendor-dashboard/real-stories', icon: Sparkles, matchPrefix: '/vendor-dashboard/real-stories' },
      { key: 'recaps', label: 'Recaps', href: '/vendor-dashboard/recaps', icon: Images, matchPrefix: '/vendor-dashboard/recaps' },
      { key: 'moodboard-library', label: 'Moodboard library', href: '/vendor-dashboard/moodboard-library', icon: Palette, matchPrefix: '/vendor-dashboard/moodboard-library' },
    ],
  },
  {
    // Business — pure money + org/ops. Tax docs retired 2026-05-29 under
    // the V2 publisher posture (Setnayan no longer withholds vendor income
    // tax · no Form 2307 obligation · page redirects to /vendor-dashboard).
    key: 'business',
    label: 'Business',
    items: [
      { key: 'earnings', label: 'Earnings', href: '/vendor-dashboard/earnings', icon: Wallet, matchPrefix: '/vendor-dashboard/earnings' },
      { key: 'payment-options', label: 'How clients pay you', href: '/vendor-dashboard/payment-options', icon: Wallet, matchPrefix: '/vendor-dashboard/payment-options' },
      { key: 'manpower', label: 'Manpower', href: '/vendor-dashboard/manpower', icon: HardHat, matchPrefix: '/vendor-dashboard/manpower' },
      {
        // Branches — Enterprise sub-location accounts (owner-locked 2026-06-05).
        // Owner/admin only: 'branches' is absent from VENDOR_SCOPED_NAV_ITEM_KEYS
        // so filterVendorNavGroups hides it from agents/viewers.
        key: 'branches',
        label: 'Branches',
        href: '/vendor-dashboard/branches',
        icon: Building2,
        matchPrefix: '/vendor-dashboard/branches',
      },
      { key: 'team', label: 'Team & Setnayan', href: '/vendor-dashboard/team', icon: Users, matchPrefix: '/vendor-dashboard/team' },
    ],
  },
];

/**
 * Overlays admin nav-registry label + icon onto each sidebar item via its
 * `vendor.sidebar.<key>` slot (the item key matches the slot suffix 1:1).
 * Fallback = the item's hardcoded default; a hidden slot drops the item; no-op
 * when navSlots is absent (fails open). href/matchPrefix + group structure +
 * role/repertoire gating all stay in code.
 */
function applyVendorRegistry(
  groups: NavGroup[],
  navSlots?: Record<string, NavSlotLite>,
): NavGroup[] {
  if (!navSlots) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const slot = navSlots[`vendor.sidebar.${item.key}`];
      if (!slot) return [item];
      if (slot.isHidden) return [];
      return [{ ...item, label: slot.label, icon: navIconComponent(slot.icon) }];
    }),
  }));
}

/**
 * VendorSidebar — renders the 6 vendor nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark + 'Vendor' eyebrow) so the vendor doorway reads as a
 * separate context from customer + admin doorways. Mirrors the
 * customer-sidebar + admin-sidebar header treatment.
 */
export function VendorSidebar({
  role,
  showRepertoire = true,
  navSlots,
}: {
  role: VendorTeamRole | null;
  showRepertoire?: boolean;
  navSlots?: Record<string, NavSlotLite>;
}) {
  const pathname = usePathname() ?? '/vendor-dashboard';
  // Role-aware nav shell — owner/admin see the full tree; agent/viewer see
  // the scoped subset (Phase 1: Overview only). Single source of truth in
  // lib/vendor-role.ts so Phase 2 expands agent surfaces in one place.
  // Service-aware: Repertoire is a music-act surface (band · singer ·
  // orchestra · choir · DJ) — hidden for every other category (owner
  // directive 2026-06-13; the page keeps its own isMusicVendor gate).
  const groups = applyVendorRegistry(
    filterVendorNavGroups(VENDOR_NAV_GROUPS, role).map((g) =>
      showRepertoire ? g : { ...g, items: g.items.filter((it) => it.key !== 'repertoire') },
    ),
    navSlots,
  );

  return (
    <>
      {/* Brand header — scrolls with the nav rather than being pinned.
          Matches the v2.1 editorial register: Wordmark + 'Vendor' eyebrow
          in m-label-mono. Mirrors admin-sidebar.tsx + customer-sidebar.tsx
          for cross-doorway chrome consistency. */}
      <header className="px-4 pb-4 pt-2 [[data-sidebar-collapsed='1']_&]:hidden">
        <Wordmark className="text-ink" />
        <p
          className="m-label-mono mt-2"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Vendor
        </p>
      </header>

      {groups.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}

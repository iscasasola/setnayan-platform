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
 * 5-item mobile BottomNav lives in vendor-bottom-nav.tsx alongside this
 * file.
 *
 * 6-MENU IA (REORG 2026-07-01 from the 4-group 2026-06-04 layout). This
 * landing ships the 5 existing-route menus; the 6th ("On the Day") arrives
 * with its route in a later phase (orphan-prevention). Item keys/hrefs/
 * matchPrefixes/icons are byte-identical to the 4-group layout — only the
 * grouping changed — so deep-links + the item-key role filter stay valid:
 *   1. Overview (key 'home')         — Overview (/vendor-dashboard root · exact-match)
 *   2. My Shop (key 'shop')          — Profile · Verify · Website · Reviews · Real
 *                      Stories · Recaps · Recommend · Partnerships · Team & Setnayan ·
 *                      Branches · Subscription · Tokens (storefront + reputation +
 *                      account/plan; Subscription/Tokens move to sidebar chrome
 *                      chips in a follow-up · Redeem code hard-deleted 2026-07-01)
 *   3. My Customers (key 'customers') — Messages · Clients · Bookings · Calendar ·
 *                      Contracts · Proposals · Earnings · Payday · How clients pay you
 *                      (booking pipeline + comms + the money that flows from them)
 *   4. My Performance (key 'performance') — Demand Radar · Funnel (analytics + market
 *                      intel · owner/admin only · standalone Performance page joins later)
 *   5. My Services (key 'offerings')  — Services · Attributes · Repertoire · Manpower ·
 *                      Moodboard library (offerings + the specialist tools that set them)
 *   6. On the Day (deferred)         — category-conditional day-of console (later phase)
 *
 * OMITTED PER ORPHAN-PREVENTION RULE — routes the brief enumerated but
 * which DON'T EXIST on disk get dropped per
 * [[feedback_setnayan_orphan_prevention]]: Bids (/vendor-dashboard/bids
 * never landed · v2.1 lead-broker side-branch RETIRED per CLAUDE.md
 * tenth 2026-05-28 row — bids surface in /vendor-dashboard/bookings
 * + per-thread chat) · Calendar (/vendor-dashboard/calendar · Phase E
 * +V1.x · CLAUDE.md 2026-05-24 ninth row Rules 3+5 calendar block
 * primitives shipped to schema but UI deferred) · Settings + Billing
 * (V1.x post-pilot per CLAUDE.md eleventh 2026-05-28 row annual SKU
 * lock — both pending Phase L8). No sidebar entries · no orphan risk.
 *
 * ADDED VS BRIEF for orphan-prevention on existing surfaces: Services
 * (/vendor-dashboard/services) + Attributes (/vendor-dashboard/attributes)
 * land in Pipeline (they set the offerings vendors lock with hosts) ·
 * Reviews (/vendor-dashboard/reviews) + Moodboard library
 * (/vendor-dashboard/moodboard-library) are trust + visibility surfaces.
 * These surfaces exist on disk per the audit + need sidebar entries so they
 * don't orphan after the pill bar retires. (Redeem code was hard-deleted
 * 2026-07-01 under the "no free tokens" money-integrity pass — no entry.)
 *
 * NOTIFICATIONS — surfaced via topbar UnreadBellBadge per the admin
 * pattern (PR #606). Not duplicated in the sidebar — the topbar bell
 * is the canonical entry point for /vendor-dashboard/notifications.
 *
 * BRAND-LAYER per the v2.1 brief: route paths + DB tables stay; sidebar
 * labels read in editorial brand voice. "Team & Setnayan" not "Team"
 * (matches existing 14-tab strip label). "Tax docs" not "Tax Documents"
 * (concise sidebar label preferred at 16rem width).
 *
 * ACTIVE STATE — defers to <SidebarItem>'s default
 * (`pathname === href || pathname.startsWith(matchPrefix + '/')`) for
 * most items. One exception needs exact-match: Profile
 * (`/vendor-dashboard`) — every other vendor route also starts with
 * `/vendor-dashboard/`, so a startsWith match would keep Profile
 * perpetually active. Sentinel matchPrefix `__profile-exact__` so the
 * strict-prefix branch never fires and only `pathname === href` lights
 * the entry. Same pattern as customer Home + admin Overview.
 */

import {
  Home,
  Briefcase,
  CalendarDays,
  CalendarClock,
  ClipboardList,
  FileSignature,
  FileText,
  HardHat,
  MessageSquare,
  Music,
  Palette,
  Radar,
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
  Filter,
  Gauge,
  Lightbulb,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import type { NavGroup } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { filterVendorNavGroups } from '@/lib/vendor-role';
import type { NavSlotLite } from '@/lib/nav-registry-types';

/**
 * Canonical vendor NavGroup[] export. Phases 1-3 of nav refactor each own
 * their own NavGroup[] array; this is the vendor doorway's. Mobile-overflow
 * landing at /vendor-dashboard/more consumes the same group definition via
 * shape introspection — single source of truth.
 *
 * Stable group/item `key` values mean future label edits (e.g., a brand
 * polish pass on "Tax docs" → "Tax & receipts") don't reset the per-section
 * `setnayan.nav.section.<key>.open` localStorage state.
 */
export const VENDOR_NAV_GROUPS: NavGroup[] = [
  // REORG 2026-07-01 — 4 groups → 6-menu IA (Overview · My Shop · My
  // Customers · My Performance · My Services · On the Day). This landing
  // ships the 5 existing-route menus; "On the Day" (6th) arrives with its
  // route in a later phase (orphan-prevention — no nav entry without a
  // page). Every item's key/href/matchPrefix/icon is byte-identical to the
  // 4-group layout — ONLY the grouping changed — so all 900+ deep-links,
  // the role filter (by item key), the /more landing + mobile landing
  // (both derive from this array) stay valid. Group keys are new where the
  // grouping is new (localStorage open-state resets for those sections —
  // cosmetic). Subscription/Tokens sit under My Shop for now; a follow-up
  // moves them to sidebar chrome chips. (Redeem code was hard-deleted
  // 2026-07-01 under the "no free tokens" money-integrity pass.)
  {
    // Overview — the single at-a-glance landing. Sentinel matchPrefix so the
    // strict-prefix branch never fires; every other vendor route begins with
    // `/vendor-dashboard/`, so a default startsWith match would keep Overview
    // perpetually active.
    key: 'home',
    label: 'Overview',
    items: [
      {
        key: 'overview',
        label: 'Overview',
        href: '/vendor-dashboard',
        icon: Home,
        matchPrefix: '__overview-exact__',
      },
    ],
  },
  {
    // My Shop — the vendor's storefront: identity, reputation, network + the
    // account/plan surfaces that run it.
    key: 'shop',
    label: 'My Shop',
    items: [
      { key: 'profile', label: 'Profile', href: '/vendor-dashboard/profile', icon: User, matchPrefix: '/vendor-dashboard/profile' },
      { key: 'verify', label: 'Verify', href: '/vendor-dashboard/verify', icon: ShieldCheck, matchPrefix: '/vendor-dashboard/verify' },
      { key: 'website', label: 'Website', href: '/vendor-dashboard/website', icon: Globe, matchPrefix: '/vendor-dashboard/website' },
      { key: 'reviews', label: 'Reviews', href: '/vendor-dashboard/reviews', icon: Star, matchPrefix: '/vendor-dashboard/reviews' },
      { key: 'real-stories', label: 'Real Stories', href: '/vendor-dashboard/real-stories', icon: Sparkles, matchPrefix: '/vendor-dashboard/real-stories' },
      { key: 'recaps', label: 'Recaps', href: '/vendor-dashboard/recaps', icon: Images, matchPrefix: '/vendor-dashboard/recaps' },
      { key: 'recommendations', label: 'Recommend', href: '/vendor-dashboard/recommendations', icon: Lightbulb, matchPrefix: '/vendor-dashboard/recommendations' },
      { key: 'partnerships', label: 'Partnerships', href: '/vendor-dashboard/partnerships', icon: Handshake, matchPrefix: '/vendor-dashboard/partnerships' },
      { key: 'team', label: 'Team & Setnayan', href: '/vendor-dashboard/team', icon: Users, matchPrefix: '/vendor-dashboard/team' },
      // Branches — Enterprise sub-location accounts. Owner/admin only + the
      // page/actions re-check tier + role server-side.
      { key: 'branches', label: 'Branches', href: '/vendor-dashboard/branches', icon: Building2, matchPrefix: '/vendor-dashboard/branches' },
      { key: 'subscription', label: 'Subscription', href: '/vendor-dashboard/subscription', icon: Crown, matchPrefix: '/vendor-dashboard/subscription' },
      { key: 'tokens', label: 'Tokens', href: '/vendor-dashboard/tokens', icon: Coins, matchPrefix: '/vendor-dashboard/tokens' },
    ],
  },
  {
    // My Customers — the people you work with + the money that flows from
    // them (booking pipeline · comms · contracts · earnings).
    key: 'customers',
    label: 'My Customers',
    items: [
      { key: 'messages', label: 'Messages', href: '/vendor-dashboard/messages', icon: MessageSquare, matchPrefix: '/vendor-dashboard/messages' },
      { key: 'clients', label: 'Clients', href: '/vendor-dashboard/clients', icon: Users, matchPrefix: '/vendor-dashboard/clients' },
      { key: 'bookings', label: 'Bookings', href: '/vendor-dashboard/bookings', icon: Briefcase, matchPrefix: '/vendor-dashboard/bookings' },
      // Schedule-pool surface (owner lock 2026-06-12) — one schedule per
      // service category; the calendar that stops double-bookings.
      { key: 'calendar', label: 'Calendar', href: '/vendor-dashboard/calendar', icon: CalendarDays, matchPrefix: '/vendor-dashboard/calendar' },
      { key: 'contracts', label: 'Contracts', href: '/vendor-dashboard/contracts', icon: FileSignature, matchPrefix: '/vendor-dashboard/contracts' },
      // Data-link program ③ — auto-filled proposals for booked clients.
      { key: 'proposals', label: 'Proposals', href: '/vendor-dashboard/proposals', icon: FileText, matchPrefix: '/vendor-dashboard/proposals' },
      { key: 'earnings', label: 'Earnings', href: '/vendor-dashboard/earnings', icon: Wallet, matchPrefix: '/vendor-dashboard/earnings' },
      // Payday Calendar & Cash-Flow (Wave 4) — installment due-dates across
      // booked events. Owner/admin only — surfaces money figures.
      { key: 'payday', label: 'Payday', href: '/vendor-dashboard/payday', icon: CalendarClock, matchPrefix: '/vendor-dashboard/payday' },
      { key: 'payment-options', label: 'How clients pay you', href: '/vendor-dashboard/payment-options', icon: Wallet, matchPrefix: '/vendor-dashboard/payment-options' },
    ],
  },
  {
    // My Performance — analytics + market intel. Owner/admin only (every key
    // absent from VENDOR_SCOPED_NAV_ITEM_KEYS). The standalone Performance
    // cockpit composes the ROI/health overview; Demand Radar + Funnel are its
    // drill-downs.
    key: 'performance',
    label: 'My Performance',
    items: [
      { key: 'performance', label: 'Overview', href: '/vendor-dashboard/performance', icon: Gauge, matchPrefix: '/vendor-dashboard/performance' },
      { key: 'demand', label: 'Demand Radar', href: '/vendor-dashboard/demand', icon: Radar, matchPrefix: '/vendor-dashboard/demand' },
      { key: 'funnel', label: 'Funnel', href: '/vendor-dashboard/funnel', icon: Filter, matchPrefix: '/vendor-dashboard/funnel' },
    ],
  },
  {
    // My Services — the offerings couples see + the specialist tools that
    // configure them (Repertoire is music-only · gated in code + on the page).
    key: 'offerings',
    label: 'My Services',
    items: [
      { key: 'services', label: 'Services', href: '/vendor-dashboard/services', icon: ClipboardList, matchPrefix: '/vendor-dashboard/services' },
      { key: 'attributes', label: 'Attributes', href: '/vendor-dashboard/attributes', icon: Tag, matchPrefix: '/vendor-dashboard/attributes' },
      { key: 'repertoire', label: 'Repertoire', href: '/vendor-dashboard/repertoire', icon: Music, matchPrefix: '/vendor-dashboard/repertoire' },
      { key: 'manpower', label: 'Manpower', href: '/vendor-dashboard/manpower', icon: HardHat, matchPrefix: '/vendor-dashboard/manpower' },
      { key: 'moodboard-library', label: 'Moodboard library', href: '/vendor-dashboard/moodboard-library', icon: Palette, matchPrefix: '/vendor-dashboard/moodboard-library' },
    ],
  },
];

/**
 * VendorSidebar — renders the 4 vendor nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark + 'Vendor' eyebrow) so the vendor doorway reads as a
 * separate context from customer + admin doorways. Mirrors the
 * customer-sidebar + admin-sidebar header treatment.
 */
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

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
 * 6-MENU IA (REORG 2026-07-01 from the 4-group 2026-06-04 layout). The 6th
 * menu ("On the Day") landed with its route in Phase 7 (2026-07-01) — the
 * /vendor-dashboard/on-the-day category-conditional day-of console. The other
 * five menus keep item keys/hrefs/matchPrefixes/icons byte-identical to the
 * 4-group layout — only the grouping changed — so deep-links + the item-key
 * role filter stay valid:
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
 *   6. On the Day (key 'onday')       — On the Day (/vendor-dashboard/on-the-day ·
 *                      category-conditional day-of console: shot list · command
 *                      center · headcount · setlist. Free surface · Phase 7)
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
  ShoppingBag,
  BarChart2,
  ChevronRight,
  Check,
  Zap,
  Briefcase,
  CalendarCheck,
  CalendarDays,
  CalendarClock,
  FileSignature,
  FileText,
  HardHat,
  MessageSquare,
  Music,
  Palette,
  Radar,
  Globe,
  Scale,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  ListChecks,
  User,
  Users,
  Wallet,
  Coins,
  Crown,
  Building2,
  Images,
  Handshake,
  Gauge,
  Lightbulb,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navIconComponent } from '@/app/_components/nav/nav-icon-component';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import { VendorAvatar } from '@/app/_components/vendor-avatar';
import type { NavGroup, NavBadge } from '@/app/_components/nav/types';
import type { VendorTeamRole } from '@/lib/vendor-team';
import { filterVendorNavGroups, canManageVendor } from '@/lib/vendor-role';
import { TIER_LABEL, asVendorTier, type VendorTier } from '@/lib/vendor-tier-caps';
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
  // Customers · My Performance · My Services · On the Day). "On the Day" (6th)
  // landed with its route in Phase 7 (2026-07-01) — the
  // /vendor-dashboard/on-the-day category-conditional day-of console (its nav
  // entry was added only AFTER the page existed, per orphan-prevention). Every
  // OTHER item's key/href/matchPrefix/icon is byte-identical to the
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
      // Shop overview — the storefront landing (proto-shell 6-menu destination).
      // First item so the /more "My Shop" section leads with it.
      { key: 'shop', label: 'My Shop', href: '/vendor-dashboard/shop', icon: ShoppingBag, matchPrefix: '/vendor-dashboard/shop' },
      // Profile editing + the gallery/video/Instagram media editors consolidated
      // onto My Shop (2026-07-05); the old /vendor-dashboard/profile route now
      // redirects there. Point the item at My Shop so it lands live, not on a
      // redirect hop.
      { key: 'profile', label: 'Profile', href: '/vendor-dashboard/shop', icon: User, matchPrefix: '/vendor-dashboard/profile' },
      { key: 'verify', label: 'Verify', href: '/vendor-dashboard/verify', icon: ShieldCheck, matchPrefix: '/vendor-dashboard/verify' },
      { key: 'website', label: 'Website', href: '/vendor-dashboard/website', icon: Globe, matchPrefix: '/vendor-dashboard/website' },
      { key: 'reviews', label: 'Reviews', href: '/vendor-dashboard/reviews', icon: Star, matchPrefix: '/vendor-dashboard/reviews' },
      // Track record across life events — the per-event-type reputation breakdown
      // (Weddings 12 · ★4.8 / Debuts 3 · ★4.6). A reputation surface → lives under
      // My Shop. Reachable via /more + mobile landing (both derive from this
      // array); the 6 flat desktop destinations stay unchanged.
      { key: 'track-record', label: 'Track record', href: '/vendor-dashboard/track-record', icon: BarChart2, matchPrefix: '/vendor-dashboard/track-record' },
      // Disputes — "stand up for yourself" mediation. A neutral team reviews any
      // dispute filed against your shop before it can touch your rating; you
      // contest + track outcomes here. Reputation surface → lives under My Shop.
      { key: 'disputes', label: 'Disputes', href: '/vendor-dashboard/disputes', icon: Scale, matchPrefix: '/vendor-dashboard/disputes' },
      { key: 'theft-watch', label: 'Theft Watch', href: '/vendor-dashboard/theft-watch', icon: ShieldAlert, matchPrefix: '/vendor-dashboard/theft-watch' },
      { key: 'real-stories', label: 'Real Stories', href: '/vendor-dashboard/real-stories', icon: Sparkles, matchPrefix: '/vendor-dashboard/real-stories' },
      { key: 'recaps', label: 'Recaps', href: '/vendor-dashboard/recaps', icon: Images, matchPrefix: '/vendor-dashboard/recaps' },
      { key: 'recommendations', label: 'Recommend', href: '/vendor-dashboard/recommendations', icon: Lightbulb, matchPrefix: '/vendor-dashboard/recommendations' },
      { key: 'partnerships', label: 'Partnerships', href: '/vendor-dashboard/partnerships', icon: Handshake, matchPrefix: '/vendor-dashboard/partnerships' },
      { key: 'team', label: 'Team & Setnayan', href: '/vendor-dashboard/team', icon: Users, matchPrefix: '/vendor-dashboard/team' },
      // Branches — Enterprise sub-location accounts. Owner/admin only + the
      // page/actions re-check tier + role server-side.
      { key: 'branches', label: 'Branches', href: '/vendor-dashboard/branches', icon: Building2, matchPrefix: '/vendor-dashboard/branches' },
      { key: 'subscription', label: 'Plan & tokens', href: '/vendor-dashboard/subscription', icon: Crown, matchPrefix: '/vendor-dashboard/subscription' },
    ],
  },
  {
    // My Customers — the people you work with + the money that flows from
    // them (booking pipeline · comms · contracts · earnings).
    key: 'customers',
    label: 'My Customers',
    items: [
      // Customers overview — the pipeline landing (proto-shell 6-menu destination).
      // First item so the /more "My Customers" section leads with it.
      { key: 'customers', label: 'My Customers', href: '/vendor-dashboard/customers', icon: Users, matchPrefix: '/vendor-dashboard/customers' },
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
    // absent from VENDOR_SCOPED_NAV_ITEM_KEYS). The Performance cockpit composes
    // the ROI/health overview + booking funnel + by-source breakdown (the old
    // standalone /funnel page was folded in · 2026-07-02); Demand Radar is its
    // remaining drill-down.
    key: 'performance',
    label: 'My Performance',
    items: [
      { key: 'performance', label: 'Overview', href: '/vendor-dashboard/performance', icon: Gauge, matchPrefix: '/vendor-dashboard/performance' },
      { key: 'demand', label: 'Demand Radar', href: '/vendor-dashboard/demand', icon: Radar, matchPrefix: '/vendor-dashboard/demand' },
    ],
  },
  {
    // Service tools — the specialist tools that configure a vendor's offerings
    // (Repertoire is music-only · gated in code + on the page). The Services
    // editor itself was folded into My Shop (2026-07-02) — no 'services' item
    // here; the group keeps its 'offerings' key so section open-state persists.
    key: 'offerings',
    label: 'Service tools',
    items: [
      { key: 'attributes', label: 'Attributes', href: '/vendor-dashboard/attributes', icon: Tag, matchPrefix: '/vendor-dashboard/attributes' },
      { key: 'repertoire', label: 'Repertoire', href: '/vendor-dashboard/repertoire', icon: Music, matchPrefix: '/vendor-dashboard/repertoire' },
      { key: 'manpower', label: 'Manpower', href: '/vendor-dashboard/manpower', icon: HardHat, matchPrefix: '/vendor-dashboard/manpower' },
      { key: 'moodboard-library', label: 'Moodboard library', href: '/vendor-dashboard/moodboard-library', icon: Palette, matchPrefix: '/vendor-dashboard/moodboard-library' },
    ],
  },
  {
    // On the Day — the free, category-conditional day-of console (Phase 7,
    // 2026-07-01). Resolves the vendor's category from their services and shows
    // the matching day-of tool: shot list (photo/video) · command center
    // (coordinator) · headcount (caterer) · setlist (band/DJ), plus the live
    // run-of-show for the event in focus. Ordered LAST per the 6-menu IA.
    key: 'onday',
    label: 'On the Day',
    items: [
      { key: 'on-the-day', label: 'On the Day', href: '/vendor-dashboard/on-the-day', icon: CalendarCheck, matchPrefix: '/vendor-dashboard/on-the-day' },
    ],
  },
];

/**
 * THE DESKTOP SIDEBAR TREE — "Energy, not skin" reskin (2026-07-09).
 *
 * The desktop sidebar renders TWO labelled sections (Business · Grow) matching
 * the `setnayan-vendor-energy.html` prototype. A handful of relabelled PRIMARY
 * rows (Home · Bookings · Services · Threads · My Shop · Growth & Setnayan) each
 * carry the rest of the surfaces as auto-expanding sub-items (SidebarItem's
 * in-section nesting), so NOTHING orphans — every route in the flat canonical
 * `VENDOR_NAV_GROUPS` above also appears here, just grouped + nested.
 *
 * This tree is SEPARATE from `VENDOR_NAV_GROUPS` on purpose: that flat 6-group
 * export still drives the mobile /more landing + `vendor-mobile-landing`, which
 * enumerate every item as a top-level row (mobile reachability). Nesting is a
 * DESKTOP presentation only; the two stay in sync by covering the same route
 * set. Active-state = wine (SidebarItem's shared `--m-nav-active`); the vendor's
 * photography-blue secondary accent lives in the identity card + the Overview
 * body, never replacing the shared wine chrome.
 *
 * REGISTRY: each PRIMARY row keys off a `vendor.sidebar.<key>` slot for the
 * admin label/icon override (nested children keep their code defaults, as the
 * flat destinations did). Keys reuse the canonical item keys 1:1 so deep-links,
 * the role filter (by key), and localStorage section state all stay valid.
 */
const VENDOR_SIDEBAR_TREE: NavGroup[] = [
  {
    // BUSINESS — the day-to-day running of the shop.
    key: 'shell-business',
    label: 'Business',
    items: [
      { key: 'overview', label: 'Home', href: '/vendor-dashboard', icon: Home, matchPrefix: '__overview-exact__' },
      {
        key: 'bookings',
        label: 'Bookings',
        href: '/vendor-dashboard/bookings',
        icon: Briefcase,
        // The booking pipeline + the money that flows from it. Badge (pending
        // inquiries) injected at render from real layout data.
        children: [
          { key: 'customers', label: 'My Customers', href: '/vendor-dashboard/customers', icon: Users, matchPrefix: '/vendor-dashboard/customers' },
          { key: 'clients', label: 'Clients', href: '/vendor-dashboard/clients', icon: Users, matchPrefix: '/vendor-dashboard/clients' },
          { key: 'calendar', label: 'Calendar', href: '/vendor-dashboard/calendar', icon: CalendarDays, matchPrefix: '/vendor-dashboard/calendar' },
          { key: 'contracts', label: 'Contracts', href: '/vendor-dashboard/contracts', icon: FileSignature, matchPrefix: '/vendor-dashboard/contracts' },
          { key: 'proposals', label: 'Proposals', href: '/vendor-dashboard/proposals', icon: FileText, matchPrefix: '/vendor-dashboard/proposals' },
          { key: 'earnings', label: 'Earnings', href: '/vendor-dashboard/earnings', icon: Wallet, matchPrefix: '/vendor-dashboard/earnings' },
          { key: 'payday', label: 'Payday', href: '/vendor-dashboard/payday', icon: CalendarClock, matchPrefix: '/vendor-dashboard/payday' },
          { key: 'payment-options', label: 'How clients pay you', href: '/vendor-dashboard/payment-options', icon: Wallet, matchPrefix: '/vendor-dashboard/payment-options' },
          { key: 'on-the-day', label: 'On the Day', href: '/vendor-dashboard/on-the-day', icon: CalendarCheck, matchPrefix: '/vendor-dashboard/on-the-day' },
        ],
      },
      {
        key: 'services',
        label: 'Services',
        href: '/vendor-dashboard/services',
        icon: ListChecks,
        // The offerings couples book + the specialist tools that configure them.
        children: [
          { key: 'attributes', label: 'Attributes', href: '/vendor-dashboard/attributes', icon: Tag, matchPrefix: '/vendor-dashboard/attributes' },
          { key: 'repertoire', label: 'Repertoire', href: '/vendor-dashboard/repertoire', icon: Music, matchPrefix: '/vendor-dashboard/repertoire' },
          { key: 'manpower', label: 'Manpower', href: '/vendor-dashboard/manpower', icon: HardHat, matchPrefix: '/vendor-dashboard/manpower' },
          { key: 'moodboard-library', label: 'Moodboard library', href: '/vendor-dashboard/moodboard-library', icon: Palette, matchPrefix: '/vendor-dashboard/moodboard-library' },
        ],
      },
      // Threads = the chat inbox (Messages route). Badge (unread threads)
      // injected at render from real layout data.
      { key: 'messages', label: 'Threads', href: '/vendor-dashboard/messages', icon: MessageSquare, matchPrefix: '/vendor-dashboard/messages' },
    ],
  },
  {
    // GROW — reputation, reach, plan. Owner/admin surfaces (dropped for
    // agent/viewer by the role filter, which strips the whole group).
    key: 'shell-grow',
    label: 'Grow',
    items: [
      {
        key: 'shop',
        label: 'My Shop',
        href: '/vendor-dashboard/shop',
        icon: ShoppingBag,
        // Storefront identity + reputation surfaces.
        children: [
          { key: 'profile', label: 'Profile', href: '/vendor-dashboard/profile', icon: User, matchPrefix: '/vendor-dashboard/profile' },
          { key: 'verify', label: 'Verify', href: '/vendor-dashboard/verify', icon: ShieldCheck, matchPrefix: '/vendor-dashboard/verify' },
          { key: 'website', label: 'Website', href: '/vendor-dashboard/website', icon: Globe, matchPrefix: '/vendor-dashboard/website' },
          { key: 'reviews', label: 'Reviews', href: '/vendor-dashboard/reviews', icon: Star, matchPrefix: '/vendor-dashboard/reviews' },
          { key: 'track-record', label: 'Track record', href: '/vendor-dashboard/track-record', icon: BarChart2, matchPrefix: '/vendor-dashboard/track-record' },
          { key: 'disputes', label: 'Disputes', href: '/vendor-dashboard/disputes', icon: Scale, matchPrefix: '/vendor-dashboard/disputes' },
          { key: 'theft-watch', label: 'Theft Watch', href: '/vendor-dashboard/theft-watch', icon: ShieldAlert, matchPrefix: '/vendor-dashboard/theft-watch' },
          { key: 'real-stories', label: 'Real Stories', href: '/vendor-dashboard/real-stories', icon: Sparkles, matchPrefix: '/vendor-dashboard/real-stories' },
          { key: 'recaps', label: 'Recaps', href: '/vendor-dashboard/recaps', icon: Images, matchPrefix: '/vendor-dashboard/recaps' },
          { key: 'recommendations', label: 'Recommend', href: '/vendor-dashboard/recommendations', icon: Lightbulb, matchPrefix: '/vendor-dashboard/recommendations' },
          { key: 'partnerships', label: 'Partnerships', href: '/vendor-dashboard/partnerships', icon: Handshake, matchPrefix: '/vendor-dashboard/partnerships' },
          { key: 'team', label: 'Team & Setnayan', href: '/vendor-dashboard/team', icon: Users, matchPrefix: '/vendor-dashboard/team' },
          { key: 'branches', label: 'Branches', href: '/vendor-dashboard/branches', icon: Building2, matchPrefix: '/vendor-dashboard/branches' },
        ],
      },
      {
        key: 'performance',
        label: 'Growth & Setnayan',
        href: '/vendor-dashboard/performance',
        icon: TrendingUp,
        // Analytics + market intel + the plan/tokens relationship with Setnayan.
        children: [
          { key: 'demand', label: 'Demand Radar', href: '/vendor-dashboard/demand', icon: Radar, matchPrefix: '/vendor-dashboard/demand' },
          { key: 'subscription', label: 'Plan & tokens', href: '/vendor-dashboard/subscription', icon: Crown, matchPrefix: '/vendor-dashboard/subscription' },
        ],
      },
    ],
  },
];

/**
 * Overlays the admin nav-registry label + icon onto each PRIMARY row via its
 * `vendor.sidebar.<key>` slot (the item key matches the slot suffix 1:1).
 * Fallback = the item's hardcoded default; a hidden slot drops the primary; a
 * no-op when navSlots is absent (fails open). Nested children + href/matchPrefix
 * stay in code, mirroring the flat-destination overlay this replaced.
 */
function applyVendorRegistryGroups(
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
 * Injects a live count badge onto a PRIMARY row when the badge map carries a
 * positive number for its key. Real counts only — a 0/undefined entry leaves the
 * row unbadged (the caller omits rather than fakes). Runs AFTER the registry
 * overlay so an admin-renamed label keeps its count.
 */
function applyPrimaryBadges(
  groups: NavGroup[],
  badges: Record<string, NavBadge | undefined>,
): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const badge = badges[item.key];
      return badge && badge.count > 0 ? { ...item, badge } : item;
    }),
  }));
}

/**
 * Strips nested children from every primary row — used for agent/viewer roles so
 * the scoped sidebar shows only their flat primaries (Home · Bookings · Threads)
 * without exposing owner-only sub-surfaces underneath them.
 */
function flattenChildren(groups: NavGroup[]): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map(({ children: _children, ...item }) => item),
  }));
}

/**
 * The vendor identity card — a dark rounded-square avatar (initials) + the
 * business display name + a green "Verified" / muted "Unverified" line. Reads
 * as the prototype's obsidian avatar tile. Hidden on the collapsed 64px rail
 * (no room) via the same data-attr selector the shell uses elsewhere.
 */
function VendorIdentityCard({
  displayName,
  initials,
  logoUrl,
  isVerified,
}: {
  displayName: string;
  initials: string;
  logoUrl: string | null;
  isVerified: boolean;
}) {
  return (
    <div
      className="mx-2 mb-2 flex items-center gap-3 overflow-hidden rounded-xl border p-2.5 [[data-sidebar-collapsed='1']_&]:hidden"
      style={{
        background: 'var(--m-sidebar-bg-2)',
        borderColor: 'var(--m-sidebar-line)',
        // Photography-blue secondary accent (vendor doorway) — a thin left rail
        // so the identity tile reads as the prototype's blue business switcher.
        boxShadow: 'inset 3px 0 0 var(--v-blue)',
      }}
    >
      <span
        className="shrink-0"
        style={{ borderRadius: 'var(--m-r-sm)', boxShadow: '0 0 0 1.5px var(--v-blue)' }}
      >
        <VendorAvatar
          logoUrl={logoUrl}
          initials={initials}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[13px] font-semibold tracking-wide"
        />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--m-sidebar-fg)' }}>
          {displayName}
        </p>
        {isVerified ? (
          <p
            className="mt-0.5 flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--m-sage)' }}
          >
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />
            Verified
          </p>
        ) : (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--m-sidebar-fg-muted)' }}>
            Unverified
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * VendorSidebar — the "Energy, not skin" vendor shell body: the identity card +
 * the two labelled sections (Business · Grow) rendered through the shared
 * <SidebarSection> + <SidebarItem> primitives (wine active-state · nested
 * auto-expanding sub-items · live badges — all inherited from the shared
 * chrome). The brand wordmark + "Vendor" eyebrow + account switcher live in
 * DoorwaySidebarHeader (pinned above by SidebarShell); the subscription chip +
 * token row live in VendorSidebarFooter (pinned below via SidebarShell).
 */
export function VendorSidebar({
  role,
  showRepertoire: _showRepertoire = true,
  navSlots,
  displayName,
  initials,
  logoUrl = null,
  isVerified,
  bookingsBadge = 0,
  threadsBadge = 0,
}: {
  role: VendorTeamRole | null;
  /** Retained for API compatibility; the Service tools nest under the Services
   *  primary, so this remains a no-op here (Repertoire stays reachable). */
  showRepertoire?: boolean;
  navSlots?: Record<string, NavSlotLite>;
  displayName: string;
  initials: string;
  /** Presigned display URL of the uploaded logo — replaces the initials tile. */
  logoUrl?: string | null;
  isVerified: boolean;
  /** Pending-inquiry count → Bookings badge. Real layout data; 0 omits it. */
  bookingsBadge?: number;
  /** Unread-thread count → Threads badge. Real layout data; 0 omits it. */
  threadsBadge?: number;
}) {
  const pathname = usePathname() ?? '/vendor-dashboard';

  // Role-aware: owner/admin see both sections in full; agent/viewer see only the
  // scoped primaries (Home · Bookings · Threads per VENDOR_SCOPED_NAV_ITEM_KEYS)
  // with their owner-only sub-surfaces stripped. filterVendorNavGroups gates by
  // top-level item key + drops empty groups (the whole Grow section falls away
  // for staff); flattenChildren then removes nested rows so staff never see a
  // sub-surface they can't open.
  const isManager = canManageVendor(role);
  const scoped = filterVendorNavGroups(VENDOR_SIDEBAR_TREE, role);
  const roleGated = isManager ? scoped : flattenChildren(scoped);

  // Registry label/icon overrides → live badges (real counts only) onto the
  // primaries. Badge tone 'orange' = the shared brand-accent pill.
  const groups = applyPrimaryBadges(
    applyVendorRegistryGroups(roleGated, navSlots),
    {
      bookings: bookingsBadge > 0
        ? { count: bookingsBadge, tone: 'orange', label: `${bookingsBadge} new inquiries` }
        : undefined,
      messages: threadsBadge > 0
        ? { count: threadsBadge, tone: 'orange', label: `${threadsBadge} unread threads` }
        : undefined,
    },
  );

  return (
    <div className="pt-1">
      <VendorIdentityCard
        displayName={displayName}
        initials={initials}
        logoUrl={logoUrl}
        isVerified={isVerified}
      />
      <nav aria-label="Vendor menu">
        {groups.map((group) => (
          <SidebarSection key={group.key} group={group} pathname={pathname}>
            {group.items.map((item) => (
              <SidebarItem key={item.key} item={item} pathname={pathname} />
            ))}
          </SidebarSection>
        ))}
      </nav>
    </div>
  );
}

/**
 * VendorSidebarFooter — the prototype's pinned footer, passed to
 * <SidebarShell sidebarFooter>. Two rows, BOTH linking to the unified Plan &
 * tokens hub (/vendor-dashboard/subscription):
 *   1. Plan chip — a gold "Pro" pill (tier label · Free shows "Free") +
 *      "Plan & tokens" label.
 *   2. Token balance row — "Your tokens ◎ N" (Coins icon + balance).
 * SidebarShell hides this whole slot when the sidebar collapses to the 64px rail.
 */
export function VendorSidebarFooter({
  tier,
  tokenBalance,
}: {
  tier: string | null;
  tokenBalance: number;
}) {
  const normalizedTier: VendorTier = asVendorTier(tier);
  const tierLabel = TIER_LABEL[normalizedTier];
  const numberFormat = new Intl.NumberFormat('en-PH');

  return (
    <div className="flex flex-col gap-2">
      {/* Plan chip — whole row links to the Plan & tokens hub */}
      <Link
        href="/vendor-dashboard/subscription"
        className="flex items-center gap-2 rounded-xl border p-2.5 transition-colors hover:bg-[var(--m-sidebar-hover)]"
        style={{ background: 'var(--m-sidebar-bg-2)', borderColor: 'var(--m-sidebar-line)' }}
      >
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: 'var(--m-orange-4)',
            border: '1px solid var(--m-orange-3)',
            color: 'var(--m-orange-2)',
          }}
        >
          <Zap aria-hidden className="h-3 w-3" strokeWidth={2} />
          {tierLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--m-sidebar-fg-soft)' }}>
          Plan &amp; tokens
        </span>
        <ChevronRight
          aria-hidden
          className="ml-auto h-3.5 w-3.5 shrink-0"
          strokeWidth={2}
          style={{ color: 'var(--m-sidebar-fg)' }}
        />
      </Link>

      {/* Token balance row — also lands on the unified Plan & tokens hub */}
      <Link
        href="/vendor-dashboard/subscription"
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-[var(--m-sidebar-hover)]"
        style={{ background: 'var(--m-sidebar-bg-2)', borderColor: 'var(--m-sidebar-line)', color: 'var(--m-sidebar-fg-soft)' }}
      >
        <Coins aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange)' }} />
        <span>Your tokens</span>
        <span className="ml-auto font-semibold" style={{ color: 'var(--m-sidebar-fg)' }}>
          {numberFormat.format(tokenBalance)}
        </span>
      </Link>
    </div>
  );
}

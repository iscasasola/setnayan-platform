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
    // ── THE 5-PAGE IA (owner-locked 2026-07-12: "overview, my shop, my
    // customers, my performance, BEO are all 1-page each with the different
    // features integrated on that page"). The desktop sidebar is now exactly
    // the mobile bottom nav's five destinations — every former child surface
    // lives as a tab (or a More-tools card) INSIDE its hub, and the old
    // routes redirect in with params preserved. Do NOT re-add children here;
    // extend the hub's tab strip instead (customers/shop/performance page.tsx).
    key: 'home',
    label: 'Menu',
    items: [
      {
        // Sentinel matchPrefix so the strict-prefix branch never fires —
        // every other vendor route begins with `/vendor-dashboard/`, so a
        // default startsWith match would keep Overview perpetually active.
        key: 'overview',
        label: 'Overview',
        href: '/vendor-dashboard',
        icon: Home,
        matchPrefix: '__overview-exact__',
      },
      { key: 'shop', label: 'My Shop', href: '/vendor-dashboard/shop', icon: ShoppingBag, matchPrefix: '/vendor-dashboard/shop' },
      { key: 'customers', label: 'My Customers', href: '/vendor-dashboard/customers', icon: Users, matchPrefix: '/vendor-dashboard/customers' },
      { key: 'performance', label: 'My Performance', href: '/vendor-dashboard/performance', icon: Gauge, matchPrefix: '/vendor-dashboard/performance' },
      { key: 'on-the-day', label: 'On the Day (BEO)', href: '/vendor-dashboard/on-the-day', icon: CalendarCheck, matchPrefix: '/vendor-dashboard/on-the-day' },
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
    // ── THE 5-PAGE IA (owner-locked 2026-07-12: "overview, my shop, my
    // customers, my performance, BEO are all 1-page each with the different
    // features integrated on that page"). Desktop now mirrors the mobile
    // bottom nav exactly — five destinations, no nested children. Every
    // former sub-surface lives as a tab (or More-tools card) INSIDE its hub:
    //   My Customers → pipeline · Bookings · Clients · Calendar · Payday · Messages
    //   My Shop      → home (profile·services·verify·website) · Contracts ·
    //                  Proposals · Earnings · How clients pay you · Manpower · tools
    //   My Performance → overview · Demand Radar
    // Old routes redirect in with params preserved. Do NOT re-add children
    // here; extend the hub tab strips instead (customers/shop/performance).
    key: 'shell-business',
    label: 'Menu',
    items: [
      {
        // Sentinel matchPrefix so the strict-prefix branch never fires —
        // a startsWith '/vendor-dashboard' match would keep this always lit.
        key: 'overview',
        label: 'Overview',
        href: '/vendor-dashboard',
        icon: Home,
        matchPrefix: '__overview-exact__',
      },
      { key: 'shop', label: 'My Shop', href: '/vendor-dashboard/shop', icon: ShoppingBag, matchPrefix: '/vendor-dashboard/shop' },
      { key: 'customers', label: 'My Customers', href: '/vendor-dashboard/customers', icon: Users, matchPrefix: '/vendor-dashboard/customers' },
      { key: 'performance', label: 'My Performance', href: '/vendor-dashboard/performance', icon: Gauge, matchPrefix: '/vendor-dashboard/performance' },
      { key: 'on-the-day', label: 'On the Day (BEO)', href: '/vendor-dashboard/on-the-day', icon: CalendarCheck, matchPrefix: '/vendor-dashboard/on-the-day' },
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
 * VendorSidebar — the "Energy, not skin" vendor shell body: the two labelled
 * sections (Business · Grow) rendered through the shared <SidebarSection> +
 * <SidebarItem> primitives (wine active-state · nested auto-expanding
 * sub-items · live badges — all inherited from the shared chrome). The brand
 * wordmark home-link + "Vendor" eyebrow + the business identity plaque (the
 * account-menu SwitcherPlaqueTrigger — Plaque-as-Menu council verdict
 * 2026-07-16, which retired the old in-body VendorIdentityCard div) live in
 * DoorwaySidebarHeader (pinned above by SidebarShell); the subscription chip +
 * token row live in VendorSidebarFooter (pinned below via SidebarShell).
 */
export function VendorSidebar({
  role,
  showRepertoire = true,
  navSlots,
  bookingsBadge = 0,
  threadsBadge = 0,
}: {
  role: VendorTeamRole | null;
  /** Music-only gate (owner directive 2026-06-13): when false, the nested
   *  'repertoire' tool is filtered out of the Services primary so non-music
   *  vendors don't dead-end on the "for music acts" explainer. Mirrors the
   *  top-level filter in vendor-dashboard/more/page.tsx. */
  showRepertoire?: boolean;
  navSlots?: Record<string, NavSlotLite>;
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

  // Repertoire is a music-only tool (owner directive 2026-06-13): drop the
  // nested 'repertoire' child from the Services primary for non-music vendors so
  // they don't dead-end on the "for music acts" explainer. Mirrors the top-level
  // filter in vendor-dashboard/more/page.tsx. (Staff already had their children
  // stripped by flattenChildren above, so this is a no-op for them.)
  const repertoireGated = showRepertoire
    ? roleGated
    : roleGated.map((group) => ({
        ...group,
        items: group.items.map((item) =>
          item.children
            ? { ...item, children: item.children.filter((c) => c.key !== 'repertoire') }
            : item,
        ),
      }));

  // Registry label/icon overrides → live badges (real counts only) onto the
  // primaries. Badge tone 'orange' = the shared brand-accent pill.
  const groups = applyPrimaryBadges(
    applyVendorRegistryGroups(repertoireGated, navSlots),
    {
      // Both live counts land on My Customers — the hub that now contains
      // the booking pipeline AND the message threads (5-page IA 2026-07-12).
      customers: bookingsBadge + threadsBadge > 0
        ? {
            count: bookingsBadge + threadsBadge,
            tone: 'orange',
            label: `${bookingsBadge} new inquiries · ${threadsBadge} unread threads`,
          }
        : undefined,
    },
  );

  return (
    <div className="pt-1">
      <nav aria-label="Vendor menu">
        {groups.map((group) => (
          // `eyebrow` — Glass PR-6: section labels render as `.sn-eye` gold
          // eyebrows, matching the couple rail's shipped treatment (PR-2).
          <SidebarSection key={group.key} group={group} pathname={pathname} eyebrow>
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
 * <SidebarShell sidebarFooter>. One row linking to the Plan hub
 * (/vendor-dashboard/subscription): a gold "Pro" pill (tier label · Free shows
 * "Free") + "Plan" label, with the vendor's retained token balance right-aligned
 * (tokens are retired — the balance is read-only, nothing spends them).
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
      {/* ONE Plan & tokens row (deduped 2026-07-16 — was two adjacent rows both
          linking to /subscription): tier pill + label on the left, the live
          token balance right-aligned. */}
      <Link
        href="/vendor-dashboard/subscription"
        className="flex items-center gap-2 rounded-xl border p-2.5 transition-colors hover:bg-[var(--m-sidebar-hover)]"
        style={{ background: 'var(--m-sidebar-bg-2)', borderColor: 'var(--m-sidebar-line)' }}
      >
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            // This chip lives INSIDE `.sn-sidebar` (the obsidian panel), where
            // globals.css remaps `--m-orange-2 → --m-orange-3` (light champagne,
            // for the AccountSwitcher initials). The old light-cream fill
            // (`--m-orange-4`) + that now-light text read ~1.34:1 (invisible).
            // Recolour FOR the dark panel: a translucent gold fill lets the
            // light `--m-orange-2` text/icon land ~6.4:1 on the obsidian tile.
            background: 'color-mix(in srgb, var(--m-orange) 22%, transparent)',
            border: '1px solid color-mix(in srgb, var(--m-orange) 45%, transparent)',
            color: 'var(--m-orange-2)',
          }}
        >
          <Zap aria-hidden className="h-3 w-3" strokeWidth={2} />
          {tierLabel}
        </span>
        <span className="text-xs" style={{ color: 'var(--m-sidebar-fg-soft)' }}>
          Plan
        </span>
        <span
          className="ml-auto inline-flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--m-sidebar-fg)' }}
          title={`${numberFormat.format(tokenBalance)} tokens`}
        >
          <Coins aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange)' }} />
          {numberFormat.format(tokenBalance)}
        </span>
      </Link>
    </div>
  );
}

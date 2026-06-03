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
 * 6 GROUPS (per the Nav Phase 2 brief + on-disk route audit):
 *   1. Home          — Profile (/vendor-dashboard root · activeMatchExact)
 *   2. Pipeline      — Bookings · Contracts · Services · Attributes (4 —
 *                      the surfaces that drive vendor → host commitments)
 *   3. Communicate   — Messages (single chat surface — Bell badge stays
 *                      in topbar via UnreadBellBadge, not duplicated here)
 *   4. Marketing     — Marketing · Verify · Reviews · Moodboard library (4)
 *   5. Money         — Earnings · Tokens · Manpower · Redeem code (4 —
 *                      Tax docs retired 2026-05-29 under V2 publisher
 *                      posture · Setnayan no longer withholds vendor
 *                      income tax · no Form 2307 obligation toward vendors)
 *   6. Team          — Team & Setnayan (1)
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
 * (/vendor-dashboard/moodboard-library) land in Marketing (both are
 * trust + visibility surfaces) · Redeem code (/vendor-dashboard/redeem-code)
 * lands in Money (token redemption · sits with Tokens). All 6 surfaces
 * exist on disk per the audit + need sidebar entries so they don't
 * orphan after the pill bar retires.
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
  ClipboardList,
  FileSignature,
  HardHat,
  Megaphone,
  MessageSquare,
  Music,
  Palette,
  ShieldCheck,
  Star,
  Tag,
  User,
  Users,
  Wallet,
  Coins,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import type { NavGroup } from '@/app/_components/nav/types';

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
  {
    key: 'home',
    label: 'Home',
    items: [
      {
        // 2026-05-29 vendor home overview ship — /vendor-dashboard root
        // route now renders the Overview (welcome header + stat tiles
        // + upcoming events + recent activity). Profile editor moved to
        // /vendor-dashboard/profile in the same PR.
        //
        // Sentinel matchPrefix so the strict-prefix branch never fires;
        // every other vendor route begins with `/vendor-dashboard/`, so
        // a default startsWith match would keep Overview perpetually
        // active. Mirrors the Home/Overview exact-match pattern from
        // customer-sidebar.tsx + admin-bottom-nav.tsx.
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
    ],
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    items: [
      {
        key: 'bookings',
        label: 'Bookings',
        href: '/vendor-dashboard/bookings',
        icon: Briefcase,
        matchPrefix: '/vendor-dashboard/bookings',
      },
      {
        key: 'contracts',
        label: 'Contracts',
        href: '/vendor-dashboard/contracts',
        icon: FileSignature,
        matchPrefix: '/vendor-dashboard/contracts',
      },
      {
        key: 'services',
        label: 'Services',
        href: '/vendor-dashboard/services',
        icon: ClipboardList,
        matchPrefix: '/vendor-dashboard/services',
      },
      {
        key: 'attributes',
        label: 'Attributes',
        href: '/vendor-dashboard/attributes',
        icon: Tag,
        matchPrefix: '/vendor-dashboard/attributes',
      },
      {
        // Music acts (band / choir / orchestra / singer / DJ) build their song
        // set list here — the master-songlist compatibility signal. The page
        // gates non-music vendors with an explainer; nav-level hiding TODO.
        key: 'repertoire',
        label: 'Repertoire',
        href: '/vendor-dashboard/repertoire',
        icon: Music,
        matchPrefix: '/vendor-dashboard/repertoire',
      },
    ],
  },
  {
    key: 'communicate',
    label: 'Communicate',
    items: [
      {
        key: 'messages',
        label: 'Messages',
        href: '/vendor-dashboard/messages',
        icon: MessageSquare,
        matchPrefix: '/vendor-dashboard/messages',
      },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    items: [
      {
        key: 'marketing',
        label: 'Marketing',
        href: '/vendor-dashboard/marketing',
        icon: Megaphone,
        matchPrefix: '/vendor-dashboard/marketing',
      },
      {
        key: 'verify',
        label: 'Verify',
        href: '/vendor-dashboard/verify',
        icon: ShieldCheck,
        matchPrefix: '/vendor-dashboard/verify',
      },
      {
        key: 'reviews',
        label: 'Reviews',
        href: '/vendor-dashboard/reviews',
        icon: Star,
        matchPrefix: '/vendor-dashboard/reviews',
      },
      {
        key: 'moodboard-library',
        label: 'Moodboard library',
        href: '/vendor-dashboard/moodboard-library',
        icon: Palette,
        matchPrefix: '/vendor-dashboard/moodboard-library',
      },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    items: [
      {
        key: 'earnings',
        label: 'Earnings',
        href: '/vendor-dashboard/earnings',
        icon: Wallet,
        matchPrefix: '/vendor-dashboard/earnings',
      },
      {
        // Phase C #621 — vendor token wallet surface. Reads vendor_wallets
        // + earned_token_vouchers + token_grants_log + token_redemptions_log
        // per CLAUDE.md 2026-05-28 third row V2 architectural pivot.
        key: 'tokens',
        label: 'Tokens',
        href: '/vendor-dashboard/tokens',
        icon: Coins,
        matchPrefix: '/vendor-dashboard/tokens',
      },
      {
        // Phase F #618 — Manpower ₱15k offline cash flow per CLAUDE.md
        // 2026-05-28 third row § (a). 2-token handshake on accept · cash
        // flows direct host → crew · BIR-exempt for Setnayan per RR 16-2023.
        key: 'manpower',
        label: 'Manpower',
        href: '/vendor-dashboard/manpower',
        icon: HardHat,
        matchPrefix: '/vendor-dashboard/manpower',
      },
      // RETIRED 2026-05-29 · Vendor "Tax docs" entry removed under V2
      // publisher posture per CLAUDE.md tenth 2026-05-28 row. The only
      // document Setnayan ever issued vendors was Form 2307 for withheld
      // income tax, and Setnayan no longer withholds vendor income tax
      // under V2 (no booking commission · no payout intermediation per RR
      // 16-2023 1% Intermediary Tax exemption). Vendors handle their own
      // Form 2307 as the income recipient. Page redirects to /vendor-
      // dashboard for bookmark continuity.
      {
        // Vendor-side token-pack redemption surface — sits with Tokens
        // in the Money group so the redemption + balance view are one
        // tap apart.
        key: 'redeem-code',
        label: 'Redeem code',
        href: '/vendor-dashboard/redeem-code',
        icon: Tag,
        matchPrefix: '/vendor-dashboard/redeem-code',
      },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    items: [
      {
        key: 'team',
        label: 'Team & Setnayan',
        href: '/vendor-dashboard/team',
        icon: Users,
        matchPrefix: '/vendor-dashboard/team',
      },
    ],
  },
];

/**
 * VendorSidebar — renders the 6 vendor nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark + 'Vendor' eyebrow) so the vendor doorway reads as a
 * separate context from customer + admin doorways. Mirrors the
 * customer-sidebar + admin-sidebar header treatment.
 */
export function VendorSidebar() {
  const pathname = usePathname() ?? '/vendor-dashboard';

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

      {VENDOR_NAV_GROUPS.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}

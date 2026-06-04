'use client';

/**
 * AdminSidebar — v2.1 Navigation Phase 3 (admin doorway).
 *
 * WHY: CLAUDE.md 2026-05-23 row 2 locks the 28-surface admin console
 * grouped into 8 canonical categories per iteration 0023 § 1. Pre-Phase 3
 * the admin chrome rendered a horizontal pill bar via
 * apps/web/app/admin/_components/admin-nav.tsx (lines 19-110 · 8 groups +
 * 1 leaf rendered as portal-based dropdowns). The CLAUDE.md 2026-05-28
 * 11th + 14th rows + the v2.1 brief canonical lock (10th 2026-05-28 row)
 * established a coherent sidebar treatment across the 3 doorways using
 * the shared primitives shipped via PR #603.
 *
 * This file owns the NavGroup[] array consumed by SidebarShell +
 * SidebarSection + SidebarItem from @/app/_components/nav/*. It is the
 * single source of truth for admin nav structure on desktop. The 5-item
 * mobile BottomNav lives in admin-bottom-nav.tsx alongside this file.
 *
 * 8 GROUPS (per 0023 § 1 canonical structure):
 *   1. Home       — Overview (/admin)
 *   2. Queues     — Payments · Verify · Disputes · Force majeure ·
 *                   Reviews · Help · Concierge abuse (7 surfaces)
 *   3. Directory  — Users · Vendors · Demo vendors · Events · Venues (5)
 *   4. Money      — Pricing · Discount codes · Add-ons · Payouts ·
 *                   Receipts · Payment methods (6 — BIR 2307 retired
 *                   2026-05-29 under V2 publisher posture · Payment
 *                   methods de-duplicated from Settings group per brief)
 *   5. Content    — Brain · Moodboard library · Taxonomy · Website · Ads (5)
 *   6. Operations — Operations & Hiring · Telemetry · Offline daemon (3 —
 *                   Telemetry + Offline are FORWARD-REFERENCE entries for
 *                   parallel Phase E + Phase G sprints; routes 404 until
 *                   those PRs land)
 *   7. Funnels    — Funnels (/admin/funnels) (1)
 *   8. Settings   — Settings · Demo mode (2 — Demo mode kept here so it
 *                   stays reachable post-restructure since /admin/settings
 *                   page.tsx doesn't currently link to it)
 *
 * PAYMENT METHODS DEDUP: the existing admin-nav.tsx surfaced
 * /admin/settings/payment-methods in BOTH Money + Settings groups per
 * iteration 0023 § 1 dual-location note. The Phase 3 brief explicitly
 * drops the Settings duplicate and keeps the Money location only. This
 * eliminates the confusion vector + matches the "money + trust + recourse"
 * cluster reading of the Money group.
 *
 * BRAND-LAYER RENAME 2026-05-28 V2 CUTOVER: Concierge abuse remains as
 * an admin label per PR #579 ("Today's Focus abuse") because the route
 * path + DB table names (concierge_abuse_flags) stayed for bookmark +
 * audit-history continuity. We label the sidebar entry "Today's Focus
 * abuse" to match the V2 brand surface (CLAUDE.md 10th 2026-05-28 row
 * v2.1 brief canonical lock).
 */

import {
  Home,
  Banknote,
  BadgeCheck,
  Shield,
  AlertOctagon,
  Star,
  LifeBuoy,
  Flag,
  Users,
  Briefcase,
  TestTube,
  CalendarDays,
  MapPin,
  Church,
  BookOpen,
  DollarSign,
  Tag as TagIcon,
  Sparkles,
  Receipt,
  CreditCard,
  Brain,
  Palette,
  Tag,
  Globe,
  Megaphone,
  Music,
  TrendingUp,
  Activity,
  WifiOff,
  BarChart3,
  LineChart,
  Settings,
  Wallet,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Wordmark } from '@/app/_components/brand-marks';
import { SidebarSection } from '@/app/_components/nav/sidebar-section';
import { SidebarItem } from '@/app/_components/nav/sidebar-item';
import type { NavGroup } from '@/app/_components/nav/types';

/**
 * Canonical admin NavGroup[] export. Phases 1-3 of nav refactor each own
 * their own NavGroup[] array; this is the admin doorway's. Mobile-overflow
 * landing pages at /admin/queues + /admin/directory + /admin/money +
 * /admin/more consume the same group definitions via shape introspection.
 *
 * Stable group/item `key` values mean future label edits (e.g., Concierge →
 * Today's Focus brand swap) don't reset the per-section
 * setnayan.nav.section.<key>.open localStorage state.
 */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    key: 'home',
    label: 'Home',
    items: [
      {
        key: 'overview',
        label: 'Overview',
        href: '/admin',
        icon: Home,
      },
    ],
  },
  {
    key: 'queues',
    label: 'Queues',
    items: [
      {
        key: 'payments',
        label: 'Payments',
        href: '/admin/payments',
        icon: Banknote,
        // matchPrefix so /admin/payments/<orderId> + future sub-routes
        // (e.g., /admin/payments/disputes-from-reconciliation) still light
        // up the Payments entry.
        matchPrefix: '/admin/payments',
      },
      {
        // Vendor off-platform payment-options moderation (fraud screen for
        // vendor-published bank/QR/link payment destinations). Setnayan never
        // holds the money — approving only screens links/QRs before couples
        // see them.
        key: 'payment-options',
        label: 'Payment options',
        href: '/admin/payment-options',
        icon: CreditCard,
        matchPrefix: '/admin/payment-options',
      },
      {
        key: 'verify',
        label: 'Verify',
        href: '/admin/verify',
        icon: BadgeCheck,
        // /admin/verify/[id] V1.x detail surface from CLAUDE.md
        // 2026-05-28 14th row § 5 GREEN list — sidebar item bridges
        // forward-reference when the detail route lands.
        matchPrefix: '/admin/verify',
      },
      {
        key: 'disputes',
        label: 'Disputes',
        href: '/admin/disputes',
        icon: Shield,
        // /admin/disputes/[disputeId] V1.x detail page deferred per
        // CLAUDE.md 2026-05-28 14th row § 5 GREEN list. matchPrefix
        // bridges forward-reference.
        matchPrefix: '/admin/disputes',
      },
      {
        key: 'force-majeure',
        label: 'Force majeure',
        href: '/admin/force-majeure',
        icon: AlertOctagon,
        matchPrefix: '/admin/force-majeure',
      },
      {
        key: 'reviews',
        label: 'Reviews',
        href: '/admin/reviews',
        icon: Star,
      },
      {
        key: 'help',
        label: 'Help',
        href: '/admin/help',
        icon: LifeBuoy,
      },
      {
        key: 'concierge-abuse',
        // Brand-layer label per CLAUDE.md 2026-05-28 5th row PR #579
        // brand-layer rename — route + DB table names stay.
        label: "Today's Focus abuse",
        href: '/admin/concierge-abuse',
        icon: Flag,
      },
    ],
  },
  {
    key: 'directory',
    label: 'Directory',
    items: [
      {
        key: 'users',
        label: 'Users',
        href: '/admin/users',
        icon: Users,
      },
      {
        key: 'vendors',
        label: 'Vendors',
        href: '/admin/vendors',
        icon: Briefcase,
        // /admin/vendors/<id>/edit reachable from list — matchPrefix
        // keeps Vendors lit on the detail surface.
        matchPrefix: '/admin/vendors',
      },
      {
        key: 'demo-vendors',
        label: 'Demo vendors',
        href: '/admin/demo-vendors',
        icon: TestTube,
        // Keep "Demo vendors" lit on the /admin/demo-vendors/inquiries responder.
        matchPrefix: '/admin/demo-vendors',
      },
      {
        key: 'events',
        label: 'Events',
        href: '/admin/events',
        icon: CalendarDays,
        matchPrefix: '/admin/events',
      },
      {
        key: 'venues',
        label: 'Venues',
        href: '/admin/venues',
        icon: MapPin,
        // /admin/venues/[id] + /admin/venues/new both reached from list —
        // matchPrefix keeps Venues lit on detail + create surfaces.
        matchPrefix: '/admin/venues',
      },
      {
        // Per-religion launch gate (iteration 0043) — readiness counts +
        // open/coming-soon/disable. Sits in Directory next to Venues since
        // it reads the same supply (vendors + ceremonial venues).
        key: 'wedding-types',
        label: 'Wedding types',
        href: '/admin/wedding-types',
        icon: Church,
      },
      {
        // Per-religion traditions content (iteration 0043) — the editable
        // "What to expect" guide shown on each couple's /paperwork page.
        key: 'wedding-traditions',
        label: 'Wedding traditions',
        href: '/admin/wedding-traditions',
        icon: BookOpen,
      },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    items: [
      {
        key: 'pricing',
        label: 'Pricing',
        href: '/admin/pricing',
        icon: DollarSign,
      },
      {
        key: 'discount-codes',
        label: 'Discount codes',
        href: '/admin/discount-codes',
        icon: TagIcon,
        matchPrefix: '/admin/discount-codes',
      },
      {
        key: 'addons',
        label: 'Add-ons',
        href: '/admin/addons',
        icon: Sparkles,
      },
      {
        key: 'payouts',
        label: 'Payouts',
        href: '/admin/payouts',
        icon: Wallet,
      },
      {
        key: 'receipts',
        label: 'Receipts',
        href: '/admin/receipts',
        icon: Receipt,
      },
      // RETIRED 2026-05-29 · BIR Form 2307 (Certificate of Creditable Tax
      // Withheld at Source) entry retired under V2 publisher posture per
      // CLAUDE.md tenth 2026-05-28 row (v2.1 brief canonical lock) + V2
      // Phase F manpower § "Setnayan has NO BIR 2307 / EWT obligation
      // under RR 16-2023 1% Intermediary Tax exemption." Setnayan no longer
      // sits in the booking-money path · doesn't withhold vendor tax ·
      // doesn't issue 2307. Page redirects to /admin/money for bookmark
      // continuity. Lib + table preserved as audit history.
      {
        // Payment methods de-duplicated from Settings group per brief.
        // Canonical home is Money (the data IS money — vendor payouts +
        // customer payment instructions both consume it).
        key: 'payment-methods',
        label: 'Payment methods',
        href: '/admin/settings/payment-methods',
        icon: CreditCard,
      },
    ],
  },
  {
    // REMAP 2026-06-04 — admin groups 8 → 6 for a simpler console.
    // "Insights" now also absorbs the old Operations group (Operations &
    // Hiring · Telemetry · Offline daemon) — all analytics/ops monitoring.
    // Group KEY stays 'funnels' so persisted open-state survives; item keys
    // unchanged so no surface orphans on the mobile More landing.
    key: 'funnels',
    label: 'Insights',
    items: [
      {
        key: 'growth',
        label: 'Growth',
        href: '/admin/growth',
        icon: LineChart,
        matchPrefix: '/admin/growth',
      },
      {
        key: 'funnels',
        label: 'Funnels',
        href: '/admin/funnels',
        icon: BarChart3,
      },
      {
        key: 'operations-hiring',
        label: 'Operations & Hiring',
        href: '/admin/operations-hiring',
        icon: TrendingUp,
      },
      {
        // FORWARD-REFERENCE until the Phase E telemetry sprint lands.
        key: 'telemetry',
        label: 'Telemetry',
        href: '/admin/telemetry',
        icon: Activity,
      },
      {
        // FORWARD-REFERENCE until the Phase G offline-daemon sprint lands.
        key: 'offline',
        label: 'Offline daemon',
        href: '/admin/offline',
        icon: WifiOff,
      },
    ],
  },
  {
    // REMAP 2026-06-04 — "Manage" merges the old Content + Settings groups
    // (low-traffic config: catalogs, marketing site, platform settings).
    // Group KEY stays 'content' for open-state continuity; item keys
    // unchanged. Collapsed by default to keep higher-traffic groups above
    // the fold.
    key: 'content',
    label: 'Manage',
    defaultOpen: false,
    items: [
      {
        key: 'taxonomy',
        label: 'Taxonomy',
        href: '/admin/taxonomy',
        icon: Tag,
      },
      {
        key: 'website',
        label: 'Website',
        href: '/admin/website',
        icon: Globe,
      },
      {
        key: 'ads',
        label: 'Ads',
        href: '/admin/ads',
        icon: Megaphone,
      },
      {
        // Brand-layer label per CLAUDE.md 2026-05-28 brand cutover.
        key: 'brain',
        label: "Today's Focus brain",
        href: '/admin/brain',
        icon: Brain,
      },
      {
        key: 'moodboard-library',
        label: 'Moodboard library',
        href: '/admin/moodboard-library',
        icon: Palette,
      },
      {
        key: 'songs',
        label: 'Songs',
        href: '/admin/songs',
        icon: Music,
        matchPrefix: '/admin/songs',
      },
      {
        key: 'settings',
        label: 'Settings',
        href: '/admin/settings',
        icon: Settings,
        // /admin/settings/payment-methods lives under Money — exclude it
        // from the Settings matchPrefix so the Money entry stays lit when
        // viewing payment methods.
        matchPrefix: '/admin/settings',
      },
      {
        // Kept reachable post-restructure per orphan-prevention.
        key: 'demo-mode',
        label: 'Demo mode',
        href: '/admin/settings/demo-mode',
        icon: Settings,
      },
    ],
  },
];

/**
 * AdminSidebar — renders the 8 admin nav groups using the shared
 * SidebarSection + SidebarItem primitives. Wraps with a brand header
 * (Wordmark) so the admin doorway reads as a separate context from
 * customer + vendor doorways.
 */
export function AdminSidebar() {
  const pathname = usePathname() ?? '/admin';

  return (
    <>
      {/* Brand header — sits inside the sidebar's scrollable section so it
          scrolls with the nav rather than being pinned. Matches the v2.1
          editorial register: Wordmark + 'Admin' eyebrow in m-label-mono. */}
      <header className="px-4 pb-4 pt-2 [[data-sidebar-collapsed='1']_&]:hidden">
        <Wordmark className="text-ink" />
        <p
          className="m-label-mono mt-2"
          style={{ color: 'var(--m-slate-2)' }}
        >
          Admin
        </p>
      </header>

      {ADMIN_NAV_GROUPS.map((group) => (
        <SidebarSection key={group.key} group={group} pathname={pathname}>
          {group.items.map((item) => (
            <SidebarItem key={item.key} item={item} pathname={pathname} />
          ))}
        </SidebarSection>
      ))}
    </>
  );
}
